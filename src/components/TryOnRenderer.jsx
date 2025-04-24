// src/components/TryOnRenderer.jsx - VERSION KNOWN TO RENDER BOTH VIDEO & DARK SELFIE

import React, { useRef, useImperativeHandle, forwardRef, useEffect, useCallback } from 'react';
import * as THREE from 'three';

console.log(`Using Three.js revision: ${THREE.REVISION}`);

const TryOnRenderer = forwardRef(({ videoWidth, videoHeight, className }, ref) => {
  const canvasRef = useRef(null);
  const rendererInstanceRef = useRef(null);
  const sceneRef = useRef(null);
  const cameraRef = useRef(null);
  const planeMeshRef = useRef(null);    // Ref to the Mesh object
  const videoTextureRef = useRef(null); // Separate refs for disposal tracking
  const imageTextureRef = useRef(null);
  const isInitialized = useRef(false);
  const currentSourceElement = useRef(null); // Stores the CURRENT source (video OR image)
  const currentResults = useRef(null); // Stores results for future shader use
  const animationFrameHandle = useRef(null);

  // --- Basic Shaders ---
  const vertexShader = `
    varying vec2 vUv;
    void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
  `;
  // Fragment shader just displays texture for now
  const fragmentShader = `
    uniform sampler2D uTexture;
    varying vec2 vUv;
    void main() {
      // Check if texture uniform is likely unset
      // Note: Comparing sampler2D directly might not be reliable across all platforms/drivers.
      // A better check might involve a separate boolean uniform if needed.
      // For now, just sample it. If it's invalid, behavior might vary (often black or transparent).
      vec4 texColor = texture2D(uTexture, vUv);
      gl_FragColor = texColor;
    }
  `;

  // --- Handle Resizing ---
  const handleResize = useCallback(() => {
      const canvas = canvasRef.current; if (!rendererInstanceRef.current || !cameraRef.current || !canvas) return;
      const newWidth = canvas.clientWidth; const newHeight = canvas.clientHeight; if (newWidth === 0 || newHeight === 0) return;
      const currentSize = rendererInstanceRef.current.getSize(new THREE.Vector2()); if (currentSize.x === newWidth && currentSize.y === newHeight) return;
      // console.log(`Renderer: Resizing canvas -> ${newWidth}x${newHeight}.`);
      rendererInstanceRef.current.setSize(newWidth, newHeight);
      cameraRef.current.left = -newWidth / 2; cameraRef.current.right = newWidth / 2; cameraRef.current.top = newHeight / 2; cameraRef.current.bottom = -newHeight / 2; cameraRef.current.updateProjectionMatrix();
  }, []);

  // --- Initialize Scene ---
  const initThreeScene = useCallback(() => {
    if (!canvasRef.current || isInitialized.current) return;
    console.log("Renderer: Initializing Three.js scene...");
    try {
      const canvas = canvasRef.current; const initialWidth = canvas.clientWidth || 640; const initialHeight = canvas.clientHeight || 480;
      sceneRef.current = new THREE.Scene(); cameraRef.current = new THREE.OrthographicCamera(-initialWidth / 2, initialWidth / 2, initialHeight / 2, -initialHeight / 2, 1, 1000); cameraRef.current.position.z = 1; sceneRef.current.add(cameraRef.current); rendererInstanceRef.current = new THREE.WebGLRenderer({ canvas: canvas, antialias: true, alpha: true }); rendererInstanceRef.current.setSize(initialWidth, initialHeight); rendererInstanceRef.current.setPixelRatio(window.devicePixelRatio); rendererInstanceRef.current.outputColorSpace = THREE.SRGBColorSpace;
      const planeGeometry = new THREE.PlaneGeometry(1, 1); // Start 1x1, scale later
      // Use ShaderMaterial but only with uTexture uniform initially
      const planeMaterial = new THREE.ShaderMaterial({
          vertexShader: vertexShader, fragmentShader: fragmentShader,
          uniforms: { uTexture: { value: null } }, // Only texture uniform for now
          side: THREE.DoubleSide, transparent: false,
      });
      planeMeshRef.current = new THREE.Mesh(planeGeometry, planeMaterial); planeMeshRef.current.position.z = 0; planeMeshRef.current.scale.set(1, 1, 1); sceneRef.current.add(planeMeshRef.current);
      isInitialized.current = true; console.log("Renderer: Scene initialized."); handleResize();
    } catch (error) { console.error("Error initializing Three.js:", error); }
  }, [handleResize, vertexShader, fragmentShader]); // Include shaders

  // --- Effect for Initial Setup / Resize Observer ---
  useEffect(() => {
    initThreeScene(); let resizeObserver; if (canvasRef.current) { resizeObserver = new ResizeObserver(() => { handleResize(); }); resizeObserver.observe(canvasRef.current); }
    return () => { /* ... cleanup ... */ console.log("Renderer: Cleaning up..."); resizeObserver?.disconnect(); cancelAnimationFrame(animationFrameHandle.current); isInitialized.current = false; videoTextureRef.current?.dispose(); imageTextureRef.current?.dispose(); planeMeshRef.current?.material?.uniforms?.uTexture?.value?.dispose(); planeMeshRef.current?.geometry?.dispose(); planeMeshRef.current?.material?.dispose(); rendererInstanceRef.current?.dispose(); /* Clear refs */ videoTextureRef.current = null; imageTextureRef.current = null; planeMeshRef.current = null; sceneRef.current = null; cameraRef.current = null; rendererInstanceRef.current = null; currentSourceElement.current = null; currentResults.current = null; };
  }, [initThreeScene, handleResize]);

  // --- Scale Plane ---
  const fitPlaneToCamera = useCallback((textureWidth, textureHeight) => {
      if (!cameraRef.current || !planeMeshRef.current || !textureWidth || !textureHeight) return; const canvas = canvasRef.current; if (!canvas) return; const cameraWidth = canvas.clientWidth; const cameraHeight = canvas.clientHeight; if (cameraWidth === 0 || cameraHeight === 0) return; const cameraAspect = cameraWidth / cameraHeight; const textureAspect = textureWidth / textureHeight; let scaleX, scaleY; if (cameraAspect > textureAspect) { scaleY = cameraHeight; scaleX = scaleY * textureAspect; } else { scaleX = cameraWidth; scaleY = scaleX / textureAspect; } planeMeshRef.current.scale.y = scaleY; planeMeshRef.current.scale.x = scaleX;
  }, []);

  // --- Render Loop ---
  const renderLoop = useCallback(() => {
       animationFrameHandle.current = requestAnimationFrame(renderLoop);
       if (isInitialized.current && rendererInstanceRef.current && sceneRef.current && cameraRef.current) {
           rendererInstanceRef.current.render(sceneRef.current, cameraRef.current);
       }
  }, []);

  // --- Start Render Loop ---
  useEffect(() => { if (isInitialized.current) { cancelAnimationFrame(animationFrameHandle.current); animationFrameHandle.current = requestAnimationFrame(renderLoop); } }, [renderLoop]);

  // --- Expose Methods (Texture Update Logic Here) ---
  useImperativeHandle(ref, () => ({
    renderResults: (videoElement, results) => { // For Mirror
        if (!planeMeshRef.current || !planeMeshRef.current.material.uniforms || !videoElement || videoElement.readyState < 2) return;
        const uniforms = planeMeshRef.current.material.uniforms;
        const videoW = videoElement.videoWidth; const videoH = videoElement.videoHeight;

        // Update video texture if needed
        if (uniforms.uTexture.value !== videoTextureRef.current || !videoTextureRef.current || videoTextureRef.current.image !== videoElement) {
            // console.log("Handle: Creating/Updating Video Texture"); // Reduce log noise
            videoTextureRef.current?.dispose(); imageTextureRef.current?.dispose(); imageTextureRef.current = null;
            videoTextureRef.current = new THREE.VideoTexture(videoElement); videoTextureRef.current.colorSpace = THREE.SRGBColorSpace;
            uniforms.uTexture.value = videoTextureRef.current;
            planeMeshRef.current.material.needsUpdate = true; // May not be needed for video, but safe
        }
        // NO uIsStaticImage update needed yet

        // Scale and mirror plane
        if (videoW > 0) { fitPlaneToCamera(videoW, videoH); planeMeshRef.current.scale.x = -Math.abs(planeMeshRef.current.scale.x); }
        else { planeMeshRef.current.scale.set(0,0,0); }
        currentResults.current = results;
    },
    renderStaticImageResults: (imageElement, results /* No brightness/contrast yet */) => { // For Selfie
        console.log("Handle: renderStaticImageResults.");
        if (!planeMeshRef.current || !planeMeshRef.current.material.uniforms || !imageElement || !imageElement.complete || imageElement.naturalWidth === 0) return;
        const uniforms = planeMeshRef.current.material.uniforms;
        const imgWidth = imageElement.naturalWidth; const imgHeight = imageElement.naturalHeight;

        // Update image texture if needed
        if (uniforms.uTexture.value !== imageTextureRef.current || !imageTextureRef.current || imageTextureRef.current.image !== imageElement) {
             console.log("Handle: Creating/Updating Image Texture");
            videoTextureRef.current?.dispose(); videoTextureRef.current = null;
            imageTextureRef.current?.dispose();
            imageTextureRef.current = new THREE.Texture(imageElement); imageTextureRef.current.colorSpace = THREE.SRGBColorSpace; imageTextureRef.current.needsUpdate = true; // Image needs this flag
            uniforms.uTexture.value = imageTextureRef.current;
            planeMeshRef.current.material.needsUpdate = true;
        } else if (imageTextureRef.current) { imageTextureRef.current.needsUpdate = true; } // Ensure flag is set if texture exists
        // NO uIsStaticImage update needed yet

        // Scale plane (no mirroring)
        if (imgWidth > 0) { fitPlaneToCamera(imgWidth, imgHeight); planeMeshRef.current.scale.x = Math.abs(planeMeshRef.current.scale.x); }
        else { planeMeshRef.current.scale.set(0,0,0); }
         currentResults.current = results;
    },
    clearCanvas: () => { /* ... Keep clearCanvas method ... */
        console.log("Handle: Clearing canvas source.");
        const uniforms = planeMeshRef.current?.material?.uniforms;
        if (uniforms?.uTexture) {
            videoTextureRef.current?.dispose(); imageTextureRef.current?.dispose();
            videoTextureRef.current = null; imageTextureRef.current = null;
            uniforms.uTexture.value = null;
            planeMeshRef.current.material.needsUpdate = true;
            planeMeshRef.current.scale.set(0,0,0);
        }
    }
  }));

  // --- JSX ---
  return ( <canvas ref={canvasRef} className={`renderer-canvas ${className || ''}`} style={{ display: 'block', width: '100%', height: '100%' }} /> );
});

TryOnRenderer.displayName = 'TryOnRenderer';
export default TryOnRenderer;