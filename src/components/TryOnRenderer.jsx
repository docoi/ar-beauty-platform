// src/components/TryOnRenderer.jsx - Read Props Directly in Loop

import React, { useRef, forwardRef, useEffect, useCallback, useState, useMemo } from 'react';
import * as THREE from 'three';

console.log(`Using Three.js revision: ${THREE.REVISION}`);

const TryOnRenderer = forwardRef(({
    videoElement, imageElement, mediaPipeResults, isStatic,
    brightness, contrast, effectIntensity, className
 }, ref) => {

    // ... refs ...
    const canvasRef = useRef(null); const rendererInstanceRef = useRef(null); const animationFrameHandle = useRef(null); const isInitialized = useRef(false); const baseSceneRef = useRef(null); const baseCameraRef = useRef(null); const basePlaneMeshRef = useRef(null); const videoTextureRef = useRef(null); const imageTextureRef = useRef(null); const postSceneRef = useRef(null); const postCameraRef = useRef(null); const postMaterialRef = useRef(null); const segmentationTextureRef = useRef(null); const renderTargetRef = useRef(null);
    // REMOVE internal state refs for source/isStatic, read props directly
    // const currentSource = useRef(null);
    // const currentIsStatic = useRef(false);
    // Keep refs for results/intensity/correction as they might be updated independently
    const currentResults = useRef(null);
    const currentBrightness = useRef(1.0);
    const currentContrast = useRef(1.0);
    const currentIntensity = useRef(0.5);
    const renderLoopCounter = useRef(0);


    // --- Shaders --- (Keep Bare Minimum)
    const postVertexShader = `varying vec2 vUv; void main() { vUv = uv; gl_Position = vec4(position, 1.0); }`;
    const postFragmentShader = `
        uniform sampler2D uSceneTexture; varying vec2 vUv;
        void main() { gl_FragColor = texture2D(uSceneTexture, vUv); }
    `;

    // --- Update internal refs (ONLY for results/intensity/correction) ---
    // REMOVE useEffect for source/isStatic props
    // useEffect(() => { /* ... update currentSource, currentIsStatic ... */ }, [videoElement, imageElement, isStatic]);
    useEffect(() => { currentResults.current = mediaPipeResults; }, [mediaPipeResults]);
    useEffect(() => {
        currentBrightness.current = isStatic ? Math.max(0.1, brightness || 1.0) : 1.0;
        currentContrast.current = isStatic ? Math.max(0.1, contrast || 1.0) : 1.0;
     }, [isStatic, brightness, contrast]); // Still need isStatic prop here
    useEffect(() => { currentIntensity.current = effectIntensity; }, [effectIntensity]);


    // --- Handle Resizing ---
    const handleResize = useCallback(() => { /* ... */ }, []);
    // --- Scale Base Plane ---
    const fitPlaneToCamera = useCallback((textureWidth, textureHeight) => { /* ... */ }, []);


    // --- Render Loop --- (Read Props Directly)
     const renderLoop = useCallback(() => {
        animationFrameHandle.current = requestAnimationFrame(renderLoop);
        if (!isInitialized.current /* ... etc ... */) return;

        const currentCount = renderLoopCounter.current++;
        const logThisFrame = (currentCount % 100 === 0);
        // if (logThisFrame) console.log(`RenderLoop executing: Frame ${currentCount}`);

        try {
            const postUniforms = postMaterialRef.current.uniforms;
            if (!postUniforms) { return; }

            // *** Read props directly ***
            const sourceElement = isStatic ? imageElement : videoElement;
            const results = currentResults.current; // Still use ref for results
            // *** ------------------- ***

            const baseMaterial = basePlaneMeshRef.current.material;
            let sourceWidth = 0, sourceHeight = 0;
            let isVideo = sourceElement instanceof HTMLVideoElement;
            let isImage = sourceElement instanceof HTMLImageElement;
            let textureToAssign = null;
            let textureJustCreated = false;

            // 1. Update Base Texture (using sourceElement from props)
             if (isVideo && sourceElement.readyState >= 2 && sourceElement.videoWidth > 0) { /* ... create/assign video texture ... */ textureToAssign = videoTextureRef.current; }
             else if (isImage && sourceElement?.complete && sourceElement?.naturalWidth > 0) { /* ... create/assign image texture ... */ textureToAssign = imageTextureRef.current; } // Add checks for imageElement existence
             else { textureToAssign = null; if(videoTextureRef.current) { /* ... */ } if(imageTextureRef.current) { /* ... */} }
             const textureChanged = baseMaterial.map !== textureToAssign; if (textureChanged) { baseMaterial.map = textureToAssign; baseMaterial.needsUpdate = true; console.log("DEBUG RenderLoop: Assigned texture to base material:", textureToAssign ? textureToAssign.constructor.name : 'null'); }
             if (textureToAssign && textureToAssign.needsUpdate && !(textureToAssign instanceof THREE.VideoTexture)) { textureToAssign.needsUpdate = true; }


            // 2. Update Plane Scale & Mirroring
            // Calculate sourceWidth/sourceHeight based on the type
            if (isVideo && sourceElement) { sourceWidth = sourceElement.videoWidth; sourceHeight = sourceElement.videoHeight; }
            else if (isImage && sourceElement) { sourceWidth = sourceElement.naturalWidth; sourceHeight = sourceElement.naturalHeight; }
            else { sourceWidth = 0; sourceHeight = 0; }

            const planeVisible = !!baseMaterial.map && sourceWidth > 0 && sourceHeight > 0;
             if (planeVisible) { fitPlaneToCamera(sourceWidth, sourceHeight); const scaleX = Math.abs(basePlaneMeshRef.current.scale.x); const newScaleX = isVideo ? -scaleX : scaleX; if(basePlaneMeshRef.current.scale.x !== newScaleX) { basePlaneMeshRef.current.scale.x = newScaleX; } }
             else { if (basePlaneMeshRef.current.scale.x !== 0 || basePlaneMeshRef.current.scale.y !== 0) { basePlaneMeshRef.current.scale.set(0, 0, 0); if (logThisFrame) console.log("DEBUG RenderLoop: Hiding base plane"); } }


            // 3. Render Base Scene to Target
            rendererInstanceRef.current.setRenderTarget(renderTargetRef.current);
            rendererInstanceRef.current.setClearColor(0xff0000, 1); // Keep RED clear for debug
            rendererInstanceRef.current.clear();
            if (planeVisible) {
                 rendererInstanceRef.current.render(baseSceneRef.current, baseCameraRef.current);
                 if (logThisFrame) console.log(`DEBUG RenderLoop: Rendered base scene to target.`);
            } else {
                 if (logThisFrame) console.log(`DEBUG RenderLoop: Target cleared red (plane hidden).`);
            }
            rendererInstanceRef.current.setRenderTarget(null);
            rendererInstanceRef.current.setClearColor(0x000000, 0); // Reset clear color


            // 4. Update Post-Processing Uniforms
            if (postUniforms.uSceneTexture) { postUniforms.uSceneTexture.value = renderTargetRef.current.texture; }
            // ... (Segmentation mask update logic using currentResults.current) ...

            // 5. Render Post-Processing Scene to Screen
            rendererInstanceRef.current.render(postSceneRef.current, postCameraRef.current);
            // if (logThisFrame) console.log(`DEBUG RenderLoop: Rendered post scene to screen.`);

        } catch (error) { console.error("Error in renderLoop:", error); }
    // Add props used directly in loop to dependency array
    }, [fitPlaneToCamera, videoElement, imageElement, isStatic]);


    // --- Initialize Scene --- (Keep Bare Minimum Shader & ONLY uSceneTexture Uniform)
    const initThreeScene = useCallback(() => { /* ... same init logic ... */ }, [handleResize, postVertexShader, postFragmentShader, renderLoop]);

    // --- Effect for Initial Setup / Resize Observer ---
    useEffect(() => { /* ... */ }, [initThreeScene, handleResize]);
    // --- REMOVED useImperativeHandle ---
    // --- JSX ---
    return ( <canvas ref={canvasRef} className={`renderer-canvas ${className || ''}`} style={{ display: 'block', width: '100%', height: '100%' }} /> );
});

TryOnRenderer.displayName = 'TryOnRenderer';
export default TryOnRenderer;