// src/components/TryOnRenderer.jsx

import React, { useRef, useImperativeHandle, forwardRef, useEffect, useCallback } from 'react';
import * as THREE from 'three';

const TryOnRenderer = forwardRef(({ videoWidth, videoHeight, className }, ref) => {
  const canvasRef = useRef(null);
  const rendererInstanceRef = useRef(null);
  const sceneRef = useRef(null);
  const cameraRef = useRef(null);
  const videoTextureRef = useRef(null);
  const imageTextureRef = useRef(null);
  const planeMeshRef = useRef(null);
  const isInitialized = useRef(false);
  const currentVideoElement = useRef(null);
  const currentResults = useRef(null);

  // --- Shader Definitions (Basic Passthrough) ---
  // Vertex Shader
  const basicVertexShader = `
    varying vec2 vUv; // UV coordinates will be passed to the fragment shader

    void main() {
      vUv = uv; // Pass the vertex's UV coordinate
      // projectVertex takes care of applying modelViewMatrix and projectionMatrix
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `;

  // Fragment Shader (Reads texture color)
  const basicFragmentShader = `
    uniform sampler2D uTexture; // The texture (video or image)
    varying vec2 vUv; // UV coordinates from the vertex shader

    void main() {
      // Sample the texture at the interpolated UV coordinate
      vec4 textureColor = texture2D(uTexture, vUv);
      gl_FragColor = textureColor; // Output the texture color directly
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
      const initialWidth = canvas.clientWidth || 640;
      const initialHeight = canvas.clientHeight || 480;

      sceneRef.current = new THREE.Scene();

      cameraRef.current = new THREE.OrthographicCamera(
        -initialWidth / 2, initialWidth / 2, initialHeight / 2, -initialHeight / 2, 1, 1000
      );
      cameraRef.current.position.z = 1;
      sceneRef.current.add(cameraRef.current);

      rendererInstanceRef.current = new THREE.WebGLRenderer({
        canvas: canvas,
        antialias: true,
        alpha: true
      });
      rendererInstanceRef.current.setSize(initialWidth, initialHeight);
      rendererInstanceRef.current.setPixelRatio(window.devicePixelRatio);
      // rendererInstanceRef.current.outputEncoding = THREE.sRGBEncoding; // Deprecated in r152
      rendererInstanceRef.current.outputColorSpace = THREE.SRGBColorSpace; // Correct property in recent versions

      // *** KEY CHANGE: Use ShaderMaterial ***
      const planeGeometry = new THREE.PlaneGeometry(1, 1); // Still 1x1, scaled later
      const planeMaterial = new THREE.ShaderMaterial({
          vertexShader: basicVertexShader, // Our basic vertex shader
          fragmentShader: basicFragmentShader, // Our basic fragment shader
          uniforms: {
              uTexture: { value: null }, // Uniform to hold our texture
          },
          side: THREE.DoubleSide,
          // Optional flags based on needs:
          // transparent: true, // Needed if alpha is true and shader respects it
          // depthWrite: false, // Useful for effects that shouldn't write to depth buffer
      });

      planeMeshRef.current = new THREE.Mesh(planeGeometry, planeMaterial);
      planeMeshRef.current.position.z = 0;
      planeMeshRef.current.scale.set(1, 1, 1);
      sceneRef.current.add(planeMeshRef.current);

      isInitialized.current = true;
      console.log("Renderer: Three.js scene initialized with ShaderMaterial.");

      handleResize(); // Initial resize based on current canvas size

    } catch (error) {
      console.error("Error initializing Three.js:", error);
    }
  }, [handleResize, basicVertexShader, basicFragmentShader]); // Include shaders in dependencies

  // --- Effect for Initial Setup and Resize Observer ---
  useEffect(() => {
    initThreeScene();

    let resizeObserver;
    if (canvasRef.current) {
        resizeObserver = new ResizeObserver(() => {
            console.log("Renderer: ResizeObserver detected canvas resize.");
            handleResize();
        });
        resizeObserver.observe(canvasRef.current);
    }

    // Cleanup on unmount
    return () => {
        console.log("Renderer: Cleaning up Three.js resources and ResizeObserver...");
        resizeObserver?.disconnect();
        isInitialized.current = false;
        videoTextureRef.current?.dispose();
        imageTextureRef.current?.dispose();
        planeMeshRef.current?.geometry?.dispose();
        planeMeshRef.current?.material?.dispose(); // Dispose material too!
        rendererInstanceRef.current?.dispose();

        // Clear refs
        videoTextureRef.current = null; imageTextureRef.current = null; planeMeshRef.current = null;
        sceneRef.current = null; cameraRef.current = null; rendererInstanceRef.current = null;
        currentVideoElement.current = null; currentResults.current = null;
    };
  }, [initThreeScene, handleResize]);


  // --- Scale Plane to Fit Camera View ---
  const fitPlaneToCamera = useCallback((textureWidth, textureHeight) => {
      if (!cameraRef.current || !planeMeshRef.current || !textureWidth || !textureHeight) return;

      const canvas = canvasRef.current;
      if (!canvas) return;
      const cameraWidth = canvas.clientWidth;
      const cameraHeight = canvas.clientHeight;

      if (cameraWidth === 0 || cameraHeight === 0) return;

      const cameraAspect = cameraWidth / cameraHeight;
      const textureAspect = textureWidth / textureHeight;

      let scaleX, scaleY;

      if (cameraAspect > textureAspect) {
          scaleY = cameraHeight;
          scaleX = scaleY * textureAspect;
      } else {
          scaleX = cameraWidth;
          scaleY = scaleX / textureAspect;
      }

      // Apply scale to the plane mesh (base geometry is 1x1)
      planeMeshRef.current.scale.set(scaleX, scaleY, 1);
      // console.log(`Renderer: Adjusted plane scale to ${scaleX.toFixed(2)} x ${scaleY.toFixed(2)}`);

  }, []);


  // --- Main Render Loop Logic (called via requestAnimationFrame) ---
  const renderLoop = useCallback(() => {
       // Schedule next frame FIRST
       requestAnimationFrame(renderLoop); // Keep trying

      if (!isInitialized.current || !rendererInstanceRef.current || !sceneRef.current || !cameraRef.current || !planeMeshRef.current) {
         return;
      }

       // Get current source and dimensions
       let sourceElement = currentVideoElement.current;
       let sourceWidth = sourceElement?.videoWidth || sourceElement?.naturalWidth || 0;
       let sourceHeight = sourceElement?.videoHeight || sourceElement?.naturalHeight || 0;
       let isMirrored = sourceElement instanceof HTMLVideoElement; // Only video is mirrored

       // Update texture if source changed or not set
       let currentTexture = planeMeshRef.current.material.uniforms.uTexture.value; // Get texture from uniform
       if (sourceElement && (!currentTexture || currentTexture.image !== sourceElement)) {
            console.log(`Renderer: Updating texture from ${isMirrored ? 'video' : 'image'}.`);
            // Dispose old texture if it exists and is not the new one
            if (currentTexture && currentTexture.image !== sourceElement) {
                 console.log("Renderer: Disposing old texture.");
                 currentTexture.dispose();
            }

            if (isMirrored) {
                videoTextureRef.current = new THREE.VideoTexture(sourceElement);
                videoTextureRef.current.colorSpace = THREE.SRGBColorSpace;
                planeMeshRef.current.material.uniforms.uTexture.value = videoTextureRef.current; // Assign to uniform
                // Dispose image texture if it was there
                 if(imageTextureRef.current){ imageTextureRef.current.dispose(); imageTextureRef.current = null; }

            } else if (sourceElement instanceof HTMLImageElement) {
                imageTextureRef.current = new THREE.Texture(sourceElement);
                imageTextureRef.current.colorSpace = THREE.SRGBColorSpace;
                imageTextureRef.current.needsUpdate = true;
                planeMeshRef.current.material.uniforms.uTexture.value = imageTextureRef.current; // Assign to uniform
                 // Dispose video texture if it was there
                 if(videoTextureRef.current){ videoTextureRef.current.dispose(); videoTextureRef.current = null; }
            } else {
                 // Handle unexpected source type
                 console.warn("Renderer: Unexpected source element type:", sourceElement);
                 planeMeshRef.current.material.uniforms.uTexture.value = null; // Clear texture
            }

       } else if (!sourceElement && currentTexture) {
            // Source removed, clear texture
            console.log("Renderer: Source element removed, clearing texture.");
            currentTexture.dispose(); // Dispose the texture
            planeMeshRef.current.material.uniforms.uTexture.value = null;
             videoTextureRef.current = null; imageTextureRef.current = null; // Clear refs
       }


       // Update plane scale to fit camera view based on source aspect ratio
       if (sourceWidth > 0 && sourceHeight > 0) {
            fitPlaneToCamera(sourceWidth, sourceHeight);
            // Apply mirroring scale AFTER fitting
            planeMeshRef.current.scale.x *= (isMirrored ? -1 : 1);
       } else if (planeMeshRef.current.material.uniforms.uTexture.value === null) {
           // If no source and no texture, maybe scale down the plane or hide it
           // planeMeshRef.current.scale.set(0, 0, 0); // Hide the plane
           // Or just leave it at last size
       }


       // --- TODO: Shader Uniform Updates ---
       // Update shader uniforms here with data from currentResults.current, slider value, etc.


       // Render the scene
       rendererInstanceRef.current.render(sceneRef.current, cameraRef.current);

  }, [fitPlaneToCamera]); // Include dependency


  // --- Start Render Loop on Mount ---
  useEffect(() => {
      console.log("Renderer: Starting render loop.");
      // The loop schedules itself via requestAnimationFrame(renderLoop)
      // Call it once to start
      const handle = requestAnimationFrame(renderLoop);

      return () => {
          console.log("Renderer: Stopping render loop.");
          // We need to find and cancel the *last* requested frame.
          // This is tricky with the loop scheduling itself.
          // A common pattern is to use a mutable ref to store the handle
          // and cancel that ref in the cleanup.
          // However, since renderLoop calls itself, the handle changes.
          // A flag is simpler: tell the loop to stop on the *next* iteration.
           isInitialized.current = false; // Setting this flag will prevent further loop execution

           // Clean up textures explicitly in the main cleanup
           videoTextureRef.current?.dispose();
           imageTextureRef.current?.dispose();
           videoTextureRef.current = null;
           imageTextureRef.current = null;
           if(planeMeshRef.current?.material?.uniforms?.uTexture?.value){
               planeMeshRef.current.material.uniforms.uTexture.value.dispose();
               planeMeshRef.current.material.uniforms.uTexture.value = null;
           }

           // Dispose renderer and other resources in the main cleanup (handled below)
           // The render loop might try one more frame before noticing the isInitialized flag
           // but disposing the renderer prevents issues.
      }
  }, [renderLoop]); // Depend on the loop function


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