// src/components/TryOnRenderer.jsx - Restore Static Selfie Rendering with Shader Correction

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
  const animationFrameHandle = useRef(null);

  // --- Shaders with Correction ---
  const vertexShader = `
    varying vec2 vUv;
    void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
  `;
  const fragmentShader = `
    uniform sampler2D uTexture;
    uniform bool uIsStaticImage; // Flag for correction
    uniform float uBrightness;    // Correction factor
    uniform float uContrast;      // Correction factor
    varying vec2 vUv;

    vec3 contrastAdjust(vec3 color, float value) { return 0.5 + value * (color - 0.5); }

    void main() {
      vec4 textureColor = vec4(0.8, 0.8, 0.8, 1.0); // Default gray
      // Check if texture uniform seems valid before sampling
      bool textureValid = uTexture != sampler2D(0); // Basic check

      if (textureValid) {
         textureColor = texture2D(uTexture, vUv);
      }

      // Apply correction only if it's the static image AND texture is valid
      if (uIsStaticImage && textureValid) {
        textureColor.rgb *= uBrightness;
        textureColor.rgb = contrastAdjust(textureColor.rgb, uContrast);
        textureColor.rgb = clamp(textureColor.rgb, 0.0, 1.0);
      }

      // If texture was invalid, output default gray, otherwise output potentially corrected color
      gl_FragColor = textureColor;
    }
  `;

  // --- Handle Resizing ---
  const handleResize = useCallback(() => { /* ... */
      const canvas = canvasRef.current; if (!rendererInstanceRef.current || !cameraRef.current || !canvas) return; const newWidth = canvas.clientWidth; const newHeight = canvas.clientHeight; if (newWidth === 0 || newHeight === 0) return; const currentSize = rendererInstanceRef.current.getSize(new THREE.Vector2()); if (currentSize.x === newWidth && currentSize.y === newHeight) return; /* console.log(`DEBUG: Resizing -> ${newWidth}x${newHeight}`); */ rendererInstanceRef.current.setSize(newWidth, newHeight); cameraRef.current.left = -newWidth / 2; cameraRef.current.right = newWidth / 2; cameraRef.current.top = newHeight / 2; cameraRef.current.bottom = -newHeight / 2; cameraRef.current.updateProjectionMatrix();
  }, []);

  // --- Initialize Scene ---
  const initThreeScene = useCallback(() => {
    if (!canvasRef.current || isInitialized.current) return;
    console.log("DEBUG: initThreeScene START");
    try {
      const canvas = canvasRef.current; const initialWidth = canvas.clientWidth || 640; const initialHeight = canvas.clientHeight || 480;
      sceneRef.current = new THREE.Scene(); cameraRef.current = new THREE.OrthographicCamera(-initialWidth / 2, initialWidth / 2, initialHeight / 2, -initialHeight / 2, 0.1, 10); cameraRef.current.position.z = 1; sceneRef.current.add(cameraRef.current); rendererInstanceRef.current = new THREE.WebGLRenderer({ canvas: canvas, antialias: true, alpha: true }); rendererInstanceRef.current.setSize(initialWidth, initialHeight); rendererInstanceRef.current.setPixelRatio(window.devicePixelRatio); rendererInstanceRef.current.outputColorSpace = THREE.SRGBColorSpace;
      const planeGeometry = new THREE.PlaneGeometry(1, 1);
      // *** Restore ShaderMaterial with correction uniforms ***
      const planeMaterial = new THREE.ShaderMaterial({
          vertexShader: vertexShader, fragmentShader: fragmentShader,
          uniforms: {
              uTexture: { value: null },
              uIsStaticImage: { value: false },
              uBrightness: { value: 1.5 }, // Start with reasonably high defaults
              uContrast: { value: 1.3 },
          },
          side: THREE.DoubleSide, transparent: false,
      });
      planeMeshRef.current = new THREE.Mesh(planeGeometry, planeMaterial); planeMeshRef.current.position.z = 0; planeMeshRef.current.scale.set(1, 1, 1); sceneRef.current.add(planeMeshRef.current);
      isInitialized.current = true; console.log("DEBUG: Scene initialized with ShaderMaterial."); handleResize();
    } catch (error) { console.error("DEBUG: initThreeScene ERROR:", error); }
  }, [handleResize, vertexShader, fragmentShader]); // Add shaders back

  // --- Effect for Initial Setup / Resize Observer ---
  useEffect(() => { /* ... */
    initThreeScene(); let resizeObserver; if (canvasRef.current) { resizeObserver = new ResizeObserver(() => { handleResize(); }); resizeObserver.observe(canvasRef.current); }
    return () => { /* ... cleanup ... */ console.log("DEBUG: Cleanup running..."); resizeObserver?.disconnect(); cancelAnimationFrame(animationFrameHandle.current); isInitialized.current = false; videoTextureRef.current?.dispose(); imageTextureRef.current?.dispose(); planeMeshRef.current?.geometry?.dispose(); planeMeshRef.current?.material?.map?.dispose(); planeMeshRef.current?.material?.dispose(); rendererInstanceRef.current?.dispose(); /* Clear refs */ videoTextureRef.current = null; imageTextureRef.current = null; planeMeshRef.current = null; sceneRef.current = null; cameraRef.current = null; rendererInstanceRef.current = null; };
  }, [initThreeScene, handleResize]);

  // --- Scale Plane ---
  const fitPlaneToCamera = useCallback((textureWidth, textureHeight) => { /* ... */
      if (!cameraRef.current || !planeMeshRef.current || !textureWidth || !textureHeight) return; const canvas = canvasRef.current; if (!canvas) return; const cameraWidth = canvas.clientWidth; const cameraHeight = canvas.clientHeight; if (cameraWidth === 0 || cameraHeight === 0) return; const cameraAspect = cameraWidth / cameraHeight; const textureAspect = textureWidth / textureHeight; let scaleX, scaleY; if (cameraAspect > textureAspect) { scaleY = cameraHeight; scaleX = scaleY * textureAspect; } else { scaleX = cameraWidth; scaleY = scaleX / textureAspect; } planeMeshRef.current.scale.y = scaleY; planeMeshRef.current.scale.x = scaleX;
  }, []);

  // --- Render Loop ---
  const renderLoop = useCallback(() => {
       animationFrameHandle.current = requestAnimationFrame(renderLoop);
       if (isInitialized.current && rendererInstanceRef.current && sceneRef.current && cameraRef.current) {
           try { rendererInstanceRef.current.render(sceneRef.current, cameraRef.current); }
           catch (e) { console.error("!!! RENDER LOOP ERROR:", e); cancelAnimationFrame(animationFrameHandle.current); }
       }
  }, []);

  // --- Start Render Loop ---
  useEffect(() => { if (isInitialized.current) { cancelAnimationFrame(animationFrameHandle.current); animationFrameHandle.current = requestAnimationFrame(renderLoop); } }, [renderLoop]);

  // --- Expose Methods ---
  useImperativeHandle(ref, () => ({
    renderResults: (videoElement, results) => { // For Mirror
        if (!planeMeshRef.current || !planeMeshRef.current.material.uniforms || !videoElement || videoElement.readyState < 2) return;
        const uniforms = planeMeshRef.current.material.uniforms;
        const videoW = videoElement.videoWidth; const videoH = videoElement.videoHeight;

        try {
            // Update video texture if needed
            if (uniforms.uTexture.value !== videoTextureRef.current || !videoTextureRef.current || videoTextureRef.current.image !== videoElement) {
                // console.log("Handle: Mirror - Assigning Video Texture"); // Reduce noise
                videoTextureRef.current?.dispose(); imageTextureRef.current?.dispose(); imageTextureRef.current = null;
                videoTextureRef.current = new THREE.VideoTexture(videoElement);
                videoTextureRef.current.colorSpace = THREE.SRGBColorSpace;
                uniforms.uTexture.value = videoTextureRef.current;
                 planeMeshRef.current.material.needsUpdate = true; // Update material state
            }
            uniforms.uIsStaticImage.value = false; // Set flag

            // Scale and mirror plane
            if (videoW > 0) { fitPlaneToCamera(videoW, videoH); planeMeshRef.current.scale.x = -Math.abs(planeMeshRef.current.scale.x); }
            else { planeMeshRef.current.scale.set(0,0,0); }

        } catch (e) { console.error("!!! ERROR inside renderResults:", e); }
    },
    // *** RESTORE renderStaticImageResults LOGIC ***
    renderStaticImageResults: (imageElement, results) => {
        console.log("Handle: renderStaticImageResults.");
        if (!planeMeshRef.current || !planeMeshRef.current.material.uniforms || !imageElement || !imageElement.complete || imageElement.naturalWidth === 0) return;
        const uniforms = planeMeshRef.current.material.uniforms;
        const imgWidth = imageElement.naturalWidth; const imgHeight = imageElement.naturalHeight;

        try {
            // Update image texture if needed
            if (uniforms.uTexture.value !== imageTextureRef.current || !imageTextureRef.current || imageTextureRef.current.image !== imageElement) {
                console.log("Handle: Selfie - Assigning Image Texture");
                videoTextureRef.current?.dispose(); videoTextureRef.current = null;
                imageTextureRef.current?.dispose();
                imageTextureRef.current = new THREE.Texture(imageElement);
                imageTextureRef.current.colorSpace = THREE.SRGBColorSpace;
                imageTextureRef.current.needsUpdate = true; // Image needs this flag
                uniforms.uTexture.value = imageTextureRef.current;
                planeMeshRef.current.material.needsUpdate = true; // Update material state
            } else if (imageTextureRef.current) {
                imageTextureRef.current.needsUpdate = true; // Still needs update if same image
            }

            uniforms.uIsStaticImage.value = true; // Set flag for shader correction
            // Brightness/Contrast are set by default in uniforms or will be updated by sliders later

            // Scale plane (no mirroring)
            if (imgWidth > 0) {
                fitPlaneToCamera(imgWidth, imgHeight);
                planeMeshRef.current.scale.x = Math.abs(planeMeshRef.current.scale.x); // Ensure non-mirrored
            } else {
                planeMeshRef.current.scale.set(0,0,0);
            }
        } catch(e) {
            console.error("!!! ERROR inside renderStaticImageResults:", e);
        }
    },
    clearCanvas: () => { /* ... Keep clearCanvas method ... */
        console.log("DEBUG: clearCanvas called.");
         const uniforms = planeMeshRef.current?.material?.uniforms;
         if (planeMeshRef.current?.material) {
             // Dispose the texture held by the uniform first
             if (uniforms?.uTexture?.value) {
                 uniforms.uTexture.value.dispose();
             }
             uniforms.uTexture.value = null; // Clear uniform
             planeMeshRef.current.material.needsUpdate = true;
             planeMeshRef.current.scale.set(0,0,0); // Hide plane
         }
         // Dispose texture refs
         videoTextureRef.current?.dispose(); videoTextureRef.current = null;
         imageTextureRef.current?.dispose(); imageTextureRef.current = null;
    }
  }));

  // --- JSX ---
  return ( <canvas ref={canvasRef} className={`renderer-canvas ${className || ''}`} style={{ display: 'block', width: '100%', height: '100%', backgroundColor: '#444' }} /> );
});

TryOnRenderer.displayName = 'TryOnRenderer';
export default TryOnRenderer;