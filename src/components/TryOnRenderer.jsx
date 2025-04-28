// src/components/TryOnRenderer.jsx - MORE Mask Logging & Exaggerated Effect

import React, { useRef, forwardRef, useEffect, useCallback, useState, useMemo } from 'react';
import * as THREE from 'three';

console.log(`Using Three.js revision: ${THREE.REVISION}`);

const TryOnRenderer = forwardRef(({
    videoRefProp,
    imageElement,
    mediaPipeResults,
    isStatic,
    brightness,
    contrast,
    effectIntensity,
    className,
    style
 }, ref) => {

    // --- Core Refs ---
    const canvasRef = useRef(null);
    const rendererInstanceRef = useRef(null);
    const animationFrameHandle = useRef(null);
    const isInitialized = useRef(false);
    const baseSceneRef = useRef(null);
    const baseCameraRef = useRef(null);
    const basePlaneMeshRef = useRef(null);
    const videoTextureRef = useRef(null);
    const imageTextureRef = useRef(null);
    const postSceneRef = useRef(null);
    const postCameraRef = useRef(null);
    const postMaterialRef = useRef(null);
    const renderTargetRef = useRef(null);
    const segmentationTextureRef = useRef(null);

    // --- Internal State Refs ---
    const currentResults = useRef(null);
    const currentBrightness = useRef(1.0);
    const currentContrast = useRef(1.0);
    const currentIntensity = useRef(0.5);
    const renderLoopCounter = useRef(0);
    const lastMaskUpdateTime = useRef(0);


    // --- Shaders --- (EXAGGERATED Effect)
    const postVertexShader = `
        varying vec2 vUv;
        void main() {
            vUv = uv;
            gl_Position = vec4(position, 1.0);
        }
    `;

    const postFragmentShader = `
        uniform sampler2D uSceneTexture;
        uniform sampler2D uSegmentationMask;
        uniform float uBrightness;
        uniform float uContrast;
        uniform float uEffectIntensity;
        uniform bool uHasMask;

        varying vec2 vUv;

        vec3 applyBrightnessContrast(vec3 color, float brightness, float contrast) {
            color = color * brightness;
            color = (color - 0.5) * contrast + 0.5;
            return color;
        }

        vec3 applyHydrationEffect(vec3 color) {
            return vec3(1.0, 0.0, 0.0); // Bright Red
        }

        void main() {
            vec4 baseColor = texture2D(uSceneTexture, vUv);
            vec3 correctedColor = applyBrightnessContrast(baseColor.rgb, uBrightness, uContrast);
            vec3 finalColor = correctedColor;

            // Only attempt mix if mask exists
            if (uHasMask && uEffectIntensity > 0.0 && uSegmentationMask != sampler2D(0)) { // Added check for valid sampler
                 float maskValue = texture2D(uSegmentationMask, vUv).r;
                 // Simple thresholding might be useful for debugging
                 // maskValue = step(0.5, maskValue); // Uncomment to make mask binary

                 vec3 hydratedColor = applyHydrationEffect(correctedColor);

                 // Blend using mask and intensity
                 finalColor = mix(correctedColor, hydratedColor, maskValue * uEffectIntensity);
            }

            finalColor = clamp(finalColor, 0.0, 1.0);
            gl_FragColor = vec4(finalColor, baseColor.a);
        }
    `;

    // --- Update internal refs based on props ---
    useEffect(() => { currentResults.current = mediaPipeResults; }, [mediaPipeResults]);
    useEffect(() => { currentBrightness.current = isStatic ? Math.max(0.01, brightness || 1.0) : 1.0; currentContrast.current = isStatic ? Math.max(0.01, contrast || 1.0) : 1.0; }, [isStatic, brightness, contrast]);
    useEffect(() => { currentIntensity.current = effectIntensity; }, [effectIntensity]);


    // --- Effects for Video/Image Textures --- (No changes)
    useEffect(() => { const videoElement = videoRefProp?.current; if (!isStatic && videoElement) { if (!videoTextureRef.current || videoTextureRef.current.image !== videoElement) { videoTextureRef.current?.dispose(); videoTextureRef.current = new THREE.VideoTexture(videoElement); videoTextureRef.current.colorSpace = THREE.SRGBColorSpace; } } else { if (videoTextureRef.current) { videoTextureRef.current.dispose(); videoTextureRef.current = null; } } }, [isStatic, videoRefProp]);
    useEffect(() => { if (isStatic && imageElement) { if (!imageTextureRef.current || imageTextureRef.current.image !== imageElement) { imageTextureRef.current?.dispose(); imageTextureRef.current = new THREE.Texture(imageElement); imageTextureRef.current.colorSpace = THREE.SRGBColorSpace; imageTextureRef.current.needsUpdate = true; } else if (imageTextureRef.current && imageTextureRef.current.image === imageElement) { imageTextureRef.current.needsUpdate = true; } } else { if (imageTextureRef.current) { imageTextureRef.current.dispose(); imageTextureRef.current = null; } } }, [isStatic, imageElement]);


    // --- CORRECTED & LOGGING Effect to manage Segmentation Mask Texture ---
    useEffect(() => {
        const results = currentResults.current;
        const hasMaskDataArray = Array.isArray(results?.segmentationMasks) && results.segmentationMasks.length > 0;

        // *** Log initial check result ***
        // console.log(`TryOnRenderer Mask Check: hasMaskDataArray = ${hasMaskDataArray}`);

        if (hasMaskDataArray) {
            const segmentationMask = results.segmentationMasks[0];
            const mask = segmentationMask?.mask;
            const maskData = segmentationMask?.maskData; // Should be Float32Array or WebGLTexture
            const maskWidth = mask?.width;
            const maskHeight = mask?.height;

            // *** Log details about extracted mask components ***
            // console.log(`TryOnRenderer Mask Details: Mask Obj Type=${typeof mask}, maskData Type=${typeof maskData}, Width=${maskWidth}, Height=${maskHeight}`);

            // Check if maskData is a WebGLTexture (CPU vs GPU processing from MediaPipe)
             if (maskData instanceof WebGLTexture) {
                 console.log("TryOnRenderer Mask Handling: Received WebGLTexture directly (GPU). NEEDS SPECIAL HANDLING (NOT IMPLEMENTED YET).");
                 // TODO: If MediaPipe is configured for GPU output, we need to use the texture directly
                 // This might involve passing the texture handle differently or using it in a specific way.
                 // For now, let's assume CPU fallback or CPU output.
                 if (segmentationTextureRef.current) { // Clear CPU texture if we get GPU one
                      segmentationTextureRef.current.dispose();
                      segmentationTextureRef.current = null;
                 }

             // Check if maskData is a Float32Array (CPU output)
             } else if (maskData instanceof Float32Array && maskWidth > 0 && maskHeight > 0) {
                // *** Log that we are proceeding with Float32Array data ***
                // console.log(`TryOnRenderer Mask Effect: Processing Float32Array mask data. Length: ${maskData.length}`);

                 // Optimization: Throttle texture updates
                 const now = performance.now();
                 const timeSinceLastUpdate = now - lastMaskUpdateTime.current;
                 const throttleThreshold = isStatic ? 0 : 66; // ~15fps

                 if (timeSinceLastUpdate > throttleThreshold) {
                    lastMaskUpdateTime.current = now;

                    try {
                        // *** Log BEFORE creating/updating texture ***
                        // console.log(`TryOnRenderer Mask Texture: Attempting to create/update DataTexture...`);

                        if (!segmentationTextureRef.current || segmentationTextureRef.current.image.width !== maskWidth || segmentationTextureRef.current.image.height !== maskHeight) {
                            console.log(`TryOnRenderer Mask Texture: Creating new DataTexture (${maskWidth}x${maskHeight})`);
                            segmentationTextureRef.current?.dispose();
                            segmentationTextureRef.current = new THREE.DataTexture(maskData, maskWidth, maskHeight, THREE.RedFormat, THREE.FloatType);
                            segmentationTextureRef.current.minFilter = THREE.LinearFilter;
                            segmentationTextureRef.current.magFilter = THREE.LinearFilter;
                            segmentationTextureRef.current.needsUpdate = true;
                            // *** Log AFTER creating texture ***
                            console.log(`TryOnRenderer Mask Texture: New DataTexture CREATED.`);
                        } else {
                            // console.log(`TryOnRenderer Mask Texture: Updating existing DataTexture data.`);
                            segmentationTextureRef.current.image.data = maskData;
                            segmentationTextureRef.current.needsUpdate = true;
                             // *** Log AFTER updating texture ***
                             // console.log(`TryOnRenderer Mask Texture: Existing DataTexture UPDATED.`);
                        }
                    } catch (error) {
                         console.error("TryOnRenderer Mask Texture: Error creating/updating DataTexture:", error);
                         segmentationTextureRef.current?.dispose();
                         segmentationTextureRef.current = null;
                    }
                 } // else { console.log("TryOnRenderer Mask Effect: Throttled mask update."); }

            } else {
                 // *** Log when mask data is invalid/incomplete ***
                 console.warn(`TryOnRenderer Mask Effect: Found segmentationMasks[0] but mask data is not a valid Float32Array or dimensions are invalid. Type: ${maskData?.constructor?.name}, Dims: ${maskWidth}x${maskHeight}`);
                 if (segmentationTextureRef.current) {
                    segmentationTextureRef.current.dispose();
                    segmentationTextureRef.current = null;
                 }
            }
        } else {
            // No mask data array, ensure texture is nullified/disposed
            if (segmentationTextureRef.current) {
                // console.log("TryOnRenderer Mask Effect: No valid segmentation mask array found, disposing texture.");
                segmentationTextureRef.current.dispose();
                segmentationTextureRef.current = null;
            }
        }
    }, [mediaPipeResults, isStatic]);


    // --- Handle Resizing --- (No changes)
    const handleResize = useCallback(() => { /* ... */ }, []);
    // --- Scale Base Plane --- (No changes)
    const fitPlaneToCamera = useCallback((textureWidth, textureHeight) => { /* ... */ }, []);

    // --- Render Loop --- (No changes needed)
     const renderLoop = useCallback(() => {
        animationFrameHandle.current = requestAnimationFrame(renderLoop);
        if (!isInitialized.current || !rendererInstanceRef.current || !baseSceneRef.current || !baseCameraRef.current || !postSceneRef.current || !postCameraRef.current || !basePlaneMeshRef.current || !postMaterialRef.current || !renderTargetRef.current) { return; }

        const currentCount = renderLoopCounter.current++;
        const logThisFrame = (currentCount % 150 === 0);

        try {
            const postUniforms = postMaterialRef.current.uniforms;
            if (!postUniforms || !postUniforms.uBrightness || !postUniforms.uContrast || !postUniforms.uEffectIntensity || !postUniforms.uSegmentationMask || !postUniforms.uHasMask) { return; }

            // Steps 1, 2, 3 (Select Texture, Scale Plane, Render Base) - No changes
            const baseMaterial = basePlaneMeshRef.current.material; let sourceWidth = 0, sourceHeight = 0; let textureToAssign = null; let isVideo = false;
            if (!isStatic && videoTextureRef.current) { textureToAssign = videoTextureRef.current; if (textureToAssign.image) { sourceWidth = textureToAssign.image.videoWidth; sourceHeight = textureToAssign.image.videoHeight; isVideo = true;} } else if (isStatic && imageTextureRef.current) { textureToAssign = imageTextureRef.current; if (textureToAssign.image) { sourceWidth = textureToAssign.image.naturalWidth; sourceHeight = textureToAssign.image.naturalHeight; } if (textureToAssign.needsUpdate) { textureToAssign.needsUpdate = true; } }
            if (baseMaterial.map !== textureToAssign) { baseMaterial.map = textureToAssign; baseMaterial.needsUpdate = true; } else if (textureToAssign && textureToAssign.needsUpdate) { baseMaterial.needsUpdate = true; }
            const planeVisible = !!baseMaterial.map && sourceWidth > 0 && sourceHeight > 0;
            if (planeVisible) { fitPlaneToCamera(sourceWidth, sourceHeight); const scaleX = Math.abs(basePlaneMeshRef.current.scale.x); const newScaleX = isVideo ? -scaleX : scaleX; if(basePlaneMeshRef.current.scale.x !== newScaleX) { basePlaneMeshRef.current.scale.x = newScaleX; } } else { if (basePlaneMeshRef.current.scale.x !== 0 || basePlaneMeshRef.current.scale.y !== 0) { basePlaneMeshRef.current.scale.set(0, 0, 0); } }
            rendererInstanceRef.current.setRenderTarget(renderTargetRef.current); rendererInstanceRef.current.setClearColor(0x000000, 0); rendererInstanceRef.current.clear();
             if (planeVisible) { rendererInstanceRef.current.render(baseSceneRef.current, baseCameraRef.current); if (textureToAssign?.needsUpdate) { textureToAssign.needsUpdate = false; } }
             rendererInstanceRef.current.setRenderTarget(null);

            // 4. Update Post-Processing Uniforms
             postUniforms.uSceneTexture.value = renderTargetRef.current.texture;
             postUniforms.uBrightness.value = currentBrightness.current;
             postUniforms.uContrast.value = currentContrast.current;
             postUniforms.uEffectIntensity.value = currentIntensity.current;
             postUniforms.uSegmentationMask.value = segmentationTextureRef.current; // Assign ref value (null or DataTexture)
             const hasMask = !!segmentationTextureRef.current;
             postUniforms.uHasMask.value = hasMask;

             if (logThisFrame) {
                  // *** Log texture object if it exists ***
                  console.log(`RenderLoop Uniforms: uIntensity=${currentIntensity.current.toFixed(2)}, uHasMask=${hasMask}, MaskTexture Obj:`, segmentationTextureRef.current);
             }

            // 5. Render Post-Processing Scene to Screen
             rendererInstanceRef.current.render(postSceneRef.current, postCameraRef.current);

        } catch (error) { console.error("Error in renderLoop:", error); }
    }, [fitPlaneToCamera, isStatic]);


    // --- Initialize Scene --- (No changes)
    const initThreeScene = useCallback(() => { /* ... */ }, [handleResize, postVertexShader, postFragmentShader, renderLoop]);
    // --- Setup / Cleanup Effect --- (No changes)
    useEffect(() => { /* ... */ }, [initThreeScene, handleResize]);


    // --- JSX --- (No changes)
    return ( <canvas ref={canvasRef} className={`renderer-canvas ${className || ''}`} style={{ display: 'block', width: '100%', height: '100%', ...(style || {}) }} /> );
});

TryOnRenderer.displayName = 'TryOnRenderer';
export default TryOnRenderer;