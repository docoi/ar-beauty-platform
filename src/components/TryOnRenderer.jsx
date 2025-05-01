// src/components/TryOnRenderer.jsx - MINIMAL LANDMARK UNIFORM TEST
// Passes only one landmark via uniform

import React, { useRef, forwardRef, useEffect, useCallback } from 'react';
import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { UniformsUtils } from 'three';

const TryOnRenderer = forwardRef(({
    videoRefProp, imageElement,
    mediaPipeResults,     // <<< USED for one landmark
    segmentationResults, // <<< Mask texture created but UNUSED by shader
    isStatic,
    effectIntensity,      // <<< UNUSED by shader
    className, style
 }, ref) => {

    // --- Core Refs / Internal State Refs ---
    const canvasRef = useRef(null); const rendererInstanceRef = useRef(null); const animationFrameHandle = useRef(null); const isInitialized = useRef(false);
    const baseSceneRef = useRef(null); const baseCameraRef = useRef(null); const basePlaneMeshRef = useRef(null); const videoTextureRef = useRef(null);
    const imageTextureRef = useRef(null);
    const segmentationTextureRef = useRef(null); // Created but unused
    const composerRef = useRef(null); const effectPassRef = useRef(null);
    // const currentIntensity = useRef(0.5); // Unused
    const renderLoopCounter = useRef(0); const lastMaskUpdateTime = useRef(0);
    const lastLandmarkUpdateTime = useRef(0);


    // --- Shaders (Minimal Debug Shader for Single Landmark) ---
    const customVertexShader = `varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 ); }`;
    const customFragmentShader = `
        // uniform sampler2D tDiffuse; // UNUSED
        // uniform sampler2D uSegmentationMask; // UNUSED
        uniform vec2 uDebugLandmark; // <<< The ONLY landmark uniform
        uniform bool uHasLandmarks;  // <<< Flag for landmark availability
        // uniform float uEffectIntensity; // UNUSED
        // uniform bool uHasMask; // UNUSED
        // uniform bool uFlipMaskX; // UNUSED

        varying vec2 vUv;

        void main() {
            vec3 outputColor;

            if (uHasLandmarks) {
                // If landmarks are present, output GREEN
                // (Could use uDebugLandmark.x/.y to vary color if needed later)
                outputColor = vec3(0.0, 1.0, 0.0);
            } else {
               // If no landmarks detected/ready, output RED
               outputColor = vec3(1.0, 0.0, 0.0);
            }

            // Check for potential issues (though less likely with simple logic)
            if (isnan(outputColor.r) || isnan(outputColor.g) || isnan(outputColor.b)) {
                 outputColor = vec3(0.0, 0.0, 1.0); // BLUE if NaN occurs
            }

            gl_FragColor = vec4(outputColor, 1.0); // Output solid color
        }
    `;

    // Define the DEBUG shader structure for ShaderPass
    const MinimalDebugShader = useRef({
        uniforms: {
            'tDiffuse': { value: null },
            'uSegmentationMask': { value: null },
            // --- Only include uniforms the shader *actually* uses ---
            'uDebugLandmark': { value: new THREE.Vector2(0, 0) }, // Initialize
            'uHasLandmarks': { value: false },
            // --- Include others only if ShaderPass strictly requires the full original set ---
            // 'uEffectIntensity': { value: 0.5 },
            // 'uHasMask': { value: false },
            // 'uFlipMaskX': { value: false }
        },
        vertexShader: customVertexShader,
        fragmentShader: customFragmentShader // Reference the DEBUG shader string
    }).current;


    // --- Prop Effects / Texture Effects ---
    // useEffect(() => { /* Intensity not needed */ }, [effectIntensity]);
    useEffect(() => { /* Video Texture - No Change */ }, [isStatic, videoRefProp, videoRefProp?.current?.readyState]);
    useEffect(() => { /* Image Texture - No Change */ }, [isStatic, imageElement, imageElement?.complete]);
    useEffect(() => { /* Segmentation Mask Texture (Created but unused by shader) - No Change */ }, [segmentationResults, isStatic]);

    // --- Minimal Landmark Uniform Effect ---
    useEffect(() => {
        const landmarks = mediaPipeResults?.faceLandmarks?.[0];
        let hasValidLandmark = false;
        let debugPoint = new THREE.Vector2(0, 0); // Default

        if (landmarks && landmarks.length > 1) { // Check if landmark index 1 exists
             const now = performance.now();
             const timeSinceLastUpdate = now - lastLandmarkUpdateTime.current;
             const throttleThreshold = isStatic ? 0 : 33; // Throttle

             if (timeSinceLastUpdate > throttleThreshold) {
                 lastLandmarkUpdateTime.current = now;
                 try {
                     // Get nose tip (index 1)
                     const noseTip = landmarks[1];
                     debugPoint.set(noseTip.x, noseTip.y);
                     hasValidLandmark = true;
                     // console.log("DEBUG: Updating uDebugLandmark:", debugPoint.x, debugPoint.y);

                 } catch (error) {
                     console.error("TryOnRenderer: Error processing debug landmark:", error);
                     hasValidLandmark = false;
                 }
             } else {
                 // Throttled: Keep previous state
                 hasValidLandmark = effectPassRef.current ? effectPassRef.current.uniforms.uHasLandmarks.value : false;
                 // Don't re-assign debugPoint here, keep last valid one if throttled
             }
        } else {
             // No landmarks or not enough landmarks
             hasValidLandmark = false;
        }

        // Update uniforms if the pass exists
        if (effectPassRef.current) {
            // Only update if needed to potentially avoid unnecessary work
            if (effectPassRef.current.uniforms.uHasLandmarks.value !== hasValidLandmark){
                 effectPassRef.current.uniforms.uHasLandmarks.value = hasValidLandmark;
                 // console.log("DEBUG: Set uHasLandmarks to:", hasValidLandmark);
            }
            // Update the point value if we have a valid one (even if throttled, send last good one)
            // Check if the value actually changed before assigning (optional optimization)
            if (hasValidLandmark && !effectPassRef.current.uniforms.uDebugLandmark.value.equals(debugPoint)) {
                 effectPassRef.current.uniforms.uDebugLandmark.value.copy(debugPoint);
                 // console.log("DEBUG: Set uDebugLandmark");
            }
        }
    }, [mediaPipeResults, isStatic]);


    // --- Handle Resizing (No changes) ---
    const handleResize = useCallback(() => { /* ... */ }, []);
    // --- Scale Base Plane (No changes) ---
    const fitPlaneToCamera = useCallback((textureWidth, textureHeight) => { /* ... */ }, []);


    // --- Render Loop (No landmark uniform updates needed here) ---
     const renderLoop = useCallback(() => {
        animationFrameHandle.current = requestAnimationFrame(renderLoop);
        renderLoopCounter.current++;
        if (!isInitialized.current || !rendererInstanceRef.current || !composerRef.current || !basePlaneMeshRef.current || !effectPassRef.current) { return; }

        try {
            // 1 & 2: Select Texture, Assign Map, Update Plane Scale/Mirroring (Still needed for RenderPass)
             const baseMaterial = basePlaneMeshRef.current.material; let sourceWidth = 0, sourceHeight = 0; let textureToAssign = null; let isVideo = !isStatic; let needsTextureUpdate = false; if (isVideo && videoTextureRef.current) { textureToAssign = videoTextureRef.current; const video = textureToAssign.image; if(video && video.readyState >= video.HAVE_CURRENT_DATA) { sourceWidth = video.videoWidth; sourceHeight = video.videoHeight; needsTextureUpdate = (baseMaterial.map !== textureToAssign); } else { textureToAssign = null; } } else if (isStatic && imageTextureRef.current) { textureToAssign = imageTextureRef.current; const image = textureToAssign.image; if(image && image.complete && image.naturalWidth > 0) { sourceWidth = image.naturalWidth; sourceHeight = image.naturalHeight; needsTextureUpdate = (baseMaterial.map !== textureToAssign) || textureToAssign.needsUpdate; } else { textureToAssign = null; } } if (baseMaterial && needsTextureUpdate) { baseMaterial.map = textureToAssign; baseMaterial.needsUpdate = true; } else if (baseMaterial && baseMaterial.map !== textureToAssign && !textureToAssign) { baseMaterial.map = null; baseMaterial.needsUpdate = true; } const planeVisible = !!baseMaterial?.map && sourceWidth > 0 && sourceHeight > 0; if (planeVisible) { fitPlaneToCamera(sourceWidth, sourceHeight); const scaleX = Math.abs(basePlaneMeshRef.current.scale.x); const newScaleX = isVideo ? -scaleX : scaleX; if(basePlaneMeshRef.current.scale.x !== newScaleX) { basePlaneMeshRef.current.scale.x = newScaleX; } } else { if (basePlaneMeshRef.current.scale.x !== 0 || basePlaneMeshRef.current.scale.y !== 0) { basePlaneMeshRef.current.scale.set(0, 0, 0); } } if (planeVisible && textureToAssign && textureToAssign.needsUpdate) { textureToAssign.needsUpdate = false; }

            // 3. Update Only Necessary Uniforms for Debug
             // if (effectPassRef.current) {
                 // const uniforms = effectPassRef.current.uniforms;
                 // uHasLandmarks and uDebugLandmark are updated in useEffect
                 // Other uniforms like mask/flip aren't used by this shader
             // }

            // 4. Render using the Composer
            composerRef.current.render();

        } catch (error) {
            console.error("TryOnRenderer: Error in renderLoop:", error);
        }
    }, [fitPlaneToCamera, isStatic]);


    // --- Initialize Scene (Uses MinimalDebugShader definition) ---
    const initThreeScene = useCallback(() => {
        if (!canvasRef.current || isInitialized.current) { return; }
        console.log("DEBUG: initThreeScene START (Minimal Landmark Uniform DEBUG)"); // Log
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

            // <<< Add ShaderPass using the MinimalDebugShader definition >>>
            console.log("DEBUG: Setting up Minimal Debug ShaderPass...");
            if (!MinimalDebugShader || !MinimalDebugShader.uniforms) {
                 throw new Error("MinimalDebugShader object is invalid.");
            }
            const debugShaderPassUniforms = UniformsUtils.clone(MinimalDebugShader.uniforms);
             // Ensure the debug landmark uniform is initialized correctly if cloned
            debugShaderPassUniforms.uDebugLandmark = { value: new THREE.Vector2(0, 0) };
            debugShaderPassUniforms.uHasLandmarks = { value: false };

            effectPassRef.current = new ShaderPass({
                uniforms: debugShaderPassUniforms,
                vertexShader: MinimalDebugShader.vertexShader,
                fragmentShader: MinimalDebugShader.fragmentShader
            }, "tDiffuse"); // Input texture name (ignored by shader but maybe needed by pass)
            if (!effectPassRef.current) {
                 throw new Error("Failed to create ShaderPass.");
            }
            effectPassRef.current.renderToScreen = true;
            composerRef.current.addPass(effectPassRef.current);
            console.log("DEBUG: Added ShaderPass (Minimal Landmark Uniform DEBUG).");

            // Finish initialization
            isInitialized.current = true; handleResize(); cancelAnimationFrame(animationFrameHandle.current); animationFrameHandle.current = requestAnimationFrame(renderLoop);
            console.log("DEBUG: initThreeScene SUCCESSFUL. Starting render loop.");

        } catch (error) {
            console.error("DEBUG: initThreeScene FAILED:", error); tempRenderTarget?.dispose(); composerRef.current = null; effectPassRef.current = null; basePlaneMeshRef.current?.geometry?.dispose(); basePlaneMeshRef.current?.material?.dispose(); rendererInstanceRef.current?.dispose(); rendererInstanceRef.current = null; isInitialized.current = false;
        }
    }, [handleResize, renderLoop, MinimalDebugShader]); // Depend on MinimalDebugShader ref now


    // --- Setup / Cleanup Effect (No landmark texture to clean) ---
    useEffect(() => {
        initThreeScene();
        let resizeObserver; const currentCanvas = canvasRef.current;
        if (currentCanvas) { resizeObserver = new ResizeObserver(() => { handleResize(); }); resizeObserver.observe(currentCanvas); }
        return () => {
            resizeObserver?.disconnect(); cancelAnimationFrame(animationFrameHandle.current); isInitialized.current = false;
            videoTextureRef.current?.dispose(); videoTextureRef.current = null;
            imageTextureRef.current?.dispose(); imageTextureRef.current = null;
            segmentationTextureRef.current?.dispose(); segmentationTextureRef.current = null; // Dispose mask texture
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