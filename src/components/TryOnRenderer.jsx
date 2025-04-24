// src/components/TryOnRenderer.jsx - AGGRESSIVE DEBUGGING

import React, { useRef, useImperativeHandle, forwardRef, useEffect, useCallback } from 'react';
import * as THREE from 'three';

console.log(`Using Three.js revision: ${THREE.REVISION}`);

const TryOnRenderer = forwardRef(({ videoWidth, videoHeight, className }, ref) => {
  const canvasRef = useRef(null);
  const rendererInstanceRef = useRef(null);
  const sceneRef = useRef(null);
  const cameraRef = useRef(null);
  const planeMeshRef = useRef(null);
  const isInitialized = useRef(false);
  const currentSourceElement = useRef(null);
  const animationFrameHandle = useRef(null);
  const loopCounter = useRef(0); // Frame counter

  // --- Minimal Shaders ---
  const minimalVertexShader = `
    void main() { gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
  `;
  const debugFragmentShader = `
    uniform float uTime; // Time uniform for visual change
    void main() {
      // Output a color that changes over time to prove shader is running
      gl_FragColor = vec4(abs(sin(uTime * 0.5)), 0.5, abs(cos(uTime * 0.5)), 1.0);
    }
  `;

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
      const canvas = canvasRef.current;
      const initialWidth = canvas.clientWidth || 300; const initialHeight = canvas.clientHeight || 150; // Smaller default
      sceneRef.current = new THREE.Scene();
      // Make background obvious
      sceneRef.current.background = new THREE.Color(0x888888); // Gray background
      cameraRef.current = new THREE.OrthographicCamera(-initialWidth / 2, initialWidth / 2, initialHeight / 2, -initialHeight / 2, 0.1, 10); // Near/Far adjusted
      cameraRef.current.position.z = 1; sceneRef.current.add(cameraRef.current);
      rendererInstanceRef.current = new THREE.WebGLRenderer({ canvas: canvas, antialias: true }); // Remove alpha for now
      rendererInstanceRef.current.setSize(initialWidth, initialHeight); rendererInstanceRef.current.setPixelRatio(window.devicePixelRatio);
      // No color space setting for debug shader

      // *** Use debug shader, simple plane ***
      const planeGeometry = new THREE.PlaneGeometry(100, 100); // Fixed size geometry for testing
      const planeMaterial = new THREE.ShaderMaterial({
          vertexShader: minimalVertexShader, fragmentShader: debugFragmentShader,
          uniforms: { uTime: { value: 0.0 } }, // Time uniform
      });
      planeMeshRef.current = new THREE.Mesh(planeGeometry, planeMaterial);
      planeMeshRef.current.position.z = 0; // Directly in front of camera
      sceneRef.current.add(planeMeshRef.current);

      isInitialized.current = true; console.log("DEBUG: initThreeScene SUCCESS");
      handleResize(); // Ensure size is set
    } catch (error) { console.error("DEBUG: initThreeScene ERROR:", error); }
  }, [handleResize, minimalVertexShader, debugFragmentShader]);

  // --- Effect for Initial Setup / Resize ---
  useEffect(() => {
    initThreeScene();
    let resizeObserver; if (canvasRef.current) { resizeObserver = new ResizeObserver(() => { handleResize(); }); resizeObserver.observe(canvasRef.current); }
    return () => { console.log("DEBUG: Cleanup running..."); resizeObserver?.disconnect(); cancelAnimationFrame(animationFrameHandle.current); isInitialized.current = false; planeMeshRef.current?.geometry?.dispose(); planeMeshRef.current?.material?.dispose(); rendererInstanceRef.current?.dispose(); /* Clear refs */ };
  }, [initThreeScene, handleResize]);

  // --- Minimal Render Loop ---
  const renderLoop = useCallback((time) => {
       animationFrameHandle.current = requestAnimationFrame(renderLoop); // Schedule next

       loopCounter.current++; // Increment counter

       if (!isInitialized.current || !rendererInstanceRef.current || !sceneRef.current || !cameraRef.current || !planeMeshRef.current?.material?.uniforms?.uTime) {
          if (loopCounter.current % 60 === 0) console.log("DEBUG Loop: Waiting for init..."); // Log periodically
          return;
       }

       // Log every 60 frames to reduce noise
       if (loopCounter.current % 60 === 0) {
           console.log(`DEBUG Loop: Running frame ${loopCounter.current}`);
           console.log(`DEBUG Loop: Canvas Size: ${canvasRef.current?.clientWidth}x${canvasRef.current?.clientHeight}`);
           console.log(`DEBUG Loop: Renderer Size: ${rendererInstanceRef.current?.getSize(new THREE.Vector2())?.x}x${rendererInstanceRef.current?.getSize(new THREE.Vector2())?.y}`);
           console.log(`DEBUG Loop: Camera: L=${cameraRef.current?.left} R=${cameraRef.current?.right} T=${cameraRef.current?.top} B=${cameraRef.current?.bottom}`);
           console.log(`DEBUG Loop: Plane Scale: ${planeMeshRef.current?.scale.x}x${planeMeshRef.current?.scale.y}`);
           console.log(`DEBUG Loop: Source Element: ${currentSourceElement.current?.tagName}`);
       }

       // --- Minimal Logic ---
       // 1. Update time uniform for debug shader
       planeMeshRef.current.material.uniforms.uTime.value = time * 0.001; // Convert ms to seconds

       // 2. Ensure plane is visible (simple scale)
       planeMeshRef.current.scale.set(1,1,1); // Keep scale fixed for now

       // 3. RENDER!
       try {
           rendererInstanceRef.current.render(sceneRef.current, cameraRef.current);
       } catch (renderError) {
            console.error("DEBUG Loop: RENDER ERROR!", renderError);
            cancelAnimationFrame(animationFrameHandle.current); // Stop loop on error
       }

  }, []); // No dependencies needed for this minimal loop


  // --- Start Render Loop ---
  useEffect(() => {
    console.log("DEBUG: UseEffect starting render loop.");
    loopCounter.current = 0; // Reset counter
    cancelAnimationFrame(animationFrameHandle.current); // Clear any previous
    animationFrameHandle.current = requestAnimationFrame(renderLoop);
  }, [renderLoop]);

  // --- Expose Methods (Do Nothing for now) ---
  useImperativeHandle(ref, () => ({
    renderResults: (videoElement, results) => { currentSourceElement.current = videoElement; /* NOOP */ },
    renderStaticImageResults: (imageElement, results) => { currentSourceElement.current = imageElement; console.log("DEBUG: renderStaticImageResults called, source set."); /* NOOP */ },
    clearCanvas: () => { currentSourceElement.current = null; /* NOOP */ }
  }));

  // --- JSX ---
  return (
    <canvas
      ref={canvasRef}
      className={`renderer-canvas ${className || ''}`}
      // Add explicit CSS background for visibility
      style={{ display: 'block', width: '100%', height: '100%', backgroundColor: '#444' }}
    />
  );
});

TryOnRenderer.displayName = 'TryOnRenderer';
export default TryOnRenderer;