// src/components/TryOnRenderer.jsx - Reads Silhouette Mask, Adds Landmark Texture & BBox Check
// !! INCLUDES DEBUG SHADER to visualize the Bounding Box !!

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
    segmentationResults, // <<< USED for silhouette mask (but ignored by debug shader)
    isStatic,
    effectIntensity,      // <<< Ignored by debug shader
    className, style
 }, ref) => {

    // --- Core Refs / Internal State Refs ---
    const canvasRef = useRef(null); const rendererInstanceRef = useRef(null); const animationFrameHandle = useRef(null); const isInitialized = useRef(false);
    const baseSceneRef = useRef(null); const baseCameraRef = useRef(null); const basePlaneMeshRef = useRef(null); const videoTextureRef = useRef(null);
    const imageTextureRef = useRef(null);
    const segmentationTextureRef = useRef(null); // For silhouette mask
    const landmarkTextureRef = useRef(null);     // For landmarks
    const landmarkDataArray = useRef(null);      // Buffer for landmarks
    const composerRef = useRef(null); const effectPassRef = useRef(null);
    const currentIntensity = useRef(0.5); // Still here but unused by debug shader
    const renderLoopCounter = useRef(0); const lastMaskUpdateTime = useRef(0);
    const lastLandmarkUpdateTime = useRef(0);


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
            float uvx = (float(index) + 0.5) / 512.0; // MAX_LANDMARKS = 512
            return texture2D(uLandmarkData, vec2(uvx, 0.5)).rg;
        }

        // Basic Bounding Box check using a few key landmarks
        bool isInsideFaceBBox(vec2 pointUV) {
            vec2 p = vec2(pointUV.x, 1.0 - pointUV.y); // Flip point Y for comparison

            // Indices for approximate bounding box (adjust as needed)
            // These are examples, refer to MediaPipe face mesh diagram!
            vec2 forehead = getLandmark(10);  // Top center
            vec2 chin     = getLandmark(152); // Bottom center
            vec2 leftCheek = getLandmark(234); // Left extreme
            vec2 rightCheek= getLandmark(454); // Right extreme

            // --- Let's try NO padding first ---
            float minX = min(leftCheek.x, rightCheek.x);
            float maxX = max(leftCheek.x, rightCheek.x);
            // Remember landmark Y increases downwards, screen UV Y increases upwards
            // So forehead.y (smaller value visually) should be the lower bound after flipping p.y
            // And chin.y (larger value visually) should be the upper bound after flipping p.y
            float minY = forehead.y;
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

    // Shader definition object (still needed for ShaderPass)
    // Note: Uniforms here might not perfectly match the debug shader's usage,
    // but EffectComposer/ShaderPass needs the structure.
    // We only care about tDiffuse and uLandmarkData/uHasLandmarks for the debug pass.
    const DebugShader = useRef({
        uniforms: {
            'tDiffuse': { value: null },
            'uSegmentationMask': { value: null }, // Not used by debug shader
            'uLandmarkData': { value: null },     // Used by debug shader
            'uEffectIntensity': { value: 0.5 },   // Not used by debug shader
            'uHasMask': { value: false },         // Not used by debug shader
            'uHasLandmarks': { value: false },    // Used by debug shader
            'uFlipMaskX': { value: false }        // Not used by debug shader
        },
        vertexShader: customVertexShader,
        fragmentShader: customFragmentShader // Reference the DEBUG shader string
    }).current;


    // --- Prop Effects / Texture Effects ---
    useEffect(() => { currentIntensity.current = effectIntensity; /* Uniform update not needed for debug */ }, [effectIntensity]);
    useEffect(() => { /* Video Texture - No change */ }, [isStatic, videoRefProp, videoRefProp?.current?.readyState]);
    useEffect(() => { /* Image Texture - No change */ }, [isStatic, imageElement, imageElement?.complete]);
    useEffect(() => { /* Segmentation Mask Texture - No change (Data created but not used by shader) */ }, [segmentationResults, isStatic]);
    useEffect(() => { /* Landmark Texture Effect - No change */ }, [mediaPipeResults, isStatic]);


    // --- Handle Resizing - No change needed ---
    const handleResize = useCallback(() => { /* ... */ }, []);
    // --- Scale Base Plane - No change needed ---
    const fitPlaneToCamera = useCallback((textureWidth, textureHeight) => { /* ... */ }, []);


    // --- Render Loop (Uniforms updated, but shader only uses landmarks) ---
     const renderLoop = useCallback(() => {
        animationFrameHandle.current = requestAnimationFrame(renderLoop);
        renderLoopCounter.current++;
        if (!isInitialized.current || !rendererInstanceRef.current || !composerRef.current || !basePlaneMeshRef.current || !effectPassRef.current) { return; }

        try {
            // 1 & 2: Select Texture, Assign Map, Update Plane Scale/Mirroring (No changes here)
            const baseMaterial = basePlaneMeshRef.current.material; let sourceWidth = 0, sourceHeight = 0; let textureToAssign = null; let isVideo = !isStatic; let needsTextureUpdate = false; if (isVideo && videoTextureRef.current) { textureToAssign = videoTextureRef.current; const video = textureToAssign.image; if(video && video.readyState >= video.HAVE_CURRENT_DATA) { sourceWidth = video.videoWidth; sourceHeight = video.videoHeight; needsTextureUpdate = (baseMaterial.map !== textureToAssign); } else { textureToAssign = null; } } else if (isStatic && imageTextureRef.current) { textureToAssign = imageTextureRef.current; const image = textureToAssign.image; if(image && image.complete && image.naturalWidth > 0) { sourceWidth = image.naturalWidth; sourceHeight = image.naturalHeight; needsTextureUpdate = (baseMaterial.map !== textureToAssign) || textureToAssign.needsUpdate; } else { textureToAssign = null; } } if (baseMaterial && needsTextureUpdate) { baseMaterial.map = textureToAssign; baseMaterial.needsUpdate = true; } else if (baseMaterial && baseMaterial.map !== textureToAssign && !textureToAssign) { baseMaterial.map = null; baseMaterial.needsUpdate = true; } const planeVisible = !!baseMaterial?.map && sourceWidth > 0 && sourceHeight > 0; if (planeVisible) { fitPlaneToCamera(sourceWidth, sourceHeight); const scaleX = Math.abs(basePlaneMeshRef.current.scale.x); const newScaleX = isVideo ? -scaleX : scaleX; if(basePlaneMeshRef.current.scale.x !== newScaleX) { basePlaneMeshRef.current.scale.x = newScaleX; } } else { if (basePlaneMeshRef.current.scale.x !== 0 || basePlaneMeshRef.current.scale.y !== 0) { basePlaneMeshRef.current.scale.set(0, 0, 0); } } if (planeVisible && textureToAssign && textureToAssign.needsUpdate) { textureToAssign.needsUpdate = false; }

            // 3. Update ShaderPass Uniforms (Only Landmark ones matter for debug shader)
             if (effectPassRef.current) {
                 const uniforms = effectPassRef.current.uniforms;
                 // Landmark Data Texture
                 if (uniforms.uLandmarkData.value !== landmarkTextureRef.current) {
                    uniforms.uLandmarkData.value = landmarkTextureRef.current;
                    uniforms.uHasLandmarks.value = !!landmarkTextureRef.current;
                 }
                 // Other uniforms are updated but ignored by the debug shader...
             }

            // 4. Render using the Composer
            composerRef.current.render();

        } catch (error) {
            console.error("TryOnRenderer: Error in renderLoop:", error);
        }
    }, [fitPlaneToCamera, isStatic]); // isStatic dependency is important


    // --- Initialize Scene (Uses DebugShader definition for ShaderPass) ---
    const initThreeScene = useCallback(() => {
        if (!canvasRef.current || isInitialized.current) { return; }
        console.log("DEBUG: initThreeScene START (Bounding Box DEBUG)"); // Updated log
        let tempRenderTarget = null;
        try {
            const canvas = canvasRef.current; const initialWidth = Math.max(1, canvas.clientWidth || 640); const initialHeight = Math.max(1, canvas.clientHeight || 480);
            const renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true });
            // ... (Renderer setup, capability check, render target creation - NO CHANGE needed here)
            renderer.setSize(initialWidth, initialHeight); renderer.setPixelRatio(window.devicePixelRatio); renderer.outputColorSpace = THREE.SRGBColorSpace; rendererInstanceRef.current = renderer; const capabilities = renderer.capabilities; if (!capabilities) { throw new Error("Renderer capabilities object not found."); } let targetType = THREE.UnsignedByteType; let canUseHalfFloat = false; if (capabilities.isWebGL2) { canUseHalfFloat = true; } else { const halfFloatExt = capabilities.getExtension('OES_texture_half_float'); const colorBufferFloatExt = capabilities.getExtension('WEBGL_color_buffer_float'); if (halfFloatExt && colorBufferFloatExt) { canUseHalfFloat = true; } } if (canUseHalfFloat) { targetType = THREE.HalfFloatType; } const renderTargetOptions = { minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, format: THREE.RGBAFormat, type: targetType, depthBuffer: false, stencilBuffer: false }; tempRenderTarget = new THREE.WebGLRenderTarget(initialWidth, initialHeight, renderTargetOptions); tempRenderTarget.texture.generateMipmaps = false; console.log(`DEBUG: Created WebGLRenderTarget (${initialWidth}x${initialHeight}) with type: ${targetType === THREE.HalfFloatType ? 'HalfFloatType' : 'UnsignedByteType'}.`);

            // Base Scene Setup (No change)
            baseSceneRef.current = new THREE.Scene(); baseCameraRef.current = new THREE.OrthographicCamera(-initialWidth / 2, initialWidth / 2, initialHeight / 2, -initialHeight / 2, 0.1, 10); baseCameraRef.current.position.z = 1; const planeGeometry = new THREE.PlaneGeometry(1, 1); const planeMaterial = new THREE.MeshBasicMaterial({ map: null, side: THREE.DoubleSide, color: 0xffffff, transparent: false }); basePlaneMeshRef.current = new THREE.Mesh(planeGeometry, planeMaterial); baseSceneRef.current.add(basePlaneMeshRef.current);

            // Setup EffectComposer (No change)
            composerRef.current = new EffectComposer(renderer, tempRenderTarget);

            // Add RenderPass (No change)
            const renderPass = new RenderPass(baseSceneRef.current, baseCameraRef.current);
            composerRef.current.addPass(renderPass);

            // <<< Add ShaderPass using the DEBUG SHADER definition >>>
            const debugShaderPassUniforms = UniformsUtils.clone(DebugShader.uniforms);
            // We don't need to set intensity for the debug shader
            effectPassRef.current = new ShaderPass({
                uniforms: debugShaderPassUniforms,
                vertexShader: DebugShader.vertexShader,       // Use debug vertex shader (same)
                fragmentShader: DebugShader.fragmentShader   // Use debug fragment shader
            }, "tDiffuse");
            effectPassRef.current.renderToScreen = true;
            composerRef.current.addPass(effectPassRef.current);
            console.log("DEBUG: Added ShaderPass (Bounding Box DEBUG)."); // Updated log

            // Finish initialization (No change)
            isInitialized.current = true; handleResize(); cancelAnimationFrame(animationFrameHandle.current); animationFrameHandle.current = requestAnimationFrame(renderLoop); console.log("DEBUG: initThreeScene SUCCESSFUL. Starting render loop.");
        } catch (error) {
            console.error("DEBUG: initThreeScene FAILED:", error); tempRenderTarget?.dispose(); composerRef.current = null; effectPassRef.current = null; basePlaneMeshRef.current?.geometry?.dispose(); basePlaneMeshRef.current?.material?.dispose(); rendererInstanceRef.current?.dispose(); rendererInstanceRef.current = null; isInitialized.current = false;
        }
    }, [handleResize, renderLoop, DebugShader]); // Depend on DebugShader ref now


    // --- Setup / Cleanup Effect - No change needed ---
    useEffect(() => { /* ... */ }, [initThreeScene, handleResize]);


    // --- JSX --- (No change)
    return ( <canvas ref={canvasRef} className={`renderer-canvas ${className || ''}`} style={{ display: 'block', width: '100%', height: '100%', ...(style || {}) }} /> );

});
TryOnRenderer.displayName = 'TryOnRenderer';
export default TryOnRenderer;