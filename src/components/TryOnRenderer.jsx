// src/components/TryOnRenderer.jsx - Reverted to MeshBasicMaterial (Stable Base)

import React, { useRef, useImperativeHandle, forwardRef, useEffect, useCallback } from 'react';
import * as THREE from 'three';

console.log(`Using Three.js revision: ${THREE.REVISION}`);

const TryOnRenderer = forwardRef(({ videoWidth, videoHeight, className }, ref) => {
  const canvasRef = useRef(null);
  const rendererInstanceRef = useRef(null);
  const sceneRef = useRef(null);
  const cameraRef = useRef(null);
  const planeMeshRef = useRef(null);
  const videoTextureRef = useRef(null);
  const imageTextureRef = useRef(null); // Keep ref for image texture
  const isInitialized = useRef(false);
  const animationFrameHandle = useRef(null);
  const currentSourceElement = useRef(null); // Stores the CURRENT source (video OR image)

  // --- Handle Resizing ---
  const handleResize = useCallback(() => {
    const canvas = canvasRef.current; if (!rendererInstanceRef.current || !cameraRef.current || !canvas) return; const newWidth = canvas.clientWidth; const newHeight = canvas.clientHeight; if (newWidth === 0 || newHeight === 0) return; const currentSize = rendererInstanceRef.current.getSize(new THREE.Vector2()); if (currentSize.x === newWidth && currentSize.y === newHeight) return; /* console.log(`DEBUG: Resizing -> ${newWidth}x${newHeight}`); */ rendererInstanceRef.current.setSize(newWidth, newHeight); cameraRef.current.left = -newWidth / 2; cameraRef.current.right = newWidth / 2; cameraRef.current.top = newHeight / 2; cameraRef.current.bottom = -newHeight / 2; cameraRef.current.updateProjectionMatrix();
   }, []);

  // --- Initialize Scene ---
  const initThreeScene = useCallback(() => {
    if (!canvasRef.current || isInitialized.current) return; console.log("DEBUG: initThreeScene START (MeshBasicMaterial)"); try { const canvas = canvasRef.current; const initialWidth = canvas.clientWidth || 640; const initialHeight = canvas.clientHeight || 480; sceneRef.current = new THREE.Scene(); cameraRef.current = new THREE.OrthographicCamera(-initialWidth / 2, initialWidth / 2, initialHeight / 2, -initialHeight / 2, 0.1, 10); cameraRef.current.position.z = 1; sceneRef.current.add(cameraRef.current); rendererInstanceRef.current = new THREE.WebGLRenderer({ canvas: canvas, antialias: true }); rendererInstanceRef.current.setSize(initialWidth, initialHeight); rendererInstanceRef.current.setPixelRatio(window.devicePixelRatio); rendererInstanceRef.current.outputColorSpace = THREE.SRGBColorSpace; const planeGeometry = new THREE.PlaneGeometry(1, 1);
    // *** Use MeshBasicMaterial ***
    const planeMaterial = new THREE.MeshBasicMaterial({ map: null, side: THREE.DoubleSide, color: 0xffffff }); // White base
    planeMeshRef.current = new THREE.Mesh(planeGeometry, planeMaterial); planeMeshRef.current.position.z = 0; planeMeshRef.current.scale.set(1, 1, 1); sceneRef.current.add(planeMeshRef.current); isInitialized.current = true; console.log("DEBUG: Scene initialized with MeshBasicMaterial."); handleResize(); } catch (error) { console.error("DEBUG: initThreeScene ERROR:", error); }
   }, [handleResize]);

  // --- Effect for Initial Setup / Resize Observer ---
  useEffect(() => {
    initThreeScene(); let resizeObserver; if (canvasRef.current) { resizeObserver = new ResizeObserver(() => { handleResize(); }); resizeObserver.observe(canvasRef.current); } return () => { console.log("DEBUG: Cleanup running..."); resizeObserver?.disconnect(); cancelAnimationFrame(animationFrameHandle.current); isInitialized.current = false; videoTextureRef.current?.dispose(); imageTextureRef.current?.dispose(); planeMeshRef.current?.geometry?.dispose(); planeMeshRef.current?.material?.map?.dispose(); planeMeshRef.current?.material?.dispose(); rendererInstanceRef.current?.dispose(); /* Clear refs */ videoTextureRef.current = null; imageTextureRef.current = null; planeMeshRef.current = null; sceneRef.current = null; cameraRef.current = null; rendererInstanceRef.current = null; currentSourceElement.current = null;};
   }, [initThreeScene, handleResize]);

  // --- Scale Plane ---
  const fitPlaneToCamera = useCallback((textureWidth, textureHeight) => {
      if (!cameraRef.current || !planeMeshRef.current || !textureWidth || !textureHeight) return; const canvas = canvasRef.current; if (!canvas) return; const cameraWidth = canvas.clientWidth; const cameraHeight = canvas.clientHeight; if (cameraWidth === 0 || cameraHeight === 0) return; const cameraAspect = cameraWidth / cameraHeight; const textureAspect = textureWidth / textureHeight; let scaleX, scaleY; if (cameraAspect > textureAspect) { scaleY = cameraHeight; scaleX = scaleY * textureAspect; } else { scaleX = cameraWidth; scaleY = scaleX / textureAspect; } planeMeshRef.current.scale.y = scaleY; planeMeshRef.current.scale.x = scaleX;
   }, []);

  // --- Render Loop (Texture Logic for MeshBasicMaterial) ---
  const renderLoop = useCallback(() => {
       animationFrameHandle.current = requestAnimationFrame(renderLoop);
       if (!isInitialized.current || !rendererInstanceRef.current || !sceneRef.current || !cameraRef.current || !planeMeshRef.current || !planeMeshRef.current.material ) return;

       const sourceElement = currentSourceElement.current;
       const material = planeMeshRef.current.material; // MeshBasicMaterial
       let sourceWidth = 0, sourceHeight = 0;
       let isVideo = sourceElement instanceof HTMLVideoElement;
       let isImage = sourceElement instanceof HTMLImageElement;
       let textureToAssign = null;

       // 1. Determine Source & Texture Object
       if (isVideo && sourceElement.readyState >= 2) {
           sourceWidth = sourceElement.videoWidth; sourceHeight = sourceElement.videoHeight;
           if (videoTextureRef.current?.image !== sourceElement) {
               videoTextureRef.current?.dispose();
               videoTextureRef.current = new THREE.VideoTexture(sourceElement);
               videoTextureRef.current.colorSpace = THREE.SRGBColorSpace;
           }
           textureToAssign = videoTextureRef.current;
       } else if (isImage && sourceElement.complete && sourceElement.naturalWidth > 0) {
            sourceWidth = sourceElement.naturalWidth; sourceHeight = sourceElement.naturalHeight;
            if (imageTextureRef.current?.image !== sourceElement) {
                imageTextureRef.current?.dispose();
                imageTextureRef.current = new THREE.Texture(sourceElement);
                imageTextureRef.current.colorSpace = THREE.SRGBColorSpace;
                imageTextureRef.current.needsUpdate = true;
            } else if (imageTextureRef.current) {
                 imageTextureRef.current.needsUpdate = true; // Image needs update
            }
            textureToAssign = imageTextureRef.current;
       } else {
           textureToAssign = null; // No valid source
            // Clear refs if source becomes invalid
             if(videoTextureRef.current) { videoTextureRef.current.dispose(); videoTextureRef.current = null;}
             if(imageTextureRef.current) { imageTextureRef.current.dispose(); imageTextureRef.current = null;}
       }

       // 2. Update Material Map
       if (material.map !== textureToAssign) {
            // console.log("Minimal Loop: Updating material.map"); // Reduce noise
            material.map = textureToAssign; // Assign determined texture (or null)
            material.needsUpdate = true; // Update material when map changes
       }

       // 3. Update Plane Scale & Mirroring
       if (material.map && sourceWidth > 0 && sourceHeight > 0) { fitPlaneToCamera(sourceWidth, sourceHeight); planeMeshRef.current.scale.x = Math.abs(planeMeshRef.current.scale.x) * (isVideo ? -1 : 1); }
       else { if (planeMeshRef.current.scale.x !== 0) { planeMeshRef.current.scale.set(0,0,0); } } // Hide plane if no texture

       // 4. Render Scene
       try { rendererInstanceRef.current.render(sceneRef.current, cameraRef.current); }
       catch(e) { console.error("!!! RENDER LOOP ERROR:", e); cancelAnimationFrame(animationFrameHandle.current); }

   }, [fitPlaneToCamera]);

  // --- Start Render Loop ---
  useEffect(() => { if (isInitialized.current) { cancelAnimationFrame(animationFrameHandle.current); animationFrameHandle.current = requestAnimationFrame(renderLoop); } }, [renderLoop]);

  // --- Expose Methods ---
  useImperativeHandle(ref, () => ({
      renderResults: (videoElement, results) => { currentSourceElement.current = videoElement; },
      renderStaticImageResults: (imageElement, results) => { currentSourceElement.current = imageElement; },
      clearCanvas: () => { currentSourceElement.current = null; }
  }));

  // --- JSX ---
  return ( <canvas ref={canvasRef} className={`renderer-canvas ${className || ''}`} style={{ display: 'block', width: '100%', height: '100%' }} /> );
});

TryOnRenderer.displayName = 'TryOnRenderer';
export default TryOnRenderer;