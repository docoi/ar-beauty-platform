// src/components/TryOnRenderer.jsx - SUPER Simplified (Corrected Cleanup): Direct Rendering, No Post-Processing

import React, { useRef, forwardRef, useEffect, useCallback } from 'react';
import * as THREE from 'three';

const TryOnRenderer = forwardRef(({
    videoRefProp, imageElement,
    // Props below are NOT used in this simplified version:
    mediaPipeResults, segmentationResults,
    isStatic, brightness, contrast, effectIntensity,
    className, style
 }, ref) => {

    // --- Core Refs ---
    const canvasRef = useRef(null);
    const rendererInstanceRef = useRef(null);
    const animationFrameHandle = useRef(null);
    const isInitialized = useRef(false);
    // Only need Base Scene Refs now
    const baseSceneRef = useRef(null);
    const baseCameraRef = useRef(null);
    const basePlaneMeshRef = useRef(null);
    const videoTextureRef = useRef(null);
    const imageTextureRef = useRef(null);
    // REMOVED: postSceneRef, postCameraRef, postMaterialRef, renderTargetRef, segmentationTextureRef

    const renderLoopCounter = useRef(0);

    // --- Video/Image Texture Effects --- (Keep these)
    useEffect(() => {
        const videoElement = videoRefProp?.current;
        if (!isStatic && videoElement) { if (!videoTextureRef.current || videoTextureRef.current.image !== videoElement) { console.log("TryOnRenderer Effect: Creating/Updating Video Texture"); videoTextureRef.current?.dispose(); videoTextureRef.current = new THREE.VideoTexture(videoElement); videoTextureRef.current.colorSpace = THREE.SRGBColorSpace; } } else { if (videoTextureRef.current) { console.log("TryOnRenderer Effect: Disposing Video Texture"); videoTextureRef.current.dispose(); videoTextureRef.current = null; } }
    }, [isStatic, videoRefProp]);
    useEffect(() => {
        if (isStatic && imageElement) { if (!imageTextureRef.current || imageTextureRef.current.image !== imageElement) { console.log("TryOnRenderer Effect: Creating/Updating Image Texture"); imageTextureRef.current?.dispose(); imageTextureRef.current = new THREE.Texture(imageElement); imageTextureRef.current.colorSpace = THREE.SRGBColorSpace; imageTextureRef.current.needsUpdate = true; } else if (imageTextureRef.current && imageTextureRef.current.image === imageElement) { imageTextureRef.current.needsUpdate = true; } } else { if (imageTextureRef.current) { console.log("TryOnRenderer Effect: Disposing Image Texture"); imageTextureRef.current.dispose(); imageTextureRef.current = null; } }
    }, [isStatic, imageElement]);


    // --- Handle Resizing --- (Only needs to update Base Camera now)
    const handleResize = useCallback(() => {
         const canvas = canvasRef.current;
         if (!rendererInstanceRef.current || !baseCameraRef.current || !canvas ) return;
         const newWidth = canvas.clientWidth; const newHeight = canvas.clientHeight;
         if (newWidth === 0 || newHeight === 0) return;
         const currentSize = rendererInstanceRef.current.getSize(new THREE.Vector2());
         if (currentSize.x === newWidth && currentSize.y === newHeight) return;
         console.log(`DEBUG: Resizing Renderer -> ${newWidth}x${newHeight}`);
         try {
             rendererInstanceRef.current.setSize(newWidth, newHeight);
             // Update Base Camera projection for new aspect ratio
             baseCameraRef.current.left = -newWidth / 2;
             baseCameraRef.current.right = newWidth / 2;
             baseCameraRef.current.top = newHeight / 2;
             baseCameraRef.current.bottom = -newHeight / 2;
             baseCameraRef.current.updateProjectionMatrix();
         } catch(e) { console.error("Resize Error:", e);}
    }, []);


    // --- Scale Base Plane --- (No changes needed)
    const fitPlaneToCamera = useCallback((textureWidth, textureHeight) => {
        const canvas = canvasRef.current; if (!baseCameraRef.current || !basePlaneMeshRef.current || !textureWidth || !textureHeight || !canvas || canvas.clientWidth === 0 || canvas.clientHeight === 0) return; const viewWidth = canvas.clientWidth; const viewHeight = canvas.clientHeight; const viewAspect = viewWidth / viewHeight; const textureAspect = textureWidth / textureHeight; let scaleX, scaleY; if (viewAspect > textureAspect) { scaleX = viewWidth; scaleY = scaleX / textureAspect; } else { scaleY = viewHeight; scaleX = scaleY * textureAspect; } const currentScale = basePlaneMeshRef.current.scale; const currentSignX = Math.sign(currentScale.x) || 1; const newScaleXWithSign = scaleX * currentSignX; if (Math.abs(currentScale.y - scaleY) > 0.01 || Math.abs(currentScale.x - newScaleXWithSign) > 0.01) { currentScale.y = scaleY; currentScale.x = newScaleXWithSign; }
     }, []);


    // --- ***** SIMPLIFIED Render Loop (Direct Rendering) ***** ---
     const renderLoop = useCallback(() => {
        animationFrameHandle.current = requestAnimationFrame(renderLoop);
        if (!isInitialized.current || !rendererInstanceRef.current || !baseSceneRef.current || !baseCameraRef.current || !basePlaneMeshRef.current) { return; }

        const currentCount = renderLoopCounter.current++;
        const logThisFrame = (currentCount % 150 === 0);

        try {
            // 1. Select Source Texture
            const baseMaterial = basePlaneMeshRef.current.material;
            let sourceWidth = 0, sourceHeight = 0;
            let textureToAssign = null;
            let isVideo = false;

            if (!isStatic && videoTextureRef.current) { textureToAssign = videoTextureRef.current; if (textureToAssign.image) { sourceWidth = textureToAssign.image.videoWidth; sourceHeight = textureToAssign.image.videoHeight; isVideo = true;} } else if (isStatic && imageTextureRef.current) { textureToAssign = imageTextureRef.current; if (textureToAssign.image) { sourceWidth = textureToAssign.image.naturalWidth; sourceHeight = textureToAssign.image.naturalHeight; } if (textureToAssign.needsUpdate) { textureToAssign.needsUpdate = true; } }

            // Assign texture map
             if (baseMaterial.map !== textureToAssign) {
                 console.log("DEBUG RenderLoop: Assigning base texture:", textureToAssign?.constructor?.name ?? 'null');
                 baseMaterial.map = textureToAssign;
                 baseMaterial.needsUpdate = true;
             } else if (textureToAssign && textureToAssign.needsUpdate) {
                 baseMaterial.needsUpdate = true;
             }

            // 2. Update Plane Scale & Mirroring
            const planeVisible = !!baseMaterial.map && sourceWidth > 0 && sourceHeight > 0;
            if (planeVisible) { fitPlaneToCamera(sourceWidth, sourceHeight); const scaleX = Math.abs(basePlaneMeshRef.current.scale.x); const newScaleX = isVideo ? -scaleX : scaleX; if(basePlaneMeshRef.current.scale.x !== newScaleX) { basePlaneMeshRef.current.scale.x = newScaleX; } } else { if (basePlaneMeshRef.current.scale.x !== 0 || basePlaneMeshRef.current.scale.y !== 0) { basePlaneMeshRef.current.scale.set(0, 0, 0); } }

            // 3. Render Base Scene DIRECTLY to Screen
            rendererInstanceRef.current.setRenderTarget(null);
            rendererInstanceRef.current.setClearColor(0x000000, 1); // Clear black
            rendererInstanceRef.current.clear();
             if (planeVisible) {
                 rendererInstanceRef.current.render(baseSceneRef.current, baseCameraRef.current);
                 if (textureToAssign?.needsUpdate) { textureToAssign.needsUpdate = false; }
             }

        } catch (error) { console.error("Error in renderLoop:", error); }
    }, [fitPlaneToCamera, isStatic]);


    // --- ***** SIMPLIFIED Initialize Scene ***** ---
    const initThreeScene = useCallback(() => {
        if (!canvasRef.current || isInitialized.current) return;
        console.log("DEBUG: initThreeScene START (SUPER Simplified - Direct Rendering)");
        try {
            const canvas = canvasRef.current; const initialWidth = canvas.clientWidth || 640; const initialHeight = canvas.clientHeight || 480;
            rendererInstanceRef.current = new THREE.WebGLRenderer({ canvas: canvas, antialias: true }); rendererInstanceRef.current.setSize(initialWidth, initialHeight); rendererInstanceRef.current.setPixelRatio(window.devicePixelRatio); rendererInstanceRef.current.outputColorSpace = THREE.SRGBColorSpace;
            baseSceneRef.current = new THREE.Scene(); baseCameraRef.current = new THREE.OrthographicCamera(-initialWidth / 2, initialWidth / 2, initialHeight / 2, -initialHeight / 2, 0.1, 10); baseCameraRef.current.position.z = 1;
            const planeGeometry = new THREE.PlaneGeometry(1, 1);
            const planeMaterial = new THREE.MeshBasicMaterial({ map: null, side: THREE.DoubleSide, color: 0xffffff, transparent: true });
            basePlaneMeshRef.current = new THREE.Mesh(planeGeometry, planeMaterial); baseSceneRef.current.add(basePlaneMeshRef.current);
            console.log("DEBUG: Base scene created.");
            isInitialized.current = true;
            console.log("DEBUG: Scene initialization complete (Direct Rendering).");
            handleResize();
            console.log("DEBUG: Requesting first render loop frame from Init.");
            cancelAnimationFrame(animationFrameHandle.current);
            animationFrameHandle.current = requestAnimationFrame(renderLoop);
        } catch (error) { console.error("DEBUG: initThreeScene ERROR:", error); isInitialized.current = false; }
    }, [handleResize, renderLoop]);


    // --- Setup / Cleanup Effect --- (Corrected Simplified disposal)
    useEffect(() => {
        initThreeScene();
        let resizeObserver; const currentCanvas = canvasRef.current;
        if (currentCanvas) { resizeObserver = new ResizeObserver(() => { handleResize(); }); resizeObserver.observe(currentCanvas); }
        return () => {
             console.log("DEBUG: Cleanup running (TryOnRenderer Unmount)...");
             resizeObserver?.disconnect();
             cancelAnimationFrame(animationFrameHandle.current);
             isInitialized.current = false;
             console.log("DEBUG: Disposing Three.js resources (Simplified)...");
             // Dispose textures managed by effects
             videoTextureRef.current?.dispose();
             imageTextureRef.current?.dispose();
             // No segmentationTextureRef or renderTargetRef to dispose here

             // Dispose base scene elements
             basePlaneMeshRef.current?.geometry?.dispose();
             basePlaneMeshRef.current?.material?.map?.dispose();
             basePlaneMeshRef.current?.material?.dispose();
             // No postMaterialRef to dispose

             // Dispose renderer
             rendererInstanceRef.current?.dispose();

             // Nullify refs
             videoTextureRef.current = null; imageTextureRef.current = null;
             // segmentationTextureRef = null; // Ref doesn't exist in this scope
             // renderTargetRef = null; // Ref doesn't exist
             basePlaneMeshRef.current = null;
             // postMaterialRef = null; // Ref doesn't exist
             rendererInstanceRef.current = null; baseSceneRef.current = null;
             // postSceneRef = null; // Ref doesn't exist
             baseCameraRef.current = null;
             // postCameraRef = null; // Ref doesn't exist
             console.log("DEBUG: Three.js resources disposed.");
        };
     }, [initThreeScene, handleResize]); // Keep dependencies


    // --- JSX --- (No change)
    return ( <canvas ref={canvasRef} className={`renderer-canvas ${className || ''}`} style={{ display: 'block', width: '100%', height: '100%', ...(style || {}) }} /> );
});
TryOnRenderer.displayName = 'TryOnRenderer';
export default TryOnRenderer;