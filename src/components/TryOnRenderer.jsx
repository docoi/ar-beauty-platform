// src/components/TryOnRenderer.jsx

import React, { useRef, useImperativeHandle, forwardRef, useEffect, useCallback } from 'react';
import * as THREE from 'three';

const TryOnRenderer = forwardRef(({ videoWidth, videoHeight, className }, ref) => {
  const canvasRef = useRef(null);
  const rendererInstanceRef = useRef(null);
  const sceneRef = useRef(null);
  const cameraRef = useRef(null);
  const videoTextureRef = useRef(null);
  const imageTextureRef = useRef(null);
  const planeMeshRef = useRef(null);
  const isInitialized = useRef(false);
  const currentVideoElement = useRef(null); // Ref to store the current video/image element
  const currentResults = useRef(null); // Ref to store the latest results

  // --- Handle Resizing (Based on Canvas Client Size) ---
  const handleResize = useCallback(() => {
      // *** Use canvas clientWidth/clientHeight for renderer and camera ***
      const canvas = canvasRef.current;
      if (!rendererInstanceRef.current || !cameraRef.current || !canvas) return;

      const newWidth = canvas.clientWidth;
      const newHeight = canvas.clientHeight;
      if (newWidth === 0 || newHeight === 0) return; // Avoid resizing to zero

      // Check if size actually changed to avoid redundant operations
      const currentSize = rendererInstanceRef.current.getSize(new THREE.Vector2());
      if (currentSize.x === newWidth && currentSize.y === newHeight) return;


      console.log(`Renderer: Resizing canvas client size detected: ${newWidth}x${newHeight}. Updating renderer & camera.`);

      // Update Renderer size
      rendererInstanceRef.current.setSize(newWidth, newHeight);

      // Update Orthographic Camera's view volume to match canvas size
      cameraRef.current.left = -newWidth / 2;
      cameraRef.current.right = newWidth / 2;
      cameraRef.current.top = newHeight / 2;
      cameraRef.current.bottom = -newHeight / 2;
      cameraRef.current.updateProjectionMatrix();

      // *** Plane geometry/scale remains independent, controlled by video/image aspect ratio ***
      // We'll adjust plane scale in the render methods to fit this new camera view

  }, []);

  // --- Initialize Three.js Scene ---
  const initThreeScene = useCallback(() => {
    if (!canvasRef.current || isInitialized.current) return;
    console.log("Renderer: Initializing Three.js scene...");

    try {
      const canvas = canvasRef.current;
      // Initial size from canvas (might be 0 initially, handleResize will fix)
      const initialWidth = canvas.clientWidth || 640;
      const initialHeight = canvas.clientHeight || 480;

      sceneRef.current = new THREE.Scene();

      cameraRef.current = new THREE.OrthographicCamera(
        -initialWidth / 2, initialWidth / 2, initialHeight / 2, -initialHeight / 2, 1, 1000
      );
      cameraRef.current.position.z = 1;
      sceneRef.current.add(cameraRef.current);

      rendererInstanceRef.current = new THREE.WebGLRenderer({
        canvas: canvas,
        antialias: true,
        alpha: true
      });
      rendererInstanceRef.current.setSize(initialWidth, initialHeight); // Set initial renderer size
      rendererInstanceRef.current.setPixelRatio(window.devicePixelRatio);
      rendererInstanceRef.current.outputColorSpace = THREE.SRGBColorSpace;

      // *** Start with a simple 1x1 plane geometry ***
      const planeGeometry = new THREE.PlaneGeometry(1, 1);
      const planeMaterial = new THREE.MeshBasicMaterial({
          color: 0xeeeeee,
          side: THREE.DoubleSide,
          map: null // Start with no map
       });
      planeMeshRef.current = new THREE.Mesh(planeGeometry, planeMaterial);
      planeMeshRef.current.position.z = 0;
      sceneRef.current.add(planeMeshRef.current);

      isInitialized.current = true;
      console.log("Renderer: Three.js scene initialized.");

      // Initial resize based on current canvas size
      handleResize();

    } catch (error) {
      console.error("Error initializing Three.js:", error);
    }
  }, [handleResize]);


  // --- Effect for Initial Setup and Resize Observer ---
  useEffect(() => {
    initThreeScene();

    // Use ResizeObserver to detect canvas size changes reliably
    let resizeObserver;
    if (canvasRef.current) {
        resizeObserver = new ResizeObserver(() => {
            console.log("Renderer: ResizeObserver detected canvas resize.");
            handleResize(); // Call resize handler when canvas element size changes
        });
        resizeObserver.observe(canvasRef.current);
    }

    // Cleanup on unmount
    return () => {
        console.log("Renderer: Cleaning up Three.js resources and ResizeObserver...");
        resizeObserver?.disconnect(); // Disconnect observer
        isInitialized.current = false;
        videoTextureRef.current?.dispose();
        imageTextureRef.current?.dispose();
        planeMeshRef.current?.geometry?.dispose();
        planeMeshRef.current?.material?.dispose();
        rendererInstanceRef.current?.dispose();
        // Clear refs
        videoTextureRef.current = null; imageTextureRef.current = null; planeMeshRef.current = null;
        sceneRef.current = null; cameraRef.current = null; rendererInstanceRef.current = null;
        currentVideoElement.current = null; currentResults.current = null;
    };
  }, [initThreeScene, handleResize]);


  // --- Scale Plane to Fit Camera View ---
  const fitPlaneToCamera = useCallback((textureWidth, textureHeight) => {
      if (!cameraRef.current || !planeMeshRef.current || !textureWidth || !textureHeight) return;

      const cameraWidth = cameraRef.current.right - cameraRef.current.left;
      const cameraHeight = cameraRef.current.top - cameraRef.current.bottom;
      const cameraAspect = cameraWidth / cameraHeight;
      const textureAspect = textureWidth / textureHeight;

      let scaleX, scaleY;

      // Determine scaling factor to fit texture within camera view without distortion
      if (cameraAspect > textureAspect) {
          // Camera is wider than texture: Fit height, calculate width scale
          scaleY = cameraHeight;
          scaleX = scaleY * textureAspect;
      } else {
          // Camera is taller than texture (or same aspect): Fit width, calculate height scale
          scaleX = cameraWidth;
          scaleY = scaleX / textureAspect;
      }

       // Apply scale to the plane mesh (base geometry is 1x1)
      planeMeshRef.current.scale.set(scaleX, scaleY, 1);
      // console.log(`Renderer: Adjusted plane scale to ${scaleX.toFixed(2)} x ${scaleY.toFixed(2)}`);

  }, []);


  // --- Main Render Loop Logic (called via requestAnimationFrame) ---
  const renderLoop = useCallback(() => {
      if (!isInitialized.current || !rendererInstanceRef.current || !sceneRef.current || !cameraRef.current || !planeMeshRef.current) {
         requestAnimationFrame(renderLoop); // Keep trying if not ready
         return;
      }

       // Determine source dimensions
       let sourceWidth = 0;
       let sourceHeight = 0;
       let sourceElement = null;
       let isMirrored = false;

       if (currentVideoElement.current instanceof HTMLVideoElement) {
           sourceElement = currentVideoElement.current;
           sourceWidth = sourceElement.videoWidth;
           sourceHeight = sourceElement.videoHeight;
           isMirrored = true; // Mirror video
       } else if (currentVideoElement.current instanceof HTMLImageElement) {
            sourceElement = currentVideoElement.current;
            sourceWidth = sourceElement.naturalWidth;
            sourceHeight = sourceElement.naturalHeight;
            isMirrored = false; // Don't mirror static image
       }

       // Update texture if source changed or not set
       if (sourceElement) {
            let currentTexture = isMirrored ? videoTextureRef.current : imageTextureRef.current;
            if (!currentTexture || currentTexture.image !== sourceElement) {
                currentTexture?.dispose();
                if (isMirrored) {
                    videoTextureRef.current = new THREE.VideoTexture(sourceElement);
                    videoTextureRef.current.colorSpace = THREE.SRGBColorSpace;
                    planeMeshRef.current.material.map = videoTextureRef.current;
                    if(imageTextureRef.current){ imageTextureRef.current.dispose(); imageTextureRef.current = null; }
                } else {
                    imageTextureRef.current = new THREE.Texture(sourceElement);
                    imageTextureRef.current.colorSpace = THREE.SRGBColorSpace;
                    imageTextureRef.current.needsUpdate = true;
                    planeMeshRef.current.material.map = imageTextureRef.current;
                    if(videoTextureRef.current){ videoTextureRef.current.dispose(); videoTextureRef.current = null; }
                }
                planeMeshRef.current.material.needsUpdate = true;
                console.log(`Renderer: Set texture from ${isMirrored ? 'video' : 'image'}`);
            }
       } else {
            // No source, clear map
            if (planeMeshRef.current.material.map) {
                 planeMeshRef.current.material.map = null;
                 planeMeshRef.current.material.needsUpdate = true;
            }
       }


       // Update plane scale to fit camera view based on source aspect ratio
       if (sourceWidth > 0 && sourceHeight > 0) {
            fitPlaneToCamera(sourceWidth, sourceHeight);
            // Apply mirroring scale AFTER fitting
            planeMeshRef.current.scale.x *= (isMirrored ? -1 : 1);
       }


       // --- TODO: Effect/Shader Update Logic ---
       // Access latest results via currentResults.current if needed
       // Update shader uniforms here based on results and slider value


       // Render the scene
       rendererInstanceRef.current.render(sceneRef.current, cameraRef.current);

       // Continue the loop
       requestAnimationFrame(renderLoop);

  }, [fitPlaneToCamera]); // Include dependency


  // --- Start Render Loop on Mount ---
  useEffect(() => {
      console.log("Renderer: Starting render loop.");
      const handle = requestAnimationFrame(renderLoop);
      return () => {
          console.log("Renderer: Stopping render loop.");
          cancelAnimationFrame(handle);
      }
  }, [renderLoop]); // Depend on the loop function


  // --- Expose Methods ---
  useImperativeHandle(ref, () => ({
    renderResults: (videoElement, results) => {
        // Store the latest video element and results
        currentVideoElement.current = videoElement;
        currentResults.current = results;
        // The renderLoop will pick these up
    },
    renderStaticImageResults: (imageElement, results) => {
        console.log("Renderer: Receiving static image results.");
        // Store the latest image element and results
        currentVideoElement.current = imageElement; // Use the same ref for simplicity
        currentResults.current = results;
         // The renderLoop will pick these up
    },
    clearCanvas: () => {
        console.log("Renderer: Clearing canvas via imperative handle.");
        currentVideoElement.current = null; // Clear source
        currentResults.current = null; // Clear results
        // Render loop will clear texture map
    }
  }));


  // The canvas element for Three.js
  return (
    <canvas
      ref={canvasRef}
      className={`renderer-canvas ${className || ''}`}
      style={{ display: 'block', width: '100%', height: '100%' }} // Canvas CSS fills container
    >
      Your browser does not support the HTML canvas element or WebGL.
    </canvas>
  );
});

TryOnRenderer.displayName = 'TryOnRenderer';
export default TryOnRenderer;