// src/components/TryOnRenderer.jsx - RESET to SUPER Simplified: Direct Rendering, No Post-Processing

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
    // REMOVED: segmentationTextureRef, post-processing refs etc.

    const renderLoopCounter = useRef(0);

    // --- Video/Image Texture Effects --- (Keep these)
    useEffect(() => {
        const videoElement = videoRefProp?.current;
        if (!isStatic && videoElement) { if (!videoTextureRef.current || videoTextureRef.current.image !== videoElement) { /*console.log("Effect: Creating/Updating Video Texture");*/ videoTextureRef.current?.dispose(); videoTextureRef.current = new THREE.VideoTexture(videoElement); videoTextureRef.current.colorSpace = THREE.SRGBColorSpace; } } else { if (videoTextureRef.current) { /*console.log("Effect: Disposing Video Texture");*/ videoTextureRef.current.dispose(); videoTextureRef.current = null; } }
    }, [isStatic, videoRefProp]);
    useEffect(() => {
        if (isStatic && imageElement) { if (!imageTextureRef.current || imageTextureRef.current.image !== imageElement) { /*console.log("Effect: Creating/Updating Image Texture");*/ imageTextureRef.current?.dispose(); imageTextureRef.current = new THREE.Texture(imageElement); imageTextureRef.current.colorSpace = THREE.SRGBColorSpace; imageTextureRef.current.needsUpdate = true; } else if (imageTextureRef.current && imageTextureRef.current.image === imageElement) { imageTextureRef.current.needsUpdate = true; } } else { if (imageTextureRef.current) { /*console.log("Effect: Disposing Image Texture");*/ imageTextureRef.current.dispose(); imageTextureRef.current = null; } }
    }, [isStatic, imageElement]);


    // --- Handle Resizing --- (Only needs to update Base Camera now)
    const handleResize = useCallback(() => {
         const canvas = canvasRef.current;
         if (!rendererInstanceRef.current || !baseCameraRef.current || !canvas ) return;
         const newWidth = canvas.clientWidth; const newHeight = canvas.clientHeight;
         if (newWidth === 0 || newHeight === 0) return;
         const currentSize = rendererInstanceRef.current.getSize(new THREE.Vector2());
         if (currentSize.x === newWidth && currentSize.y === newHeight) return;
         // console.log(`DEBUG: Resizing Renderer -> ${newWidth}x${newHeight}`);
         try {
             rendererInstanceRef.current.setSize(newWidth, newHeight);
             baseCameraRef.current.left = -newWidth / 2; baseCameraRef.current.right = newWidth / 2;
             baseCameraRef.current.top = newHeight / 2; baseCameraRef.current.bottom = -newHeight / 2;
             baseCameraRef.current.updateProjectionMatrix();
         } catch(e) { console.error("Resize Error:", e);}
    }, []);


    // --- Scale Base Plane --- (Full Function Restored)
    const fitPlaneToCamera = useCallback((textureWidth, textureHeight) => {
        const canvas = canvasRef.current; if (!baseCameraRef.current || !basePlaneMeshRef.current || !textureWidth || !textureHeight || !canvas || canvas.clientWidth === 0 || canvas.clientHeight === 0) return; const viewWidth = canvas.clientWidth; const viewHeight = canvas.clientHeight; const viewAspect = viewWidth / viewHeight; const textureAspect = textureWidth / textureHeight; let scaleX, scaleY; if (viewAspect > textureAspect) { scaleX = viewWidth; scaleY = scaleX / textureAspect; } else { scaleY = viewHeight; scaleX = scaleY * textureAspect; } const currentScale = basePlaneMeshRef.current.scale; const signX = Math.sign(currentScale.x) || 1; const newScaleXWithSign = scaleX * signX; if (Math.abs(currentScale.y - scaleY) > 0.01 || Math.abs(currentScale.x - newScaleXWithSign) > 0.01) { currentScale.set(newScaleXWithSign, scaleY, 1); }
     }, []);


    // --- SIMPLIFIED Render Loop (Direct Rendering) ---
     const renderLoop = useCallback(() => {
        animationFrameHandle.current = requestAnimationFrame(renderLoop);
        if (!isInitialized.current || !rendererInstanceRef.current || !baseSceneRef.current || !baseCameraRef.current || !basePlaneMeshRef.current || !basePlaneMeshRef.current.material ) { return; } // Check init flag and material

        renderLoopCounter.current++; // Increment counter
        const logThisFrame = (renderLoopCounter.current <= 5 || renderLoopCounter.current % 300 === 0); // Log first 5 + every 5 seconds approx

        try {
            // 1. Select Source Texture
            const baseMaterial = basePlaneMeshRef.current.material; // Should be MeshBasicMaterial
            let sourceWidth = 0, sourceHeight = 0;
            let textureToAssign = null; // Determine texture inside the loop based on CURRENT ref values
            let isVideo = false;

            // Read Refs DIRECTLY inside the loop execution
            if (!isStatic && videoTextureRef.current) {
                 textureToAssign = videoTextureRef.current;
                 isVideo = true;
                 if(textureToAssign.image) {sourceWidth=textureToAssign.image.videoWidth; sourceHeight=textureToAssign.image.videoHeight;}
            } else if (isStatic && imageTextureRef.current) {
                 textureToAssign = imageTextureRef.current;
                 if(textureToAssign.image){sourceWidth=textureToAssign.image.naturalWidth; sourceHeight=textureToAssign.image.naturalHeight;}
                 if(textureToAssign.needsUpdate){textureToAssign.needsUpdate=true;}
            }

             if (logThisFrame) { console.log(`RenderLoop ${renderLoopCounter.current}: isStatic=${isStatic}, TexRef=${textureToAssign ? 'Exists' : 'null'}, Map=${baseMaterial.map ? 'Exists' : 'null'}`); }


            // Assign texture directly to map
            if (baseMaterial.map !== textureToAssign) {
                 if(logThisFrame && textureToAssign) console.log(` -> Assigning map!`);
                 baseMaterial.map = textureToAssign;
                 baseMaterial.needsUpdate = true; // Material needs update when map changes
            } else if (textureToAssign && textureToAssign.needsUpdate) {
                 if(logThisFrame) console.log(` -> Marking material needsUpdate (texture content changed).`);
                 baseMaterial.needsUpdate = true;
            }

            // 2. Update Plane Scale & Mirroring
            const planeVisible = !!baseMaterial.map && sourceWidth > 0 && sourceHeight > 0;
            if (planeVisible) { fitPlaneToCamera(sourceWidth, sourceHeight); const scaleX = Math.abs(basePlaneMeshRef.current.scale.x); const newScaleX = isVideo ? -scaleX : scaleX; if(basePlaneMeshRef.current.scale.x !== newScaleX) { basePlaneMeshRef.current.scale.x = newScaleX; } } else { if (basePlaneMeshRef.current?.scale.x !== 0 || basePlaneMeshRef.current?.scale.y !== 0) { basePlaneMeshRef.current?.scale.set(0, 0, 0); } }

            // 3. Render Base Scene DIRECTLY to Screen
            rendererInstanceRef.current.setRenderTarget(null);
            rendererInstanceRef.current.setClearColor(0x000000, 1); // Clear black
            rendererInstanceRef.current.clear();
             if (planeVisible) {
                 // If direct rendering works, this should display the image/video
                 rendererInstanceRef.current.render(baseSceneRef.current, baseCameraRef.current);
                 if (textureToAssign?.needsUpdate) { textureToAssign.needsUpdate = false; }
             } // else: screen is just cleared (black)

        } catch (error) { console.error("Error in renderLoop:", error); }
    }, [fitPlaneToCamera, isStatic]); // Keep dependencies


    // --- SIMPLIFIED Initialize Scene ---
    const initThreeScene = useCallback(() => {
        if (!canvasRef.current || isInitialized.current) return;
        console.log("DEBUG: initThreeScene START (SUPER Simplified - Direct Rendering)");
        try {
            const canvas = canvasRef.current; const initialWidth = canvas.clientWidth || 640; const initialHeight = canvas.clientHeight || 480;
            rendererInstanceRef.current = new THREE.WebGLRenderer({ canvas: canvas, antialias: true }); rendererInstanceRef.current.setSize(initialWidth, initialHeight); rendererInstanceRef.current.setPixelRatio(window.devicePixelRatio); rendererInstanceRef.current.outputColorSpace = THREE.SRGBColorSpace;
            baseSceneRef.current = new THREE.Scene(); baseCameraRef.current = new THREE.OrthographicCamera(-initialWidth / 2, initialWidth / 2, initialHeight / 2, -initialHeight / 2, 0.1, 10); baseCameraRef.current.position.z = 1;
            const planeGeometry = new THREE.PlaneGeometry(1, 1);
            // *** USE MeshBasicMaterial ***
            const planeMaterial = new THREE.MeshBasicMaterial({ map: null, side: THREE.DoubleSide, color: 0xffffff, transparent: true });
            basePlaneMeshRef.current = new THREE.Mesh(planeGeometry, planeMaterial);
            baseSceneRef.current.add(basePlaneMeshRef.current);
            isInitialized.current = true;
            console.log("DEBUG: Scene initialization complete (Direct Rendering).");
            handleResize(); cancelAnimationFrame(animationFrameHandle.current); animationFrameHandle.current = requestAnimationFrame(renderLoop);
        } catch (error) { console.error("DEBUG: initThreeScene ERROR:", error); isInitialized.current = false; }
    }, [handleResize, renderLoop]);


    // --- Setup / Cleanup Effect --- (Simplified disposal)
    useEffect(() => {
        initThreeScene();
        let resizeObserver; const currentCanvas = canvasRef.current;
        if (currentCanvas) { resizeObserver = new ResizeObserver(() => { handleResize(); }); resizeObserver.observe(currentCanvas); }
        return () => { console.log("DEBUG: Cleanup running..."); resizeObserver?.disconnect(); cancelAnimationFrame(animationFrameHandle.current); isInitialized.current = false; console.log("DEBUG: Disposing Three.js resources (Simplified)..."); videoTextureRef.current?.dispose(); imageTextureRef.current?.dispose(); /* segmentationTextureRef?.dispose(); */ basePlaneMeshRef.current?.geometry?.dispose(); basePlaneMeshRef.current?.material?.map?.dispose(); basePlaneMeshRef.current?.material?.dispose(); rendererInstanceRef.current?.dispose(); videoTextureRef.current = null; imageTextureRef.current = null; /* segmentationTextureRef=null; */ basePlaneMeshRef.current = null; rendererInstanceRef.current = null; baseSceneRef.current = null; baseCameraRef.current = null; console.log("DEBUG: Three.js resources disposed."); };
     }, [initThreeScene, handleResize]);


    // --- JSX --- (No change)
    return ( <canvas ref={canvasRef} className={`renderer-canvas ${className || ''}`} style={{ display: 'block', width: '100%', height: '100%', ...(style || {}) }} /> );
});
TryOnRenderer.displayName = 'TryOnRenderer';
export default TryOnRenderer;