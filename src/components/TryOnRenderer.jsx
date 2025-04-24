// src/components/TryOnRenderer.jsx - Restore Texture Logic, Simplify Update

import React, { useRef, useImperativeHandle, forwardRef, useEffect, useCallback } from 'react';
import * as THREE from 'three';

console.log(`Using Three.js revision: ${THREE.REVISION}`);

const TryOnRenderer = forwardRef(({ videoWidth, videoHeight, className }, ref) => {
  const canvasRef = useRef(null);
  const rendererInstanceRef = useRef(null);
  const sceneRef = useRef(null);
  const cameraRef = useRef(null);
  const planeMeshRef = useRef(null);    // Ref to the Mesh object
  const videoTextureRef = useRef(null); // Keep separate refs for disposal
  const imageTextureRef = useRef(null);
  const isInitialized = useRef(false);
  const animationFrameHandle = useRef(null);

  // --- Shader Definitions ---
  const vertexShader = `
    varying vec2 vUv;
    void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
  `;
  const fragmentShader = `
    uniform sampler2D uTexture;
    uniform bool uIsStaticImage;
    uniform float uBrightness;
    uniform float uContrast;
    varying vec2 vUv;

    vec3 contrastAdjust(vec3 color, float value) { return 0.5 + value * (color - 0.5); }

    void main() {
      if (uTexture == sampler2D(0)) { gl_FragColor = vec4(0.8, 0.8, 0.8, 1.0); return; } // Gray if no texture
      vec4 textureColor = texture2D(uTexture, vUv);
      if (uIsStaticImage) {
        textureColor.rgb *= uBrightness;
        textureColor.rgb = contrastAdjust(textureColor.rgb, uContrast);
        textureColor.rgb = clamp(textureColor.rgb, 0.0, 1.0);
      }
      gl_FragColor = textureColor;
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
          vertexShader: vertexShader, fragmentShader: fragmentShader,
          uniforms: {
              uTexture: { value: null }, uIsStaticImage: { value: false },
              uBrightness: { value: 1.2 }, uContrast: { value: 1.1 },
          },
          side: THREE.DoubleSide, transparent: false,
      });
      planeMeshRef.current = new THREE.Mesh(planeGeometry, planeMaterial);
      planeMeshRef.current.position.z = 0; planeMeshRef.current.scale.set(1, 1, 1);
      sceneRef.current.add(planeMeshRef.current);
      isInitialized.current = true; console.log("Renderer: Scene initialized.");
      handleResize();
    } catch (error) { console.error("Error initializing Three.js:", error); }
  }, [handleResize, vertexShader, fragmentShader]); // Include shaders

  // --- Effect for Initial Setup / Resize Observer ---
  useEffect(() => {
    initThreeScene();
    let resizeObserver; if (canvasRef.current) { resizeObserver = new ResizeObserver(() => { handleResize(); }); resizeObserver.observe(canvasRef.current); }
    return () => { /* ... cleanup ... */ console.log("Renderer: Cleaning up..."); resizeObserver?.disconnect(); cancelAnimationFrame(animationFrameHandle.current); isInitialized.current = false; videoTextureRef.current?.dispose(); imageTextureRef.current?.dispose(); planeMeshRef.current?.material?.uniforms?.uTexture?.value?.dispose(); planeMeshRef.current?.geometry?.dispose(); planeMeshRef.current?.material?.dispose(); rendererInstanceRef.current?.dispose(); /* Clear refs */ };
  }, [initThreeScene, handleResize]);


  // --- Scale Plane ---
  const fitPlaneToCamera = useCallback((textureWidth, textureHeight) => {
      if (!cameraRef.current || !planeMeshRef.current || !textureWidth || !textureHeight) return;
      const canvas = canvasRef.current; if (!canvas) return;
      const cameraWidth = canvas.clientWidth; const cameraHeight = canvas.clientHeight;
      if (cameraWidth === 0 || cameraHeight === 0) return;
      const cameraAspect = cameraWidth / cameraHeight; const textureAspect = textureWidth / textureHeight;
      let scaleX, scaleY;
      if (cameraAspect > textureAspect) { scaleY = cameraHeight; scaleX = scaleY * textureAspect; }
      else { scaleX = cameraWidth; scaleY = scaleX / textureAspect; }
      planeMeshRef.current.scale.y = scaleY; planeMeshRef.current.scale.x = scaleX;
  }, []);


  // --- Render Loop ---
  const renderLoop = useCallback(() => {
       animationFrameHandle.current = requestAnimationFrame(renderLoop);
       if (!isInitialized.current || !rendererInstanceRef.current || !sceneRef.current || !cameraRef.current || !planeMeshRef.current || !planeMeshRef.current.material?.uniforms) return;

       // --- Update Uniforms ---
       // (We'll set the texture directly in the imperative handles now)
       // TODO: Update effect uniforms based on currentResults.current

       // --- Render Scene ---
       rendererInstanceRef.current.render(sceneRef.current, cameraRef.current);

  }, []); // No dependency needed here


  // --- Start Render Loop ---
  useEffect(() => {
    console.log("Renderer: UseEffect starting render loop.");
    if (isInitialized.current) {
        cancelAnimationFrame(animationFrameHandle.current);
        animationFrameHandle.current = requestAnimationFrame(renderLoop);
    } else { console.warn("Render loop start skipped."); }
  }, [renderLoop]);


  // --- Expose Methods (Update Texture/Uniforms Directly) ---
  useImperativeHandle(ref, () => ({
    renderResults: (videoElement, results) => {
        // Called every frame in Mirror mode
        if (!planeMeshRef.current || !planeMeshRef.current.material.uniforms) return;

        const uniforms = planeMeshRef.current.material.uniforms;

        // Create/update video texture ONLY if needed
        if (uniforms.uTexture.value !== videoTextureRef.current || !videoTextureRef.current || videoTextureRef.current.image !== videoElement) {
            console.log("Renderer Handle: Creating/Updating Video Texture");
            videoTextureRef.current?.dispose(); // Dispose previous ref
            imageTextureRef.current?.dispose(); // Dispose image ref if switching
            imageTextureRef.current = null;
            videoTextureRef.current = new THREE.VideoTexture(videoElement);
            videoTextureRef.current.colorSpace = THREE.SRGBColorSpace;
            uniforms.uTexture.value = videoTextureRef.current; // Assign to uniform
            planeMeshRef.current.material.needsUpdate = true; // Important? Maybe not for video.
        }
        uniforms.uIsStaticImage.value = false; // Ensure flag is correct

        // Scale plane based on video dimensions
        if (videoElement.videoWidth > 0) {
             fitPlaneToCamera(videoElement.videoWidth, videoElement.videoHeight);
             planeMeshRef.current.scale.x *= -1; // Apply mirror
        }
        // Store results for potential use in renderLoop's TODO section
        currentResults.current = results;
    },
    renderStaticImageResults: (imageElement, results) => {
        // Called ONCE after selfie detection finishes
        console.log("Renderer Handle: renderStaticImageResults called.");
        if (!planeMeshRef.current || !planeMeshRef.current.material.uniforms || !imageElement) return;

        const uniforms = planeMeshRef.current.material.uniforms;

        console.log("Renderer Handle: Creating/Updating Image Texture");
        videoTextureRef.current?.dispose(); // Dispose video ref if switching
        videoTextureRef.current = null;
        imageTextureRef.current?.dispose(); // Dispose previous image ref
        imageTextureRef.current = new THREE.Texture(imageElement);
        imageTextureRef.current.colorSpace = THREE.SRGBColorSpace;
        imageTextureRef.current.needsUpdate = true; // Image needs update flag
        uniforms.uTexture.value = imageTextureRef.current; // Assign to uniform
        uniforms.uIsStaticImage.value = true; // Set flag
        planeMeshRef.current.material.needsUpdate = true; // Material needs update

        // Scale plane based on image dimensions
        if (imageElement.naturalWidth > 0) {
             fitPlaneToCamera(imageElement.naturalWidth, imageElement.naturalHeight);
             planeMeshRef.current.scale.x = Math.abs(planeMeshRef.current.scale.x); // Ensure non-mirrored
        }
         // Store results
         currentResults.current = results;
    },
    clearCanvas: () => {
        console.log("Renderer Handle: Clearing canvas source.");
        if (planeMeshRef.current && planeMeshRef.current.material.uniforms.uTexture) {
             videoTextureRef.current?.dispose();
             imageTextureRef.current?.dispose();
             videoTextureRef.current = null;
             imageTextureRef.current = null;
             planeMeshRef.current.material.uniforms.uTexture.value = null;
             planeMeshRef.current.material.needsUpdate = true;
             planeMeshRef.current.scale.set(0,0,0); // Hide plane
        }
        currentSourceElement.current = null; // Keep this for parent components
        currentResults.current = null;
    }
  }));


  // --- JSX ---
  return (
    <canvas
      ref={canvasRef}
      className={`renderer-canvas ${className || ''}`}
      style={{ display: 'block', width: '100%', height: '100%' }}
    />
  );
});

TryOnRenderer.displayName = 'TryOnRenderer';
export default TryOnRenderer;