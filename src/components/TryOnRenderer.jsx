// src/components/TryOnRenderer.jsx - Ensure Base Scene Renders

import React, { useRef, forwardRef, useEffect, useCallback, useState, useMemo } from 'react';
import * as THREE from 'three';

// ... console log revision ...

const TryOnRenderer = forwardRef(({ videoElement, imageElement, mediaPipeResults, isStatic, brightness, contrast, effectIntensity, className }, ref) => {

    // ... refs ...
    const canvasRef = useRef(null); // Ensure all refs are defined
    const rendererInstanceRef = useRef(null); const animationFrameHandle = useRef(null); const isInitialized = useRef(false);
    const baseSceneRef = useRef(null); const baseCameraRef = useRef(null); const basePlaneMeshRef = useRef(null);
    const videoTextureRef = useRef(null); const imageTextureRef = useRef(null);
    const postSceneRef = useRef(null); const postCameraRef = useRef(null); const postMaterialRef = useRef(null);
    const segmentationTextureRef = useRef(null); const renderTargetRef = useRef(null);
    const currentSource = useRef(null); const currentResults = useRef(null); const currentIsStatic = useRef(false);
    const currentBrightness = useRef(1.0); const currentContrast = useRef(1.0); const currentIntensity = useRef(0.5);
    const renderLoopCounter = useRef(0);


    // --- Shaders --- (Keep Bare Minimum)
    const postVertexShader = `varying vec2 vUv; void main() { vUv = uv; gl_Position = vec4(position, 1.0); }`;
    const postFragmentShader = `
        uniform sampler2D uSceneTexture; varying vec2 vUv;
        void main() { gl_FragColor = texture2D(uSceneTexture, vUv); }
    `;

    // --- Update internal refs ---
    // ... useEffects for props ... (remain the same)

    // --- Handle Resizing ---
    const handleResize = useCallback(() => { /* ... */ }, []);
    // --- Scale Base Plane ---
    const fitPlaneToCamera = useCallback((textureWidth, textureHeight) => { /* ... */ }, []);


    // --- Render Loop --- (Adjust base render logic)
     const renderLoop = useCallback(() => {
        animationFrameHandle.current = requestAnimationFrame(renderLoop);
        if (!isInitialized.current /* ... etc ... */) return;

        const currentCount = renderLoopCounter.current++;
        const logThisFrame = (currentCount % 100 === 0);
        // if (logThisFrame) console.log(`RenderLoop executing: Frame ${currentCount}`);


        try {
            const postUniforms = postMaterialRef.current.uniforms;
            if (!postUniforms) { /*console.warn(...)*/; return; }

            const sourceElement = currentSource.current;
            const results = currentResults.current;
            const isStatic = currentIsStatic.current;
            const baseMaterial = basePlaneMeshRef.current.material;
            let sourceWidth = 0, sourceHeight = 0;
            let isVideo = sourceElement instanceof HTMLVideoElement;
            let isImage = sourceElement instanceof HTMLImageElement;
            let textureToAssign = null;
            let textureJustCreated = false; // Flag

            // 1. Update Base Texture
            if (isVideo && sourceElement.readyState >= 2 && sourceElement.videoWidth > 0) {
                sourceWidth = sourceElement.videoWidth; sourceHeight = sourceElement.videoHeight;
                if (!videoTextureRef.current || videoTextureRef.current.image !== sourceElement) { // More robust check
                    videoTextureRef.current?.dispose();
                    videoTextureRef.current = new THREE.VideoTexture(sourceElement);
                    videoTextureRef.current.colorSpace = THREE.SRGBColorSpace;
                    console.log("DEBUG RenderLoop: Created Video Texture");
                    textureJustCreated = true;
                }
                textureToAssign = videoTextureRef.current;
            }
            else if (isImage && sourceElement.complete && sourceElement.naturalWidth > 0) {
                 sourceWidth = sourceElement.naturalWidth; sourceHeight = sourceElement.naturalHeight;
                 if (!imageTextureRef.current || imageTextureRef.current.image !== sourceElement) {
                     imageTextureRef.current?.dispose();
                     imageTextureRef.current = new THREE.Texture(sourceElement);
                     imageTextureRef.current.colorSpace = THREE.SRGBColorSpace;
                     imageTextureRef.current.needsUpdate = true; // Important for initial upload
                     console.log("DEBUG RenderLoop: Created Image Texture");
                     textureJustCreated = true;
                 } else if (imageTextureRef.current.needsUpdate) {
                     // If needsUpdate was already true (e.g. from imperative handle), keep it true
                     imageTextureRef.current.needsUpdate = true;
                 }
                 textureToAssign = imageTextureRef.current;
            }
            else { // No valid source
                 textureToAssign = null;
                 if(videoTextureRef.current) { videoTextureRef.current.dispose(); videoTextureRef.current = null; }
                 if(imageTextureRef.current) { imageTextureRef.current.dispose(); imageTextureRef.current = null;}
            }

            // Assign texture if different or just created
            if (baseMaterial.map !== textureToAssign || textureJustCreated) {
                baseMaterial.map = textureToAssign;
                baseMaterial.needsUpdate = true; // Crucial: Tell material to update
                 console.log("DEBUG RenderLoop: Assigned texture to base material:", textureToAssign ? textureToAssign.constructor.name : 'null');
            }
             // Ensure needsUpdate is handled correctly for non-video textures
             if (textureToAssign && textureToAssign.needsUpdate && !(textureToAssign instanceof THREE.VideoTexture)) {
                 textureToAssign.needsUpdate = true; // This will be set false by three.js after upload
             }


            // 2. Update Plane Scale & Mirroring
            const planeVisible = !!baseMaterial.map && sourceWidth > 0 && sourceHeight > 0; // Check map directly
            if (planeVisible) { fitPlaneToCamera(sourceWidth, sourceHeight); const scaleX = Math.abs(basePlaneMeshRef.current.scale.x); const newScaleX = isVideo ? -scaleX : scaleX; if(basePlaneMeshRef.current.scale.x !== newScaleX) { basePlaneMeshRef.current.scale.x = newScaleX; } }
            else { if (basePlaneMeshRef.current.scale.x !== 0 || basePlaneMeshRef.current.scale.y !== 0) { basePlaneMeshRef.current.scale.set(0, 0, 0); if (logThisFrame) console.log("DEBUG RenderLoop: Hiding base plane"); } }


            // 3. Render Base Scene to Target
            rendererInstanceRef.current.setRenderTarget(renderTargetRef.current);
            rendererInstanceRef.current.setClearColor(0xff0000, 1); // Clear target to RED
            rendererInstanceRef.current.clear();
            if (planeVisible) {
                 // *** Force material update before rendering base scene ***
                 if (baseMaterial.needsUpdate) {
                    // This isn't strictly needed usually, but let's try forcing it
                    // baseMaterial.needsUpdate = true; // Already set above if changed
                 }
                 rendererInstanceRef.current.render(baseSceneRef.current, baseCameraRef.current);
                 if (logThisFrame) console.log(`DEBUG RenderLoop: Rendered base scene to target.`);
            } else {
                 if (logThisFrame) console.log(`DEBUG RenderLoop: Target cleared red (plane hidden).`);
            }
            rendererInstanceRef.current.setRenderTarget(null);
            rendererInstanceRef.current.setClearColor(0x000000, 0); // Reset clear color


            // 4. Update Post-Processing Uniforms
            if (postUniforms.uSceneTexture) { postUniforms.uSceneTexture.value = renderTargetRef.current.texture; }


            // 5. Render Post-Processing Scene to Screen
            rendererInstanceRef.current.render(postSceneRef.current, postCameraRef.current);
             // if (logThisFrame) console.log(`DEBUG RenderLoop: Rendered post scene to screen.`);


        } catch (error) { console.error("Error in renderLoop:", error); }
    }, [fitPlaneToCamera]);


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