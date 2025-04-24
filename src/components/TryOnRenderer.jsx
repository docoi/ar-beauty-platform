// src/components/TryOnRenderer.jsx

import React, { useRef, useImperativeHandle, forwardRef, useEffect, useCallback } from 'react';
import * as THREE from 'three';

console.log(`Using Three.js revision: ${THREE.REVISION}`);

const TryOnRenderer = forwardRef(({ videoWidth, videoHeight, className }, ref) => {
  const canvasRef = useRef(null);
  const rendererInstanceRef = useRef(null);
  const sceneRef = useRef(null);
  const cameraRef = useRef(null);
  const videoTextureRef = useRef(null); // Keep separate refs
  const imageTextureRef = useRef(null);
  const planeMeshRef = useRef(null);
  const isInitialized = useRef(false);
  const currentSourceElement = useRef(null); // Renamed for clarity
  const currentResults = useRef(null);
  const animationFrameHandle = useRef(null);

  // --- Shader Definitions (Keep as is) ---
  const basicVertexShader = `
    varying vec2 vUv;
    void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
  `;
  const basicFragmentShader = `
    uniform sampler2D uTexture;
    varying vec2 vUv;
    void main() { gl_FragColor = texture2D(uTexture, vUv); }
  `;

  // --- Handle Resizing (Keep as is) ---
  const handleResize = useCallback(() => { /* ... */
      const canvas = canvasRef.current;
      if (!rendererInstanceRef.current || !cameraRef.current || !canvas) return;
      const newWidth = canvas.clientWidth; const newHeight = canvas.clientHeight;
      if (newWidth === 0 || newHeight === 0) return;
      const currentSize = rendererInstanceRef.current.getSize(new THREE.Vector2());
      if (currentSize.x === newWidth && currentSize.y === newHeight) return;
      console.log(`Renderer: Resizing canvas -> ${newWidth}x${newHeight}.`);
      rendererInstanceRef.current.setSize(newWidth, newHeight);
      cameraRef.current.left = -newWidth / 2; cameraRef.current.right = newWidth / 2;
      cameraRef.current.top = newHeight / 2; cameraRef.current.bottom = -newHeight / 2;
      cameraRef.current.updateProjectionMatrix();
  }, []);

  // --- Initialize Three.js Scene (Keep as is) ---
  const initThreeScene = useCallback(() => { /* ... */
    if (!canvasRef.current || isInitialized.current) return;
    console.log("Renderer: Initializing Three.js scene...");
    try {
      const canvas = canvasRef.current;
      const initialWidth = canvas.clientWidth || 640; const initialHeight = canvas.clientHeight || 480;
      sceneRef.current = new THREE.Scene();
      cameraRef.current = new THREE.OrthographicCamera(-initialWidth / 2, initialWidth / 2, initialHeight / 2, -initialHeight / 2, 1, 1000);
      cameraRef.current.position.z = 1; sceneRef.current.add(cameraRef.current);
      rendererInstanceRef.current = new THREE.WebGLRenderer({ canvas: canvas, antialias: true, alpha: true });
      rendererInstanceRef.current.setSize(initialWidth, initialHeight);
      rendererInstanceRef.current.setPixelRatio(window.devicePixelRatio);
      rendererInstanceRef.current.outputColorSpace = THREE.SRGBColorSpace;
      const planeGeometry = new THREE.PlaneGeometry(1, 1);
      const planeMaterial = new THREE.ShaderMaterial({
          vertexShader: basicVertexShader, fragmentShader: basicFragmentShader,
          uniforms: { uTexture: { value: null } }, side: THREE.DoubleSide,
      });
      planeMeshRef.current = new THREE.Mesh(planeGeometry, planeMaterial);
      planeMeshRef.current.position.z = 0; planeMeshRef.current.scale.set(1, 1, 1);
      sceneRef.current.add(planeMeshRef.current); isInitialized.current = true;
      console.log("Renderer: Three.js scene initialized with ShaderMaterial.");
      handleResize();
    } catch (error) { console.error("Error initializing Three.js:", error); }
  }, [handleResize, basicVertexShader, basicFragmentShader]);

  // --- Effect for Initial Setup and Resize Observer (Keep as is) ---
  useEffect(() => { /* ... */
    initThreeScene();
    let resizeObserver;
    if (canvasRef.current) {
        resizeObserver = new ResizeObserver(() => { handleResize(); });
        resizeObserver.observe(canvasRef.current);
    }
    return () => {
        console.log("Renderer: Cleaning up...");
        resizeObserver?.disconnect();
        cancelAnimationFrame(animationFrameHandle.current);
        isInitialized.current = false;
        videoTextureRef.current?.dispose(); imageTextureRef.current?.dispose();
        planeMeshRef.current?.material?.uniforms?.uTexture?.value?.dispose();
        planeMeshRef.current?.geometry?.dispose(); planeMeshRef.current?.material?.dispose();
        rendererInstanceRef.current?.dispose();
        videoTextureRef.current = null; imageTextureRef.current = null; planeMeshRef.current = null;
        sceneRef.current = null; cameraRef.current = null; rendererInstanceRef.current = null;
        currentSourceElement.current = null; currentResults.current = null;
    };
  }, [initThreeScene, handleResize]);

  // --- Scale Plane to Fit Camera View (Keep as is) ---
  const fitPlaneToCamera = useCallback((textureWidth, textureHeight) => { /* ... */
      if (!cameraRef.current || !planeMeshRef.current || !textureWidth || !textureHeight) return;
      const canvas = canvasRef.current; if (!canvas) return;
      const cameraWidth = canvas.clientWidth; const cameraHeight = canvas.clientHeight;
      if (cameraWidth === 0 || cameraHeight === 0) return;
      const cameraAspect = cameraWidth / cameraHeight; const textureAspect = textureWidth / textureHeight;
      let scaleX, scaleY;
      if (cameraAspect > textureAspect) { scaleY = cameraHeight; scaleX = scaleY * textureAspect; }
      else { scaleX = cameraWidth; scaleY = scaleX / textureAspect; }
      planeMeshRef.current.scale.y = scaleY; // Keep Y scale positive
      planeMeshRef.current.scale.x = scaleX; // X scale will be flipped for mirror later
  }, []);

  // --- Main Render Loop Logic ---
  const renderLoop = useCallback(() => {
       animationFrameHandle.current = requestAnimationFrame(renderLoop); // Schedule next frame first

       if (!isInitialized.current || !rendererInstanceRef.current || !sceneRef.current || !cameraRef.current || !planeMeshRef.current || !planeMeshRef.current.material?.uniforms?.uTexture) {
          return; // Not ready yet
       }

       const sourceElement = currentSourceElement.current; // Get the latest source
       const uTextureUniform = planeMeshRef.current.material.uniforms.uTexture;
       let sourceWidth = 0;
       let sourceHeight = 0;
       let isVideo = sourceElement instanceof HTMLVideoElement;
       let isImage = sourceElement instanceof HTMLImageElement;

       // --- 1. Get Source Dimensions ---
       if (isVideo && sourceElement.readyState >= 2) { // HAVE_CURRENT_DATA
           sourceWidth = sourceElement.videoWidth;
           sourceHeight = sourceElement.videoHeight;
       } else if (isImage && sourceElement.complete && sourceElement.naturalWidth > 0) { // Image loaded and has size
            sourceWidth = sourceElement.naturalWidth;
            sourceHeight = sourceElement.naturalHeight;
       } else if (!sourceElement) {
           // No source element, reset dimensions
            sourceWidth = 0;
            sourceHeight = 0;
       }
        // else: video/image not ready yet, dimensions remain 0

       // --- 2. Manage Textures ---
       let textureAssignedThisFrame = false; // Flag to track assignment
       if (isVideo && sourceWidth > 0) {
            // Video source is active and ready
            if (uTextureUniform.value !== videoTextureRef.current || !videoTextureRef.current) {
                 // If uniform doesn't hold the correct video texture, or no video texture exists
                 console.log("RenderLoop: Assigning VIDEO Texture to Uniform.");
                 videoTextureRef.current?.dispose(); // Dispose previous video texture ref if any
                 imageTextureRef.current?.dispose(); // Dispose image texture ref if switching
                 imageTextureRef.current = null;
                 videoTextureRef.current = new THREE.VideoTexture(sourceElement); // Create new
                 videoTextureRef.current.colorSpace = THREE.SRGBColorSpace;
                 uTextureUniform.value = videoTextureRef.current; // Assign to uniform
                 textureAssignedThisFrame = true;
            }
       } else if (isImage && sourceWidth > 0) {
            // Image source is active and ready
            if (uTextureUniform.value !== imageTextureRef.current || !imageTextureRef.current) {
                // If uniform doesn't hold the correct image texture, or no image texture exists
                 console.log("RenderLoop: Assigning IMAGE Texture to Uniform.");
                 videoTextureRef.current?.dispose(); // Dispose video texture ref if switching
                 videoTextureRef.current = null;
                 imageTextureRef.current?.dispose(); // Dispose previous image texture ref
                 imageTextureRef.current = new THREE.Texture(sourceElement); // Create new
                 imageTextureRef.current.colorSpace = THREE.SRGBColorSpace;
                 imageTextureRef.current.needsUpdate = true; // Mark image texture for upload
                 uTextureUniform.value = imageTextureRef.current; // Assign to uniform
                 textureAssignedThisFrame = true;
            }
             // Ensure needsUpdate is set if it's the current image texture (might be needed after context loss)
            if (imageTextureRef.current && uTextureUniform.value === imageTextureRef.current) {
                imageTextureRef.current.needsUpdate = true;
            }
       } else {
            // No valid source, clear texture uniform
            if (uTextureUniform.value !== null) {
                console.log("RenderLoop: Clearing texture uniform (No valid source).");
                 // Dispose the textures stored in refs
                 videoTextureRef.current?.dispose();
                 imageTextureRef.current?.dispose();
                 videoTextureRef.current = null;
                 imageTextureRef.current = null;
                 uTextureUniform.value = null; // Clear uniform
                 textureAssignedThisFrame = true;
            }
       }

        // Force material update if texture was assigned or cleared
        if (textureAssignedThisFrame) {
             planeMeshRef.current.material.needsUpdate = true;
        }


       // --- 3. Update Plane Scale & Mirroring ---
       if (uTextureUniform.value && sourceWidth > 0 && sourceHeight > 0) { // Only scale if texture is set
            fitPlaneToCamera(sourceWidth, sourceHeight);
            planeMeshRef.current.scale.x = Math.abs(planeMeshRef.current.scale.x) * (isVideo ? -1 : 1);
       } else {
            // No texture, hide plane
           if (planeMeshRef.current.scale.x !== 0) { // Avoid setting scale repeatedly
                 console.log("RenderLoop: Hiding plane (no texture).")
                 planeMeshRef.current.scale.set(0,0,0);
           }
       }


       // --- 4. TODO: Update Shader Uniforms (Effects) ---


       // --- 5. Render Scene ---
       rendererInstanceRef.current.render(sceneRef.current, cameraRef.current);

  }, [fitPlaneToCamera]); // Include dependency


  // --- Start Render Loop ---
  useEffect(() => {
    console.log("Renderer: UseEffect starting render loop.");
    if (isInitialized.current) {
        cancelAnimationFrame(animationFrameHandle.current);
        animationFrameHandle.current = requestAnimationFrame(renderLoop);
        console.log("Render loop requested with handle:", animationFrameHandle.current);
    } else { console.warn("Render loop start skipped, not initialized."); }
  }, [renderLoop]);


  // --- Expose Methods ---
  useImperativeHandle(ref, () => ({
    renderResults: (videoElement, results) => {
        // Update refs, renderLoop will pick them up
        currentSourceElement.current = videoElement;
        currentResults.current = results;
    },
    renderStaticImageResults: (imageElement, results) => {
        console.log("ImperativeHandle: renderStaticImageResults called.");
        currentSourceElement.current = imageElement;
        currentResults.current = results;
    },
    clearCanvas: () => {
        console.log("ImperativeHandle: Clearing canvas source.");
        currentSourceElement.current = null;
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