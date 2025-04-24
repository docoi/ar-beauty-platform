// src/components/TryOnRenderer.jsx - Update Uniforms in Render Loop

import React, { useRef, useImperativeHandle, forwardRef, useEffect, useCallback } from 'react';
import * as THREE from 'three';

console.log(`Using Three.js revision: ${THREE.REVISION}`);

const TryOnRenderer = forwardRef(({ videoWidth, videoHeight, className }, ref) => {
  const canvasRef = useRef(null);
  const rendererInstanceRef = useRef(null);
  const sceneRef = useRef(null);
  const cameraRef = useRef(null);
  const planeMeshRef = useRef(null);
  const videoTextureRef = useRef(null); // Keep separate refs
  const imageTextureRef = useRef(null);
  const isInitialized = useRef(false);
  const currentSourceElement = useRef(null); // Stores the CURRENT source (video OR image)
  const currentResults = useRef(null);
  const animationFrameHandle = useRef(null);

  // --- Shaders with Correction ---
  const vertexShader = `varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;
  const fragmentShader = `uniform sampler2D uTexture; uniform bool uIsStaticImage; uniform float uBrightness; uniform float uContrast; varying vec2 vUv; vec3 cAdjust(vec3 c, float v){return 0.5+v*(c-0.5);} void main() { vec4 tColor = vec4(0.3, 0.3, 0.3, 1.0); bool textureValid = uTexture != sampler2D(0); if (textureValid) { tColor = texture2D(uTexture, vUv); } if (uIsStaticImage && textureValid) { tColor.rgb *= uBrightness; tColor.rgb = cAdjust(tColor.rgb, uContrast); tColor.rgb = clamp(tColor.rgb, 0.0, 1.0); } gl_FragColor = tColor; }`; // Dark gray default

  // --- Handle Resizing ---
  const handleResize = useCallback(() => { /* ... */
      const canvas = canvasRef.current; if (!rendererInstanceRef.current || !cameraRef.current || !canvas) return; const newWidth = canvas.clientWidth; const newHeight = canvas.clientHeight; if (newWidth === 0 || newHeight === 0) return; const currentSize = rendererInstanceRef.current.getSize(new THREE.Vector2()); if (currentSize.x === newWidth && currentSize.y === newHeight) return; rendererInstanceRef.current.setSize(newWidth, newHeight); cameraRef.current.left = -newWidth / 2; cameraRef.current.right = newWidth / 2; cameraRef.current.top = newHeight / 2; cameraRef.current.bottom = -newHeight / 2; cameraRef.current.updateProjectionMatrix();
  }, []);

  // --- Initialize Scene ---
  const initThreeScene = useCallback(() => { /* ... */
      if (!canvasRef.current || isInitialized.current) return; console.log("DEBUG: initThreeScene START"); try { const canvas = canvasRef.current; const initialWidth = canvas.clientWidth || 640; const initialHeight = canvas.clientHeight || 480; sceneRef.current = new THREE.Scene(); cameraRef.current = new THREE.OrthographicCamera(-initialWidth / 2, initialWidth / 2, initialHeight / 2, -initialHeight / 2, 0.1, 10); cameraRef.current.position.z = 1; sceneRef.current.add(cameraRef.current); rendererInstanceRef.current = new THREE.WebGLRenderer({ canvas: canvas, antialias: true, alpha: true }); rendererInstanceRef.current.setSize(initialWidth, initialHeight); rendererInstanceRef.current.setPixelRatio(window.devicePixelRatio); rendererInstanceRef.current.outputColorSpace = THREE.SRGBColorSpace; const planeGeometry = new THREE.PlaneGeometry(1, 1); const planeMaterial = new THREE.ShaderMaterial({ vertexShader: vertexShader, fragmentShader: fragmentShader, uniforms: { uTexture: { value: null }, uIsStaticImage: { value: false }, uBrightness: { value: 1.5 }, uContrast: { value: 1.3 }, }, side: THREE.DoubleSide, transparent: false, }); planeMeshRef.current = new THREE.Mesh(planeGeometry, planeMaterial); planeMeshRef.current.position.z = 0; planeMeshRef.current.scale.set(1, 1, 1); sceneRef.current.add(planeMeshRef.current); isInitialized.current = true; console.log("DEBUG: Scene initialized with ShaderMaterial."); handleResize(); } catch (error) { console.error("DEBUG: initThreeScene ERROR:", error); }
  }, [handleResize, vertexShader, fragmentShader]);

  // --- Effect for Initial Setup / Resize Observer ---
  useEffect(() => { /* ... */
      initThreeScene(); let resizeObserver; if (canvasRef.current) { resizeObserver = new ResizeObserver(() => { handleResize(); }); resizeObserver.observe(canvasRef.current); } return () => { console.log("DEBUG: Cleanup running..."); resizeObserver?.disconnect(); cancelAnimationFrame(animationFrameHandle.current); isInitialized.current = false; videoTextureRef.current?.dispose(); imageTextureRef.current?.dispose(); planeMeshRef.current?.geometry?.dispose(); planeMeshRef.current?.material?.map?.dispose(); /* Might be redundant */ planeMeshRef.current?.material?.dispose(); rendererInstanceRef.current?.dispose(); /* Clear refs */ videoTextureRef.current = null; imageTextureRef.current = null; planeMeshRef.current = null; sceneRef.current = null; cameraRef.current = null; rendererInstanceRef.current = null; currentSourceElement.current = null; currentResults.current = null;};
  }, [initThreeScene, handleResize]);

  // --- Scale Plane ---
  const fitPlaneToCamera = useCallback((textureWidth, textureHeight) => { /* ... */
      if (!cameraRef.current || !planeMeshRef.current || !textureWidth || !textureHeight) return; const canvas = canvasRef.current; if (!canvas) return; const cameraWidth = canvas.clientWidth; const cameraHeight = canvas.clientHeight; if (cameraWidth === 0 || cameraHeight === 0) return; const cameraAspect = cameraWidth / cameraHeight; const textureAspect = textureWidth / textureHeight; let scaleX, scaleY; if (cameraAspect > textureAspect) { scaleY = cameraHeight; scaleX = scaleY * textureAspect; } else { scaleX = cameraWidth; scaleY = scaleX / textureAspect; } planeMeshRef.current.scale.y = scaleY; planeMeshRef.current.scale.x = scaleX;
  }, []);

  // --- Render Loop ---
  const renderLoop = useCallback(() => {
       animationFrameHandle.current = requestAnimationFrame(renderLoop);
       if (!isInitialized.current || !rendererInstanceRef.current || !sceneRef.current || !cameraRef.current || !planeMeshRef.current || !planeMeshRef.current.material?.uniforms) return;

       const sourceElement = currentSourceElement.current; // Get latest source
       const uniforms = planeMeshRef.current.material.uniforms;
       let sourceWidth = 0, sourceHeight = 0;
       let isVideo = sourceElement instanceof HTMLVideoElement;
       let isImage = sourceElement instanceof HTMLImageElement;
       let currentTexture = null; // Texture to assign this frame

       // --- 1. Determine Source and Texture ---
       if (isVideo && sourceElement.readyState >= 2) {
           sourceWidth = sourceElement.videoWidth; sourceHeight = sourceElement.videoHeight;
           // Use existing video texture if image matches, otherwise create new
           if (videoTextureRef.current?.image === sourceElement) {
               currentTexture = videoTextureRef.current;
           } else {
               videoTextureRef.current?.dispose(); // Dispose old one
               videoTextureRef.current = new THREE.VideoTexture(sourceElement);
               videoTextureRef.current.colorSpace = THREE.SRGBColorSpace;
               currentTexture = videoTextureRef.current;
               console.log("RenderLoop: Created new Video Texture");
           }
           uniforms.uIsStaticImage.value = false;
       } else if (isImage && sourceElement.complete && sourceElement.naturalWidth > 0) {
            sourceWidth = sourceElement.naturalWidth; sourceHeight = sourceElement.naturalHeight;
            // Use existing image texture if image matches, otherwise create new
            if (imageTextureRef.current?.image === sourceElement) {
                currentTexture = imageTextureRef.current;
                currentTexture.needsUpdate = true; // Image texture needs update flag
            } else {
                imageTextureRef.current?.dispose(); // Dispose old one
                imageTextureRef.current = new THREE.Texture(sourceElement);
                imageTextureRef.current.colorSpace = THREE.SRGBColorSpace;
                imageTextureRef.current.needsUpdate = true;
                currentTexture = imageTextureRef.current;
                console.log("RenderLoop: Created new Image Texture");
            }
           uniforms.uIsStaticImage.value = true;
       } else {
           // No valid source
           uniforms.uIsStaticImage.value = false; // Default to false if no source
       }

       // --- 2. Update Uniforms ---
       if (uniforms.uTexture.value !== currentTexture) {
            console.log("RenderLoop: Updating uTexture uniform.");
            uniforms.uTexture.value = currentTexture; // Assign determined texture (or null)
            planeMeshRef.current.material.needsUpdate = true; // Update material when texture changes
       }
       // Update brightness/contrast only if static image
       // Using fixed values for now from initialization
       // uniforms.uBrightness.value = uniforms.uIsStaticImage.value ? 1.5 : 1.0;
       // uniforms.uContrast.value = uniforms.uIsStaticImage.value ? 1.3 : 1.0;

       // --- 3. Update Plane Scale & Mirroring ---
       if (currentTexture && sourceWidth > 0 && sourceHeight > 0) {
            fitPlaneToCamera(sourceWidth, sourceHeight);
            planeMeshRef.current.scale.x = Math.abs(planeMeshRef.current.scale.x) * (isVideo ? -1 : 1);
       } else {
            if (planeMeshRef.current.scale.x !== 0) { planeMeshRef.current.scale.set(0,0,0); } // Hide plane if no texture
       }

       // --- 4. Render Scene ---
       rendererInstanceRef.current.render(sceneRef.current, cameraRef.current);

  }, [fitPlaneToCamera]); // Include dependency

  // --- Start Render Loop ---
  useEffect(() => { /* ... start loop ... */ if (isInitialized.current) { cancelAnimationFrame(animationFrameHandle.current); animationFrameHandle.current = requestAnimationFrame(renderLoop); } }, [renderLoop]);

  // --- Expose Methods (Simplified - just store source and results) ---
  useImperativeHandle(ref, () => ({
    renderResults: (videoElement, results) => { currentSourceElement.current = videoElement; currentResults.current = results; },
    renderStaticImageResults: (imageElement, results) => { currentSourceElement.current = imageElement; currentResults.current = results; },
    clearCanvas: () => { currentSourceElement.current = null; currentResults.current = null; }
  }));

  // --- JSX ---
  return ( <canvas ref={canvasRef} className={`renderer-canvas ${className || ''}`} style={{ display: 'block', width: '100%', height: '100%' }} /> );
});

TryOnRenderer.displayName = 'TryOnRenderer';
export default TryOnRenderer;