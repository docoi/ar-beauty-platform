// src/components/TryOnRenderer.jsx - FINAL - FACE OUTLINE CONSTRAINT via UNIFORMS
// Uses Aligned Silhouette Mask + PointInPolygon test with Landmark Uniforms

import React, { useRef, forwardRef, useEffect, useCallback } from 'react';
import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { UniformsUtils } from 'three';

// Define which landmarks form the outer face contour.
// Adjust this list based on the MediaPipe diagram for desired accuracy.
// Example list (indices might need verification/tuning):
const FACE_OUTLINE_INDICES = [
    10,  338, 297, 332, 284, 251, 389, 356, 454, 323, 361, 288,
    397, 365, 379, 378, 400, 377, 152, 148, 176, 149, 150, 136,
    172, 58,  132, 93,  234, 127, 162, 21,  54,  103, 67,  109
];
// Ensure shader constant matches the length of the index array
const MAX_FACE_POINTS = FACE_OUTLINE_INDICES.length;

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
    // No Landmark Texture Refs
    const composerRef = useRef(null); const effectPassRef = useRef(null);
    const currentIntensity = useRef(0.5);
    // Store the processed face outline points for uniform update
    const faceOutlinePoints = useRef(new Array(MAX_FACE_POINTS).fill(new THREE.Vector2()));
    const numFacePoints = useRef(0);

    const renderLoopCounter = useRef(0); const lastMaskUpdateTime = useRef(0);
    const lastLandmarkUpdateTime = useRef(0);


    // --- Shaders (PointInPolygon using Uniform Array) ---
    const customVertexShader = `varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 ); }`;
    const customFragmentShader = `
        // Define max points for shader array size
        #define MAX_FACE_POINTS ${MAX_FACE_POINTS}

        uniform sampler2D tDiffuse;
        uniform sampler2D uSegmentationMask;
        uniform vec2 uFaceOutline[MAX_FACE_POINTS]; // <<< Landmark points as uniform array
        uniform int uNumFacePoints;                 // <<< Actual number of points in array
        uniform float uEffectIntensity;
        uniform bool uHasMask;
        uniform bool uHasLandmarks; // Flag if landmarks are generally available
        uniform bool uFlipMaskX;    // For coordinate flipping

        varying vec2 vUv;

        // Point-in-Polygon test (Ray Casting Algorithm) using uniform array
        bool isInsideFace(vec2 pointUV, bool shouldFlipX) {
            // Flip point Y for comparison (landmark Y is 0 at top)
            vec2 p = vec2(pointUV.x, 1.0 - pointUV.y);
            // Conditionally flip point X for mirror mode
            if (shouldFlipX) {
                p.x = 1.0 - p.x;
            }

            bool inside = false;
            // Loop through the actual number of points passed (clamp to MAX_FACE_POINTS just in case)
            int count = min(uNumFacePoints, MAX_FACE_POINTS);
            if (count < 3) return false; // Need at least 3 points for a polygon

            for (int i = 0, j = count - 1; i < count; j = i++) {
                // Get coordinates from the uniform array
                vec2 pi = uFaceOutline[i];
                vec2 pj = uFaceOutline[j];

                // Check if the horizontal ray from p intersects the edge (pi, pj)
                // Add small epsilon to avoid issues with horizontal lines
                if ( ((pi.y > p.y) != (pj.y > p.y)) &&
                     (p.x < (pj.x - pi.x) * (p.y - pi.y) / (pj.y - pi.y + 0.00001) + pi.x) ) {
                    inside = !inside; // Flip the inside flag on intersection
                }
            }
            return inside;
        }

        vec3 applyHydrationEffect(vec3 c){ vec3 h=c*(1.0+0.1*uEffectIntensity); h+=vec3(0.05*uEffectIntensity); return h; }

        void main() {
            vec4 bC = texture2D(tDiffuse,vUv);
            vec3 fC = bC.rgb;
            bool applyEffect = false;

            // Check prerequisites first: need mask, landmarks, and >0 intensity
            if(uHasLandmarks && uNumFacePoints > 2 && uHasMask && uEffectIntensity > 0.01) {
                 // Check if pixel is inside the face polygon using the uniform array
                if (isInsideFace(vUv, uFlipMaskX)) {
                    // If inside face polygon, check the silhouette mask value
                    float maskCoordX = uFlipMaskX ? (1.0 - vUv.x) : vUv.x; // Use aligned coords
                    float maskCoordY = 1.0 - vUv.y;
                    float silhouetteMaskValue = texture2D(uSegmentationMask, vec2(maskCoordX, maskCoordY)).r;

                    // Apply effect only if also inside the silhouette
                    if (silhouetteMaskValue > 0.5) { // Threshold silhouette mask
                        applyEffect = true;
                    }
                }
            }

            if (applyEffect) {
                // Apply effect fully if inside face polygon and silhouette mask
                fC = applyHydrationEffect(fC);
            }

            fC=clamp(fC, 0.0, 1.0);
            gl_FragColor=vec4(fC, bC.a);
        }
    `;

    // Final Shader Definition (Uses uniform array for landmarks)
    const FinalShader = useRef({
        uniforms: {
            'tDiffuse': { value: null },
            'uSegmentationMask': { value: null },
            'uFaceOutline': { value: new Array(MAX_FACE_POINTS).fill(new THREE.Vector2()) }, // Initialize empty array
            'uNumFacePoints': { value: 0 },
            'uEffectIntensity': { value: 0.5 },
            'uHasMask': { value: false },
            'uHasLandmarks': { value: false },
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

    // --- Landmark UNIFORM Update Effect ---
    useEffect(() => {
        const landmarks = mediaPipeResults?.faceLandmarks?.[0];
        let needsUniformUpdate = false;

        if (landmarks && landmarks.length > 0) {
             const now = performance.now();
             const timeSinceLastUpdate = now - lastLandmarkUpdateTime.current;
             const throttleThreshold = isStatic ? 0 : 33; // Throttle

             if (timeSinceLastUpdate > throttleThreshold) {
                 lastLandmarkUpdateTime.current = now;
                 try {
                     // Extract only the required points into the ref array
                     let currentCount = 0;
                     for(let i=0; i < FACE_OUTLINE_INDICES.length; ++i) {
                         const index = FACE_OUTLINE_INDICES[i];
                         if (index < landmarks.length) {
                              // Ensure the array exists before writing
                             if(!faceOutlinePoints.current[i]) {
                                 faceOutlinePoints.current[i] = new THREE.Vector2();
                             }
                             faceOutlinePoints.current[i].set(landmarks[index].x, landmarks[index].y);
                             currentCount++;
                         } else {
                             // Handle case where landmark index is out of bounds (shouldn't happen with valid indices)
                             if(!faceOutlinePoints.current[i]) {
                                 faceOutlinePoints.current[i] = new THREE.Vector2();
                             }
                             faceOutlinePoints.current[i].set(0, 0); // Set to zero or handle differently
                         }
                     }
                     numFacePoints.current = currentCount; // Store the actual count
                     needsUniformUpdate = true; // Mark that uniforms need update
                     // console.log("DEBUG: Processed", numFacePoints.current, "face outline points.");

                 } catch (error) {
                     console.error("TryOnRenderer: Error processing landmark uniforms:", error);
                     numFacePoints.current = 0;
                     needsUniformUpdate = true; // Still need to update flag to false
                 }
             }
             // If throttled, don't set needsUniformUpdate = true

        } else if (numFacePoints.current !== 0) {
             // No landmarks found, but previous state had landmarks, so update flag
             numFacePoints.current = 0;
             needsUniformUpdate = true;
        }

        // Update shader uniforms ONLY if effectPass is ready AND an update is needed
        if (effectPassRef.current && needsUniformUpdate) {
            const uniforms = effectPassRef.current.uniforms;
            const hasValidLandmarks = numFacePoints.current > 0;
            uniforms.uHasLandmarks.value = hasValidLandmarks;
            uniforms.uNumFacePoints.value = numFacePoints.current;
            if(hasValidLandmarks) {
                // uniforms.uFaceOutline.value = faceOutlinePoints.current; // This might work directly if THREE handles array updates well
                // More robust: Copy values if THREE doesn't track array content changes
                 for(let i=0; i<numFacePoints.current; ++i) {
                     if (!uniforms.uFaceOutline.value[i]) { // Safety check
                          uniforms.uFaceOutline.value[i] = new THREE.Vector2();
                     }
                     uniforms.uFaceOutline.value[i].copy(faceOutlinePoints.current[i]);
                 }
            }
             // console.log("DEBUG: Updated Landmark Uniforms. HasLandmarks:", hasValidLandmarks, "Count:", numFacePoints.current);
        }
    }, [mediaPipeResults, isStatic]); // Depends on landmark results


    // --- Handle Resizing (No changes) ---
    const handleResize = useCallback(() => { /* ... */ }, []);
    // --- Scale Base Plane (No changes) ---
    const fitPlaneToCamera = useCallback((textureWidth, textureHeight) => { /* ... */ }, []);


    // --- Render Loop (Updates only mask and flip uniforms) ---
     const renderLoop = useCallback(() => {
        animationFrameHandle.current = requestAnimationFrame(renderLoop);
        renderLoopCounter.current++;
        if (!isInitialized.current || !rendererInstanceRef.current || !composerRef.current || !basePlaneMeshRef.current || !effectPassRef.current) { return; }

        try {
            // 1 & 2: Select Texture, Assign Map, Update Plane Scale/Mirroring
            const baseMaterial = basePlaneMeshRef.current.material; let sourceWidth = 0, sourceHeight = 0; let textureToAssign = null; let isVideo = !isStatic; let needsTextureUpdate = false; if (isVideo && videoTextureRef.current) { textureToAssign = videoTextureRef.current; const video = textureToAssign.image; if(video && video.readyState >= video.HAVE_CURRENT_DATA) { sourceWidth = video.videoWidth; sourceHeight = video.videoHeight; needsTextureUpdate = (baseMaterial.map !== textureToAssign); } else { textureToAssign = null; } } else if (isStatic && imageTextureRef.current) { textureToAssign = imageTextureRef.current; const image = textureToAssign.image; if(image && image.complete && image.naturalWidth > 0) { sourceWidth = image.naturalWidth; sourceHeight = image.naturalHeight; needsTextureUpdate = (baseMaterial.map !== textureToAssign) || textureToAssign.needsUpdate; } else { textureToAssign = null; } } if (baseMaterial && needsTextureUpdate) { baseMaterial.map = textureToAssign; baseMaterial.needsUpdate = true; } else if (baseMaterial && baseMaterial.map !== textureToAssign && !textureToAssign) { baseMaterial.map = null; baseMaterial.needsUpdate = true; } const planeVisible = !!baseMaterial?.map && sourceWidth > 0 && sourceHeight > 0; if (planeVisible) { fitPlaneToCamera(sourceWidth, sourceHeight); const scaleX = Math.abs(basePlaneMeshRef.current.scale.x); const newScaleX = isVideo ? -scaleX : scaleX; if(basePlaneMeshRef.current.scale.x !== newScaleX) { basePlaneMeshRef.current.scale.x = newScaleX; } } else { if (basePlaneMeshRef.current.scale.x !== 0 || basePlaneMeshRef.current.scale.y !== 0) { basePlaneMeshRef.current.scale.set(0, 0, 0); } } if (planeVisible && textureToAssign && textureToAssign.needsUpdate) { textureToAssign.needsUpdate = false; }

            // 3. Update ShaderPass Uniforms (Mask and Flip only)
             if (effectPassRef.current) {
                 const uniforms = effectPassRef.current.uniforms;
                 // Segmentation Mask
                 if (uniforms.uSegmentationMask.value !== segmentationTextureRef.current) {
                    uniforms.uSegmentationMask.value = segmentationTextureRef.current;
                    uniforms.uHasMask.value = !!segmentationTextureRef.current;
                 }
                 // Flip Flag
                 uniforms.uFlipMaskX.value = isVideo;
                 // Landmark uniforms (uFaceOutline, uNumFacePoints, uHasLandmarks) are set in the useEffect
             }

            // 4. Render using the Composer
            composerRef.current.render();

        } catch (error) {
            console.error("TryOnRenderer: Error in renderLoop:", error);
        }
    }, [fitPlaneToCamera, isStatic]);


    // --- Initialize Scene (Uses FinalShader definition) ---
    const initThreeScene = useCallback(() => {
        if (!canvasRef.current || isInitialized.current) { return; }
        console.log("DEBUG: initThreeScene START (Face Outline Uniforms)");
        let tempRenderTarget = null;
        try {
            console.log("DEBUG: Initializing renderer...");
            const canvas = canvasRef.current; const initialWidth = Math.max(1, canvas.clientWidth || 640); const initialHeight = Math.max(1, canvas.clientHeight || 480);
            const renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true });
            renderer.setSize(initialWidth, initialHeight); renderer.setPixelRatio(window.devicePixelRatio); renderer.outputColorSpace = THREE.SRGBColorSpace;
            rendererInstanceRef.current = renderer;
            console.log("DEBUG: Renderer initialized.");

            console.log("DEBUG: Checking capabilities and creating render target...");
            const capabilities = renderer.capabilities; if (!capabilities) { throw new Error("Renderer capabilities object not found."); } let targetType = THREE.UnsignedByteType; let canUseHalfFloat = false; if (capabilities.isWebGL2) { canUseHalfFloat = true; } else { const halfFloatExt = capabilities.getExtension('OES_texture_half_float'); const colorBufferFloatExt = capabilities.getExtension('WEBGL_color_buffer_float'); if (halfFloatExt && colorBufferFloatExt) { canUseHalfFloat = true; } } if (canUseHalfFloat) { targetType = THREE.HalfFloatType; } const renderTargetOptions = { minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, format: THREE.RGBAFormat, type: targetType, depthBuffer: false, stencilBuffer: false }; tempRenderTarget = new THREE.WebGLRenderTarget(initialWidth, initialHeight, renderTargetOptions); tempRenderTarget.texture.generateMipmaps = false;
            console.log(`DEBUG: Created WebGLRenderTarget (${initialWidth}x${initialHeight}) with type: ${targetType === THREE.HalfFloatType ? 'HalfFloatType' : 'UnsignedByteType'}.`);

            console.log("DEBUG: Setting up base scene...");
            baseSceneRef.current = new THREE.Scene(); baseCameraRef.current = new THREE.OrthographicCamera(-initialWidth / 2, initialWidth / 2, initialHeight / 2, -initialHeight / 2, 0.1, 10); baseCameraRef.current.position.z = 1; const planeGeometry = new THREE.PlaneGeometry(1, 1); const planeMaterial = new THREE.MeshBasicMaterial({ map: null, side: THREE.DoubleSide, color: 0xffffff, transparent: false }); basePlaneMeshRef.current = new THREE.Mesh(planeGeometry, planeMaterial); baseSceneRef.current.add(basePlaneMeshRef.current);
            console.log("DEBUG: Base scene setup complete.");

            console.log("DEBUG: Setting up EffectComposer...");
            composerRef.current = new EffectComposer(renderer, tempRenderTarget);
            const renderPass = new RenderPass(baseSceneRef.current, baseCameraRef.current);
            composerRef.current.addPass(renderPass);
            console.log("DEBUG: Added RenderPass.");

            console.log("DEBUG: Setting up ShaderPass with Final Shader...");
            if (!FinalShader || !FinalShader.uniforms) {
                 throw new Error("FinalShader object is invalid.");
            }
            const finalShaderPassUniforms = UniformsUtils.clone(FinalShader.uniforms);
             // Set initial values correctly
            finalShaderPassUniforms.uEffectIntensity.value = currentIntensity.current;
            // Ensure the array uniform is properly initialized for cloning
            finalShaderPassUniforms.uFaceOutline.value = new Array(MAX_FACE_POINTS).fill(new THREE.Vector2());

            effectPassRef.current = new ShaderPass({
                uniforms: finalShaderPassUniforms,
                vertexShader: FinalShader.vertexShader,
                fragmentShader: FinalShader.fragmentShader
            }, "tDiffuse");
            if (!effectPassRef.current) { throw new Error("Failed to create ShaderPass."); }
            effectPassRef.current.renderToScreen = true;
            composerRef.current.addPass(effectPassRef.current);
            console.log("DEBUG: Added ShaderPass (Final Face Outline).");

            // Finish initialization
            isInitialized.current = true; handleResize(); cancelAnimationFrame(animationFrameHandle.current); animationFrameHandle.current = requestAnimationFrame(renderLoop);
            console.log("DEBUG: initThreeScene SUCCESSFUL. Starting render loop.");

        } catch (error) {
            console.error("DEBUG: initThreeScene FAILED:", error); tempRenderTarget?.dispose(); composerRef.current = null; effectPassRef.current = null; basePlaneMeshRef.current?.geometry?.dispose(); basePlaneMeshRef.current?.material?.dispose(); rendererInstanceRef.current?.dispose(); rendererInstanceRef.current = null; isInitialized.current = false;
        }
    }, [handleResize, renderLoop, FinalShader]); // Depend on FinalShader


    // --- Setup / Cleanup Effect (No landmark texture to clean) ---
    useEffect(() => {
        initThreeScene();
        let resizeObserver; const currentCanvas = canvasRef.current;
        if (currentCanvas) { resizeObserver = new ResizeObserver(() => { handleResize(); }); resizeObserver.observe(currentCanvas); }
        return () => {
            resizeObserver?.disconnect(); cancelAnimationFrame(animationFrameHandle.current); isInitialized.current = false;
            videoTextureRef.current?.dispose(); videoTextureRef.current = null;
            imageTextureRef.current?.dispose(); imageTextureRef.current = null;
            segmentationTextureRef.current?.dispose(); segmentationTextureRef.current = null;
            // No landmark texture refs to clean
            if (composerRef.current) { composerRef.current.renderTarget?.dispose(); effectPassRef.current?.material?.dispose(); }
            composerRef.current = null; effectPassRef.current = null;
            basePlaneMeshRef.current?.geometry?.dispose(); basePlaneMeshRef.current?.material?.map?.dispose(); basePlaneMeshRef.current?.material?.dispose(); basePlaneMeshRef.current = null;
            baseSceneRef.current = null; baseCameraRef.current = null;
            rendererInstanceRef.current?.dispose(); rendererInstanceRef.current = null;
        };
     }, [initThreeScene, handleResize]);


    // --- JSX --- (No change)
    return ( <canvas ref={canvasRef} className={`renderer-canvas ${className || ''}`} style={{ display: 'block', width: '100%', height: '100%', ...(style || {}) }} /> );

});
TryOnRenderer.displayName = 'TryOnRenderer';
export default TryOnRenderer;