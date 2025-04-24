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
  const planeMeshRef = useRef(null);    // Ref to the Mesh object
  const isInitialized = useRef(false);
  const currentSourceElement = useRef(null); // Stores the CURRENT source (video OR image)
  const currentResults = useRef(null);
  const animationFrameHandle = useRef(null); // Ref to store animation frame handle

  // --- Shader Definitions ---
  const basicVertexShader = `
    varying vec2 vUv;
    void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
  `;

  // *** MODIFIED FRAGMENT SHADER ***
  const basicFragmentShader = `
    uniform sampler2D uTexture;
    uniform bool uIsStaticImage; // NEW: Flag to indicate source type
    uniform float uBrightness;    // NEW: Brightness adjustment
    uniform float uContrast;      // NEW: Contrast adjustment
    varying vec2 vUv;

    // Helper for contrast
    vec3 contrastAdjust(vec3 color, float value) {
       return 0.5 + value * (color - 0.5);
    }

    void main() {
      // Ensure texture exists before sampling to avoid potential issues
      if (uTexture == sampler2D(0)) { // Check if texture uniform is likely unset (can be implementation dependent)
         gl_FragColor = vec4(0.8, 0.8, 0.8, 1.0); // Output gray if no texture
         return;
      }

      vec4 textureColor = texture2D(uTexture, vUv);

      // Apply correction only if it's the static image
      if (uIsStaticImage) {
        // Apply brightness correction
        textureColor.rgb *= uBrightness;

        // Apply contrast
        textureColor.rgb = contrastAdjust(textureColor.rgb, uContrast);

        // Basic clamp - consider Reinhard tone mapping for better results if needed
        textureColor.rgb = clamp(textureColor.rgb, 0.0, 1.0);
      }

      gl_FragColor = textureColor;
    }
  `;
  // --- END SHADER MODIFICATION ---


  // --- Handle Resizing (Based on Canvas Client Size) ---
  const handleResize = useCallback(() => {
      const canvas = canvasRef.current;
      if (!rendererInstanceRef.current || !cameraRef.current || !canvas) return;
      const newWidth = canvas.clientWidth; const newHeight = canvas.clientHeight;
      if (newWidth === 0 || newHeight === 0) return;
      const currentSize = rendererInstanceRef.current.getSize(new THREE.Vector2());
      // Only resize if necessary, check against current renderer size
      if (currentSize.x === newWidth && currentSize.y === newHeight) return;

      console.log(`Renderer: Resizing canvas client size detected: ${newWidth}x${newHeight}.`);
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
      const initialWidth = canvas.clientWidth || 640; const initialHeight = canvas.clientHeight || 480;
      sceneRef.current = new THREE.Scene();
      cameraRef.current = new THREE.OrthographicCamera(-initialWidth / 2, initialWidth / 2, initialHeight / 2, -initialHeight / 2, 1, 1000);
      cameraRef.current.position.z = 1; sceneRef.current.add(cameraRef.current);
      rendererInstanceRef.current = new THREE.WebGLRenderer({ canvas: canvas, antialias: true, alpha: true });
      rendererInstanceRef.current.setSize(initialWidth, initialHeight);
      rendererInstanceRef.current.setPixelRatio(window.devicePixelRatio);
      rendererInstanceRef.current.outputColorSpace = THREE.SRGBColorSpace;

      const planeGeometry = new THREE.PlaneGeometry(1, 1); // Start with 1x1, scale later
      // *** UPDATE SHADERMATERIAL WITH NEW UNIFORMS ***
      const planeMaterial = new THREE.ShaderMaterial({
          vertexShader: basicVertexShader, fragmentShader: basicFragmentShader,
          uniforms: {
              uTexture: { value: null },
              uIsStaticImage: { value: false }, // Default to false (video)
              uBrightness: { value: 1.2 },      // Default brightness boost for static image (tweak this)
              uContrast: { value: 1.1 },        // Default contrast boost for static image (tweak this)
          },
          side: THREE.DoubleSide,
          transparent: false, // Set explicitly
      });
      // *** END SHADERMATERIAL UPDATE ***
      planeMeshRef.current = new THREE.Mesh(planeGeometry, planeMaterial);
      planeMeshRef.current.position.z = 0; planeMeshRef.current.scale.set(1, 1, 1);
      sceneRef.current.add(planeMeshRef.current);
      isInitialized.current = true;
      console.log("Renderer: Scene initialized with updated ShaderMaterial.");
      handleResize(); // Initial resize based on current canvas size
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
    // Cleanup function
    return () => {
        console.log("Renderer: Cleaning up Three.js resources and ResizeObserver...");
        resizeObserver?.disconnect();
        cancelAnimationFrame(animationFrameHandle.current); // Cancel animation frame
        isInitialized.current = false;
        // Dispose textures and materials thoroughly
        videoTextureRef.current?.dispose(); imageTextureRef.current?.dispose();
        // Check if material exists before accessing uniforms
        planeMeshRef.current?.material?.uniforms?.uTexture?.value?.dispose();
        planeMeshRef.current?.geometry?.dispose(); planeMeshRef.current?.material?.dispose();
        rendererInstanceRef.current?.dispose();
        // Clear refs
        videoTextureRef.current = null; imageTextureRef.current = null; planeMeshRef.current = null;
        sceneRef.current = null; cameraRef.current = null; rendererInstanceRef.current = null;
        currentSourceElement.current = null; currentResults.current = null;
    };
  }, [initThreeScene, handleResize]); // initThreeScene is stable


  // --- Scale Plane to Fit Camera View ---
  const fitPlaneToCamera = useCallback((textureWidth, textureHeight) => {
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

       if (!isInitialized.current || !rendererInstanceRef.current || !sceneRef.current || !cameraRef.current || !planeMeshRef.current || !planeMeshRef.current.material?.uniforms) { // Added check for uniforms
          return; // Not ready yet
       }

       const sourceElement = currentSourceElement.current; // Get the latest source
       const uniforms = planeMeshRef.current.material.uniforms; // Shortcut
       let sourceWidth = 0, sourceHeight = 0, textureAssignedThisFrame = false;
       let isVideo = sourceElement instanceof HTMLVideoElement;
       let isImage = sourceElement instanceof HTMLImageElement;

       // --- 1. Get Source Dimensions ---
       if (isVideo && sourceElement.readyState >= 2) { sourceWidth = sourceElement.videoWidth; sourceHeight = sourceElement.videoHeight; }
       else if (isImage && sourceElement.complete && sourceElement.naturalWidth > 0) { sourceWidth = sourceElement.naturalWidth; sourceHeight = sourceElement.naturalHeight; }
       else if (!sourceElement) { sourceWidth = 0; sourceHeight = 0; }

       // --- 2. Manage Textures & Update Uniforms ---
       let currentTexture = uniforms.uTexture.value; // Get texture from uniform
       if (isVideo && sourceWidth > 0) {
            // Video source is active and ready
            if (currentTexture !== videoTextureRef.current || !videoTextureRef.current) {
                 console.log("RenderLoop: Assigning VIDEO Texture to Uniform.");
                 videoTextureRef.current?.dispose(); imageTextureRef.current?.dispose(); imageTextureRef.current = null;
                 videoTextureRef.current = new THREE.VideoTexture(sourceElement); videoTextureRef.current.colorSpace = THREE.SRGBColorSpace;
                 uniforms.uTexture.value = videoTextureRef.current; // Assign to uniform
                 textureAssignedThisFrame = true;
            }
            uniforms.uIsStaticImage.value = false; // Set flag for shader
       } else if (isImage && sourceWidth > 0) {
            // Image source is active and ready
            if (currentTexture !== imageTextureRef.current || !imageTextureRef.current) {
                 console.log("RenderLoop: Assigning IMAGE Texture to Uniform.");
                 videoTextureRef.current?.dispose(); videoTextureRef.current = null;
                 imageTextureRef.current?.dispose();
                 imageTextureRef.current = new THREE.Texture(sourceElement); imageTextureRef.current.colorSpace = THREE.SRGBColorSpace;
                 imageTextureRef.current.needsUpdate = true; // Mark image texture for upload
                 uniforms.uTexture.value = imageTextureRef.current; // Assign to uniform
                 textureAssignedThisFrame = true;
            } else if (imageTextureRef.current) { imageTextureRef.current.needsUpdate = true; }
            uniforms.uIsStaticImage.value = true; // Set flag for shader
            // NOTE: Brightness/Contrast values are now set during init, adjust there if needed
       } else {
            // No valid source, clear texture uniform
            if (uniforms.uTexture.value !== null) {
                 console.log("RenderLoop: Clearing texture uniform (No valid source).");
                 videoTextureRef.current?.dispose(); imageTextureRef.current?.dispose(); videoTextureRef.current = null; imageTextureRef.current = null;
                 uniforms.uTexture.value = null; // Clear uniform
                 textureAssignedThisFrame = true;
            }
            uniforms.uIsStaticImage.value = false; // Reset flag
       }
        // Force material update if texture was assigned or cleared
        if (textureAssignedThisFrame) { planeMeshRef.current.material.needsUpdate = true; }


       // --- 3. Update Plane Scale & Mirroring ---
       if (uniforms.uTexture.value && sourceWidth > 0 && sourceHeight > 0) { // Only scale if texture is set
            fitPlaneToCamera(sourceWidth, sourceHeight);
            planeMeshRef.current.scale.x = Math.abs(planeMeshRef.current.scale.x) * (isVideo ? -1 : 1);
       } else {
            if (planeMeshRef.current.scale.x !== 0) { planeMeshRef.current.scale.set(0,0,0); } // Hide plane if no texture
       }

       // --- 4. TODO: Update Shader Uniforms (Effects) ---
       // Example: Update brightness dynamically?
       // uniforms.uBrightness.value = some_slider_value;

       // --- 5. Render Scene ---
       rendererInstanceRef.current.render(sceneRef.current, cameraRef.current);

  }, [fitPlaneToCamera]);


  // --- Start Render Loop ---
  useEffect(() => {
    console.log("Renderer: UseEffect starting render loop.");
    if (isInitialized.current) {
        cancelAnimationFrame(animationFrameHandle.current);
        animationFrameHandle.current = requestAnimationFrame(renderLoop);
    } else { console.warn("Render loop start skipped."); }
  }, [renderLoop]);


  // --- Expose Methods ---
  useImperativeHandle(ref, () => ({
    renderResults: (videoElement, results) => { currentSourceElement.current = videoElement; currentResults.current = results; },
    renderStaticImageResults: (imageElement, results) => { console.log("ImperativeHandle: renderStaticImageResults."); currentSourceElement.current = imageElement; currentResults.current = results; },
    clearCanvas: () => { console.log("ImperativeHandle: Clearing canvas source."); currentSourceElement.current = null; currentResults.current = null; }
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