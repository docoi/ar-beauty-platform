// src/components/TryOnRenderer.jsx - CONSTRAIN EFFECT TO FACE BBOX (Attempt 4 - RGBA Texture)
// Uses Aligned Silhouette Mask + Landmark Bounding Box (RGBA Landmark Texture)

import React, { useRef, forwardRef, useEffect, useCallback } from 'react';
import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { UniformsUtils } from 'three';

// Define max landmarks we expect (FaceLandmarker has 478)
// Texture dimensions chosen to hold at least 478 landmarks
const LANDMARK_TEX_WIDTH = 32;
const LANDMARK_TEX_HEIGHT = 16; // 32 * 16 = 512 storage locations

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
    const landmarkTextureRef = useRef(null);     // <<< For landmarks (RGBA)
    const landmarkDataArray = useRef(null);      // <<< Buffer for landmarks (RGBA)
    const composerRef = useRef(null); const effectPassRef = useRef(null);
    const currentIntensity = useRef(0.5);
    const renderLoopCounter = useRef(0); const lastMaskUpdateTime = useRef(0);
    const lastLandmarkUpdateTime = useRef(0);     // <<< For landmarks


    // --- Shaders (Updated getLandmark for RGBA texture) ---
    const customVertexShader = `varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 ); }`;
    const customFragmentShader = `
        // Define texture dimensions for shader calculations
        #define LANDMARK_TEX_WIDTH_FLOAT 32.0
        #define LANDMARK_TEX_HEIGHT_FLOAT 16.0

        uniform sampler2D tDiffuse;
        uniform sampler2D uSegmentationMask;
        uniform sampler2D uLandmarkData; // <<< Landmark texture sampler (RGBA)
        uniform float uEffectIntensity;
        uniform bool uHasMask;
        uniform bool uHasLandmarks; // <<< Landmark flag
        uniform bool uFlipMaskX;    // <<< For coordinate flipping

        varying vec2 vUv;

        // Helper to get landmark data (XY) from RG channels of RGBA Float texture (2D)
        vec2 getLandmark(int index) {
            // Calculate the row and column in the 2D texture
            float col = mod(float(index), LANDMARK_TEX_WIDTH_FLOAT);
            float row = floor(float(index) / LANDMARK_TEX_WIDTH_FLOAT);

            // Calculate UV coordinates, sampling the center of the texel
            float uvx = (col + 0.5) / LANDMARK_TEX_WIDTH_FLOAT;
            float uvy = (row + 0.5) / LANDMARK_TEX_HEIGHT_FLOAT;

            // Sample RGBA texture, return XY from RG channels
            return texture2D(uLandmarkData, vec2(uvx, uvy)).rg;
        }

        // Basic Bounding Box check using a few key landmarks
        // Accepts flipX flag to correct coordinate system for comparison
        bool isInsideFaceBBox(vec2 pointUV, bool shouldFlipX) {
            vec2 p = vec2(pointUV.x, 1.0 - pointUV.y);
            if (shouldFlipX) { p.x = 1.0 - p.x; }

            vec2 forehead = getLandmark(10); vec2 chin = getLandmark(152);
            vec2 leftCheek = getLandmark(234); vec2 rightCheek= getLandmark(454);

            float padX = 0.03; float padY = 0.05;
            float minX = min(leftCheek.x, rightCheek.x) - padX; float maxX = max(leftCheek.x, rightCheek.x) + padX;
            float minY = forehead.y - padY; float maxY = chin.y + padY;

            return p.x > minX && p.x < maxX && p.y > minY && p.y < maxY;
        }


        vec3 applyHydrationEffect(vec3 c){ vec3 h=c*(1.0+0.1*uEffectIntensity); h+=vec3(0.05*uEffectIntensity); return h; }

        void main() {
            vec4 bC = texture2D(tDiffuse,vUv);
            vec3 fC = bC.rgb;
            bool applyEffect = false;

            if(uHasLandmarks && uHasMask && uEffectIntensity > 0.01) {
                if (isInsideFaceBBox(vUv, uFlipMaskX)) {
                    float maskCoordX = uFlipMaskX ? (1.0 - vUv.x) : vUv.x;
                    float maskCoordY = 1.0 - vUv.y;
                    float silhouetteMaskValue = texture2D(uSegmentationMask, vec2(maskCoordX, maskCoordY)).r;
                    if (silhouetteMaskValue > 0.5) {
                        applyEffect = true;
                    }
                }
            }

            if (applyEffect) {
                // Apply effect only if inside bbox and silhouette
                fC = applyHydrationEffect(fC);
            }

            fC=clamp(fC, 0.0, 1.0);
            gl_FragColor=vec4(fC, bC.a);
        }
    `;

    // Shader definition object (Includes landmark uniforms)
    const HydrationShader = useRef({
        uniforms: {
            'tDiffuse': { value: null },
            'uSegmentationMask': { value: null },
            'uLandmarkData': { value: null }, // <<< ADDED BACK
            'uEffectIntensity': { value: 0.5 },
            'uHasMask': { value: false },
            'uHasLandmarks': { value: false }, // <<< ADDED BACK
            'uFlipMaskX': { value: false }
        },
        vertexShader: customVertexShader,
        fragmentShader: customFragmentShader
    }).current;


    // --- Prop Effects / Texture Effects ---
    useEffect(() => { currentIntensity.current = effectIntensity; if (effectPassRef.current) { effectPassRef.current.uniforms.uEffectIntensity.value = currentIntensity.current; } }, [effectIntensity]);
    useEffect(() => { /* Video Texture */ const videoElement = videoRefProp?.current; if (!isStatic && videoElement && videoElement.readyState >= videoElement.HAVE_METADATA) { if (!videoTextureRef.current || videoTextureRef.current.image !== videoElement) { videoTextureRef.current?.dispose(); videoTextureRef.current = new THREE.VideoTexture(videoElement); videoTextureRef.current.colorSpace = THREE.SRGBColorSpace; } } else if (!isStatic && videoTextureRef.current) { videoTextureRef.current.dispose(); videoTextureRef.current = null; } }, [isStatic, videoRefProp, videoRefProp?.current?.readyState]);
    useEffect(() => { /* Image Texture */ if (isStatic && imageElement && imageElement.complete && imageElement.naturalWidth > 0) { if (!imageTextureRef.current || imageTextureRef.current.image !== imageElement) { imageTextureRef.current?.dispose(); imageTextureRef.current = new THREE.Texture(imageElement); imageTextureRef.current.colorSpace = THREE.SRGBColorSpace; imageTextureRef.current.needsUpdate = true; } } else if (isStatic && imageTextureRef.current) { imageTextureRef.current.dispose(); imageTextureRef.current = null; } }, [isStatic, imageElement, imageElement?.complete]);
    useEffect(() => { /* Segmentation Mask Texture */ const results = segmentationResults; const hasMaskData = results?.confidenceMasks?.[0]; if (hasMaskData) { const confidenceMaskObject = results.confidenceMasks[0]; const maskWidth = confidenceMaskObject?.width; const maskHeight = confidenceMaskObject?.height; let maskData = null; try { if (typeof confidenceMaskObject?.getAsFloat32Array === 'function') { maskData = confidenceMaskObject.getAsFloat32Array(); } else if (confidenceMaskObject?.data instanceof Float32Array) { maskData = confidenceMaskObject.data; } else { console.warn("TryOnRenderer: confidenceMasks[0] data format not recognized."); } } catch (error) { console.error("TryOnRenderer: Error getting mask data from confidenceMasks:", error); maskData = null; } if (maskData instanceof Float32Array && maskWidth > 0 && maskHeight > 0) { const now = performance.now(); const timeSinceLastUpdate = now - lastMaskUpdateTime.current; const throttleThreshold = isStatic ? 0 : 66; if (timeSinceLastUpdate > throttleThreshold) { lastMaskUpdateTime.current = now; try { let texture = segmentationTextureRef.current; if (!texture || texture.image.width !== maskWidth || texture.image.height !== maskHeight) { texture?.dispose(); texture = new THREE.DataTexture(maskData, maskWidth, maskHeight, THREE.RedFormat, THREE.FloatType); texture.minFilter = THREE.NearestFilter; texture.magFilter = THREE.NearestFilter; texture.generateMipmaps = false; texture.needsUpdate = true; segmentationTextureRef.current = texture; } else { texture.image.data = maskData; texture.needsUpdate = true; } if (effectPassRef.current) { effectPassRef.current.uniforms.uSegmentationMask.value = segmentationTextureRef.current; effectPassRef.current.uniforms.uHasMask.value = true; } } catch (error) { console.error("TryOnRenderer: Error processing mask texture from ImageSegmenter:", error); segmentationTextureRef.current?.dispose(); segmentationTextureRef.current = null; if (effectPassRef.current) { effectPassRef.current.uniforms.uSegmentationMask.value = null; effectPassRef.current.uniforms.uHasMask.value = false; } } } else { if (effectPassRef.current && effectPassRef.current.uniforms.uSegmentationMask.value !== segmentationTextureRef.current) { effectPassRef.current.uniforms.uSegmentationMask.value = segmentationTextureRef.current; effectPassRef.current.uniforms.uHasMask.value = !!segmentationTextureRef.current; } } } else { if (segmentationTextureRef.current) { segmentationTextureRef.current.dispose(); segmentationTextureRef.current = null; } if (effectPassRef.current) { effectPassRef.current.uniforms.uSegmentationMask.value = null; effectPassRef.current.uniforms.uHasMask.value = false; } } } else { if (segmentationTextureRef.current) { segmentationTextureRef.current.dispose(); segmentationTextureRef.current = null; } if (effectPassRef.current) { effectPassRef.current.uniforms.uSegmentationMask.value = null; effectPassRef.current.uniforms.uHasMask.value = false; } } }, [segmentationResults, isStatic]);

    // --- Landmark Texture Effect (USING RGBA 32x16) ---
    useEffect(() => {
        const landmarks = mediaPipeResults?.faceLandmarks?.[0]; // Get landmarks

        // Texture dimensions
        const texWidth = LANDMARK_TEX_WIDTH;  // Use constant
        const texHeight = LANDMARK_TEX_HEIGHT; // Use constant
        const bufferSize = texWidth * texHeight * 4; // RGBA * 4 floats per pixel

        if (landmarks && landmarks.length > 0) {
             const now = performance.now();
             const timeSinceLastUpdate = now - lastLandmarkUpdateTime.current;
             const throttleThreshold = isStatic ? 0 : 33; // Throttle landmark updates too (~30fps)

             if (timeSinceLastUpdate > throttleThreshold) {
                 lastLandmarkUpdateTime.current = now;
                 try {
                     // Ensure buffer exists and is the correct size
                     if (!landmarkDataArray.current || landmarkDataArray.current.length !== bufferSize) {
                         landmarkDataArray.current = new Float32Array(bufferSize);
                         // console.log(`TryOnRenderer: Created landmark RGBA Float32Array buffer (size: ${bufferSize})`);
                     }
                     const buffer = landmarkDataArray.current;
                     buffer.fill(0.0); // Clear buffer with floats

                     // Fill buffer (RGBA format, store XY in RG)
                     for (let i = 0; i < landmarks.length && i < texWidth * texHeight; i++) {
                         const pixelIndex = i * 4; // Index for the R channel
                         buffer[pixelIndex] = landmarks[i].x;     // R = X
                         buffer[pixelIndex + 1] = landmarks[i].y; // G = Y
                         // buffer[pixelIndex + 2] = 0.0;          // B = unused (already 0)
                         // buffer[pixelIndex + 3] = 1.0;          // A = unused (already 0)
                     }

                     // Create or update DataTexture using RGBAFormat
                     let texture = landmarkTextureRef.current;
                     if (!texture || texture.image.width !== texWidth || texture.image.height !== texHeight) {
                         texture?.dispose();
                         // console.log(`TryOnRenderer Landmark Texture: Creating NEW RGBA DataTexture (${texWidth}x${texHeight})`);
                         // *** Use RGBAFormat ***
                         texture = new THREE.DataTexture(buffer, texWidth, texHeight, THREE.RGBAFormat, THREE.FloatType);
                         texture.minFilter = THREE.NearestFilter; texture.magFilter = THREE.NearestFilter;
                         texture.generateMipmaps = false;
                         texture.needsUpdate = true;
                         landmarkTextureRef.current = texture;
                     } else {
                         // console.log(`TryOnRenderer Landmark Texture: Updating existing RGBA DataTexture.`);
                         texture.image.data = buffer; // Update data reference potentially
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
             } else if (effectPassRef.current && effectPassRef.current.uniforms.uHasLandmarks.value !== !!landmarkTextureRef.current) {
                  // Ensure flag matches texture state even if throttled
                  effectPassRef.current.uniforms.uHasLandmarks.value = !!landmarkTextureRef.current;
             }

        } else {
             // No landmarks found
             if (landmarkTextureRef.current) { landmarkTextureRef.current.dispose(); landmarkTextureRef.current = null; }
             if (effectPassRef.current) { effectPassRef.current.uniforms.uHasLandmarks.value = false; }
        }
    }, [mediaPipeResults, isStatic]); // Depends on landmark results


    // --- Handle Resizing (No changes) ---
    const handleResize = useCallback(() => { /* ... */ }, []);
    // --- Scale Base Plane (No changes) ---
    const fitPlaneToCamera = useCallback((textureWidth, textureHeight) => { /* ... */ }, []);


    // --- Render Loop (Updates Landmark Texture Uniform) ---
     const renderLoop = useCallback(() => {
        animationFrameHandle.current = requestAnimationFrame(renderLoop);
        renderLoopCounter.current++;
        if (!isInitialized.current || !rendererInstanceRef.current || !composerRef.current || !basePlaneMeshRef.current || !effectPassRef.current) { return; }

        try {
            // 1 & 2: Select Texture, Assign Map, Update Plane Scale/Mirroring (No changes)
            const baseMaterial = basePlaneMeshRef.current.material; let sourceWidth = 0, sourceHeight = 0; let textureToAssign = null; let isVideo = !isStatic; let needsTextureUpdate = false; if (isVideo && videoTextureRef.current) { textureToAssign = videoTextureRef.current; const video = textureToAssign.image; if(video && video.readyState >= video.HAVE_CURRENT_DATA) { sourceWidth = video.videoWidth; sourceHeight = video.videoHeight; needsTextureUpdate = (baseMaterial.map !== textureToAssign); } else { textureToAssign = null; } } else if (isStatic && imageTextureRef.current) { textureToAssign = imageTextureRef.current; const image = textureToAssign.image; if(image && image.complete && image.naturalWidth > 0) { sourceWidth = image.naturalWidth; sourceHeight = image.naturalHeight; needsTextureUpdate = (baseMaterial.map !== textureToAssign) || textureToAssign.needsUpdate; } else { textureToAssign = null; } } if (baseMaterial && needsTextureUpdate) { baseMaterial.map = textureToAssign; baseMaterial.needsUpdate = true; } else if (baseMaterial && baseMaterial.map !== textureToAssign && !textureToAssign) { baseMaterial.map = null; baseMaterial.needsUpdate = true; } const planeVisible = !!baseMaterial?.map && sourceWidth > 0 && sourceHeight > 0; if (planeVisible) { fitPlaneToCamera(sourceWidth, sourceHeight); const scaleX = Math.abs(basePlaneMeshRef.current.scale.x); const newScaleX = isVideo ? -scaleX : scaleX; if(basePlaneMeshRef.current.scale.x !== newScaleX) { basePlaneMeshRef.current.scale.x = newScaleX; } } else { if (basePlaneMeshRef.current.scale.x !== 0 || basePlaneMeshRef.current.scale.y !== 0) { basePlaneMeshRef.current.scale.set(0, 0, 0); } } if (planeVisible && textureToAssign && textureToAssign.needsUpdate) { textureToAssign.needsUpdate = false; }

            // 3. Update ShaderPass Uniforms
             if (effectPassRef.current) {
                 const uniforms = effectPassRef.current.uniforms;
                 // Segmentation Mask
                 if (uniforms.uSegmentationMask.value !== segmentationTextureRef.current) {
                    uniforms.uSegmentationMask.value = segmentationTextureRef.current;
                    uniforms.uHasMask.value = !!segmentationTextureRef.current;
                 }
                 // Landmark Data Texture
                 if (uniforms.uLandmarkData.value !== landmarkTextureRef.current) {
                    uniforms.uLandmarkData.value = landmarkTextureRef.current;
                    uniforms.uHasLandmarks.value = !!landmarkTextureRef.current; // Also update flag
                 }
                 // Flip Flag
                 uniforms.uFlipMaskX.value = isVideo;
             }

            // 4. Render using the Composer
            composerRef.current.render();

        } catch (error) {
            console.error("TryOnRenderer: Error in renderLoop:", error);
        }
    }, [fitPlaneToCamera, isStatic]);


    // --- Initialize Scene (No changes) ---
    const initThreeScene = useCallback(() => {
        if (!canvasRef.current || isInitialized.current) { return; } console.log("DEBUG: initThreeScene START (BBox Constraint - RGBA Texture)"); let tempRenderTarget = null; try { console.log("DEBUG: Initializing renderer..."); const canvas = canvasRef.current; const initialWidth = Math.max(1, canvas.clientWidth || 640); const initialHeight = Math.max(1, canvas.clientHeight || 480); const renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true }); renderer.setSize(initialWidth, initialHeight); renderer.setPixelRatio(window.devicePixelRatio); renderer.outputColorSpace = THREE.SRGBColorSpace; rendererInstanceRef.current = renderer; console.log("DEBUG: Renderer initialized."); console.log("DEBUG: Checking capabilities and creating render target..."); const capabilities = renderer.capabilities; if (!capabilities) { throw new Error("Renderer capabilities object not found."); } let targetType = THREE.UnsignedByteType; let canUseHalfFloat = false; if (capabilities.isWebGL2) { canUseHalfFloat = true; } else { const halfFloatExt = capabilities.getExtension('OES_texture_half_float'); const colorBufferFloatExt = capabilities.getExtension('WEBGL_color_buffer_float'); if (halfFloatExt && colorBufferFloatExt) { canUseHalfFloat = true; } } if (canUseHalfFloat) { targetType = THREE.HalfFloatType; } const renderTargetOptions = { minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, format: THREE.RGBAFormat, type: targetType, depthBuffer: false, stencilBuffer: false }; tempRenderTarget = new THREE.WebGLRenderTarget(initialWidth, initialHeight, renderTargetOptions); tempRenderTarget.texture.generateMipmaps = false; console.log(`DEBUG: Created WebGLRenderTarget (${initialWidth}x${initialHeight}) with type: ${targetType === THREE.HalfFloatType ? 'HalfFloatType' : 'UnsignedByteType'}.`); console.log("DEBUG: Setting up base scene..."); baseSceneRef.current = new THREE.Scene(); baseCameraRef.current = new THREE.OrthographicCamera(-initialWidth / 2, initialWidth / 2, initialHeight / 2, -initialHeight / 2, 0.1, 10); baseCameraRef.current.position.z = 1; const planeGeometry = new THREE.PlaneGeometry(1, 1); const planeMaterial = new THREE.MeshBasicMaterial({ map: null, side: THREE.DoubleSide, color: 0xffffff, transparent: false }); basePlaneMeshRef.current = new THREE.Mesh(planeGeometry, planeMaterial); baseSceneRef.current.add(basePlaneMeshRef.current); console.log("DEBUG: Base scene setup complete."); console.log("DEBUG: Setting up EffectComposer..."); composerRef.current = new EffectComposer(renderer, tempRenderTarget); const renderPass = new RenderPass(baseSceneRef.current, baseCameraRef.current); composerRef.current.addPass(renderPass); console.log("DEBUG: Added RenderPass."); console.log("DEBUG: Setting up ShaderPass..."); const hydrationShaderPassUniforms = UniformsUtils.clone(HydrationShader.uniforms); hydrationShaderPassUniforms.uEffectIntensity.value = currentIntensity.current; effectPassRef.current = new ShaderPass({ uniforms: hydrationShaderPassUniforms, vertexShader: HydrationShader.vertexShader, fragmentShader: HydrationShader.fragmentShader }, "tDiffuse"); effectPassRef.current.renderToScreen = true; composerRef.current.addPass(effectPassRef.current); console.log("DEBUG: Added ShaderPass (Hydration Effect - BBox)."); isInitialized.current = true; handleResize(); cancelAnimationFrame(animationFrameHandle.current); animationFrameHandle.current = requestAnimationFrame(renderLoop); console.log("DEBUG: initThreeScene SUCCESSFUL. Starting render loop."); } catch (error) { console.error("DEBUG: initThreeScene FAILED:", error); tempRenderTarget?.dispose(); composerRef.current = null; effectPassRef.current = null; basePlaneMeshRef.current?.geometry?.dispose(); basePlaneMeshRef.current?.material?.dispose(); rendererInstanceRef.current?.dispose(); rendererInstanceRef.current = null; isInitialized.current = false; }
    }, [handleResize, renderLoop, HydrationShader]);


    // --- Setup / Cleanup Effect (Dispose landmark texture) ---
    useEffect(() => {
        initThreeScene();
        let resizeObserver; const currentCanvas = canvasRef.current;
        if (currentCanvas) { resizeObserver = new ResizeObserver(() => { handleResize(); }); resizeObserver.observe(currentCanvas); }
        return () => {
            resizeObserver?.disconnect(); cancelAnimationFrame(animationFrameHandle.current); isInitialized.current = false;
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
        };
     }, [initThreeScene, handleResize]);


    // --- JSX --- (No change)
    return ( <canvas ref={canvasRef} className={`renderer-canvas ${className || ''}`} style={{ display: 'block', width: '100%', height: '100%', ...(style || {}) }} /> );

});
TryOnRenderer.displayName = 'TryOnRenderer';
export default TryOnRenderer;