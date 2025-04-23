// src/components/TryOnRenderer.jsx

import React, { useRef, useImperativeHandle, forwardRef, useEffect, useCallback } from 'react';
import * as THREE from 'three';

const TryOnRenderer = forwardRef(({ videoWidth, videoHeight, className }, ref) => {
  const canvasRef = useRef(null);
  const rendererRef = useRef(null);
  const sceneRef = useRef(null);
  const cameraRef = useRef(null);
  const videoTextureRef = useRef(null);
  const imageTextureRef = useRef(null);
  const planeMeshRef = useRef(null);
  const isInitialized = useRef(false); // Flag to prevent double initialization

  // --- Initialize Three.js Scene ---
  const initThreeScene = useCallback(() => {
    if (!canvasRef.current || isInitialized.current) return;
    console.log("Renderer: Initializing Three.js scene...");

    try {
      const canvas = canvasRef.current;
      const width = canvas.clientWidth; // Use client dimensions for initial setup
      const height = canvas.clientHeight;

      // Scene
      sceneRef.current = new THREE.Scene();

      // Camera (Orthographic)
      // We set left/right/top/bottom based on desired view size (e.g., match video)
      // Initial setup, will be adjusted when dimensions are known
      cameraRef.current = new THREE.OrthographicCamera(
        -width / 2, width / 2, height / 2, -height / 2, 1, 1000
      );
      cameraRef.current.position.z = 5; // Position camera back slightly
      sceneRef.current.add(cameraRef.current);

      // Renderer
      rendererRef.current = new THREE.WebGLRenderer({
        canvas: canvas,
        antialias: true, // Enable anti-aliasing
        alpha: true // Allow transparency if needed later
      });
      rendererRef.current.setSize(width, height);
      rendererRef.current.setPixelRatio(window.devicePixelRatio); // Adjust for screen density
      rendererRef.current.outputColorSpace = THREE.SRGBColorSpace; // Match typical image/video color space

      // Plane Geometry (placeholder size)
      const planeGeometry = new THREE.PlaneGeometry(1, 1); // Will be resized later

      // Basic Material (placeholder)
      const planeMaterial = new THREE.MeshBasicMaterial({
          color: 0xcccccc, // Gray placeholder
          side: THREE.DoubleSide
       });

      // Plane Mesh
      planeMeshRef.current = new THREE.Mesh(planeGeometry, planeMaterial);
      sceneRef.current.add(planeMeshRef.current);

      isInitialized.current = true;
      console.log("Renderer: Three.js scene initialized.");

      // Adjust size immediately if dimensions are already available
       if(videoWidth > 0 && videoHeight > 0){
           handleResize(videoWidth, videoHeight);
       }


    } catch (error) {
      console.error("Error initializing Three.js:", error);
      // Handle initialization error (e.g., show error message)
    }
  }, [videoWidth, videoHeight]); // Include dimensions dependency


  // --- Handle Resizing ---
  const handleResize = useCallback((newWidth, newHeight) => {
    if (!rendererRef.current || !cameraRef.current || !planeMeshRef.current || newWidth === 0 || newHeight === 0) return;

    console.log(`Renderer: Resizing to ${newWidth}x${newHeight}`);

    // Update Renderer
    rendererRef.current.setSize(newWidth, newHeight);

    // Update Camera
    cameraRef.current.left = -newWidth / 2;
    cameraRef.current.right = newWidth / 2;
    cameraRef.current.top = newHeight / 2;
    cameraRef.current.bottom = -newHeight / 2;
    cameraRef.current.updateProjectionMatrix();

    // Update Plane Size to match the new dimensions (acts as the screen)
    planeMeshRef.current.scale.set(newWidth, newHeight, 1);

  }, []);


  // --- Effect for Initial Setup and Resizing ---
  useEffect(() => {
    initThreeScene(); // Initialize on mount

    // Update size when props change
    if (isInitialized.current && videoWidth > 0 && videoHeight > 0) {
      handleResize(videoWidth, videoHeight);
    }

    // Cleanup on unmount
    return () => {
        console.log("Renderer: Cleaning up Three.js resources...");
        isInitialized.current = false; // Reset flag
        if (videoTextureRef.current) {
            videoTextureRef.current.dispose();
            videoTextureRef.current = null;
        }
         if (imageTextureRef.current) {
            imageTextureRef.current.dispose();
            imageTextureRef.current = null;
        }
        if (planeMeshRef.current) {
            planeMeshRef.current.geometry?.dispose();
            planeMeshRef.current.material?.dispose();
             // No need to remove from scene if scene is discarded
        }
         if (sceneRef.current) {
            // Dispose scene contents if necessary (though often just letting go is enough)
            sceneRef.current = null;
        }
        if (rendererRef.current) {
            rendererRef.current.dispose(); // Important! Release WebGL context
            rendererRef.current = null;
        }
         canvasRef.current = null; // Clear canvas ref
    };
  }, [videoWidth, videoHeight, initThreeScene, handleResize]); // Dependencies for resizing


  // --- Expose Methods ---
  useImperativeHandle(ref, () => ({
    // --- Method for Real-time Video ---
    renderResults: (videoElement, results) => {
      if (!rendererRef.current || !sceneRef.current || !cameraRef.current || !planeMeshRef.current || !videoElement || !isInitialized.current) return;

      // Create/Update Video Texture
      if (!videoTextureRef.current) {
        console.log("Renderer: Creating video texture.");
        videoTextureRef.current = new THREE.VideoTexture(videoElement);
        videoTextureRef.current.colorSpace = THREE.SRGBColorSpace;
        planeMeshRef.current.material.map = videoTextureRef.current;
        planeMeshRef.current.material.needsUpdate = true;
      }
      // VideoTexture updates automatically

      // --- Apply Mirror Effect ---
      // Flip the mesh horizontally if it's not already flipped
       if (planeMeshRef.current.scale.x > 0) {
           console.log("Renderer: Applying mirror effect scale.");
           planeMeshRef.current.scale.x = -Math.abs(planeMeshRef.current.scale.x);
       }

       // Clear previous image texture if switching modes
       if (imageTextureRef.current) {
           imageTextureRef.current.dispose();
           imageTextureRef.current = null;
       }

      // --- TODO: Landmark/Effect Logic ---
      // We'll add shader logic here later using 'results'
      // For now, just render the textured plane

      // Render the scene
      rendererRef.current.render(sceneRef.current, cameraRef.current);
    },

    // --- Method for Static Image ---
    renderStaticImageResults: (imageElement, results) => {
      console.log("Renderer: renderStaticImageResults called.", { hasImage: !!imageElement, hasResults: !!results });
      if (!rendererRef.current || !sceneRef.current || !cameraRef.current || !planeMeshRef.current || !imageElement || !isInitialized.current) return;

       // Clear previous video texture if switching modes
       if (videoTextureRef.current) {
           videoTextureRef.current.dispose();
           videoTextureRef.current = null;
       }

      // Create/Update Image Texture
      console.log("Renderer: Creating/updating image texture.");
       // Dispose previous texture first to free GPU memory
       if (imageTextureRef.current) {
            imageTextureRef.current.dispose();
       }
       imageTextureRef.current = new THREE.Texture(imageElement);
       imageTextureRef.current.needsUpdate = true; // Important! Tell three to upload the texture
       imageTextureRef.current.colorSpace = THREE.SRGBColorSpace;
       planeMeshRef.current.material.map = imageTextureRef.current;
       planeMeshRef.current.material.needsUpdate = true;


      // --- Apply Normal (Non-Mirrored) Effect ---
      // Flip the mesh back horizontally if it was mirrored
      if (planeMeshRef.current.scale.x < 0) {
           console.log("Renderer: Removing mirror effect scale.");
           planeMeshRef.current.scale.x = Math.abs(planeMeshRef.current.scale.x); // Ensure positive scale
       }

      // --- TODO: Landmark/Effect Logic ---
      // We'll add shader logic here later using 'results'
      // For now, just render the textured plane

      // Render the scene
      rendererRef.current.render(sceneRef.current, cameraRef.current);
    },

    // --- Method to clear ---
    clearCanvas: () => {
        if (rendererRef.current && sceneRef.current && cameraRef.current) {
           console.log("Renderer: Clearing canvas (rendering background).");
           // Set background color or make transparent if needed
           // rendererRef.current.setClearColor(0x000000, 0); // Example: transparent
           rendererRef.current.clear();
        }
    }
  }));


  // The canvas element for Three.js
  return (
    <canvas
      ref={canvasRef}
      className={`renderer-canvas ${className || ''}`}
      style={{ display: 'block', width: '100%', height: '100%', backgroundColor: '#eee' }} // Ensure canvas fills container
    >
      Your browser does not support the HTML canvas element or WebGL.
    </canvas>
  );
});

TryOnRenderer.displayName = 'TryOnRenderer';
export default TryOnRenderer;