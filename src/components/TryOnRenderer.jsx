// src/components/TryOnRenderer.jsx - FACE OUTLINE CONSTRAINT via UNIFORMS
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
const MAX_FACE_POINTS = FACE_OUTLINE_INDICES.length; // Set max based on our chosen indices

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
    // Remove Landmark Texture Refs
    // const landmarkTextureRef = useRef(null);
    // const landmarkDataArray = useRef(null);
    const composerRef = useRef(null); const effectPassRef = useRef(null);
    const currentIntensity = useRef(0.5);
    const renderLoopCounter = useRef(0); const lastMaskUpdateTime = useRef(0);
    const lastLandmarkUpdateTime = useRef(0);


    // --- Shaders (PointInPolygon using Uniform Array) ---
    const customVertexShader = `varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 ); }`;
    const customFragmentShader = `
        // Define max points for shader array size
        #define MAX_FACE_POINTS ${MAX_FACE_POINTS}

        uniform sampler2D tDiffuse;
        uniform sampler2D uSegmentationMask;
        // Removed uLandmarkData
        uniform vec2 uFaceOutline[MAX_FACE_POINTS]; // <<< Landmark points as uniform array
        uniform int uNumFacePoints;                 // <<< Actual number of points in array
        uniform float uEffectIntensity;
        uniform bool uHasMask;
        uniform bool uHasLandmarks; // Still useful as a flag
        uniform bool uFlipMaskX;

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
            // Loop through the actual number of points passed
            for (int i = 0, j = uNumFacePoints - 1; i < uNumFacePoints; j = i++) {
                // Get coordinates from the uniform array
                vec2 pi = uFaceOutline[i];
                vec2 pj = uFaceOutline[j];

                // Check if the horizontal ray from p intersects the edge (pi, pj)
                if ( ((pi.y > p.y) != (pj.y > p.y)) &&
                     (p.x < (pj.x - pi.x) * (p.y - pi.y) / (pj.y - pi.y) + pi.x) ) {
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

            // Check prerequisites first
            if(uHasLandmarks && uNumFacePoints > 2 && uHasMask && uEffectIntensity > 0.01) {
                 // Check if pixel is inside the face polygon
                if (isInsideFace(vUv, uFlipMaskX)) {
                    // If inside face polygon, check the silhouette mask value
                    float maskCoordX = uFlipMaskX ? (1.0 - vUv.x) : vUv.x;
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

    // Shader definition object (Uses uniform array for landmarks)
    const HydrationShader = useRef({
        uniforms: {
            'tDiffuse': { value: null },
            'uSegmentationMask': { value: null },
            // Removed uLandmarkData
            'uFaceOutline': { value: [] }, // Initialize empty array for face points
            'uNumFacePoints': { value: 0 },  // Initialize count
            'uEffectIntensity': { value: 0.5 },
            'uHasMask': { value: false },
            'uHasLandmarks': { value: false }, // Flag still needed
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

    // --- ***** UPDATE: Landmark UNIFORM Effect ***** ---
    useEffect(() => {
        const landmarks = mediaPipeResults?.faceLandmarks?.[0]; // Get landmarks

        let processedLandmarks = []; // Temporary array for vec2 objects
        let hasValidLandmarks = false;

        if (landmarks && landmarks.length > 0) {
             const now = performance.now();
             const timeSinceLastUpdate = now - lastLandmarkUpdateTime.current;
             const throttleThreshold = isStatic ? 0 : 33; // Throttle landmark updates (~30fps)

             if (timeSinceLastUpdate > throttleThreshold) {
                 lastLandmarkUpdateTime.current = now;
                 try {
                     // Extract only the outline points
                     processedLandmarks = FACE_OUTLINE_INDICES.map(index => {
                         if (index < landmarks.length) {
                             // Convert to THREE.Vector2 for uniform update compatibility
                             return new THREE.Vector2(landmarks[index].x, landmarks[index].y);
                         }
                         return new THREE.Vector2(0, 0); // Default if index out of bounds
                     });
                     hasValidLandmarks = processedLandmarks.length > 0;

                 } catch (error) {
                     console.error("TryOnRenderer: Error processing landmark uniforms:", error);
                     hasValidLandmarks = false;
                     processedLandmarks = [];
                 }
             } else {
                 // Throttled: Keep previous state by not updating uniforms yet
                 // (We update the flag below based on whether effectPass exists)
                 hasValidLandmarks = effectPassRef.current ? effectPassRef.current.uniforms.uHasLandmarks.value : false;
             }

        } else {
             // No landmarks found
             hasValidLandmarks = false;
             processedLandmarks = [];
        }

        // Update shader uniforms ONLY if effectPass is ready
        if (effectPassRef.current) {
            const uniforms = effectPassRef.current.uniforms;
            // Only update if the status changed or if we have new valid points
            if (uniforms.uHasLandmarks.value !== hasValidLandmarks || hasValidLandmarks) {
                uniforms.uHasLandmarks.value = hasValidLandmarks;
                if (hasValidLandmarks) {
                    // Update the array and count
                    uniforms.uFaceOutline.value = processedLandmarks;
                    uniforms.uNumFacePoints.value = processedLandmarks.length;
                } else {
                    uniforms.uNumFacePoints.value = 0;
                    // Optionally clear the array uniform: uniforms.uFaceOutline.value = [];
                }
            }
        }
    }, [mediaPipeResults, isStatic]); // Depends on landmark results


    // --- Handle Resizing (No changes) ---
    const handleResize = useCallback(() => { /* ... */ }, []);
    // --- Scale Base Plane (No changes) ---
    const fitPlaneToCamera = useCallback((textureWidth, textureHeight) => { /* ... */ }, []);


    // --- Render Loop (Updates only mask and flip uniforms - landmark uniforms updated in useEffect) ---
     const renderLoop = useCallback(() => {
        animationFrameHandle.current = requestAnimationFrame(renderLoop);
        renderLoopCounter.current++;
        if (!isInitialized.current || !rendererInstanceRef.current || !composerRef.current || !basePlaneMeshRef.current || !effectPassRef.current) { return; }

        try {
            // 1 & 2: Select Texture, Assign Map, Update Plane Scale/Mirroring (No changes)
            const baseMaterial = basePlaneMeshRef.current.material; let sourceWidth = 0, sourceHeight = 0; let textureToAssign = null; let isVideo = !isStatic; let needsTextureUpdate = false; if (isVideo && videoTextureRef.current) { textureToAssign = videoTextureRef.current; const video = textureToAssign.image; if(video && video.readyState >= video.HAVE_CURRENT_DATA) { sourceWidth = video.videoWidth; sourceHeight = video.videoHeight; needsTextureUpdate = (baseMaterial.map !== textureToAssign); } else { textureToAssign = null; } } else if (isStatic && imageTextureRef.current) { textureToAssign = imageTextureRef.current; const image = textureToAssign.image; if(image && image.complete && image.naturalWidth > 0) { sourceWidth = image.naturalWidth; sourceHeight = image.naturalHeight; needsTextureUpdate = (baseMaterial.map !== textureToAssign) || textureToAssign.needsUpdate; } else { textureToAssign = null; } } if (baseMaterial && needsTextureUpdate) { baseMaterial.map = textureToAssign; baseMaterial.needsUpdate = true; } else if (baseMaterial && baseMaterial.map !== textureToAssign && !textureToAssign) { baseMaterial.map = null; baseMaterial.needsUpdate = true; } const planeVisible = !!baseMaterial?.map && sourceWidth > 0 && sourceHeight > 0; if (planeVisible) { fitPlaneToCamera(sourceWidth, sourceHeight); const scaleX = Math.abs(basePlaneMeshRef.current.scale.x); const newScaleX = isVideo ? -scaleX : scaleX; if(basePlaneMeshRef.current.scale.x !== newScaleX) { basePlaneMeshRef.current.scale.x = newScaleX; } } else { if (basePlaneMeshRef.current.scale.x !== 0 || basePlaneMeshRef.current.scale.y !== 0) { basePlaneMeshRef.current.scale.set(0, 0, 0); } } if (planeVisible && textureToAssign && textureToAssign.needsUpdate) { textureToAssign.needsUpdate = false; }

            // 3. Update ShaderPass Uniforms (Mask and Flip only - Landmarks handled by useEffect)
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


    // --- Initialize Scene (No changes needed from stable version) ---
    const initThreeScene = useCallback(() => {
        if (!canvasRef.current || isInitialized.current) { return; } console.log("DEBUG: initThreeScene START (Face Outline Uniforms)"); let tempRenderTarget = null; try { console.log("DEBUG: Initializing renderer..."); const canvas = canvasRef.current; const initialWidth = Math.max(1, canvas.clientWidth || 640); const initialHeight = Math.max(1, canvas.clientHeight || 480); const renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true }); renderer.setSize(initialWidth, initialHeight); renderer.setPixelRatio(window.devicePixelRatio); renderer.outputColorSpace = THREE.SRGBColorSpace; rendererInstanceRef.current = renderer; console.log("DEBUG: Renderer initialized."); console.log("DEBUG: Checking capabilities and creating render target..."); const capabilities = renderer.capabilities; if (!capabilities) { throw new Error("Renderer capabilities object not found."); } let targetType = THREE.UnsignedByteType; let canUseHalfFloat = false; if (capabilities.isWebGL2) { canUseHalfFloat = true; } else { const halfFloatExt = capabilities.getExtension('OES_texture_half_float'); const colorBufferFloatExt = capabilities.getExtension('WEBGL_color_buffer_float'); if (halfFloatExt && colorBufferFloatExt) { canUseHalfFloat = true; } } if (canUseHalfFloat) { targetType = THREE.HalfFloatType; } const renderTargetOptions = { minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, format: THREE.RGBAFormat, type: targetType, depthBuffer: false, stencilBuffer: false }; tempRenderTarget = new THREE.WebGLRenderTarget(initialWidth, initialHeight, renderTargetOptions); tempRenderTarget.texture.generateMipmaps = false; console.log(`DEBUG: Created WebGLRenderTarget (${initialWidth}x${initialHeight}) with type: ${targetType === THREE.HalfFloatType ? 'HalfFloatType' : 'UnsignedByteType'}.`); console.log("DEBUG: Setting up base scene..."); baseSceneRef.current = new THREE.Scene(); baseCameraRef.current = new THREE.OrthographicCamera(-initialWidth / 2, initialWidth / 2, initialHeight / 2, -initialHeight / 2, 0.1, 10); baseCameraRef.current.position.z = 1; const planeGeometry = new THREE.PlaneGeometry(1, 1); const planeMaterial = new THREE.MeshBasicMaterial({ map: null, side: THREE.DoubleSide, color: 0xffffff, transparent: false }); basePlaneMeshRef.current = new THREE.Mesh(planeGeometry, planeMaterial); baseSceneRef.current.add(basePlaneMeshRef.current); console.log("DEBUG: Base scene setup complete."); console.log("DEBUG: Setting up EffectComposer..."); composerRef.current = new EffectComposer(renderer, tempRenderTarget); const renderPass = new RenderPass(baseSceneRef.current, baseCameraRef.current); composerRef.current.addPass(renderPass); console.log("DEBUG: Added RenderPass."); console.log("DEBUG: Setting up ShaderPass..."); const hydrationShaderPassUniforms = UniformsUtils.clone(HydrationShader.uniforms); hydrationShaderPassUniforms.uEffectIntensity.value = currentIntensity.current; // Set initial intensity
             // Initialize the uniform array with the correct size
             hydrationShaderPassUniforms.uFaceOutline.value = new Array(MAX_FACE_POINTS).fill(new THREE.Vector2());
             effectPassRef.current = new ShaderPass({ uniforms: hydrationShaderPassUniforms, vertexShader: HydrationShader.vertexShader, fragmentShader: HydrationShader.fragmentShader }, "tDiffuse"); effectPassRef.current.renderToScreen = true; composerRef.current.addPass(effectPassRef.current); console.log("DEBUG: Added ShaderPass (Hydration Effect - Face Outline)."); isInitialized.current = true; handleResize(); cancelAnimationFrame(animationFrameHandle.current); animationFrameHandle.current = requestAnimationFrame(renderLoop); console.log("DEBUG: initThreeScene SUCCESSFUL. Starting render loop."); } catch (error) { console.error("DEBUG: initThreeScene FAILED:", error); tempRenderTarget?.dispose(); composerRef.current = null; effectPassRef.current = null; basePlaneMeshRef.current?.geometry?.dispose(); basePlaneMeshRef.current?.material?.dispose(); rendererInstanceRef.current?.dispose(); rendererInstanceRef.current = null; isInitialized.current = false; }
    }, [handleResize, renderLoop, HydrationShader]);


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