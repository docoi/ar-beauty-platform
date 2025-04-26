// src/components/TryOnRenderer.jsx - COMPLETE - MeshBasicMaterial, Texture Creation in Loop

import React, { useRef, forwardRef, useEffect, useCallback, useState, useMemo } from 'react';
import * as THREE from 'three';

console.log(`Using Three.js revision: ${THREE.REVISION}`);

const TryOnRenderer = forwardRef(({
    videoRefProp,
    imageElement,
    mediaPipeResults,
    isStatic,
    brightness, contrast, effectIntensity, className, style
 }, ref) => {

    // --- Core Refs ---
    const canvasRef = useRef(null); const rendererInstanceRef = useRef(null); const animationFrameHandle = useRef(null); const isInitialized = useRef(false); const baseSceneRef = useRef(null); const baseCameraRef = useRef(null); const basePlaneMeshRef = useRef(null);
    const videoTextureRef = useRef(null); // Keep for video
    const imageTextureRef = useRef(null); // Keep ref, but create texture in loop for test

    // --- Internal State Refs ---
    // ... (keep results, correction, intensity refs) ...
    const renderLoopCounter = useRef(0);

    // --- Update internal refs ---
    // ... (keep useEffects for results, correction, intensity) ...

    // --- REMOVED useEffect for Image Texture ---

     // --- Effect to manage Video Texture --- (Keep this one)
    useEffect(() => {
        const videoElement = videoRefProp?.current;
        if (!isStatic && videoElement) { if (!videoTextureRef.current || videoTextureRef.current.image !== videoElement) { console.log("TryOnRenderer Effect: Creating/Updating Video Texture (Basic)"); videoTextureRef.current?.dispose(); videoTextureRef.current = new THREE.VideoTexture(videoElement); videoTextureRef.current.colorSpace = THREE.SRGBColorSpace; } }
        else { if (videoTextureRef.current) { videoTextureRef.current.dispose(); videoTextureRef.current = null; } }
    }, [isStatic, videoRefProp]);


    // --- Handle Resizing ---
    const handleResize = useCallback(() => { /* ... */ }, []);
    // --- Scale Base Plane ---
    const fitPlaneToCamera = useCallback((textureWidth, textureHeight) => { /* ... */ }, []);


    // --- Render Loop --- (Create Image Texture Here)
     const renderLoop = useCallback(() => {
        animationFrameHandle.current = requestAnimationFrame(renderLoop);
        if (!isInitialized.current || !rendererInstanceRef.current || !baseSceneRef.current || !baseCameraRef.current || !basePlaneMeshRef.current) { return; }

        try {
            const baseMaterial = basePlaneMeshRef.current.material;
            let sourceWidth = 0, sourceHeight = 0;
            let textureToAssign = null;
            let isVideo = false;

            // *** Determine texture based on props ***
            if (!isStatic && videoRefProp?.current) {
                 // Video Logic
                 const videoElement = videoRefProp.current;
                 if (videoElement.readyState >= 2 && videoElement.videoWidth > 0) {
                     sourceWidth = videoElement.videoWidth; sourceHeight = videoElement.videoHeight;
                     // Use existing texture if available
                     if (videoTextureRef.current && videoTextureRef.current.image === videoElement) {
                         textureToAssign = videoTextureRef.current;
                     } else {
                         // Texture might be created by effect, assign if ready
                         textureToAssign = videoTextureRef.current;
                     }
                     isVideo = true;
                 }
            } else if (isStatic && imageElement && imageElement.complete && imageElement.naturalWidth > 0) {
                 // Static Image Logic - CREATE TEXTURE HERE
                 sourceWidth = imageElement.naturalWidth; sourceHeight = imageElement.naturalHeight;
                 // Dispose old texture if image element changed
                 if (imageTextureRef.current && imageTextureRef.current.image !== imageElement) {
                     console.log("DEBUG RenderLoop (Basic): Disposing old image texture.");
                     imageTextureRef.current.dispose();
                     imageTextureRef.current = null;
                 }
                 // Create new texture if needed
                 if (!imageTextureRef.current) {
                     console.log("DEBUG RenderLoop (Basic): Creating new image texture in loop.");
                     imageTextureRef.current = new THREE.Texture(imageElement);
                     imageTextureRef.current.colorSpace = THREE.SRGBColorSpace;
                     imageTextureRef.current.needsUpdate = true; // Mark for upload
                 }
                 // Always ensure needsUpdate is true for static image display
                 if (imageTextureRef.current) {
                    imageTextureRef.current.needsUpdate = true;
                 }
                 textureToAssign = imageTextureRef.current;
            }
            // *** -------------------------------- ***


             // Assign texture map if changed
             if (baseMaterial.map !== textureToAssign) {
                 baseMaterial.map = textureToAssign;
                 baseMaterial.needsUpdate = true;
                 console.log("DEBUG RenderLoop (Basic): Assigned texture:", textureToAssign?.constructor?.name ?? 'null');
             }

            // Update Plane Scale & Mirroring
            const planeVisible = !!baseMaterial.map && sourceWidth > 0 && sourceHeight > 0;
             if (planeVisible) { /* ... scale/mirror ... */ }
             else { /* ... hide plane ... */ }

            // Render ONLY the base scene directly to canvas
            rendererInstanceRef.current.render(baseSceneRef.current, baseCameraRef.current);

        } catch (error) { console.error("Error in renderLoop (Basic):", error); }
    // Update dependencies
    }, [fitPlaneToCamera, isStatic, videoRefProp, imageElement]); // Add props read directly


    // --- Initialize Scene --- (Simplified for MeshBasicMaterial)
    const initThreeScene = useCallback(() => {
        if (!canvasRef.current || isInitialized.current) return; console.log("DEBUG: initThreeScene START (MeshBasicMaterial)"); try { const canvas = canvasRef.current; const initialWidth = canvas.clientWidth || 640; const initialHeight = canvas.clientHeight || 480; rendererInstanceRef.current = new THREE.WebGLRenderer({ canvas: canvas, antialias: true }); rendererInstanceRef.current.setSize(initialWidth, initialHeight); rendererInstanceRef.current.setPixelRatio(window.devicePixelRatio); rendererInstanceRef.current.outputColorSpace = THREE.SRGBColorSpace; baseSceneRef.current = new THREE.Scene(); baseCameraRef.current = new THREE.OrthographicCamera(-initialWidth / 2, initialWidth / 2, initialHeight / 2, -initialHeight / 2, 0.1, 10); baseCameraRef.current.position.z = 1; const planeGeometry = new THREE.PlaneGeometry(1, 1); const planeMaterial = new THREE.MeshBasicMaterial({ map: null, side: THREE.DoubleSide, color: 0xffffff }); basePlaneMeshRef.current = new THREE.Mesh(planeGeometry, planeMaterial); basePlaneMeshRef.current.position.z = 0; basePlaneMeshRef.current.scale.set(1, 1, 1); baseSceneRef.current.add(basePlaneMeshRef.current); console.log("DEBUG: Base scene created (MeshBasicMaterial)."); isInitialized.current = true; console.log("DEBUG: Scene initialization complete (Basic)."); handleResize(); console.log("DEBUG: Requesting first render loop frame from Init (Basic)."); cancelAnimationFrame(animationFrameHandle.current); animationFrameHandle.current = requestAnimationFrame(renderLoop); } catch (error) { console.error("DEBUG: initThreeScene ERROR (Basic):", error); isInitialized.current = false; }
    // Update dependencies
    }, [handleResize, renderLoop]);


    // --- Effect for Initial Setup / Resize Observer ---
    useEffect(() => {
         console.log("DEBUG: Mount/Init effect running (Basic).");
         initThreeScene();
         let resizeObserver; const currentCanvas = canvasRef.current; if (currentCanvas) { resizeObserver = new ResizeObserver(() => { handleResize(); }); resizeObserver.observe(currentCanvas); }
         return () => { /* ... cleanup ... */ };
     }, [initThreeScene, handleResize]); // Dependencies


    // --- REMOVED useImperativeHandle ---


    // --- JSX ---
    return ( <canvas ref={canvasRef} className={`renderer-canvas ${className || ''}`} style={{ display: 'block', width: '100%', height: '100%', ...(style || {}) }} /> );
});

TryOnRenderer.displayName = 'TryOnRenderer';
export default TryOnRenderer;