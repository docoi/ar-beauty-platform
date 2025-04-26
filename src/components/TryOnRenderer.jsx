// src/components/TryOnRenderer.jsx - COMPLETE - Correct Texture Handling via useEffect

import React, { useRef, forwardRef, useEffect, useCallback, useState, useMemo } from 'react';
import * as THREE from 'three';

console.log(`Using Three.js revision: ${THREE.REVISION}`);

const TryOnRenderer = forwardRef(({
    videoRefProp,     // Ref object for video element
    imageElement,     // Actual image element
    mediaPipeResults,
    isStatic,
    brightness, contrast, effectIntensity, className,
    style // Accept style prop
 }, ref) => {

    // --- Core Refs ---
    const canvasRef = useRef(null);
    const rendererInstanceRef = useRef(null);
    const animationFrameHandle = useRef(null);
    const isInitialized = useRef(false);
    const baseSceneRef = useRef(null);
    const baseCameraRef = useRef(null);
    const basePlaneMeshRef = useRef(null);
    const videoTextureRef = useRef(null); // Ref to hold the VideoTexture object
    const imageTextureRef = useRef(null); // Ref to hold the Image Texture object
    const postSceneRef = useRef(null);
    const postCameraRef = useRef(null);
    const postMaterialRef = useRef(null);
    const segmentationTextureRef = useRef(null);
    const renderTargetRef = useRef(null);

    // --- Internal State Refs ---
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

    // --- Update internal refs for results/correction/intensity ---
    useEffect(() => { currentResults.current = mediaPipeResults; }, [mediaPipeResults]);
    useEffect(() => { currentBrightness.current = isStatic ? Math.max(0.1, brightness || 1.0) : 1.0; currentContrast.current = isStatic ? Math.max(0.1, contrast || 1.0) : 1.0; }, [isStatic, brightness, contrast]);
    useEffect(() => { currentIntensity.current = effectIntensity; }, [effectIntensity]);

    // --- Effect to manage Video Texture ---
    useEffect(() => {
        const videoElement = videoRefProp?.current;
        if (!isStatic && videoElement) {
            // Create or update video texture only if element changes
             if (!videoTextureRef.current || videoTextureRef.current.image !== videoElement) {
                console.log("TryOnRenderer Effect: Creating/Updating Video Texture");
                videoTextureRef.current?.dispose(); // Dispose old one
                videoTextureRef.current = new THREE.VideoTexture(videoElement);
                videoTextureRef.current.colorSpace = THREE.SRGBColorSpace;
             }
        } else {
             // If not video mode or element missing, dispose texture
             if (videoTextureRef.current) {
                console.log("TryOnRenderer Effect: Disposing Video Texture");
                videoTextureRef.current.dispose();
                videoTextureRef.current = null;
             }
        }
        // Cleanup function for video texture is tricky, handled by main cleanup

    }, [isStatic, videoRefProp]); // Rerun if mode or ref object changes


     // --- Effect to manage Image Texture ---
    useEffect(() => {
        if (isStatic && imageElement) {
             // Create or update image texture only if element changes
             if (!imageTextureRef.current || imageTextureRef.current.image !== imageElement) {
                console.log("TryOnRenderer Effect: Creating/Updating Image Texture");
                imageTextureRef.current?.dispose(); // Dispose old one
                imageTextureRef.current = new THREE.Texture(imageElement);
                imageTextureRef.current.colorSpace = THREE.SRGBColorSpace;
                imageTextureRef.current.needsUpdate = true; // Mark for upload
             } else if (imageTextureRef.current) {
                 // If element is the same, still mark for update in case content changed
                 // (though parent usually passes new element if content changes)
                 imageTextureRef.current.needsUpdate = true;
             }
        } else {
             // If not static mode or element missing, dispose texture
             if (imageTextureRef.current) {
                 console.log("TryOnRenderer Effect: Disposing Image Texture");
                 imageTextureRef.current.dispose();
                 imageTextureRef.current = null;
             }
        }
         // Cleanup function for image texture is tricky, handled by main cleanup

    }, [isStatic, imageElement]); // Rerun if mode or image element changes


    // --- Handle Resizing ---
    const handleResize = useCallback(() => { /* ... */ }, []);
    // --- Scale Base Plane ---
    const fitPlaneToCamera = useCallback((textureWidth, textureHeight) => { /* ... */ }, []);


    // --- Render Loop --- (Uses texture refs)
     const renderLoop = useCallback(() => {
        animationFrameHandle.current = requestAnimationFrame(renderLoop);
        if (!isInitialized.current /* ... etc ... */) return;

        const currentCount = renderLoopCounter.current++;
        const logThisFrame = (currentCount % 100 === 0);

        try {
            const postUniforms = postMaterialRef.current.uniforms;
            if (!postUniforms) { return; }

            const results = currentResults.current; // Read results ref
            const baseMaterial = basePlaneMeshRef.current.material;
            let sourceWidth = 0, sourceHeight = 0;
            let textureToAssign = null;
            let isVideo = false; // Determine based on which texture ref is valid

            // *** Select texture based on internal refs ***
            if (!isStatic && videoTextureRef.current) {
                 textureToAssign = videoTextureRef.current;
                 if (textureToAssign.image) { // Video element is image source
                     sourceWidth = textureToAssign.image.videoWidth;
                     sourceHeight = textureToAssign.image.videoHeight;
                     isVideo = true;
                 }
            } else if (isStatic && imageTextureRef.current) {
                 textureToAssign = imageTextureRef.current;
                  if (textureToAssign.image) { // Image element is image source
                     sourceWidth = textureToAssign.image.naturalWidth;
                     sourceHeight = textureToAssign.image.naturalHeight;
                  }
            }
            // *** ------------------------------------ ***


             // Assign texture map if changed
             if (baseMaterial.map !== textureToAssign) {
                 baseMaterial.map = textureToAssign;
                 baseMaterial.needsUpdate = true;
                 console.log("DEBUG RenderLoop: Assigned texture:", textureToAssign?.constructor?.name ?? 'null');
             }
             // Ensure image texture keeps updating if needed
             if (textureToAssign && textureToAssign === imageTextureRef.current && imageTextureRef.current.needsUpdate) {
                  imageTextureRef.current.needsUpdate = true; // Persist flag until upload
             }


            // 2. Update Plane Scale & Mirroring
            const planeVisible = !!baseMaterial.map && sourceWidth > 0 && sourceHeight > 0;
             if (planeVisible) { fitPlaneToCamera(sourceWidth, sourceHeight); const scaleX = Math.abs(basePlaneMeshRef.current.scale.x); const newScaleX = isVideo ? -scaleX : scaleX; if(basePlaneMeshRef.current.scale.x !== newScaleX) { basePlaneMeshRef.current.scale.x = newScaleX; } }
             else { if (basePlaneMeshRef.current.scale.x !== 0 || basePlaneMeshRef.current.scale.y !== 0) { basePlaneMeshRef.current.scale.set(0, 0, 0); if (logThisFrame) console.log("DEBUG RenderLoop: Hiding base plane"); } }


            // 3. Render Base Scene to Target
             rendererInstanceRef.current.setRenderTarget(renderTargetRef.current);
             rendererInstanceRef.current.setClearColor(0x000000, 0); // Back to transparent/black clear
             rendererInstanceRef.current.clear();
             if (planeVisible) { rendererInstanceRef.current.render(baseSceneRef.current, baseCameraRef.current); if (logThisFrame) console.log(`DEBUG RenderLoop: Rendered base scene to target.`); }
             else { if (logThisFrame) console.log(`DEBUG RenderLoop: Target cleared (plane hidden).`); }
             rendererInstanceRef.current.setRenderTarget(null);


            // 4. Update Post-Processing Uniforms
             if (postUniforms.uSceneTexture) { postUniforms.uSceneTexture.value = renderTargetRef.current.texture; } else if (logThisFrame) { console.warn("RenderLoop: uSceneTexture uniform missing!"); }
             // Update Segmentation Mask Texture
             // ... segmentation update logic ...


            // 5. Render Post-Processing Scene to Screen
             rendererInstanceRef.current.render(postSceneRef.current, postCameraRef.current);


        } catch (error) { console.error("Error in renderLoop:", error); }
    // Dependency only on fitPlaneToCamera (stable) and isStatic prop
    }, [fitPlaneToCamera, isStatic]);


    // --- Initialize Scene --- (Bare Minimum Shader, Only uSceneTexture Uniform)
    const initThreeScene = useCallback(() => { /* ... same init logic ... */ }, [handleResize, postVertexShader, postFragmentShader, renderLoop]);

    // --- Effect for Initial Setup / Resize Observer ---
    useEffect(() => { /* ... mount/unmount ... */ }, [initThreeScene, handleResize]);
    // --- REMOVED useImperativeHandle ---

    // --- JSX ---
    // Pass style prop down to canvas
    return ( <canvas ref={canvasRef} className={`renderer-canvas ${className || ''}`} style={{ display: 'block', width: '100%', height: '100%', ...(style || {}) }} /> );
});

TryOnRenderer.displayName = 'TryOnRenderer';
export default TryOnRenderer;