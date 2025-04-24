// src/components/TryOnRenderer.jsx

import React, { useRef, useImperativeHandle, forwardRef, useEffect, useCallback } from 'react';
import * as THREE from 'three';

// --- Log Three.js version ---
console.log(`Using Three.js revision: ${THREE.REVISION}`);

const TryOnRenderer = forwardRef(({ videoWidth, videoHeight, className }, ref) => {
  const canvasRef = useRef(null);
  const rendererInstanceRef = useRef(null);
  const sceneRef = useRef(null);
  const cameraRef = useRef(null);
  const videoTextureRef = useRef(null); // Keep separate refs for easier debugging
  const imageTextureRef = useRef(null);
  const planeMeshRef = useRef(null);
  const isInitialized = useRef(false);
  const currentVideoElement = useRef(null); // Stores the CURRENT source (video OR image)
  const currentResults = useRef(null);
  const animationFrameHandle = useRef(null); // Ref to store animation frame handle

  // --- Shader Definitions (Basic Passthrough) ---
  const basicVertexShader = `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `;
  const basicFragmentShader = `
    uniform sampler2D uTexture;
    varying vec2 vUv;
    void main() {
      vec4 textureColor = texture2D(uTexture, vUv);
      // If texture is empty, output a debug color?
      // if (textureColor.a == 0.0) { gl_FragColor = vec4(1.0, 0.0, 1.0, 1.0); return; } // Magenta if empty
      gl_FragColor = textureColor;
    }
  `;

  // --- Handle Resizing (Based on Canvas Client Size) ---
  const handleResize = useCallback(() => {
      const canvas = canvasRef.current;
      if (!rendererInstanceRef.current || !cameraRef.current || !canvas) return;
      const newWidth = canvas.clientWidth;
      const newHeight = canvas.clientHeight;
      if (newWidth === 0 || newHeight === 0) return;
      const currentSize = rendererInstanceRef.current.getSize(new THREE.Vector2());
      if (currentSize.x === newWidth && currentSize.y === newHeight) return;
      console.log(`Renderer: Resizing canvas client size detected: ${newWidth}x${newHeight}. Updating renderer & camera.`);
      rendererInstanceRef.current.setSize(newWidth, newHeight);
      cameraRef.current.left = -newWidth / 2; cameraRef.current.right = newWidth / 2;
      cameraRef.current.top = newHeight / 2; cameraRef.current.bottom = -newHeight / 2;
      cameraRef.current.updateProjectionMatrix();
  }, []);

  // --- Initialize Three.js Scene ---
  const initThreeScene = useCallback(() => {
    if (!canvasRef.current || isInitialized.current) return;
    console.log("Renderer: Initializing Three.js scene...");
    try {
      const canvas = canvasRef.current;
      const initialWidth = canvas.clientWidth || 640;
      const initialHeight = canvas.clientHeight || 480;
      sceneRef.current = new THREE.Scene();
      cameraRef.current = new THREE.OrthographicCamera(-initialWidth / 2, initialWidth / 2, initialHeight / 2, -initialHeight / 2, 1, 1000);
      cameraRef.current.position.z = 1;
      sceneRef.current.add(cameraRef.current);
      rendererInstanceRef.current = new THREE.WebGLRenderer({ canvas: canvas, antialias: true, alpha: true });
      rendererInstanceRef.current.setSize(initialWidth, initialHeight);
      rendererInstanceRef.current.setPixelRatio(window.devicePixelRatio);
      rendererInstanceRef.current.outputColorSpace = THREE.SRGBColorSpace;

      const planeGeometry = new THREE.PlaneGeometry(1, 1);
      const planeMaterial = new THREE.ShaderMaterial({
          vertexShader: basicVertexShader, fragmentShader: basicFragmentShader,
          uniforms: { uTexture: { value: null } },
          side: THREE.DoubleSide,
      });
      planeMeshRef.current = new THREE.Mesh(planeGeometry, planeMaterial);
      planeMeshRef.current.position.z = 0;
      planeMeshRef.current.scale.set(1, 1, 1);
      sceneRef.current.add(planeMeshRef.current);
      isInitialized.current = true;
      console.log("Renderer: Three.js scene initialized with ShaderMaterial.");
      handleResize();
    } catch (error) { console.error("Error initializing Three.js:", error); }
  }, [handleResize, basicVertexShader, basicFragmentShader]);

  // --- Effect for Initial Setup and Resize Observer ---
  useEffect(() => {
    initThreeScene();
    let resizeObserver;
    if (canvasRef.current) {
        resizeObserver = new ResizeObserver(() => { handleResize(); });
        resizeObserver.observe(canvasRef.current);
    }
    return () => {
        console.log("Renderer: Cleaning up Three.js resources and ResizeObserver...");
        resizeObserver?.disconnect();
        cancelAnimationFrame(animationFrameHandle.current); // Cancel animation frame
        isInitialized.current = false;
        // Dispose textures and materials thoroughly
        videoTextureRef.current?.dispose(); imageTextureRef.current?.dispose();
        planeMeshRef.current?.material?.uniforms?.uTexture?.value?.dispose(); // Dispose texture in uniform
        planeMeshRef.current?.geometry?.dispose(); planeMeshRef.current?.material?.dispose();
        rendererInstanceRef.current?.dispose();
        // Clear refs
        videoTextureRef.current = null; imageTextureRef.current = null; planeMeshRef.current = null;
        sceneRef.current = null; cameraRef.current = null; rendererInstanceRef.current = null;
        currentVideoElement.current = null; currentResults.current = null;
    };
  }, [initThreeScene, handleResize]); // initThreeScene is stable


  // --- Scale Plane to Fit Camera View ---
  const fitPlaneToCamera = useCallback((textureWidth, textureHeight) => {
      if (!cameraRef.current || !planeMeshRef.current || !textureWidth || !textureHeight) return;
      const canvas = canvasRef.current;
      if (!canvas) return;
      const cameraWidth = canvas.clientWidth; const cameraHeight = canvas.clientHeight;
      if (cameraWidth === 0 || cameraHeight === 0) return;
      const cameraAspect = cameraWidth / cameraHeight; const textureAspect = textureWidth / textureHeight;
      let scaleX, scaleY;
      if (cameraAspect > textureAspect) { scaleY = cameraHeight; scaleX = scaleY * textureAspect; }
      else { scaleX = cameraWidth; scaleY = scaleX / textureAspect; }
      planeMeshRef.current.scale.y = scaleY; // Keep Y scale positive
      planeMeshRef.current.scale.x = scaleX; // X scale will be flipped for mirror
      // console.log(`Renderer: Adjusted plane scale to ${scaleX.toFixed(2)} x ${scaleY.toFixed(2)}`);
  }, []);


  // --- Main Render Loop Logic ---
  const renderLoop = useCallback(() => {
       animationFrameHandle.current = requestAnimationFrame(renderLoop); // Schedule next frame

       if (!isInitialized.current || !rendererInstanceRef.current || !sceneRef.current || !cameraRef.current || !planeMeshRef.current || !planeMeshRef.current.material.uniforms.uTexture) {
          // console.log("Render loop waiting for initialization..."); // Reduce noise
          return; // Not ready yet
       }

       const sourceElement = currentVideoElement.current;
       const uTextureUniform = planeMeshRef.current.material.uniforms.uTexture;
       let sourceWidth = 0;
       let sourceHeight = 0;
       let needsTextureUpdate = false;
       let isVideo = sourceElement instanceof HTMLVideoElement;
       let isImage = sourceElement instanceof HTMLImageElement;

       // --- 1. Determine Source and Dimensions ---
       if (isVideo && sourceElement.readyState >= 2) { // HAVE_CURRENT_DATA
           sourceWidth = sourceElement.videoWidth;
           sourceHeight = sourceElement.videoHeight;
       } else if (isImage && sourceElement.complete) { // Image loaded
            sourceWidth = sourceElement.naturalWidth;
            sourceHeight = sourceElement.naturalHeight;
       }

       // --- 2. Manage Textures ---
       if (isVideo && sourceWidth > 0) {
            // Video source is active
            if (!videoTextureRef.current || videoTextureRef.current.image !== sourceElement) {
                 videoTextureRef.current?.dispose(); // Dispose old video texture if element changed
                 imageTextureRef.current?.dispose(); // Dispose image texture if switching from image
                 imageTextureRef.current = null;
                 videoTextureRef.current = new THREE.VideoTexture(sourceElement);
                 videoTextureRef.current.colorSpace = THREE.SRGBColorSpace;
                 uTextureUniform.value = videoTextureRef.current;
                 needsTextureUpdate = true;
                 console.log("RenderLoop: Assigned Video Texture.");
            }
            // VideoTexture updates automatically, no need for needsUpdate=true
       } else if (isImage && sourceWidth > 0) {
            // Image source is active
            if (!imageTextureRef.current || imageTextureRef.current.image !== sourceElement) {
                videoTextureRef.current?.dispose(); // Dispose video texture if switching from video
                videoTextureRef.current = null;
                imageTextureRef.current?.dispose(); // Dispose old image texture
                imageTextureRef.current = new THREE.Texture(sourceElement);
                imageTextureRef.current.colorSpace = THREE.SRGBColorSpace;
                imageTextureRef.current.needsUpdate = true; // Mark image texture for upload
                uTextureUniform.value = imageTextureRef.current;
                needsTextureUpdate = true;
                console.log("RenderLoop: Assigned Image Texture.");
            } else if (imageTextureRef.current) {
                // Image texture already exists, ensure it's assigned if needed
                if (uTextureUniform.value !== imageTextureRef.current) {
                    uTextureUniform.value = imageTextureRef.current;
                    needsTextureUpdate = true;
                    console.log("RenderLoop: Re-assigned existing Image Texture.");
                }
                // Check if needsUpdate needs to be reset (should happen automatically after first render)
                // if (imageTextureRef.current.needsUpdate) console.log("Image texture still needs update");
            }
       } else {
            // No valid source, clear texture uniform
            if (uTextureUniform.value !== null) {
                console.log("RenderLoop: Clearing texture uniform.");
                 // Don't dispose here, let cleanup handle it? Or maybe just clear?
                 // uTextureUniform.value?.dispose(); // Careful with this
                 uTextureUniform.value = null;
                 needsTextureUpdate = true;
            }
       }

        // Update material if texture changed
        if (needsTextureUpdate) {
             planeMeshRef.current.material.needsUpdate = true;
        }

       // --- 3. Update Plane Scale & Mirroring ---
       if (sourceWidth > 0 && sourceHeight > 0) {
            fitPlaneToCamera(sourceWidth, sourceHeight);
            // Apply mirroring scale AFTER fitting. IMPORTANT: Use absolute value of current scale X
            planeMeshRef.current.scale.x = Math.abs(planeMeshRef.current.scale.x) * (isVideo ? -1 : 1);
       } else {
            // Optional: Hide plane if no texture?
            // planeMeshRef.current.scale.set(0,0,0);
       }


       // --- 4. TODO: Update Shader Uniforms (Effects) ---
       // Example: Pass results to shader if available
       // if (currentResults.current && planeMeshRef.current.material.uniforms.uLandmarks) {
       //    planeMeshRef.current.material.uniforms.uLandmarks.value = currentResults.current.faceLandmarks;
       // }


       // --- 5. Render Scene ---
       rendererInstanceRef.current.render(sceneRef.current, cameraRef.current);

  }, [fitPlaneToCamera]);


  // --- Start Render Loop ---
  useEffect(() => {
      console.log("Renderer: UseEffect starting render loop.");
      // Start the loop if initialized
      if (isInitialized.current) {
          cancelAnimationFrame(animationFrameHandle.current); // Cancel any previous loop just in case
          animationFrameHandle.current = requestAnimationFrame(renderLoop);
          console.log("Render loop requested with handle:", animationFrameHandle.current);
      } else {
           console.warn("Render loop start skipped, not initialized.");
      }
      // Cleanup is handled in the main init effect
  }, [renderLoop]); // Re-run if renderLoop identity changes (due to dependencies)


  // --- Expose Methods ---
  useImperativeHandle(ref, () => ({
    renderResults: (videoElement, results) => {
        // console.log("ImperativeHandle: renderResults called"); // Reduce noise
        currentVideoElement.current = videoElement;
        currentResults.current = results;
    },
    renderStaticImageResults: (imageElement, results) => {
        console.log("ImperativeHandle: renderStaticImageResults called.");
        currentVideoElement.current = imageElement;
        currentResults.current = results;
    },
    clearCanvas: () => {
        console.log("ImperativeHandle: Clearing canvas.");
        currentVideoElement.current = null;
        currentResults.current = null;
    }
  }));


  // The canvas element for Three.js
  return (
    <canvas
      ref={canvasRef}
      className={`renderer-canvas ${className || ''}`}
      style={{ display: 'block', width: '100%', height: '100%' }}
    >
      Your browser does not support the HTML canvas element or WebGL.
    </canvas>
  );
});

TryOnRenderer.displayName = 'TryOnRenderer';
export default TryOnRenderer;