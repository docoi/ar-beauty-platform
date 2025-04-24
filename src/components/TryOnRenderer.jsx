// src/components/TryOnRenderer.jsx - Ensure Correct Color Space Handling

import React, { useRef, useImperativeHandle, forwardRef, useEffect, useCallback } from 'react';
import * as THREE from 'three';

console.log(`Using Three.js revision: ${THREE.REVISION}`);

const TryOnRenderer = forwardRef(({ videoWidth, videoHeight, className }, ref) => {
  const canvasRef = useRef(null);
  const rendererInstanceRef = useRef(null);
  const sceneRef = useRef(null);
  const cameraRef = useRef(null);
  const planeMeshRef = useRef(null);
  const videoTextureRef = useRef(null); // Keep separate ref for video
  const imageTextureRef = useRef(null); // Separate ref for image (though static is disabled now)
  const isInitialized = useRef(false);
  const animationFrameHandle = useRef(null);

  // --- Shaders (Still basic, not used by MeshBasicMaterial) ---
  const vertexShader = `varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;
  const fragmentShader = `uniform sampler2D uTexture; varying vec2 vUv; void main() { gl_FragColor = texture2D(uTexture, vUv); }`;

  // --- Handle Resizing ---
  const handleResize = useCallback(() => {
    const canvas = canvasRef.current; if (!rendererInstanceRef.current || !cameraRef.current || !canvas) return;
    const newWidth = canvas.clientWidth; const newHeight = canvas.clientHeight; if (newWidth === 0 || newHeight === 0) return;
    const currentSize = rendererInstanceRef.current.getSize(new THREE.Vector2()); if (currentSize.x === newWidth && currentSize.y === newHeight) return;
    console.log(`DEBUG: Resizing -> ${newWidth}x${newHeight}`);
    rendererInstanceRef.current.setSize(newWidth, newHeight);
    cameraRef.current.left = -newWidth / 2; cameraRef.current.right = newWidth / 2; cameraRef.current.top = newHeight / 2; cameraRef.current.bottom = -newHeight / 2; cameraRef.current.updateProjectionMatrix();
  }, []);

  // --- Initialize Scene ---
  const initThreeScene = useCallback(() => {
    if (!canvasRef.current || isInitialized.current) return;
    console.log("DEBUG: initThreeScene START");
    try {
      const canvas = canvasRef.current; const initialWidth = canvas.clientWidth || 640; const initialHeight = canvas.clientHeight || 480;
      sceneRef.current = new THREE.Scene(); cameraRef.current = new THREE.OrthographicCamera(-initialWidth / 2, initialWidth / 2, initialHeight / 2, -initialHeight / 2, 0.1, 10); cameraRef.current.position.z = 1; sceneRef.current.add(cameraRef.current); rendererInstanceRef.current = new THREE.WebGLRenderer({ canvas: canvas, antialias: true }); // Removed alpha:true for basic material
      rendererInstanceRef.current.setSize(initialWidth, initialHeight); rendererInstanceRef.current.setPixelRatio(window.devicePixelRatio);
      rendererInstanceRef.current.outputColorSpace = THREE.SRGBColorSpace; // Crucial for output
      const planeGeometry = new THREE.PlaneGeometry(1, 1);
      // *** Use BASIC MeshBasicMaterial ***
      const planeMaterial = new THREE.MeshBasicMaterial({ map: null, side: THREE.DoubleSide, color: 0x555555 });
      planeMeshRef.current = new THREE.Mesh(planeGeometry, planeMaterial); planeMeshRef.current.position.z = 0; planeMeshRef.current.scale.set(1, 1, 1); sceneRef.current.add(planeMeshRef.current);
      isInitialized.current = true; console.log("DEBUG: Scene initialized with BASIC material."); handleResize();
    } catch (error) { console.error("DEBUG: initThreeScene ERROR:", error); }
  }, [handleResize]); // Removed shader dependencies as they aren't used by MeshBasicMaterial

  // --- Effect for Initial Setup / Resize Observer ---
  useEffect(() => {
    initThreeScene(); let resizeObserver; if (canvasRef.current) { resizeObserver = new ResizeObserver(() => { handleResize(); }); resizeObserver.observe(canvasRef.current); }
    return () => { console.log("DEBUG: Cleanup running..."); resizeObserver?.disconnect(); cancelAnimationFrame(animationFrameHandle.current); isInitialized.current = false; videoTextureRef.current?.dispose(); imageTextureRef.current?.dispose(); planeMeshRef.current?.geometry?.dispose(); planeMeshRef.current?.material?.map?.dispose(); planeMeshRef.current?.material?.dispose(); rendererInstanceRef.current?.dispose(); /* Clear refs */ videoTextureRef.current = null; imageTextureRef.current = null; planeMeshRef.current = null; sceneRef.current = null; cameraRef.current = null; rendererInstanceRef.current = null; };
  }, [initThreeScene, handleResize]);

  // --- Scale Plane ---
  const fitPlaneToCamera = useCallback((textureWidth, textureHeight) => {
      if (!cameraRef.current || !planeMeshRef.current || !textureWidth || !textureHeight) return; const canvas = canvasRef.current; if (!canvas) return; const cameraWidth = canvas.clientWidth; const cameraHeight = canvas.clientHeight; if (cameraWidth === 0 || cameraHeight === 0) return; const cameraAspect = cameraWidth / cameraHeight; const textureAspect = textureWidth / textureHeight; let scaleX, scaleY; if (cameraAspect > textureAspect) { scaleY = cameraHeight; scaleX = scaleY * textureAspect; } else { scaleX = cameraWidth; scaleY = scaleX / textureAspect; } planeMeshRef.current.scale.y = scaleY; planeMeshRef.current.scale.x = scaleX;
  }, []);

  // --- Render Loop ---
  const renderLoop = useCallback(() => {
       animationFrameHandle.current = requestAnimationFrame(renderLoop);
       if (isInitialized.current && rendererInstanceRef.current && sceneRef.current && cameraRef.current) {
           try { rendererInstanceRef.current.render(sceneRef.current, cameraRef.current); }
           catch (e) { console.error("!!! RENDER LOOP ERROR:", e); cancelAnimationFrame(animationFrameHandle.current); }
       }
  }, []);

  // --- Start Render Loop ---
  useEffect(() => { if (isInitialized.current) { cancelAnimationFrame(animationFrameHandle.current); animationFrameHandle.current = requestAnimationFrame(renderLoop); } }, [renderLoop]);

  // --- Expose Methods ---
  useImperativeHandle(ref, () => ({
    renderResults: (videoElement, results) => { // For Mirror
        // console.log("DEBUG: renderResults called."); // Reduce noise
        if (!planeMeshRef.current || !planeMeshRef.current.material || !videoElement || videoElement.readyState < 2) return;
        const videoW = videoElement.videoWidth; const videoH = videoElement.videoHeight;
        const material = planeMeshRef.current.material;

        try {
            // --- Direct Texture Update ---
            if (!videoTextureRef.current || videoTextureRef.current.image !== videoElement) {
                console.log("DEBUG: Creating/Updating video texture ref.");
                videoTextureRef.current?.dispose(); // Dispose previous ref object
                videoTextureRef.current = new THREE.VideoTexture(videoElement);
                // *** Explicitly set color space on texture ***
                videoTextureRef.current.colorSpace = THREE.SRGBColorSpace;
            }

            // Assign DIRECTLY to material map if it changed
            if (material.map !== videoTextureRef.current) {
                 console.log("DEBUG: Setting material.map to video texture.");
                 // Dispose old map texture if it exists
                 material.map?.dispose();
                 material.map = videoTextureRef.current;
                 material.needsUpdate = true; // Update material when map changes
            }
             // For VideoTexture, updates should be automatic, no texture.needsUpdate needed


            // Scale and mirror plane
            if (videoW > 0) {
                fitPlaneToCamera(videoW, videoH);
                planeMeshRef.current.scale.x = -Math.abs(planeMeshRef.current.scale.x); // MIRROR
            } else {
                 planeMeshRef.current.scale.set(0,0,0);
            }

        } catch (e) {
            console.error("!!! ERROR inside renderResults:", e);
        }
    },
    renderStaticImageResults: (imageElement, results) => { // For Selfie (Keep simple - hide plane)
        console.log("DEBUG: renderStaticImageResults called (hiding plane).");
         if (planeMeshRef.current?.material) {
             planeMeshRef.current.material.map?.dispose(); // Dispose current texture map
             planeMeshRef.current.material.map = null;     // Clear map
             planeMeshRef.current.material.needsUpdate = true;
             planeMeshRef.current.scale.set(0,0,0);         // Hide plane
         }
         // Dispose texture refs if they exist
         videoTextureRef.current?.dispose(); videoTextureRef.current = null;
         imageTextureRef.current?.dispose(); imageTextureRef.current = null;
    },
    clearCanvas: () => {
        console.log("DEBUG: clearCanvas called.");
         if (planeMeshRef.current?.material) {
             planeMeshRef.current.material.map?.dispose();
             planeMeshRef.current.material.map = null;
             planeMeshRef.current.material.needsUpdate = true;
             planeMeshRef.current.scale.set(0,0,0);
         }
         videoTextureRef.current?.dispose(); videoTextureRef.current = null;
         imageTextureRef.current?.dispose(); imageTextureRef.current = null;
    }
  }));

  // --- JSX ---
  return ( <canvas ref={canvasRef} className={`renderer-canvas ${className || ''}`} style={{ display: 'block', width: '100%', height: '100%', backgroundColor: '#444' }} /> );
});

TryOnRenderer.displayName = 'TryOnRenderer';
export default TryOnRenderer;