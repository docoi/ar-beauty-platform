// src/components/TryOnRenderer.jsx - Reads Silhouette Mask, Adds Landmark Texture & BBox Check

import React, { useRef, forwardRef, useEffect, useCallback } from 'react';
import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { UniformsUtils } from 'three';

// Define max landmarks we expect (FaceLandmarker has 478) + some buffer
const MAX_LANDMARKS = 512; // Use a power-of-two size for potential compatibility/perf

const TryOnRenderer = forwardRef(({
    videoRefProp, imageElement,
    mediaPipeResults,     // <<< USED for landmarks
    segmentationResults, // <<< USED for silhouette mask
    isStatic,
    effectIntensity,
    className, style
 }, ref) => {

    // --- Core Refs / Internal State Refs ---
    const canvasRef = useRef(null); const rendererInstanceRef = useRef(null); const animationFrameHandle = useRef(null); const isInitialized = useRef(false);
    const baseSceneRef = useRef(null); const baseCameraRef = useRef(null); const basePlaneMeshRef = useRef(null); const videoTextureRef = useRef(null);
    const imageTextureRef = useRef(null);
    const segmentationTextureRef = useRef(null); // For silhouette mask
    const landmarkTextureRef = useRef(null);     // <<< ADDED for landmarks
    const landmarkDataArray = useRef(null);      // <<< ADDED Float32Array buffer for landmarks
    const composerRef = useRef(null); const effectPassRef = useRef(null);
    const currentIntensity = useRef(0.5);
    const renderLoopCounter = useRef(0); const lastMaskUpdateTime = useRef(0);
    const lastLandmarkUpdateTime = useRef(0);


    // --- Shaders (Updated to include landmark uniforms and bbox logic) ---
        // --- Shaders (DEBUG VERSION - Visualizes Bounding Box) ---
        const customVertexShader = `varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 ); }`;
        // !! DEBUG Fragment Shader !!
        const customFragmentShader = `
            uniform sampler2D tDiffuse;
            // uniform sampler2D uSegmentationMask; // Unused in debug
            uniform sampler2D uLandmarkData;
            // uniform float uEffectIntensity; // Unused in debug
            // uniform bool uHasMask; // Unused in debug
            uniform bool uHasLandmarks;
            // uniform bool uFlipMaskX; // Unused in debug logic
    
            varying vec2 vUv;
    
            // Helper to get landmark data (XY) from RG Float texture
            vec2 getLandmark(int index) {
                float uvx = (float(index) + 0.5) / 512.0;
                return texture2D(uLandmarkData, vec2(uvx, 0.5)).rg;
            }
    
            // Basic Bounding Box check using a few key landmarks
            bool isInsideFaceBBox(vec2 pointUV) {
                vec2 p = vec2(pointUV.x, 1.0 - pointUV.y); // Flip point Y
    
                // Use the same indices for now
                vec2 forehead = getLandmark(10);
                vec2 chin     = getLandmark(152);
                vec2 leftCheek = getLandmark(234);
                vec2 rightCheek= getLandmark(454);
    
                // --- Let's try NO padding first ---
                float minX = min(leftCheek.x, rightCheek.x);
                float maxX = max(leftCheek.x, rightCheek.x);
                float minY = forehead.y; // Y is flipped
                float maxY = chin.y;
    
                // Check if point 'p' is within the raw box
                return p.x > minX && p.x < maxX && p.y > minY && p.y < maxY;
            }
    
            void main() {
                vec4 bC = texture2D(tDiffuse,vUv);
                vec3 fC = bC.rgb; // Base color
                vec3 debugColor = vec3(0.0, 0.0, 0.0); // Default Black
    
                if(uHasLandmarks) {
                    if (isInsideFaceBBox(vUv)) {
                        debugColor = vec3(0.0, 1.0, 0.0); // GREEN = Inside BBox
                    } else {
                        debugColor = vec3(1.0, 0.0, 0.0); // RED = Outside BBox
                    }
                } else {
                   debugColor = vec3(0.0, 0.0, 1.0); // BLUE = No Landmarks detected
                }
    
                // Mix the debug color with the base color to see both
                gl_FragColor = vec4(mix(fC, debugColor, 0.7), bC.a);
            }
        `;

    const HydrationShader = useRef({
        uniforms: {
            'tDiffuse': { value: null },
            'uSegmentationMask': { value: null },
            'uLandmarkData': { value: null }, // <<< ADDED landmark texture uniform
            'uEffectIntensity': { value: 0.5 },
            'uHasMask': { value: false },
            'uHasLandmarks': { value: false }, // <<< ADDED landmark flag uniform
            'uFlipMaskX': { value: false }
        },
        vertexShader: customVertexShader,
        fragmentShader: customFragmentShader
    }).current;


    // --- Prop Effects / Texture Effects ---
    useEffect(() => { currentIntensity.current = effectIntensity; if (effectPassRef.current) { effectPassRef.current.uniforms.uEffectIntensity.value = currentIntensity.current; } }, [effectIntensity]);
    useEffect(() => { /* Video Texture - No change */ }, [isStatic, videoRefProp, videoRefProp?.current?.readyState]);
    useEffect(() => { /* Image Texture - No change */ }, [isStatic, imageElement, imageElement?.complete]);
    useEffect(() => { /* Segmentation Mask Texture - No change */ }, [segmentationResults, isStatic]);


    // --- ***** NEW: Landmark Texture Effect ***** ---
    useEffect(() => {
        const landmarks = mediaPipeResults?.faceLandmarks?.[0]; // Get landmarks for the first face

        if (landmarks && landmarks.length > 0) {
             const now = performance.now();
             const timeSinceLastUpdate = now - lastLandmarkUpdateTime.current;
             const throttleThreshold = isStatic ? 0 : 33; // Throttle landmark updates too (~30fps)

             if (timeSinceLastUpdate > throttleThreshold) {
                 lastLandmarkUpdateTime.current = now;
                 try {
                     // Ensure buffer exists and is large enough
                     if (!landmarkDataArray.current || landmarkDataArray.current.length < MAX_LANDMARKS * 2) {
                         landmarkDataArray.current = new Float32Array(MAX_LANDMARKS * 2);
                         console.log(`TryOnRenderer: Created landmark Float32Array buffer (size: ${MAX_LANDMARKS * 2})`);
                     }
                     const buffer = landmarkDataArray.current;
                     buffer.fill(0); // Clear buffer (or handle padding explicitly)

                     // Fill buffer with landmark data (x, y per landmark)
                     for (let i = 0; i < landmarks.length && i < MAX_LANDMARKS; i++) {
                         buffer[i * 2] = landmarks[i].x;       // Red channel = X
                         buffer[i * 2 + 1] = landmarks[i].y;   // Green channel = Y
                     }

                     // Create or update DataTexture
                     let texture = landmarkTextureRef.current;
                     if (!texture) {
                         // console.log(`TryOnRenderer Landmark Texture: Creating NEW DataTexture (${MAX_LANDMARKS}x1)`);
                         texture = new THREE.DataTexture(buffer, MAX_LANDMARKS, 1, THREE.RGFormat, THREE.FloatType);
                         texture.minFilter = THREE.NearestFilter; // No interpolation needed
                         texture.magFilter = THREE.NearestFilter;
                         texture.generateMipmaps = false;
                         texture.needsUpdate = true;
                         landmarkTextureRef.current = texture;
                     } else {
                         // console.log(`TryOnRenderer Landmark Texture: Updating existing DataTexture.`);
                         texture.image.data = buffer; // Buffer reference might already be the same, but update anyway
                         texture.needsUpdate = true;
                     }

                     // Update shader uniform flag
                     if (effectPassRef.current) {
                         effectPassRef.current.uniforms.uHasLandmarks.value = true;
                         // Uniform value (texture) updated in render loop
                     }

                 } catch (error) {
                     console.error("TryOnRenderer: Error processing landmark texture:", error);
                     landmarkTextureRef.current?.dispose(); landmarkTextureRef.current = null; landmarkDataArray.current = null;
                     if (effectPassRef.current) { effectPassRef.current.uniforms.uHasLandmarks.value = false; }
                 }
             }
              // Ensure uniform points to the texture even if throttled
             else if (effectPassRef.current && effectPassRef.current.uniforms.uHasLandmarks.value !== !!landmarkTextureRef.current) {
                  effectPassRef.current.uniforms.uHasLandmarks.value = !!landmarkTextureRef.current;
             }

        } else {
             // No landmarks found
             if (landmarkTextureRef.current) { landmarkTextureRef.current.dispose(); landmarkTextureRef.current = null; }
             // Ensure buffer is cleared if we want to reuse it
             // if (landmarkDataArray.current) landmarkDataArray.current.fill(0);
             if (effectPassRef.current) { effectPassRef.current.uniforms.uHasLandmarks.value = false; }
        }
    // Update dependency array
    }, [mediaPipeResults, isStatic]); // Depends on the results containing landmarks


    // --- Handle Resizing - No change needed ---
    const handleResize = useCallback(() => { /* ... */ }, []);
    // --- Scale Base Plane - No change needed ---
    const fitPlaneToCamera = useCallback((textureWidth, textureHeight) => { /* ... */ }, []);


    // --- Render Loop (Updates Landmark Texture Uniform) ---
     const renderLoop = useCallback(() => {
        animationFrameHandle.current = requestAnimationFrame(renderLoop);
        renderLoopCounter.current++;
        if (!isInitialized.current || !rendererInstanceRef.current || !composerRef.current || !basePlaneMeshRef.current || !effectPassRef.current) { return; }

        try {
            // 1 & 2: Select Texture, Assign Map, Update Plane Scale/Mirroring (No changes here)
            const baseMaterial = basePlaneMeshRef.current.material; let sourceWidth = 0, sourceHeight = 0; let textureToAssign = null; let isVideo = !isStatic; let needsTextureUpdate = false; if (isVideo && videoTextureRef.current) { textureToAssign = videoTextureRef.current; const video = textureToAssign.image; if(video && video.readyState >= video.HAVE_CURRENT_DATA) { sourceWidth = video.videoWidth; sourceHeight = video.videoHeight; needsTextureUpdate = (baseMaterial.map !== textureToAssign); } else { textureToAssign = null; } } else if (isStatic && imageTextureRef.current) { textureToAssign = imageTextureRef.current; const image = textureToAssign.image; if(image && image.complete && image.naturalWidth > 0) { sourceWidth = image.naturalWidth; sourceHeight = image.naturalHeight; needsTextureUpdate = (baseMaterial.map !== textureToAssign) || textureToAssign.needsUpdate; } else { textureToAssign = null; } } if (baseMaterial && needsTextureUpdate) { baseMaterial.map = textureToAssign; baseMaterial.needsUpdate = true; } else if (baseMaterial && baseMaterial.map !== textureToAssign && !textureToAssign) { baseMaterial.map = null; baseMaterial.needsUpdate = true; } const planeVisible = !!baseMaterial?.map && sourceWidth > 0 && sourceHeight > 0; if (planeVisible) { fitPlaneToCamera(sourceWidth, sourceHeight); const scaleX = Math.abs(basePlaneMeshRef.current.scale.x); const newScaleX = isVideo ? -scaleX : scaleX; if(basePlaneMeshRef.current.scale.x !== newScaleX) { basePlaneMeshRef.current.scale.x = newScaleX; } } else { if (basePlaneMeshRef.current.scale.x !== 0 || basePlaneMeshRef.current.scale.y !== 0) { basePlaneMeshRef.current.scale.set(0, 0, 0); } } if (planeVisible && textureToAssign && textureToAssign.needsUpdate) { textureToAssign.needsUpdate = false; }


            // 3. Update ShaderPass Uniforms
             if (effectPassRef.current) {
                 const uniforms = effectPassRef.current.uniforms;
                 // Segmentation Mask
                 if (uniforms.uSegmentationMask.value !== segmentationTextureRef.current) {
                    uniforms.uSegmentationMask.value = segmentationTextureRef.current;
                    uniforms.uHasMask.value = !!segmentationTextureRef.current;
                 }
                 // <<< Landmark Data Texture >>>
                 if (uniforms.uLandmarkData.value !== landmarkTextureRef.current) {
                    uniforms.uLandmarkData.value = landmarkTextureRef.current;
                    uniforms.uHasLandmarks.value = !!landmarkTextureRef.current; // Also update flag just in case
                 }
                 // Flip Flag
                 uniforms.uFlipMaskX.value = isVideo;
                 // Intensity (updated via prop useEffect)
             }

            // 4. Render using the Composer
            composerRef.current.render();

        } catch (error) {
            console.error("TryOnRenderer: Error in renderLoop:", error);
        }
    }, [fitPlaneToCamera, isStatic]); // isStatic dependency is important


    // --- Initialize Scene - No change needed ---
    const initThreeScene = useCallback(() => { /* ... */ }, [handleResize, renderLoop, HydrationShader]);


    // --- Setup / Cleanup Effect (Dispose landmark texture) ---
    useEffect(() => {
        initThreeScene();
        let resizeObserver; const currentCanvas = canvasRef.current;
        if (currentCanvas) { resizeObserver = new ResizeObserver(() => { handleResize(); }); resizeObserver.observe(currentCanvas); }

        return () => {
            // console.log("DEBUG: Cleanup running (TryOnRenderer Unmount)...");
            resizeObserver?.disconnect();
            cancelAnimationFrame(animationFrameHandle.current);
            isInitialized.current = false;
            // console.log("DEBUG: Disposing Three.js resources...");

            videoTextureRef.current?.dispose(); videoTextureRef.current = null;
            imageTextureRef.current?.dispose(); imageTextureRef.current = null;
            segmentationTextureRef.current?.dispose(); segmentationTextureRef.current = null;
            landmarkTextureRef.current?.dispose(); landmarkTextureRef.current = null; // <<< Dispose landmark texture
            landmarkDataArray.current = null; // Clear buffer ref

            if (composerRef.current) { composerRef.current.renderTarget?.dispose(); effectPassRef.current?.material?.dispose(); }
            composerRef.current = null; effectPassRef.current = null;
            basePlaneMeshRef.current?.geometry?.dispose(); basePlaneMeshRef.current?.material?.map?.dispose(); basePlaneMeshRef.current?.material?.dispose(); basePlaneMeshRef.current = null;
            baseSceneRef.current = null; baseCameraRef.current = null;
            rendererInstanceRef.current?.dispose(); rendererInstanceRef.current = null;
            // console.log("DEBUG: Three.js resources disposed and refs cleared.");
        };
     }, [initThreeScene, handleResize]);


    // --- JSX --- (No change)
    return ( <canvas ref={canvasRef} className={`renderer-canvas ${className || ''}`} style={{ display: 'block', width: '100%', height: '100%', ...(style || {}) }} /> );

});
TryOnRenderer.displayName = 'TryOnRenderer';
export default TryOnRenderer;