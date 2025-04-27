// src/components/TryOnRenderer.jsx - ROBUST Mask Check & Exaggerated Effect

import React, { useRef, forwardRef, useEffect, useCallback, useState, useMemo } from 'react';
import * as THREE from 'three';

console.log(`Using Three.js revision: ${THREE.REVISION}`);

const TryOnRenderer = forwardRef(({
    videoRefProp,
    imageElement,
    mediaPipeResults, // Now used for segmentation mask
    isStatic,
    brightness,
    contrast,
    effectIntensity, // Now used for serum effect
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
    const lastMaskUpdateTime = useRef(0); // Optimization: Throttle mask updates


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

        // *** EXAGGERATED Hydration Effect Function (Bright Red) ***
        vec3 applyHydrationEffect(vec3 color) {
            return vec3(1.0, 0.0, 0.0); // Bright Red
        }

        void main() {
            vec4 baseColor = texture2D(uSceneTexture, vUv);
            vec3 correctedColor = applyBrightnessContrast(baseColor.rgb, uBrightness, uContrast);
            vec3 finalColor = correctedColor;

            if (uHasMask && uEffectIntensity > 0.0) {
                float maskValue = texture2D(uSegmentationMask, vUv).r;
                vec3 hydratedColor = applyHydrationEffect(correctedColor); // Will be red

                // Blend using mask and intensity
                // Add a small epsilon to maskValue to avoid potential artifacts at 0
                finalColor = mix(correctedColor, hydratedColor, clamp(maskValue + 0.001, 0.0, 1.0) * uEffectIntensity);
            }

            finalColor = clamp(finalColor, 0.0, 1.0);
            gl_FragColor = vec4(finalColor, baseColor.a);
        }
    `;

    // --- Update internal refs based on props ---
    useEffect(() => {
        currentResults.current = mediaPipeResults;
        // Basic log moved to mask effect hook
    }, [mediaPipeResults]);

    useEffect(() => {
        currentBrightness.current = isStatic ? Math.max(0.01, brightness || 1.0) : 1.0;
        currentContrast.current = isStatic ? Math.max(0.01, contrast || 1.0) : 1.0;
    }, [isStatic, brightness, contrast]);

    useEffect(() => {
        currentIntensity.current = effectIntensity;
    }, [effectIntensity]);


    // --- Effect to manage Video Texture --- (No changes)
    useEffect(() => {
        const videoElement = videoRefProp?.current;
        if (!isStatic && videoElement) { if (!videoTextureRef.current || videoTextureRef.current.image !== videoElement) { videoTextureRef.current?.dispose(); videoTextureRef.current = new THREE.VideoTexture(videoElement); videoTextureRef.current.colorSpace = THREE.SRGBColorSpace; } } else { if (videoTextureRef.current) { videoTextureRef.current.dispose(); videoTextureRef.current = null; } }
    }, [isStatic, videoRefProp]);


    // --- Effect to manage Image Texture --- (No changes)
    useEffect(() => {
        if (isStatic && imageElement) { if (!imageTextureRef.current || imageTextureRef.current.image !== imageElement) { imageTextureRef.current?.dispose(); imageTextureRef.current = new THREE.Texture(imageElement); imageTextureRef.current.colorSpace = THREE.SRGBColorSpace; imageTextureRef.current.needsUpdate = true; } else if (imageTextureRef.current && imageTextureRef.current.image === imageElement) { imageTextureRef.current.needsUpdate = true; } } else { if (imageTextureRef.current) { imageTextureRef.current.dispose(); imageTextureRef.current = null; } }
    }, [isStatic, imageElement]);


    // --- ***** CORRECTED & OPTIMIZED Effect to manage Segmentation Mask Texture ***** ---
    useEffect(() => {
        const results = currentResults.current;
        // *** Robust check: Ensure segmentationMasks exists, is an array, and has length > 0 ***
        const hasMaskData = Array.isArray(results?.segmentationMasks) && results.segmentationMasks.length > 0;

        if (hasMaskData) {
            const segmentationMask = results.segmentationMasks[0]; // Now safe to access [0]
            const mask = segmentationMask?.mask; // MediaPipe Mask object
            const maskData = segmentationMask?.maskData; // Float32Array
            const maskWidth = mask?.width;
            const maskHeight = mask?.height;

            // Ensure we have all necessary mask components
            if (mask && maskData && maskWidth > 0 && maskHeight > 0) {

                 // Optimization: Throttle texture updates in real-time mode
                 const now = performance.now();
                 const timeSinceLastUpdate = now - lastMaskUpdateTime.current;
                 // Update mask texture max ~15 times per second (adjust threshold as needed)
                 // Or always update if it's a static image
                 const throttleThreshold = isStatic ? 0 : 66; // ~15fps = 1000ms/15 = 66ms

                 if (timeSinceLastUpdate > throttleThreshold) {
                    lastMaskUpdateTime.current = now; // Update timestamp

                    // console.log(`TryOnRenderer Mask Effect: Processing mask ${maskWidth}x${maskHeight}`);

                    try {
                        if (!segmentationTextureRef.current || segmentationTextureRef.current.image.width !== maskWidth || segmentationTextureRef.current.image.height !== maskHeight) {
                            console.log(`TryOnRenderer Mask Effect: Creating new mask texture (${maskWidth}x${maskHeight})`);
                            segmentationTextureRef.current?.dispose();
                            segmentationTextureRef.current = new THREE.DataTexture(maskData, maskWidth, maskHeight, THREE.RedFormat, THREE.FloatType);
                            // Linear filter might be better for smoother mask edges
                            segmentationTextureRef.current.minFilter = THREE.LinearFilter;
                            segmentationTextureRef.current.magFilter = THREE.LinearFilter;
                            segmentationTextureRef.current.needsUpdate = true;
                        } else {
                            // console.log(`TryOnRenderer Mask Effect: Updating existing mask texture data (Throttled)`);
                            segmentationTextureRef.current.image.data = maskData;
                            segmentationTextureRef.current.needsUpdate = true;
                        }
                    } catch (error) {
                         console.error("Error creating/updating mask texture:", error);
                         // Dispose potentially corrupted texture
                         segmentationTextureRef.current?.dispose();
                         segmentationTextureRef.current = null;
                    }
                 }
                 // else { console.log("TryOnRenderer Mask Effect: Throttled mask update."); }

            } else {
                 console.warn("TryOnRenderer Mask Effect: Found segmentationMasks[0] but mask data is incomplete/invalid.");
                 // No valid mask data, ensure texture is removed
                 if (segmentationTextureRef.current) {
                    segmentationTextureRef.current.dispose();
                    segmentationTextureRef.current = null;
                 }
            }
        } else {
            // No mask data in results, ensure texture is nullified/disposed
            if (segmentationTextureRef.current) {
                // console.log("TryOnRenderer Mask Effect: No valid segmentation mask found in results, disposing texture.");
                segmentationTextureRef.current.dispose();
                segmentationTextureRef.current = null;
            }
        }
    }, [mediaPipeResults, isStatic]); // Add isStatic dependency for throttling logic


    // --- Handle Resizing --- (No changes)
    const handleResize = useCallback(() => {
         const canvas = canvasRef.current; if (!rendererInstanceRef.current || !baseCameraRef.current || !postCameraRef.current || !canvas || !renderTargetRef.current) return; const newWidth = canvas.clientWidth; const newHeight = canvas.clientHeight; if (newWidth === 0 || newHeight === 0) return; const currentSize = rendererInstanceRef.current.getSize(new THREE.Vector2()); if (currentSize.x === newWidth && currentSize.y === newHeight) return; try { rendererInstanceRef.current.setSize(newWidth, newHeight); renderTargetRef.current.setSize(newWidth, newHeight); baseCameraRef.current.left = -newWidth / 2; baseCameraRef.current.right = newWidth / 2; baseCameraRef.current.top = newHeight / 2; baseCameraRef.current.bottom = -newHeight / 2; baseCameraRef.current.updateProjectionMatrix(); } catch(e) { console.error("Resize Error:", e);}
    }, []);


    // --- Scale Base Plane --- (No changes)
    const fitPlaneToCamera = useCallback((textureWidth, textureHeight) => {
        const canvas = canvasRef.current; if (!baseCameraRef.current || !basePlaneMeshRef.current || !textureWidth || !textureHeight || !canvas || canvas.clientWidth === 0 || canvas.clientHeight === 0) return; const viewWidth = canvas.clientWidth; const viewHeight = canvas.clientHeight; const viewAspect = viewWidth / viewHeight; const textureAspect = textureWidth / textureHeight; let scaleX, scaleY; if (viewAspect > textureAspect) { scaleX = viewWidth; scaleY = scaleX / textureAspect; } else { scaleY = viewHeight; scaleX = scaleY * textureAspect; } const currentScale = basePlaneMeshRef.current.scale; const currentSignX = Math.sign(currentScale.x) || 1; const newScaleXWithSign = scaleX * currentSignX; if (Math.abs(currentScale.y - scaleY) > 0.01 || Math.abs(currentScale.x - newScaleXWithSign) > 0.01) { currentScale.y = scaleY; currentScale.x = newScaleXWithSign; }
     }, []);


    // --- Render Loop --- (No changes needed here, uses updated uniforms)
     const renderLoop = useCallback(() => {
        animationFrameHandle.current = requestAnimationFrame(renderLoop);
        if (!isInitialized.current || !rendererInstanceRef.current || !baseSceneRef.current || !baseCameraRef.current || !postSceneRef.current || !postCameraRef.current || !basePlaneMeshRef.current || !postMaterialRef.current || !renderTargetRef.current) { return; }

        const currentCount = renderLoopCounter.current++;
        const logThisFrame = (currentCount % 150 === 0); // Log less frequently

        try {
            const postUniforms = postMaterialRef.current.uniforms;
            if (!postUniforms || !postUniforms.uBrightness || !postUniforms.uContrast || !postUniforms.uEffectIntensity || !postUniforms.uSegmentationMask || !postUniforms.uHasMask) { return; }

            // 1. Select Source Texture
            const baseMaterial = basePlaneMeshRef.current.material; let sourceWidth = 0, sourceHeight = 0; let textureToAssign = null; let isVideo = false;
            if (!isStatic && videoTextureRef.current) { textureToAssign = videoTextureRef.current; if (textureToAssign.image) { sourceWidth = textureToAssign.image.videoWidth; sourceHeight = textureToAssign.image.videoHeight; isVideo = true;} } else if (isStatic && imageTextureRef.current) { textureToAssign = imageTextureRef.current; if (textureToAssign.image) { sourceWidth = textureToAssign.image.naturalWidth; sourceHeight = textureToAssign.image.naturalHeight; } if (textureToAssign.needsUpdate) { textureToAssign.needsUpdate = true; } }
            if (baseMaterial.map !== textureToAssign) { baseMaterial.map = textureToAssign; baseMaterial.needsUpdate = true; } else if (textureToAssign && textureToAssign.needsUpdate) { baseMaterial.needsUpdate = true; }

            // 2. Update Plane Scale & Mirroring
            const planeVisible = !!baseMaterial.map && sourceWidth > 0 && sourceHeight > 0;
            if (planeVisible) { fitPlaneToCamera(sourceWidth, sourceHeight); const scaleX = Math.abs(basePlaneMeshRef.current.scale.x); const newScaleX = isVideo ? -scaleX : scaleX; if(basePlaneMeshRef.current.scale.x !== newScaleX) { basePlaneMeshRef.current.scale.x = newScaleX; } } else { if (basePlaneMeshRef.current.scale.x !== 0 || basePlaneMeshRef.current.scale.y !== 0) { basePlaneMeshRef.current.scale.set(0, 0, 0); } }

            // 3. Render Base Scene to Target
             rendererInstanceRef.current.setRenderTarget(renderTargetRef.current); rendererInstanceRef.current.setClearColor(0x000000, 0); rendererInstanceRef.current.clear();
             if (planeVisible) { rendererInstanceRef.current.render(baseSceneRef.current, baseCameraRef.current); if (textureToAssign?.needsUpdate) { textureToAssign.needsUpdate = false; } }
             rendererInstanceRef.current.setRenderTarget(null);

            // 4. Update Post-Processing Uniforms
             postUniforms.uSceneTexture.value = renderTargetRef.current.texture;
             postUniforms.uBrightness.value = currentBrightness.current;
             postUniforms.uContrast.value = currentContrast.current;
             postUniforms.uEffectIntensity.value = currentIntensity.current;
             postUniforms.uSegmentationMask.value = segmentationTextureRef.current; // Assign ref value
             const hasMask = !!segmentationTextureRef.current; // Boolean check on ref value
             postUniforms.uHasMask.value = hasMask;

             if (logThisFrame) { console.log(`RenderLoop Uniforms: uIntensity=${currentIntensity.current.toFixed(2)}, uHasMask=${hasMask}`); }

            // 5. Render Post-Processing Scene to Screen
             rendererInstanceRef.current.render(postSceneRef.current, postCameraRef.current);

        } catch (error) { console.error("Error in renderLoop:", error); }
    }, [fitPlaneToCamera, isStatic]);


    // --- Initialize Scene --- (No changes needed here)
    const initThreeScene = useCallback(() => {
        if (!canvasRef.current || isInitialized.current) return;
        console.log("DEBUG: initThreeScene START (Robust Mask Check + Exaggerated Effect)");
        try {
            const canvas = canvasRef.current; const initialWidth = canvas.clientWidth || 640; const initialHeight = canvas.clientHeight || 480;
            rendererInstanceRef.current = new THREE.WebGLRenderer({ canvas: canvas, antialias: true }); rendererInstanceRef.current.setSize(initialWidth, initialHeight); rendererInstanceRef.current.setPixelRatio(window.devicePixelRatio); rendererInstanceRef.current.outputColorSpace = THREE.SRGBColorSpace;
            renderTargetRef.current = new THREE.WebGLRenderTarget(initialWidth, initialHeight, { minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, format: THREE.RGBAFormat, colorSpace: THREE.SRGBColorSpace });
            baseSceneRef.current = new THREE.Scene(); baseCameraRef.current = new THREE.OrthographicCamera(-initialWidth / 2, initialWidth / 2, initialHeight / 2, -initialHeight / 2, 0.1, 10); baseCameraRef.current.position.z = 1; const planeGeometry = new THREE.PlaneGeometry(1, 1); const planeMaterial = new THREE.MeshBasicMaterial({ map: null, side: THREE.DoubleSide, color: 0xffffff, transparent: true }); basePlaneMeshRef.current = new THREE.Mesh(planeGeometry, planeMaterial); baseSceneRef.current.add(basePlaneMeshRef.current);
            postSceneRef.current = new THREE.Scene(); postCameraRef.current = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1); const postPlaneGeometry = new THREE.PlaneGeometry(2, 2);
            postMaterialRef.current = new THREE.ShaderMaterial({ vertexShader: postVertexShader, fragmentShader: postFragmentShader, uniforms: { uSceneTexture: { value: renderTargetRef.current.texture }, uBrightness: { value: 1.0 }, uContrast: { value: 1.0 }, uSegmentationMask: { value: null }, uEffectIntensity: { value: currentIntensity.current }, uHasMask: { value: false }, }, transparent: true, depthWrite: false, depthTest: false, });
            const postPlaneMesh = new THREE.Mesh(postPlaneGeometry, postMaterialRef.current); postSceneRef.current.add(postPlaneMesh);
            isInitialized.current = true; handleResize(); cancelAnimationFrame(animationFrameHandle.current); animationFrameHandle.current = requestAnimationFrame(renderLoop);
        } catch (error) { console.error("DEBUG: initThreeScene ERROR:", error); isInitialized.current = false; }
    }, [handleResize, postVertexShader, postFragmentShader, renderLoop]);


    // --- Effect for Initial Setup / Resize Observer / Cleanup --- (No changes needed)
    useEffect(() => {
         initThreeScene();
         let resizeObserver; const currentCanvas = canvasRef.current; if (currentCanvas) { resizeObserver = new ResizeObserver(() => { handleResize(); }); resizeObserver.observe(currentCanvas); }
         return () => { resizeObserver?.disconnect(); cancelAnimationFrame(animationFrameHandle.current); isInitialized.current = false; videoTextureRef.current?.dispose(); imageTextureRef.current?.dispose(); segmentationTextureRef.current?.dispose(); renderTargetRef.current?.dispose(); basePlaneMeshRef.current?.geometry?.dispose(); basePlaneMeshRef.current?.material?.map?.dispose(); basePlaneMeshRef.current?.material?.dispose(); postMaterialRef.current?.uniforms?.uSceneTexture?.value?.dispose(); postMaterialRef.current?.uniforms?.uSegmentationMask?.value?.dispose(); postMaterialRef.current?.dispose(); rendererInstanceRef.current?.dispose(); videoTextureRef.current = null; imageTextureRef.current = null; segmentationTextureRef.current = null; renderTargetRef.current = null; basePlaneMeshRef.current = null; postMaterialRef.current = null; rendererInstanceRef.current = null; baseSceneRef.current = null; postSceneRef.current = null; baseCameraRef.current = null; postCameraRef.current = null; };
     }, [initThreeScene, handleResize]);


    // --- JSX --- (No changes)
    return ( <canvas ref={canvasRef} className={`renderer-canvas ${className || ''}`} style={{ display: 'block', width: '100%', height: '100%', ...(style || {}) }} /> );
});

TryOnRenderer.displayName = 'TryOnRenderer';
export default TryOnRenderer;