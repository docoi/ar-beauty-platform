// src/components/TryOnRenderer.jsx - COMPLETE - Reverted to MeshBasicMaterial

import React, { useRef, forwardRef, useEffect, useCallback, useState, useMemo } from 'react';
import * as THREE from 'three';

console.log(`Using Three.js revision: ${THREE.REVISION}`);

const TryOnRenderer = forwardRef(({
    videoRefProp,
    imageElement,
    mediaPipeResults, // Keep results prop even if not used yet
    isStatic,
    brightness, // Keep props even if not used yet
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
    const basePlaneMeshRef = useRef(null); // The plane that will display the texture
    const videoTextureRef = useRef(null);
    const imageTextureRef = useRef(null);
    // REMOVED Post-processing refs: postSceneRef, postCameraRef, postMaterialRef, renderTargetRef, segmentationTextureRef

    // --- Internal State Refs --- (Keep for potential future use)
    const currentResults = useRef(null);
    const currentBrightness = useRef(1.0);
    const currentContrast = useRef(1.0);
    const currentIntensity = useRef(0.5);
    const renderLoopCounter = useRef(0);

    // --- NO SHADERS NEEDED ---

    // --- Update internal refs --- (Keep these)
    useEffect(() => { currentResults.current = mediaPipeResults; }, [mediaPipeResults]);
    useEffect(() => { currentBrightness.current = isStatic ? Math.max(0.1, brightness || 1.0) : 1.0; currentContrast.current = isStatic ? Math.max(0.1, contrast || 1.0) : 1.0; }, [isStatic, brightness, contrast]);
    useEffect(() => { currentIntensity.current = effectIntensity; }, [effectIntensity]);

    // --- Effect to manage Video Texture ---
    useEffect(() => {
        const videoElement = videoRefProp?.current;
        if (!isStatic && videoElement) {
             if (!videoTextureRef.current || videoTextureRef.current.image !== videoElement) {
                console.log("TryOnRenderer Effect: Creating/Updating Video Texture (Basic)");
                videoTextureRef.current?.dispose();
                videoTextureRef.current = new THREE.VideoTexture(videoElement);
                videoTextureRef.current.colorSpace = THREE.SRGBColorSpace;
             }
        } else { if (videoTextureRef.current) { /* ... dispose ... */ } }
    }, [isStatic, videoRefProp]);


     // --- Effect to manage Image Texture ---
    useEffect(() => {
        if (isStatic && imageElement) {
             if (!imageTextureRef.current || imageTextureRef.current.image !== imageElement) {
                console.log("TryOnRenderer Effect: Creating/Updating Image Texture (Basic)");
                imageTextureRef.current?.dispose();
                imageTextureRef.current = new THREE.Texture(imageElement);
                imageTextureRef.current.colorSpace = THREE.SRGBColorSpace;
                imageTextureRef.current.needsUpdate = true;
             } else if (imageTextureRef.current) { imageTextureRef.current.needsUpdate = true; }
        } else { if (imageTextureRef.current) { /* ... dispose ... */ } }
    }, [isStatic, imageElement]);


    // --- Handle Resizing ---
    const handleResize = useCallback(() => {
         const canvas = canvasRef.current;
         // Only update renderer and baseCamera
         if (!rendererInstanceRef.current || !baseCameraRef.current || !canvas) return;
         const newWidth = canvas.clientWidth; const newHeight = canvas.clientHeight; if (newWidth === 0 || newHeight === 0) return;
         const currentSize = rendererInstanceRef.current.getSize(new THREE.Vector2()); if (currentSize.x === newWidth && currentSize.y === newHeight) return;
         console.log(`DEBUG: Resizing (Basic) -> ${newWidth}x${newHeight}`);
         try { rendererInstanceRef.current.setSize(newWidth, newHeight); baseCameraRef.current.left = -newWidth / 2; baseCameraRef.current.right = newWidth / 2; baseCameraRef.current.top = newHeight / 2; baseCameraRef.current.bottom = -newHeight / 2; baseCameraRef.current.updateProjectionMatrix(); } catch(e) { console.error("Resize Error:", e);}
    }, []);


    // --- Scale Base Plane ---
    const fitPlaneToCamera = useCallback((textureWidth, textureHeight) => {
        const canvas = canvasRef.current;
        if (!baseCameraRef.current || !basePlaneMeshRef.current || !textureWidth || !textureHeight || !canvas || canvas.clientWidth === 0 || canvas.clientHeight === 0) return;
        const viewWidth = canvas.clientWidth; const viewHeight = canvas.clientHeight; const viewAspect = viewWidth / viewHeight; const textureAspect = textureWidth / textureHeight; let scaleX, scaleY;
        // Use 'cover' logic
        if (viewAspect > textureAspect) { scaleX = viewWidth; scaleY = scaleX / textureAspect; } else { scaleY = viewHeight; scaleX = scaleY * textureAspect; }
        const currentScale = basePlaneMeshRef.current.scale; const currentSignX = Math.sign(currentScale.x) || 1; const newScaleXWithSign = scaleX * currentSignX;
        if (Math.abs(currentScale.y - scaleY) > 0.01 || Math.abs(currentScale.x - newScaleXWithSign) > 0.01) { currentScale.y = scaleY; currentScale.x = newScaleXWithSign; }
     }, []);


    // --- Render Loop --- (Simplified for MeshBasicMaterial)
     const renderLoop = useCallback(() => {
        animationFrameHandle.current = requestAnimationFrame(renderLoop);
        // Only need base scene refs and renderer
        if (!isInitialized.current || !rendererInstanceRef.current || !baseSceneRef.current || !baseCameraRef.current || !basePlaneMeshRef.current) { return; }

        try {
            const baseMaterial = basePlaneMeshRef.current.material;
            let sourceWidth = 0, sourceHeight = 0;
            let textureToAssign = null;
            let isVideo = false;

            // Select texture from refs based on isStatic prop
            if (!isStatic && videoTextureRef.current) {
                 textureToAssign = videoTextureRef.current;
                 if (textureToAssign.image) { sourceWidth = textureToAssign.image.videoWidth; sourceHeight = textureToAssign.image.videoHeight; isVideo = true; }
            } else if (isStatic && imageTextureRef.current) {
                 textureToAssign = imageTextureRef.current;
                 if (textureToAssign.image) { sourceWidth = textureToAssign.image.naturalWidth; sourceHeight = textureToAssign.image.naturalHeight; }
                 // Ensure image texture keeps updating if needed
                 if (textureToAssign.needsUpdate) { textureToAssign.needsUpdate = true; }
            }

             // Assign texture map if changed
             if (baseMaterial.map !== textureToAssign) {
                 baseMaterial.map = textureToAssign;
                 baseMaterial.needsUpdate = true;
                 console.log("DEBUG RenderLoop (Basic): Assigned texture:", textureToAssign?.constructor?.name ?? 'null');
             }

            // Update Plane Scale & Mirroring
            const planeVisible = !!baseMaterial.map && sourceWidth > 0 && sourceHeight > 0;
             if (planeVisible) { fitPlaneToCamera(sourceWidth, sourceHeight); const scaleX = Math.abs(basePlaneMeshRef.current.scale.x); const newScaleX = isVideo ? -scaleX : scaleX; if(basePlaneMeshRef.current.scale.x !== newScaleX) { basePlaneMeshRef.current.scale.x = newScaleX; } }
             else { if (basePlaneMeshRef.current.scale.x !== 0 || basePlaneMeshRef.current.scale.y !== 0) { basePlaneMeshRef.current.scale.set(0, 0, 0); } }

            // Render ONLY the base scene directly to canvas
            rendererInstanceRef.current.render(baseSceneRef.current, baseCameraRef.current);

        } catch (error) { console.error("Error in renderLoop (Basic):", error); }
    // Update dependencies
    }, [fitPlaneToCamera, isStatic]); // Depends on isStatic now


    // --- Initialize Scene --- (Simplified for MeshBasicMaterial)
    const initThreeScene = useCallback(() => {
        if (!canvasRef.current || isInitialized.current) return;
        console.log("DEBUG: initThreeScene START (MeshBasicMaterial)");
        try {
            const canvas = canvasRef.current; const initialWidth = canvas.clientWidth || 640; const initialHeight = canvas.clientHeight || 480;
            rendererInstanceRef.current = new THREE.WebGLRenderer({ canvas: canvas, antialias: true });
            rendererInstanceRef.current.setSize(initialWidth, initialHeight);
            rendererInstanceRef.current.setPixelRatio(window.devicePixelRatio);
            rendererInstanceRef.current.outputColorSpace = THREE.SRGBColorSpace;
            // No Render Target needed

            baseSceneRef.current = new THREE.Scene();
            baseCameraRef.current = new THREE.OrthographicCamera(-initialWidth / 2, initialWidth / 2, initialHeight / 2, -initialHeight / 2, 0.1, 10);
            baseCameraRef.current.position.z = 1;

            const planeGeometry = new THREE.PlaneGeometry(1, 1);
            // *** USE MeshBasicMaterial ***
            const planeMaterial = new THREE.MeshBasicMaterial({ map: null, side: THREE.DoubleSide, color: 0xffffff });
            basePlaneMeshRef.current = new THREE.Mesh(planeGeometry, planeMaterial);
            basePlaneMeshRef.current.position.z = 0; basePlaneMeshRef.current.scale.set(1, 1, 1);
            baseSceneRef.current.add(basePlaneMeshRef.current);
            console.log("DEBUG: Base scene created (MeshBasicMaterial).");
            // No Post-processing scene needed

            isInitialized.current = true; console.log("DEBUG: Scene initialization complete (Basic)."); handleResize();
            console.log("DEBUG: Requesting first render loop frame from Init (Basic).");
            cancelAnimationFrame(animationFrameHandle.current); animationFrameHandle.current = requestAnimationFrame(renderLoop);
         } catch (error) { console.error("DEBUG: initThreeScene ERROR (Basic):", error); isInitialized.current = false; }
    // Update dependencies
    }, [handleResize, renderLoop]);


    // --- Effect for Initial Setup / Resize Observer ---
    useEffect(() => {
         console.log("DEBUG: Mount/Init effect running (Basic).");
         initThreeScene();
         let resizeObserver; const currentCanvas = canvasRef.current; if (currentCanvas) { resizeObserver = new ResizeObserver(() => { handleResize(); }); resizeObserver.observe(currentCanvas); }
         return () => { console.log("DEBUG: Cleanup running (TryOnRenderer Unmount - Basic)..."); resizeObserver?.disconnect(currentCanvas); cancelAnimationFrame(animationFrameHandle.current); isInitialized.current = false; console.log("DEBUG: Disposing Three.js resources (Basic)..."); /* ... dispose BASE objects only ... */ videoTextureRef.current?.dispose(); imageTextureRef.current?.dispose(); basePlaneMeshRef.current?.geometry?.dispose(); basePlaneMeshRef.current?.material?.map?.dispose(); basePlaneMeshRef.current?.material?.dispose(); rendererInstanceRef.current?.dispose(); /* ... nullify refs ... */ };
     }, [initThreeScene, handleResize]); // Dependencies


    // --- REMOVED useImperativeHandle ---


    // --- JSX ---
    return ( <canvas ref={canvasRef} className={`renderer-canvas ${className || ''}`} style={{ display: 'block', width: '100%', height: '100%', ...(style || {}) }} /> );
});

TryOnRenderer.displayName = 'TryOnRenderer';
export default TryOnRenderer;