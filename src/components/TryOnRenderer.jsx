// src/components/TryOnRenderer.jsx - Simplify Texture Handling in Handles

import React, { useRef, useImperativeHandle, forwardRef, useEffect, useCallback } from 'react';
import * as THREE from 'three';

console.log(`Using Three.js revision: ${THREE.REVISION}`);

const TryOnRenderer = forwardRef(({ videoWidth, videoHeight, className }, ref) => {
  const canvasRef = useRef(null);
  const rendererInstanceRef = useRef(null);
  const sceneRef = useRef(null);
  const cameraRef = useRef(null);
  const planeMeshRef = useRef(null);
  const currentTextureRef = useRef(null); // Single ref for the current texture
  const isInitialized = useRef(false);
  const animationFrameHandle = useRef(null);

  // --- Shaders (Keep as is) ---
  const vertexShader = `varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;
  const fragmentShader = ` uniform sampler2D uTexture; uniform bool uIsStaticImage; uniform float uBrightness; uniform float uContrast; varying vec2 vUv; vec3 contrastAdjust(vec3 c, float v){ return 0.5 + v * (c - 0.5); } void main() { vec4 tColor = texture2D(uTexture, vUv); if (uIsStaticImage) { tColor.rgb *= uBrightness; tColor.rgb = contrastAdjust(tColor.rgb, uContrast); tColor.rgb = clamp(tColor.rgb, 0.0, 1.0); } gl_FragColor = tColor; }`;

  // --- Handle Resizing (Keep as is) ---
  const handleResize = useCallback(() => { /* ... */
      const canvas = canvasRef.current; if (!rendererInstanceRef.current || !cameraRef.current || !canvas) return;
      const newWidth = canvas.clientWidth; const newHeight = canvas.clientHeight; if (newWidth === 0 || newHeight === 0) return;
      const currentSize = rendererInstanceRef.current.getSize(new THREE.Vector2()); if (currentSize.x === newWidth && currentSize.y === newHeight) return;
      // console.log(`Renderer: Resizing canvas -> ${newWidth}x${newHeight}.`); // Reduce log noise
      rendererInstanceRef.current.setSize(newWidth, newHeight);
      cameraRef.current.left = -newWidth / 2; cameraRef.current.right = newWidth / 2; cameraRef.current.top = newHeight / 2; cameraRef.current.bottom = -newHeight / 2; cameraRef.current.updateProjectionMatrix();
  }, []);

  // --- Initialize Scene (Keep as is) ---
  const initThreeScene = useCallback(() => { /* ... */
    if (!canvasRef.current || isInitialized.current) return;
    console.log("Renderer: Initializing Three.js scene...");
    try { /* ... scene, camera, renderer ... */
      const canvas = canvasRef.current; const initialWidth = canvas.clientWidth || 640; const initialHeight = canvas.clientHeight || 480;
      sceneRef.current = new THREE.Scene(); cameraRef.current = new THREE.OrthographicCamera(-initialWidth / 2, initialWidth / 2, initialHeight / 2, -initialHeight / 2, 1, 1000); cameraRef.current.position.z = 1; sceneRef.current.add(cameraRef.current); rendererInstanceRef.current = new THREE.WebGLRenderer({ canvas: canvas, antialias: true, alpha: true }); rendererInstanceRef.current.setSize(initialWidth, initialHeight); rendererInstanceRef.current.setPixelRatio(window.devicePixelRatio); rendererInstanceRef.current.outputColorSpace = THREE.SRGBColorSpace; const planeGeometry = new THREE.PlaneGeometry(1, 1); const planeMaterial = new THREE.ShaderMaterial({ vertexShader: vertexShader, fragmentShader: fragmentShader, uniforms: { uTexture: { value: null }, uIsStaticImage: { value: false }, uBrightness: { value: 1.2 }, uContrast: { value: 1.1 }, }, side: THREE.DoubleSide, transparent: false, }); planeMeshRef.current = new THREE.Mesh(planeGeometry, planeMaterial); planeMeshRef.current.position.z = 0; planeMeshRef.current.scale.set(1, 1, 1); sceneRef.current.add(planeMeshRef.current); isInitialized.current = true; console.log("Renderer: Scene initialized."); handleResize(); } catch (error) { console.error("Error initializing Three.js:", error); }
  }, [handleResize, vertexShader, fragmentShader]);

  // --- Effect for Initial Setup / Resize Observer (Keep as is) ---
  useEffect(() => { /* ... */
    initThreeScene(); let resizeObserver; if (canvasRef.current) { resizeObserver = new ResizeObserver(() => { handleResize(); }); resizeObserver.observe(canvasRef.current); }
    return () => { /* ... cleanup ... */ console.log("Renderer: Cleaning up..."); resizeObserver?.disconnect(); cancelAnimationFrame(animationFrameHandle.current); isInitialized.current = false; currentTextureRef.current?.dispose(); planeMeshRef.current?.geometry?.dispose(); planeMeshRef.current?.material?.dispose(); rendererInstanceRef.current?.dispose(); /* Clear refs */ };
  }, [initThreeScene, handleResize]);

  // --- Scale Plane ---
  const fitPlaneToCamera = useCallback((textureWidth, textureHeight) => { /* ... */
      if (!cameraRef.current || !planeMeshRef.current || !textureWidth || !textureHeight) return; const canvas = canvasRef.current; if (!canvas) return; const cameraWidth = canvas.clientWidth; const cameraHeight = canvas.clientHeight; if (cameraWidth === 0 || cameraHeight === 0) return; const cameraAspect = cameraWidth / cameraHeight; const textureAspect = textureWidth / textureHeight; let scaleX, scaleY; if (cameraAspect > textureAspect) { scaleY = cameraHeight; scaleX = scaleY * textureAspect; } else { scaleX = cameraWidth; scaleY = scaleX / textureAspect; } planeMeshRef.current.scale.y = scaleY; planeMeshRef.current.scale.x = scaleX;
  }, []);

  // --- Render Loop (Only Renders) ---
  const renderLoop = useCallback(() => {
       animationFrameHandle.current = requestAnimationFrame(renderLoop);
       if (isInitialized.current && rendererInstanceRef.current && sceneRef.current && cameraRef.current) {
           rendererInstanceRef.current.render(sceneRef.current, cameraRef.current);
       }
  }, []);

  // --- Start Render Loop ---
  useEffect(() => { if (isInitialized.current) { cancelAnimationFrame(animationFrameHandle.current); animationFrameHandle.current = requestAnimationFrame(renderLoop); } }, [renderLoop]);

  // --- Expose Methods (Simplified Texture/Uniform Update) ---
  useImperativeHandle(ref, () => ({
    renderResults: (videoElement, results) => {
        // Called every frame in Mirror mode
        if (!planeMeshRef.current || !planeMeshRef.current.material.uniforms || !videoElement || videoElement.readyState < 2) return; // Need video ready

        const uniforms = planeMeshRef.current.material.uniforms;
        const videoWidth = videoElement.videoWidth;
        const videoHeight = videoElement.videoHeight;

        // --- Simplified Texture Update ---
        if (currentTextureRef.current?.image !== videoElement) {
            console.log("Handle: Assigning Video Texture");
            currentTextureRef.current?.dispose(); // Dispose whatever was there
            currentTextureRef.current = new THREE.VideoTexture(videoElement);
            currentTextureRef.current.colorSpace = THREE.SRGBColorSpace;
        }
        // --- Assign to uniform EVERY frame ---
        uniforms.uTexture.value = currentTextureRef.current;
        uniforms.uIsStaticImage.value = false;
        planeMeshRef.current.material.needsUpdate = true; // Maybe helps?

        // Scale plane
        if (videoWidth > 0) {
             fitPlaneToCamera(videoWidth, videoHeight);
             planeMeshRef.current.scale.x *= -1; // Apply mirror
        } else {
             planeMeshRef.current.scale.set(0,0,0); // Hide if no dimensions
        }
    },
    renderStaticImageResults: (imageElement, results) => {
        console.log("Handle: renderStaticImageResults called.");
        if (!planeMeshRef.current || !planeMeshRef.current.material.uniforms || !imageElement || !imageElement.complete || imageElement.naturalWidth === 0) return; // Need image ready

        const uniforms = planeMeshRef.current.material.uniforms;
        const imgWidth = imageElement.naturalWidth;
        const imgHeight = imageElement.naturalHeight;

         // --- Simplified Texture Update ---
         if (currentTextureRef.current?.image !== imageElement) {
            console.log("Handle: Assigning Image Texture");
            currentTextureRef.current?.dispose(); // Dispose whatever was there
            currentTextureRef.current = new THREE.Texture(imageElement);
            currentTextureRef.current.colorSpace = THREE.SRGBColorSpace;
            currentTextureRef.current.needsUpdate = true; // Image needs this flag
         } else {
            // If it's the same image, still flag texture for update?
            currentTextureRef.current.needsUpdate = true;
         }
        // --- Assign to uniform EVERY time ---
        uniforms.uTexture.value = currentTextureRef.current;
        uniforms.uIsStaticImage.value = true;
        planeMeshRef.current.material.needsUpdate = true;

        // Scale plane
        if (imgWidth > 0) {
             fitPlaneToCamera(imgWidth, imgHeight);
             planeMeshRef.current.scale.x = Math.abs(planeMeshRef.current.scale.x); // Ensure non-mirrored
        } else {
             planeMeshRef.current.scale.set(0,0,0); // Hide if no dimensions
        }
    },
    clearCanvas: () => {
        console.log("Handle: Clearing canvas source.");
        if (planeMeshRef.current && planeMeshRef.current.material.uniforms.uTexture) {
             currentTextureRef.current?.dispose(); // Dispose current texture
             currentTextureRef.current = null;
             planeMeshRef.current.material.uniforms.uTexture.value = null;
             planeMeshRef.current.material.needsUpdate = true;
             planeMeshRef.current.scale.set(0,0,0); // Hide plane
        }
    }
  }));

  // --- JSX ---
  return ( <canvas ref={canvasRef} className={`renderer-canvas ${className || ''}`} style={{ display: 'block', width: '100%', height: '100%' }} /> );
});

TryOnRenderer.displayName = 'TryOnRenderer';
export default TryOnRenderer;