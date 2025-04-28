// src/components/TryOnRenderer.jsx - SUPER Simplified: Direct Rendering, No Post-Processing

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
        // Check only needed refs for direct rendering
        if (!isInitialized.current || !rendererInstanceRef.current || !baseSceneRef.current || !baseCameraRef.current || !basePlaneMeshRef.current) {
             // If still initializing, skip frame
             // console.warn("RenderLoop: Waiting for initialization...");
             return;
        }

        const currentCount = renderLoopCounter.current++;
        const logThisFrame = (currentCount % 150 === 0);

        try {
            // 1. Select Source Texture
            const baseMaterial = basePlaneMeshRef.current.material;
            let sourceWidth = 0, sourceHeight = 0;
            let textureToAssign = null;
            let isVideo = false;

            if (!isStatic && videoTextureRef.current) {
                 textureToAssign = videoTextureRef.current;
                 if (textureToAssign.image) { sourceWidth = textureToAssign.image.videoWidth; sourceHeight = textureToAssign.image.videoHeight; isVideo = true;}
            } else if (isStatic && imageTextureRef.current) {
                 textureToAssign = imageTextureRef.current;
                  if (textureToAssign.image) { sourceWidth = textureToAssign.image.naturalWidth; sourceHeight = textureToAssign.image.naturalHeight; }
                  if (textureToAssign.needsUpdate) { textureToAssign.needsUpdate = true; } // Ensure flag is set
            }

            // Assign texture map if changed or needs update
             if (baseMaterial.map !== textureToAssign) {
                 console.log("DEBUG RenderLoop: Assigning base texture:", textureToAssign?.constructor?.name ?? 'null');
                 baseMaterial.map = textureToAssign;
                 baseMaterial.needsUpdate = true;
             } else if (textureToAssign && textureToAssign.needsUpdate) {
                 if (logThisFrame) console.log("DEBUG RenderLoop: Triggering baseMaterial.needsUpdate because texture needed update.");
                 baseMaterial.needsUpdate = true; // Ensure material updates if texture content changed
             }

            // 2. Update Plane Scale & Mirroring
            const planeVisible = !!baseMaterial.map && sourceWidth > 0 && sourceHeight > 0;
            if (planeVisible) {
                fitPlaneToCamera(sourceWidth, sourceHeight);
                const scaleX = Math.abs(basePlaneMeshRef.current.scale.x);
                const newScaleX = isVideo ? -scaleX : scaleX; // Mirror video
                if(basePlaneMeshRef.current.scale.x !== newScaleX) { basePlaneMeshRef.current.scale.x = newScaleX; }
            } else {
                 if (basePlaneMeshRef.current.scale.x !== 0 || basePlaneMeshRef.current.scale.y !== 0) { basePlaneMeshRef.current.scale.set(0, 0, 0); }
             }

            // 3. *** Render Base Scene DIRECTLY to Screen ***
            rendererInstanceRef.current.setRenderTarget(null); // Ensure rendering to canvas
            rendererInstanceRef.current.setClearColor(0x000000, 1); // Clear with black (or choose another color)
            rendererInstanceRef.current.clear();
             if (planeVisible) {
                 rendererInstanceRef.current.render(baseSceneRef.current, baseCameraRef.current);
                 // Mark texture as updated *after* rendering it
                 if (textureToAssign?.needsUpdate) {
                    textureToAssign.needsUpdate = false;
                    // if(logThisFrame) console.log("DEBUG RenderLoop: Set texture.needsUpdate = false");
                 }
             }
             // else: If plane not visible, scene is just cleared

        } catch (error) { console.error("Error in renderLoop:", error); }
    }, [fitPlaneToCamera, isStatic]); // Keep dependencies


    // --- ***** SIMPLIFIED Initialize Scene ***** ---
    const initThreeScene = useCallback(() => {
        if (!canvasRef.current || isInitialized.current) return;
        console.log("DEBUG: initThreeScene START (SUPER Simplified - Direct Rendering)");
        try {
            const canvas = canvasRef.current; const initialWidth = canvas.clientWidth || 640; const initialHeight = canvas.clientHeight || 480;

            // Renderer setup (same)
            rendererInstanceRef.current = new THREE.WebGLRenderer({ canvas: canvas, antialias: true });
            rendererInstanceRef.current.setSize(initialWidth, initialHeight);
            rendererInstanceRef.current.setPixelRatio(window.devicePixelRatio);
            rendererInstanceRef.current.outputColorSpace = THREE.SRGBColorSpace;

            // Base Scene setup (same)
            baseSceneRef.current = new THREE.Scene();
            baseCameraRef.current = new THREE.OrthographicCamera(-initialWidth / 2, initialWidth / 2, initialHeight / 2, -initialHeight / 2, 0.1, 10);
            baseCameraRef.current.position.z = 1;
            const planeGeometry = new THREE.PlaneGeometry(1, 1);
            // Basic material - texture will be assigned in render loop
            const planeMaterial = new THREE.MeshBasicMaterial({ map: null, side: THREE.DoubleSide, color: 0xffffff, transparent: true });
            basePlaneMeshRef.current = new THREE.Mesh(planeGeometry, planeMaterial);
            baseSceneRef.current.add(basePlaneMeshRef.current);
            console.log("DEBUG: Base scene created.");

            // NO Post-processing scene, NO Render Target needed

            isInitialized.current = true;
            console.log("DEBUG: Scene initialization complete (Direct Rendering).");
            handleResize(); // Set initial size
            console.log("DEBUG: Requesting first render loop frame from Init.");
            cancelAnimationFrame(animationFrameHandle.current);
            animationFrameHandle.current = requestAnimationFrame(renderLoop);
        } catch (error) { console.error("DEBUG: initThreeScene ERROR:", error); isInitialized.current = false; }
    // Add renderLoop dependency
    }, [handleResize, renderLoop]);


    // --- Setup / Cleanup Effect --- (Simplified disposal)
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
             videoTextureRef.current?.dispose(); imageTextureRef.current?.dispose();
             // REMOVED: segmentationTextureRef.current?.dispose(); renderTargetRef.current?.dispose();
             basePlaneMeshRef.current?.geometry?.dispose(); basePlaneMeshRef.current?.material?.map?.dispose(); basePlaneMeshRef.current?.material?.dispose();
             // REMOVED: postMaterialRef.current?.dispose();
             rendererInstanceRef.current?.dispose();
             /* ... nullify refs ... */
             videoTextureRef.current = null; imageTextureRef.current = null; segmentationTextureRef.current = null; renderTargetRef.current = null;
             basePlaneMeshRef.current = null; postMaterialRef.current = null; rendererInstanceRef.current = null; baseSceneRef.current = null;
             postSceneRef.current = null; baseCameraRef.current = null; postCameraRef.current = null;
             console.log("DEBUG: Three.js resources disposed.");
        };
     }, [initThreeScene, handleResize]); // Keep dependencies


    // --- JSX --- (No change)
    return ( <canvas ref={canvasRef} className={`renderer-canvas ${className || ''}`} style={{ display: 'block', width: '100%', height: '100%', ...(style || {}) }} /> );
});
TryOnRenderer.displayName = 'TryOnRenderer';
export default TryOnRenderer;