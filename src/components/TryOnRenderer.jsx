// src/components/TryOnRenderer.jsx - LANDMARK TEXTURE ISOLATION DEBUG
// Tries to sample only the landmark texture

import React, { useRef, forwardRef, useEffect, useCallback } from 'react';
import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { UniformsUtils } from 'three';

// Define max landmarks we expect
const LANDMARK_TEX_WIDTH = 32;
const LANDMARK_TEX_HEIGHT = 16; // 32 * 16 = 512 storage locations

const TryOnRenderer = forwardRef(({
    videoRefProp, imageElement,
    mediaPipeResults,     // <<< USED for landmarks
    segmentationResults, // <<< USED for silhouette mask (but IGNORED by this shader)
    isStatic,
    effectIntensity,      // <<< IGNORED by this shader
    className, style
 }, ref) => {

    // --- Core Refs / Internal State Refs ---
    const canvasRef = useRef(null); const rendererInstanceRef = useRef(null); const animationFrameHandle = useRef(null); const isInitialized = useRef(false);
    const baseSceneRef = useRef(null); const baseCameraRef = useRef(null); const basePlaneMeshRef = useRef(null); const videoTextureRef = useRef(null);
    const imageTextureRef = useRef(null);
    const segmentationTextureRef = useRef(null); // <<< Created but UNUSED by shader
    const landmarkTextureRef = useRef(null);     // <<< For landmarks (RGBA)
    const landmarkDataArray = useRef(null);      // <<< Buffer for landmarks (RGBA)
    const composerRef = useRef(null); const effectPassRef = useRef(null);
    // const currentIntensity = useRef(0.5); // Not needed for this debug
    const renderLoopCounter = useRef(0); const lastMaskUpdateTime = useRef(0);
    const lastLandmarkUpdateTime = useRef(0);


    // --- Shaders (DEBUG - Samples only Landmark Texture) ---
    const customVertexShader = `varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 ); }`;
    // !! DEBUG Fragment Shader !!
    const customFragmentShader = `
        #define LANDMARK_TEX_WIDTH_FLOAT 32.0
        #define LANDMARK_TEX_HEIGHT_FLOAT 16.0

        // uniform sampler2D tDiffuse; // UNUSED
        // uniform sampler2D uSegmentationMask; // UNUSED
        uniform sampler2D uLandmarkData; // <<< The ONLY texture we use
        // uniform float uEffectIntensity; // UNUSED
        // uniform bool uHasMask; // UNUSED
        uniform bool uHasLandmarks; // <<< Used
        // uniform bool uFlipMaskX; // UNUSED

        varying vec2 vUv;

        // Helper to get landmark data (XY) from RG channels of RGBA Float texture (2D)
        vec2 getLandmark(int index) {
            float col = mod(float(index), LANDMARK_TEX_WIDTH_FLOAT);
            float row = floor(float(index) / LANDMARK_TEX_WIDTH_FLOAT);
            float uvx = (col + 0.5) / LANDMARK_TEX_WIDTH_FLOAT;
            float uvy = (row + 0.5) / LANDMARK_TEX_HEIGHT_FLOAT;
            return texture2D(uLandmarkData, vec2(uvx, uvy)).rg;
        }

        void main() {
            vec3 outputColor;

            if(uHasLandmarks) {
                // Try reading landmark 0
                vec2 landmark0 = getLandmark(0);
                // Simple visualization: Use landmark X coord for Red, fixed Green
                // Should be green-ish if landmark X is near 0.5
                outputColor = vec3(landmark0.x, 0.8, 0.0);
            } else {
               // If no landmarks detected/ready, output RED
               outputColor = vec3(1.0, 0.0, 0.0);
            }

            // Fallback in case something unexpected happens (e.g., NaN)
            if (isnan(outputColor.r) || isnan(outputColor.g) || isnan(outputColor.b)) {
                 outputColor = vec3(0.0, 0.0, 1.0); // BLUE if NaN occurs
            }

            gl_FragColor = vec4(outputColor, 1.0); // Output solid color
        }
    `;

    // Define the DEBUG shader structure for ShaderPass
    const LandmarkDebugShader = useRef({
        uniforms: {
            'tDiffuse': { value: null }, // Still required by ShaderPass structure maybe
            'uSegmentationMask': { value: null }, // Still required by ShaderPass structure maybe
            'uLandmarkData': { value: null },     // <<< Used
            'uEffectIntensity': { value: 0.5 },   // Required but unused
            'uHasMask': { value: false },         // Required but unused
            'uHasLandmarks': { value: false },    // <<< Used
            'uFlipMaskX': { value: false }        // Required but unused
        },
        vertexShader: customVertexShader,
        fragmentShader: customFragmentShader // Reference the DEBUG shader string
    }).current;


    // --- Prop Effects / Texture Effects ---
    // useEffect(() => { /* Intensity not needed */ }, [effectIntensity]);
    useEffect(() => { /* Video Texture */ const videoElement = videoRefProp?.current; if (!isStatic && videoElement && videoElement.readyState >= videoElement.HAVE_METADATA) { if (!videoTextureRef.current || videoTextureRef.current.image !== videoElement) { videoTextureRef.current?.dispose(); videoTextureRef.current = new THREE.VideoTexture(videoElement); videoTextureRef.current.colorSpace = THREE.SRGBColorSpace; } } else if (!isStatic && videoTextureRef.current) { videoTextureRef.current.dispose(); videoTextureRef.current = null; } }, [isStatic, videoRefProp, videoRefProp?.current?.readyState]);
    useEffect(() => { /* Image Texture */ if (isStatic && imageElement && imageElement.complete && imageElement.naturalWidth > 0) { if (!imageTextureRef.current || imageTextureRef.current.image !== imageElement) { imageTextureRef.current?.dispose(); imageTextureRef.current = new THREE.Texture(imageElement); imageTextureRef.current.colorSpace = THREE.SRGBColorSpace; imageTextureRef.current.needsUpdate = true; } } else if (isStatic && imageTextureRef.current) { imageTextureRef.current.dispose(); imageTextureRef.current = null; } }, [isStatic, imageElement, imageElement?.complete]);
    useEffect(() => { /* Segmentation Mask Texture (Data created but not used by shader) */ const results = segmentationResults; const hasMaskData = results?.confidenceMasks?.[0]; if (hasMaskData) { const confidenceMaskObject = results.confidenceMasks[0]; const maskWidth = confidenceMaskObject?.width; const maskHeight = confidenceMaskObject?.height; let maskData = null; try { if (typeof confidenceMaskObject?.getAsFloat32Array === 'function') { maskData = confidenceMaskObject.getAsFloat32Array(); } else if (confidenceMaskObject?.data instanceof Float32Array) { maskData = confidenceMaskObject.data; } } catch (error) { maskData = null; } if (maskData instanceof Float32Array && maskWidth > 0 && maskHeight > 0) { const now = performance.now(); const timeSinceLastUpdate = now - lastMaskUpdateTime.current; const throttleThreshold = isStatic ? 0 : 66; if (timeSinceLastUpdate > throttleThreshold) { lastMaskUpdateTime.current = now; try { let texture = segmentationTextureRef.current; if (!texture || texture.image.width !== maskWidth || texture.image.height !== maskHeight) { texture?.dispose(); texture = new THREE.DataTexture(maskData, maskWidth, maskHeight, THREE.RedFormat, THREE.FloatType); texture.minFilter = THREE.NearestFilter; texture.magFilter = THREE.NearestFilter; texture.generateMipmaps = false; texture.needsUpdate = true; segmentationTextureRef.current = texture; } else { texture.image.data = maskData; texture.needsUpdate = true; } } catch (error) { segmentationTextureRef.current?.dispose(); segmentationTextureRef.current = null; } } } else { if (segmentationTextureRef.current) { segmentationTextureRef.current.dispose(); segmentationTextureRef.current = null; } } } else { if (segmentationTextureRef.current) { segmentationTextureRef.current.dispose(); segmentationTextureRef.current = null; } } }, [segmentationResults, isStatic]);
    // Landmark Texture Effect (USING RGBA 32x16 - No change from previous)
    useEffect(() => { const landmarks = mediaPipeResults?.faceLandmarks?.[0]; const texWidth = LANDMARK_TEX_WIDTH; const texHeight = LANDMARK_TEX_HEIGHT; const bufferSize = texWidth * texHeight * 4; if (landmarks && landmarks.length > 0) { const now = performance.now(); const timeSinceLastUpdate = now - lastLandmarkUpdateTime.current; const throttleThreshold = isStatic ? 0 : 33; if (timeSinceLastUpdate > throttleThreshold) { lastLandmarkUpdateTime.current = now; try { if (!landmarkDataArray.current || landmarkDataArray.current.length !== bufferSize) { landmarkDataArray.current = new Float32Array(bufferSize); } const buffer = landmarkDataArray.current; buffer.fill(0.0); for (let i = 0; i < landmarks.length && i < texWidth * texHeight; i++) { const pixelIndex = i * 4; buffer[pixelIndex] = landmarks[i].x; buffer[pixelIndex + 1] = landmarks[i].y; } let texture = landmarkTextureRef.current; if (!texture || texture.image.width !== texWidth || texture.image.height !== texHeight) { texture?.dispose(); texture = new THREE.DataTexture(buffer, texWidth, texHeight, THREE.RGBAFormat, THREE.FloatType); texture.minFilter = THREE.NearestFilter; texture.magFilter = THREE.NearestFilter; texture.generateMipmaps = false; texture.needsUpdate = true; landmarkTextureRef.current = texture; } else { texture.image.data = buffer; texture.needsUpdate = true; } if (effectPassRef.current) { effectPassRef.current.uniforms.uHasLandmarks.value = true; } } catch (error) { console.error("TryOnRenderer: Error processing landmark texture:", error); landmarkTextureRef.current?.dispose(); landmarkTextureRef.current = null; landmarkDataArray.current = null; if (effectPassRef.current) { effectPassRef.current.uniforms.uHasLandmarks.value = false; } } } else if (effectPassRef.current && effectPassRef.current.uniforms.uHasLandmarks.value !== !!landmarkTextureRef.current) { effectPassRef.current.uniforms.uHasLandmarks.value = !!landmarkTextureRef.current; } } else { if (landmarkTextureRef.current) { landmarkTextureRef.current.dispose(); landmarkTextureRef.current = null; } if (effectPassRef.current) { effectPassRef.current.uniforms.uHasLandmarks.value = false; } } }, [mediaPipeResults, isStatic]);


    // --- Handle Resizing (No changes needed) ---
    const handleResize = useCallback(() => { /* ... */ }, []);
    // --- Scale Base Plane (No changes needed) ---
    const fitPlaneToCamera = useCallback((textureWidth, textureHeight) => { /* ... */ }, []);


    // --- Render Loop (Updates only Landmark Uniform for debug shader) ---
     const renderLoop = useCallback(() => {
        animationFrameHandle.current = requestAnimationFrame(renderLoop);
        renderLoopCounter.current++;
        if (!isInitialized.current || !rendererInstanceRef.current || !composerRef.current || !basePlaneMeshRef.current || !effectPassRef.current) { return; }

        try {
            // 1 & 2: Select Texture, Assign Map, Update Plane Scale/Mirroring (Needed for RenderPass)
            const baseMaterial = basePlaneMeshRef.current.material; let sourceWidth = 0, sourceHeight = 0; let textureToAssign = null; let isVideo = !isStatic; let needsTextureUpdate = false; if (isVideo && videoTextureRef.current) { textureToAssign = videoTextureRef.current; const video = textureToAssign.image; if(video && video.readyState >= video.HAVE_CURRENT_DATA) { sourceWidth = video.videoWidth; sourceHeight = video.videoHeight; needsTextureUpdate = (baseMaterial.map !== textureToAssign); } else { textureToAssign = null; } } else if (isStatic && imageTextureRef.current) { textureToAssign = imageTextureRef.current; const image = textureToAssign.image; if(image && image.complete && image.naturalWidth > 0) { sourceWidth = image.naturalWidth; sourceHeight = image.naturalHeight; needsTextureUpdate = (baseMaterial.map !== textureToAssign) || textureToAssign.needsUpdate; } else { textureToAssign = null; } } if (baseMaterial && needsTextureUpdate) { baseMaterial.map = textureToAssign; baseMaterial.needsUpdate = true; } else if (baseMaterial && baseMaterial.map !== textureToAssign && !textureToAssign) { baseMaterial.map = null; baseMaterial.needsUpdate = true; } const planeVisible = !!baseMaterial?.map && sourceWidth > 0 && sourceHeight > 0; if (planeVisible) { fitPlaneToCamera(sourceWidth, sourceHeight); const scaleX = Math.abs(basePlaneMeshRef.current.scale.x); const newScaleX = isVideo ? -scaleX : scaleX; if(basePlaneMeshRef.current.scale.x !== newScaleX) { basePlaneMeshRef.current.scale.x = newScaleX; } } else { if (basePlaneMeshRef.current.scale.x !== 0 || basePlaneMeshRef.current.scale.y !== 0) { basePlaneMeshRef.current.scale.set(0, 0, 0); } } if (planeVisible && textureToAssign && textureToAssign.needsUpdate) { textureToAssign.needsUpdate = false; }

            // 3. Update ShaderPass Uniforms (Only Landmark ones matter for debug)
             if (effectPassRef.current) {
                 const uniforms = effectPassRef.current.uniforms;
                 // Landmark Data Texture
                 if (uniforms.uLandmarkData.value !== landmarkTextureRef.current) {
                    uniforms.uLandmarkData.value = landmarkTextureRef.current;
                    uniforms.uHasLandmarks.value = !!landmarkTextureRef.current; // Also update flag
                 }
             }

            // 4. Render using the Composer
            composerRef.current.render();

        } catch (error) {
            console.error("TryOnRenderer: Error in renderLoop:", error);
        }
    }, [fitPlaneToCamera, isStatic]);


    // --- Initialize Scene (Uses LandmarkDebugShader definition for ShaderPass) ---
    const initThreeScene = useCallback(() => {
        if (!canvasRef.current || isInitialized.current) { return; }
        console.log("DEBUG: initThreeScene START (Landmark Isolation DEBUG)"); // Updated log
        let tempRenderTarget = null;
        try {
            // Add logging before critical steps
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

            // <<< Add ShaderPass using the LandmarkDebugShader definition >>>
            console.log("DEBUG: Setting up Landmark Debug ShaderPass...");
            if (!LandmarkDebugShader || !LandmarkDebugShader.uniforms) {
                 throw new Error("LandmarkDebugShader object is invalid.");
            }
            const debugShaderPassUniforms = UniformsUtils.clone(LandmarkDebugShader.uniforms);
            effectPassRef.current = new ShaderPass({
                uniforms: debugShaderPassUniforms,
                vertexShader: LandmarkDebugShader.vertexShader,
                fragmentShader: LandmarkDebugShader.fragmentShader
            }, "tDiffuse"); // Specify input texture name (even though shader ignores it)
            if (!effectPassRef.current) {
                 throw new Error("Failed to create ShaderPass.");
            }
            effectPassRef.current.renderToScreen = true;
            composerRef.current.addPass(effectPassRef.current);
            console.log("DEBUG: Added ShaderPass (Landmark Isolation DEBUG)."); // Updated log

            // Finish initialization
            isInitialized.current = true; // Set flag *before* starting loop
            handleResize(); // Call resize AFTER initialization
            cancelAnimationFrame(animationFrameHandle.current); // Ensure no duplicate loops
            animationFrameHandle.current = requestAnimationFrame(renderLoop); // Start loop *only on success*
            console.log("DEBUG: initThreeScene SUCCESSFUL. Starting render loop.");

        } catch (error) {
            console.error("DEBUG: initThreeScene FAILED:", error); tempRenderTarget?.dispose(); composerRef.current = null; effectPassRef.current = null; basePlaneMeshRef.current?.geometry?.dispose(); basePlaneMeshRef.current?.material?.dispose(); rendererInstanceRef.current?.dispose(); rendererInstanceRef.current = null; isInitialized.current = false;
        }
    }, [handleResize, renderLoop, LandmarkDebugShader]); // Depend on LandmarkDebugShader ref now


    // --- Setup / Cleanup Effect (Dispose landmark texture) ---
    useEffect(() => {
        initThreeScene();
        let resizeObserver; const currentCanvas = canvasRef.current;
        if (currentCanvas) { resizeObserver = new ResizeObserver(() => { handleResize(); }); resizeObserver.observe(currentCanvas); }
        return () => {
            resizeObserver?.disconnect(); cancelAnimationFrame(animationFrameHandle.current); isInitialized.current = false;
            videoTextureRef.current?.dispose(); videoTextureRef.current = null;
            imageTextureRef.current?.dispose(); imageTextureRef.current = null;
            segmentationTextureRef.current?.dispose(); segmentationTextureRef.current = null; // Still dispose even if unused by shader
            landmarkTextureRef.current?.dispose(); landmarkTextureRef.current = null; // <<< Dispose landmark texture
            landmarkDataArray.current = null; // Clear buffer ref
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