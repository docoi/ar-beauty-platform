// src/components/TryOnRenderer.jsx

import React, { useRef, useImperativeHandle, forwardRef, useEffect, useCallback } from 'react';
import * as THREE from 'three';

const TryOnRenderer = forwardRef(({ videoWidth, videoHeight, className }, ref) => {
  const canvasRef = useRef(null);
  const rendererInstanceRef = useRef(null); // Rename to avoid confusion
  const sceneRef = useRef(null);
  const cameraRef = useRef(null);
  const videoTextureRef = useRef(null);
  const imageTextureRef = useRef(null);
  const planeMeshRef = useRef(null);
  const isInitialized = useRef(false);

  // --- Handle Resizing (Camera and Renderer) ---
  const handleResize = useCallback((newWidth, newHeight) => {
    if (!rendererInstanceRef.current || !cameraRef.current || newWidth === 0 || newHeight === 0) return;

    console.log(`Renderer: Resizing camera and renderer to ${newWidth}x${newHeight}`);

    // Update Renderer
    rendererInstanceRef.current.setSize(newWidth, newHeight);

    // Update Camera to match the new dimensions exactly
    cameraRef.current.left = -newWidth / 2;
    cameraRef.current.right = newWidth / 2;
    cameraRef.current.top = newHeight / 2;
    cameraRef.current.bottom = -newHeight / 2;
    cameraRef.current.updateProjectionMatrix();

  }, []);

  // --- Initialize Three.js Scene ---
  const initThreeScene = useCallback(() => {
    if (!canvasRef.current || isInitialized.current) return;
    console.log("Renderer: Initializing Three.js scene...");

    try {
      const canvas = canvasRef.current;
      // Use initial props if available, otherwise fallback (will be resized)
      const initialWidth = videoWidth || 640;
      const initialHeight = videoHeight || 480;

      // Scene
      sceneRef.current = new THREE.Scene();

      // Camera (Orthographic) - Size matches the plane dimensions
      cameraRef.current = new THREE.OrthographicCamera(
        -initialWidth / 2, initialWidth / 2, initialHeight / 2, -initialHeight / 2, 1, 1000
      );
      cameraRef.current.position.z = 1; // Camera needs to be in front of the plane (at z=0)
      sceneRef.current.add(cameraRef.current);

      // Renderer
      rendererInstanceRef.current = new THREE.WebGLRenderer({
        canvas: canvas,
        antialias: true,
        alpha: true
      });
      rendererInstanceRef.current.setSize(initialWidth, initialHeight); // Initial size
      rendererInstanceRef.current.setPixelRatio(window.devicePixelRatio);
      rendererInstanceRef.current.outputColorSpace = THREE.SRGBColorSpace;

      // *** KEY CHANGE: Create PlaneGeometry with exact dimensions ***
      const planeGeometry = new THREE.PlaneGeometry(initialWidth, initialHeight);

      // Basic Material (placeholder, will be replaced by texture)
      const planeMaterial = new THREE.MeshBasicMaterial({
          color: 0xdddddd, // Light gray placeholder
          side: THREE.DoubleSide
       });

      // Plane Mesh - Positioned at Z=0
      planeMeshRef.current = new THREE.Mesh(planeGeometry, planeMaterial);
      planeMeshRef.current.position.z = 0; // Place plane at the origin
      // Start with non-mirrored scale
      planeMeshRef.current.scale.set(1, 1, 1);
      sceneRef.current.add(planeMeshRef.current);

      isInitialized.current = true;
      console.log("Renderer: Three.js scene initialized.");

      // Ensure size is correct based on initial props
      handleResize(initialWidth, initialHeight);

    } catch (error) {
      console.error("Error initializing Three.js:", error);
    }
  }, [videoWidth, videoHeight, handleResize]); // Include handleResize dependency


  // --- Effect for Initial Setup ---
  useEffect(() => {
    initThreeScene(); // Initialize on mount

    // Cleanup on unmount
    return () => {
        console.log("Renderer: Cleaning up Three.js resources...");
        isInitialized.current = false;
        videoTextureRef.current?.dispose();
        imageTextureRef.current?.dispose();
        planeMeshRef.current?.geometry?.dispose();
        planeMeshRef.current?.material?.dispose();
        rendererInstanceRef.current?.dispose();

        videoTextureRef.current = null;
        imageTextureRef.current = null;
        planeMeshRef.current = null;
        sceneRef.current = null;
        cameraRef.current = null;
        rendererInstanceRef.current = null;
        canvasRef.current = null;
    };
  // initThreeScene is stable due to useCallback wrapping
  }, [initThreeScene]);


  // --- Effect to Handle Prop Resizing ---
  // Separate effect to handle resize when props change AFTER mount
  useEffect(() => {
      if(isInitialized.current && videoWidth > 0 && videoHeight > 0) {
          console.log("Renderer: Prop dimensions changed, calling handleResize.");
          handleResize(videoWidth, videoHeight);

          // *** KEY CHANGE: Update geometry dimensions on resize ***
          if (planeMeshRef.current?.geometry) {
              planeMeshRef.current.geometry.dispose(); // Dispose old geometry
              planeMeshRef.current.geometry = new THREE.PlaneGeometry(videoWidth, videoHeight);
              console.log("Renderer: Updated plane geometry dimensions.");
          }
      }
  }, [videoWidth, videoHeight, handleResize]); // Depends on props and handleResize


  // --- Expose Methods ---
  useImperativeHandle(ref, () => ({
    // --- Method for Real-time Video ---
    renderResults: (videoElement, results) => {
      if (!rendererInstanceRef.current || !sceneRef.current || !cameraRef.current || !planeMeshRef.current || !videoElement || !isInitialized.current) return;

      // Ensure renderer and camera match current video dimensions
      if (canvasRef.current && (canvasRef.current.width !== videoWidth || canvasRef.current.height !== videoHeight)) {
          console.warn("Renderer: renderResults detected dimension mismatch, resizing...");
          handleResize(videoWidth, videoHeight);
          // Update geometry as well if resize happened
           if (planeMeshRef.current?.geometry && planeMeshRef.current.geometry.parameters.width !== videoWidth) {
               planeMeshRef.current.geometry.dispose();
               planeMeshRef.current.geometry = new THREE.PlaneGeometry(videoWidth, videoHeight);
           }
      }


      // Create/Update Video Texture
      if (!videoTextureRef.current || videoTextureRef.current.image !== videoElement) {
        videoTextureRef.current?.dispose(); // Dispose old one if video element changed
        console.log("Renderer: Creating/updating video texture.");
        videoTextureRef.current = new THREE.VideoTexture(videoElement);
        videoTextureRef.current.colorSpace = THREE.SRGBColorSpace;
        // Use MeshBasicMaterial if no shader yet, ensure map is set
        if (planeMeshRef.current.material instanceof THREE.MeshBasicMaterial) {
            planeMeshRef.current.material.map = videoTextureRef.current;
            planeMeshRef.current.material.needsUpdate = true;
        } else {
             // If using ShaderMaterial, update the uniform later
        }
      }
      // VideoTexture updates automatically, but ensure map is assigned


       // --- Apply Mirror Effect by flipping scale ---
       if (planeMeshRef.current.scale.x > 0) {
           console.log("Renderer: Setting mirror scale.");
           planeMeshRef.current.scale.x = -1; // Flip horizontally
       }

       // Clear image texture if it exists
       if (imageTextureRef.current) {
           console.log("Renderer: Disposing stale image texture.");
           imageTextureRef.current.dispose();
           imageTextureRef.current = null;
           // Make sure video texture is assigned if material had image map
           if (planeMeshRef.current.material instanceof THREE.MeshBasicMaterial) {
                planeMeshRef.current.material.map = videoTextureRef.current;
                planeMeshRef.current.material.needsUpdate = true;
           }
       }

      // --- TODO: Shader logic using 'results' ---

      // Render the scene
      rendererInstanceRef.current.render(sceneRef.current, cameraRef.current);
    },

    // --- Method for Static Image ---
    renderStaticImageResults: (imageElement, results) => {
      console.log("Renderer: renderStaticImageResults called.", { hasImage: !!imageElement, hasResults: !!results });
      if (!rendererInstanceRef.current || !sceneRef.current || !cameraRef.current || !planeMeshRef.current || !imageElement || !isInitialized.current) return;

       // Ensure renderer and camera match current image dimensions
       const imgWidth = imageElement.naturalWidth;
       const imgHeight = imageElement.naturalHeight;
       if (canvasRef.current && (canvasRef.current.width !== imgWidth || canvasRef.current.height !== imgHeight)) {
           console.warn("Renderer: renderStaticImageResults detected dimension mismatch, resizing...");
           handleResize(imgWidth, imgHeight);
            // Update geometry as well if resize happened
           if (planeMeshRef.current?.geometry && planeMeshRef.current.geometry.parameters.width !== imgWidth) {
               planeMeshRef.current.geometry.dispose();
               planeMeshRef.current.geometry = new THREE.PlaneGeometry(imgWidth, imgHeight);
           }
       }

       // Clear video texture if it exists
       if (videoTextureRef.current) {
           console.log("Renderer: Disposing stale video texture.");
           videoTextureRef.current.dispose();
           videoTextureRef.current = null;
       }

      // Create/Update Image Texture
      // Only create if source changed or no texture exists
      if (!imageTextureRef.current || imageTextureRef.current.image !== imageElement) {
           console.log("Renderer: Creating/updating image texture.");
           imageTextureRef.current?.dispose(); // Dispose previous texture first
           imageTextureRef.current = new THREE.Texture(imageElement);
           imageTextureRef.current.needsUpdate = true;
           imageTextureRef.current.colorSpace = THREE.SRGBColorSpace;
           // Use MeshBasicMaterial if no shader yet, ensure map is set
           if (planeMeshRef.current.material instanceof THREE.MeshBasicMaterial) {
                planeMeshRef.current.material.map = imageTextureRef.current;
                planeMeshRef.current.material.needsUpdate = true;
           } else {
                // If using ShaderMaterial, update the uniform later
           }
      }


      // --- Remove Mirror Effect ---
      if (planeMeshRef.current.scale.x < 0) {
           console.log("Renderer: Setting non-mirror scale.");
           planeMeshRef.current.scale.x = 1; // Set scale back to normal
       }

      // --- TODO: Shader logic using 'results' ---

      // Render the scene
      rendererInstanceRef.current.render(sceneRef.current, cameraRef.current);
    },

    // --- Method to clear ---
    clearCanvas: () => {
        if (rendererInstanceRef.current) {
           console.log("Renderer: Clearing canvas (rendering background).");
           rendererInstanceRef.current.clear();
        }
    }
  }));


  // The canvas element for Three.js
  return (
    <canvas
      ref={canvasRef}
      className={`renderer-canvas ${className || ''}`}
      // Remove explicit width/height attributes, rely on CSS and renderer.setSize
      style={{ display: 'block', width: '100%', height: '100%', backgroundColor: '#eee' }}
    >
      Your browser does not support the HTML canvas element or WebGL.
    </canvas>
  );
});

TryOnRenderer.displayName = 'TryOnRenderer';
export default TryOnRenderer;