// src/components/TryOnRenderer.jsx - Log received props + Re-enabled Mask Logging + Refined Shader

import React, { useRef, forwardRef, useEffect, useCallback, useState, useMemo } from 'react';
import * as THREE from 'three';

// console.log(`Using Three.js revision: ${THREE.REVISION}`); // Reduce noise

const TryOnRenderer = forwardRef(({
    videoRefProp,
    imageElement,
    mediaPipeResults, // <<< Prop to log
    isStatic,
    brightness,
    contrast,
    effectIntensity,
    className,
    style
 }, ref) => {

    // *** LOG RECEIVED PROPS ON EVERY RENDER ***
    console.log(`TryOnRenderer RENDERING. isStatic=${isStatic}, Has mediaPipeResults prop? ${!!mediaPipeResults}`);
    // Log mask specifically if results exist
    if (mediaPipeResults) {
        const hasMaskArray = Array.isArray(mediaPipeResults.segmentationMasks) && mediaPipeResults.segmentationMasks.length > 0;
        console.log(` -> Prop Check: Has valid segmentationMasks array? ${hasMaskArray}`);
         if (hasMaskArray) {
            const maskData = mediaPipeResults.segmentationMasks[0]?.maskData;
            console.log(` -> Prop Check: maskData type: ${maskData?.constructor?.name}`);
        }
    }
    // ******************************************


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


    // --- Shaders --- (EXAGGERATED Effect + Refined Guard)
    const postVertexShader = `varying vec2 vUv; void main() { vUv = uv; gl_Position = vec4(position, 1.0); }`;
    const postFragmentShader = `
        uniform sampler2D uSceneTexture; uniform sampler2D uSegmentationMask;
        uniform float uBrightness; uniform float uContrast; uniform float uEffectIntensity; uniform bool uHasMask;
        varying vec2 vUv;
        vec3 applyBrightnessContrast(vec3 color, float b, float c) { color = color * b; color = (color - 0.5) * c + 0.5; return color; }
        vec3 applyHydrationEffect(vec3 color) { return vec3(1.0, 0.0, 0.0); /* Bright Red */ }
        void main() {
            vec4 baseColor = texture2D(uSceneTexture, vUv);
            vec3 correctedColor = applyBrightnessContrast(baseColor.rgb, uBrightness, uContrast);
            vec3 finalColor = correctedColor;
            if (uHasMask && uEffectIntensity > 0.0) {
                float maskValue = texture2D(uSegmentationMask, vUv).r;
                vec3 hydratedColor = applyHydrationEffect(correctedColor);
                finalColor = mix(correctedColor, hydratedColor, maskValue * uEffectIntensity);
            }
            finalColor = clamp(finalColor, 0.0, 1.0);
            gl_FragColor = vec4(finalColor, baseColor.a);
        }
    `;

    // --- Update internal refs based on props ---
    useEffect(() => { currentResults.current = mediaPipeResults; }, [mediaPipeResults]); // Keep using internal ref for effects
    useEffect(() => { currentBrightness.current = isStatic ? Math.max(0.01, brightness || 1.0) : 1.0; currentContrast.current = isStatic ? Math.max(0.01, contrast || 1.0) : 1.0; }, [isStatic, brightness, contrast]);
    useEffect(() => { currentIntensity.current = effectIntensity; }, [effectIntensity]);


    // --- Effects for Video/Image Textures --- (No changes)
    useEffect(() => { const videoElement = videoRefProp?.current; if (!isStatic && videoElement) { if (!videoTextureRef.current || videoTextureRef.current.image !== videoElement) { videoTextureRef.current?.dispose(); videoTextureRef.current = new THREE.VideoTexture(videoElement); videoTextureRef.current.colorSpace = THREE.SRGBColorSpace; } } else { if (videoTextureRef.current) { videoTextureRef.current.dispose(); videoTextureRef.current = null; } } }, [isStatic, videoRefProp]);
    useEffect(() => { if (isStatic && imageElement) { if (!imageTextureRef.current || imageTextureRef.current.image !== imageElement) { imageTextureRef.current?.dispose(); imageTextureRef.current = new THREE.Texture(imageElement); imageTextureRef.current.colorSpace = THREE.SRGBColorSpace; imageTextureRef.current.needsUpdate = true; } else if (imageTextureRef.current && imageTextureRef.current.image === imageElement) { imageTextureRef.current.needsUpdate = true; } } else { if (imageTextureRef.current) { imageTextureRef.current.dispose(); imageTextureRef.current = null; } } }, [isStatic, imageElement]);


    // --- RE-ENABLED LOGGING Effect to manage Segmentation Mask Texture ---
    useEffect(() => {
        // *** Use internal currentResults ref which is updated by prop useEffect ***
        const results = currentResults.current;
        const hasMaskDataArray = Array.isArray(results?.segmentationMasks) && results.segmentationMasks.length > 0;

        // Log initial check result
        console.log(`TryOnRenderer Mask EFFECT Check: hasMaskDataArray = ${hasMaskDataArray}`);

        if (hasMaskDataArray) {
            const segmentationMask = results.segmentationMasks[0];
            const mask = segmentationMask?.mask;
            const maskData = segmentationMask?.maskData;
            const maskWidth = mask?.width;
            const maskHeight = mask?.height;

            // Log details about extracted mask components
            console.log(`TryOnRenderer Mask EFFECT Details: Mask Obj Type=${typeof mask}, maskData Type=${typeof maskData}, Width=${maskWidth}, Height=${maskHeight}, Constructor=${maskData?.constructor?.name}`);

            if (maskData instanceof WebGLTexture) {
                 console.warn("TryOnRenderer Mask EFFECT Handling: Received WebGLTexture directly (GPU).");
                 if (segmentationTextureRef.current) { segmentationTextureRef.current.dispose(); segmentationTextureRef.current = null; }
            } else if (maskData instanceof Float32Array && maskWidth > 0 && maskHeight > 0) {
                console.log(`TryOnRenderer Mask EFFECT: Processing Float32Array mask data. Length: ${maskData.length}`);
                 const now = performance.now(); const timeSinceLastUpdate = now - lastMaskUpdateTime.current; const throttleThreshold = isStatic ? 0 : 66;
                 if (timeSinceLastUpdate > throttleThreshold) {
                    lastMaskUpdateTime.current = now;
                    try {
                        console.log(`TryOnRenderer Mask EFFECT Texture: Attempting to create/update DataTexture...`);
                        if (!segmentationTextureRef.current || segmentationTextureRef.current.image.width !== maskWidth || segmentationTextureRef.current.image.height !== maskHeight) {
                            console.log(` -> Creating NEW DataTexture (${maskWidth}x${maskHeight})`);
                            segmentationTextureRef.current?.dispose();
                            segmentationTextureRef.current = new THREE.DataTexture(maskData, maskWidth, maskHeight, THREE.RedFormat, THREE.FloatType);
                            segmentationTextureRef.current.minFilter = THREE.LinearFilter; segmentationTextureRef.current.magFilter = THREE.LinearFilter;
                            segmentationTextureRef.current.needsUpdate = true;
                            console.log(`TryOnRenderer Mask EFFECT Texture: New DataTexture CREATED.`);
                        } else {
                            console.log(` -> Updating EXISTING DataTexture data.`);
                            segmentationTextureRef.current.image.data = maskData;
                            segmentationTextureRef.current.needsUpdate = true;
                             console.log(`TryOnRenderer Mask EFFECT Texture: Existing DataTexture UPDATED.`);
                        }
                    } catch (error) { console.error("TryOnRenderer Mask EFFECT Texture: Error creating/updating DataTexture:", error); segmentationTextureRef.current?.dispose(); segmentationTextureRef.current = null; }
                 }
            } else {
                 console.warn(`TryOnRenderer Mask EFFECT: Found segmentationMasks[0] but mask data is not valid. Type: ${maskData?.constructor?.name}, Dims: ${maskWidth}x${maskHeight}`);
                 if (segmentationTextureRef.current) { segmentationTextureRef.current.dispose(); segmentationTextureRef.current = null; }
            }
        } else {
            if (segmentationTextureRef.current) {
                console.log("TryOnRenderer Mask EFFECT: No valid segmentation mask array found, disposing texture.");
                segmentationTextureRef.current.dispose();
                segmentationTextureRef.current = null;
            } else {
                 // console.log("TryOnRenderer Mask EFFECT: No segmentation mask array found in results."); // Reduce noise
            }
        }
    // *** IMPORTANT: Depend on the prop directly to trigger this effect when results change ***
    }, [mediaPipeResults, isStatic]);


    // --- Handle Resizing --- (No changes)
    const handleResize = useCallback(() => { const canvas = canvasRef.current; if (!rendererInstanceRef.current || !baseCameraRef.current || !postCameraRef.current || !canvas || !renderTargetRef.current) return; const newWidth = canvas.clientWidth; const newHeight = canvas.clientHeight; if (newWidth === 0 || newHeight === 0) return; const currentSize = rendererInstanceRef.current.getSize(new THREE.Vector2()); if (currentSize.x === newWidth && currentSize.y === newHeight) return; try { rendererInstanceRef.current.setSize(newWidth, newHeight); renderTargetRef.current.setSize(newWidth, newHeight); baseCameraRef.current.left = -newWidth / 2; baseCameraRef.current.right = newWidth / 2; baseCameraRef.current.top = newHeight / 2; baseCameraRef.current.bottom = -newHeight / 2; baseCameraRef.current.updateProjectionMatrix(); } catch(e) { console.error("Resize Error:", e);} }, []);
    // --- Scale Base Plane --- (No changes)
    const fitPlaneToCamera = useCallback((textureWidth, textureHeight) => { const canvas = canvasRef.current; if (!baseCameraRef.current || !basePlaneMeshRef.current || !textureWidth || !textureHeight || !canvas || canvas.clientWidth === 0 || canvas.clientHeight === 0) return; const viewWidth = canvas.clientWidth; const viewHeight = canvas.clientHeight; const viewAspect = viewWidth / viewHeight; const textureAspect = textureWidth / textureHeight; let scaleX, scaleY; if (viewAspect > textureAspect) { scaleX = viewWidth; scaleY = scaleX / textureAspect; } else { scaleY = viewHeight; scaleX = scaleY * textureAspect; } const currentScale = basePlaneMeshRef.current.scale; const currentSignX = Math.sign(currentScale.x) || 1; const newScaleXWithSign = scaleX * currentSignX; if (Math.abs(currentScale.y - scaleY) > 0.01 || Math.abs(currentScale.x - newScaleXWithSign) > 0.01) { currentScale.y = scaleY; currentScale.x = newScaleXWithSign; } }, []);


    // --- Render Loop --- (No changes needed)
     const renderLoop = useCallback(() => {
        animationFrameHandle.current = requestAnimationFrame(renderLoop);
        if (!isInitialized.current || !rendererInstanceRef.current || !postMaterialRef.current ) { return; } // Simplified check

        const currentCount = renderLoopCounter.current++;
        const logThisFrame = (currentCount % 150 === 0);

        try {
            const postUniforms = postMaterialRef.current.uniforms;
            if (!postUniforms?.uSceneTexture || !postUniforms?.uHasMask) { return; }

            // Steps 1, 2, 3 (Select Texture, Scale Plane, Render Base) - Condensed
            const baseMaterial = basePlaneMeshRef.current?.material; let sourceWidth = 0, sourceHeight = 0; let textureToAssign = null; let isVideo = false;
            if (!isStatic && videoTextureRef.current) { textureToAssign = videoTextureRef.current; if (textureToAssign.image) { sourceWidth = textureToAssign.image.videoWidth; sourceHeight = textureToAssign.image.videoHeight; isVideo = true;} } else if (isStatic && imageTextureRef.current) { textureToAssign = imageTextureRef.current; if (textureToAssign.image) { sourceWidth = textureToAssign.image.naturalWidth; sourceHeight = textureToAssign.image.naturalHeight; } if (textureToAssign.needsUpdate) { textureToAssign.needsUpdate = true; } }
            if(baseMaterial){ if (baseMaterial.map !== textureToAssign) { baseMaterial.map = textureToAssign; baseMaterial.needsUpdate = true; } else if (textureToAssign && textureToAssign.needsUpdate) { baseMaterial.needsUpdate = true; } }
            const planeVisible = !!baseMaterial?.map && sourceWidth > 0 && sourceHeight > 0;
            if (planeVisible) { fitPlaneToCamera(sourceWidth, sourceHeight); const scaleX = Math.abs(basePlaneMeshRef.current.scale.x); const newScaleX = isVideo ? -scaleX : scaleX; if(basePlaneMeshRef.current.scale.x !== newScaleX) { basePlaneMeshRef.current.scale.x = newScaleX; } } else { if (basePlaneMeshRef.current?.scale.x !== 0 || basePlaneMeshRef.current?.scale.y !== 0) { basePlaneMeshRef.current?.scale.set(0, 0, 0); } }
            rendererInstanceRef.current.setRenderTarget(renderTargetRef.current); rendererInstanceRef.current.setClearColor(0x000000, 0); rendererInstanceRef.current.clear();
             if (planeVisible && baseSceneRef.current && baseCameraRef.current) { rendererInstanceRef.current.render(baseSceneRef.current, baseCameraRef.current); if (textureToAssign?.needsUpdate) { textureToAssign.needsUpdate = false; } }
             rendererInstanceRef.current.setRenderTarget(null);

            // 4. Update Post-Processing Uniforms
             postUniforms.uSceneTexture.value = renderTargetRef.current?.texture;
             postUniforms.uBrightness.value = currentBrightness.current;
             postUniforms.uContrast.value = currentContrast.current;
             postUniforms.uEffectIntensity.value = currentIntensity.current;
             postUniforms.uSegmentationMask.value = segmentationTextureRef.current;
             const hasMask = !!segmentationTextureRef.current;
             postUniforms.uHasMask.value = hasMask;

             if (logThisFrame) { console.log(`RenderLoop Uniforms: uIntensity=${currentIntensity.current.toFixed(2)}, uHasMask=${hasMask}`); if(hasMask) { console.log(` -> MaskTexture Obj ID: ${segmentationTextureRef.current.id}`); } }

            // 5. Render Post-Processing Scene to Screen
             if(postSceneRef.current && postCameraRef.current) {
                 rendererInstanceRef.current.render(postSceneRef.current, postCameraRef.current);
             }

        } catch (error) { console.error("Error in renderLoop:", error); }
    }, [fitPlaneToCamera, isStatic]); // Keep dependencies


    // --- Initialize Scene ---
    const initThreeScene = useCallback(() => {
        if (!canvasRef.current || isInitialized.current) return;
        console.log("DEBUG: initThreeScene START (Logging Props + Mask Details)");
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


    // --- Setup / Cleanup Effect ---
    useEffect(() => { initThreeScene(); let resizeObserver; const currentCanvas = canvasRef.current; if (currentCanvas) { resizeObserver = new ResizeObserver(() => { handleResize(); }); resizeObserver.observe(currentCanvas); } return () => { resizeObserver?.disconnect(); cancelAnimationFrame(animationFrameHandle.current); isInitialized.current = false; videoTextureRef.current?.dispose(); imageTextureRef.current?.dispose(); segmentationTextureRef.current?.dispose(); renderTargetRef.current?.dispose(); basePlaneMeshRef.current?.geometry?.dispose(); basePlaneMeshRef.current?.material?.map?.dispose(); basePlaneMeshRef.current?.material?.dispose(); postMaterialRef.current?.uniforms?.uSceneTexture?.value?.dispose(); postMaterialRef.current?.uniforms?.uSegmentationMask?.value?.dispose(); postMaterialRef.current?.dispose(); rendererInstanceRef.current?.dispose(); videoTextureRef.current = null; imageTextureRef.current = null; segmentationTextureRef.current = null; renderTargetRef.current = null; basePlaneMeshRef.current = null; postMaterialRef.current = null; rendererInstanceRef.current = null; baseSceneRef.current = null; postSceneRef.current = null; baseCameraRef.current = null; postCameraRef.current = null; }; }, [initThreeScene, handleResize]);


    // --- JSX ---
    return ( <canvas ref={canvasRef} className={`renderer-canvas ${className || ''}`} style={{ display: 'block', width: '100%', height: '100%', ...(style || {}) }} /> );
});

TryOnRenderer.displayName = 'TryOnRenderer';
export default TryOnRenderer;