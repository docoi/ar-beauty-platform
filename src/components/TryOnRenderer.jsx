// src/components/TryOnRenderer.jsx - DEBUGGING MIRROR MODE

import React, { useRef, useImperativeHandle, forwardRef, useEffect, useCallback } from 'react';
import * as THREE from 'three';

console.log(`Using Three.js revision: ${THREE.REVISION}`);

const TryOnRenderer = forwardRef(({ videoWidth, videoHeight, className }, ref) => {
  const canvasRef = useRef(null);
  const rendererInstanceRef = useRef(null);
  const sceneRef = useRef(null);
  const cameraRef = useRef(null);
  const planeMeshRef = useRef(null);
  const videoTextureRef = useRef(null); // Keep separate ref for video
  const isInitialized = useRef(false);
  const animationFrameHandle = useRef(null);

  // --- Shaders ---
  const vertexShader = `varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;
  const fragmentShader = `uniform sampler2D uTexture; varying vec2 vUv; void main() { gl_FragColor = texture2D(uTexture, vUv); }`; // Simplest texture display

  // --- Handle Resizing ---
  const handleResize = useCallback(() => { /* ... */
    const canvas = canvasRef.current; if (!rendererInstanceRef.current || !cameraRef.current || !canvas) return; const newWidth = canvas.clientWidth; const newHeight = canvas.clientHeight; if (newWidth === 0 || newHeight === 0) return; const currentSize = rendererInstanceRef.current.getSize(new THREE.Vector2()); if (currentSize.x === newWidth && currentSize.y === newHeight) return; console.log(`DEBUG: Resizing -> ${newWidth}x${newHeight}`); rendererInstanceRef.current.setSize(newWidth, newHeight); cameraRef.current.left = -newWidth / 2; cameraRef.current.right = newWidth / 2; cameraRef.current.top = newHeight / 2; cameraRef.current.bottom = -newHeight / 2; cameraRef.current.updateProjectionMatrix();
  }, []);

  // --- Initialize Scene ---
  const initThreeScene = useCallback(() => {
    if (!canvasRef.current || isInitialized.current) return;
    console.log("DEBUG: initThreeScene START");
    try { /* ... scene, camera, renderer ... */
      const canvas = canvasRef.current; const initialWidth = canvas.clientWidth || 640; const initialHeight = canvas.clientHeight || 480;
      sceneRef.current = new THREE.Scene(); cameraRef.current = new THREE.OrthographicCamera(-initialWidth / 2, initialWidth / 2, initialHeight / 2, -initialHeight / 2, 1, 1000); cameraRef.current.position.z = 1; sceneRef.current.add(cameraRef.current); rendererInstanceRef.current = new THREE.WebGLRenderer({ canvas: canvas, antialias: true, alpha: true }); rendererInstanceRef.current.setSize(initialWidth, initialHeight); rendererInstanceRef.current.setPixelRatio(window.devicePixelRatio); rendererInstanceRef.current.outputColorSpace = THREE.SRGBColorSpace; const planeGeometry = new THREE.PlaneGeometry(1, 1);
      // *** Use BASIC MeshBasicMaterial for maximum simplicity ***
      const planeMaterial = new THREE.MeshBasicMaterial({ map: null, side: THREE.DoubleSide, color: 0x555555 }); // Start with gray, no texture
      planeMeshRef.current = new THREE.Mesh(planeGeometry, planeMaterial); planeMeshRef.current.position.z = 0; planeMeshRef.current.scale.set(1, 1, 1); sceneRef.current.add(planeMeshRef.current);
      isInitialized.current = true; console.log("DEBUG: Scene initialized with BASIC material."); handleResize();
    } catch (error) { console.error("DEBUG: initThreeScene ERROR:", error); }
  }, [handleResize, vertexShader, fragmentShader]); // Keep shaders even if not used initially

  // --- Effect for Initial Setup / Resize Observer ---
  useEffect(() => { /* ... */
    initThreeScene(); let resizeObserver; if (canvasRef.current) { resizeObserver = new ResizeObserver(() => { handleResize(); }); resizeObserver.observe(canvasRef.current); }
    return () => { /* ... cleanup ... */ console.log("DEBUG: Cleanup running..."); resizeObserver?.disconnect(); cancelAnimationFrame(animationFrameHandle.current); isInitialized.current = false; videoTextureRef.current?.dispose(); planeMeshRef.current?.geometry?.dispose(); planeMeshRef.current?.material?.map?.dispose(); planeMeshRef.current?.material?.dispose(); rendererInstanceRef.current?.dispose(); /* Clear refs */ };
  }, [initThreeScene, handleResize]);

  // --- Scale Plane ---
  const fitPlaneToCamera = useCallback((textureWidth, textureHeight) => { /* ... */
      if (!cameraRef.current || !planeMeshRef.current || !textureWidth || !textureHeight) return; const canvas = canvasRef.current; if (!canvas) return; const cameraWidth = canvas.clientWidth; const cameraHeight = canvas.clientHeight; if (cameraWidth === 0 || cameraHeight === 0) return; const cameraAspect = cameraWidth / cameraHeight; const textureAspect = textureWidth / textureHeight; let scaleX, scaleY; if (cameraAspect > textureAspect) { scaleY = cameraHeight; scaleX = scaleY * textureAspect; } else { scaleX = cameraWidth; scaleY = scaleX / textureAspect; } planeMeshRef.current.scale.y = scaleY; planeMeshRef.current.scale.x = scaleX;
  }, []);

  // --- Render Loop (Only Renders) ---
  const renderLoop = useCallback(() => {
       animationFrameHandle.current = requestAnimationFrame(renderLoop);
       if (isInitialized.current && rendererInstanceRef.current && sceneRef.current && cameraRef.current) {
           try { // Add try-catch around render
                rendererInstanceRef.current.render(sceneRef.current, cameraRef.current);
           } catch(e) {
                console.error("!!! RENDER LOOP ERROR:", e);
                cancelAnimationFrame(animationFrameHandle.current); // Stop loop on error
           }
       }
  }, []);

  // --- Start Render Loop ---
  useEffect(() => { if (isInitialized.current) { cancelAnimationFrame(animationFrameHandle.current); animationFrameHandle.current = requestAnimationFrame(renderLoop); } }, [renderLoop]);

  // --- Expose Methods (Simplify Video Texture Handling) ---
  useImperativeHandle(ref, () => ({
    renderResults: (videoElement, results) => { // For Mirror
        console.log("DEBUG: renderResults called."); // Log entry
        if (!planeMeshRef.current || !videoElement || videoElement.readyState < 2) {
            console.log("DEBUG: renderResults returning early (plane/video not ready).");
            return;
        }
        const videoW = videoElement.videoWidth; const videoH = videoElement.videoHeight;

        try {
            // --- Direct Texture Update ---
            // Create only if needed
            if (!videoTextureRef.current || videoTextureRef.current.image !== videoElement) {
                console.log("DEBUG: Creating/Assigning video texture.");
                videoTextureRef.current?.dispose();
                videoTextureRef.current = new THREE.VideoTexture(videoElement);
                videoTextureRef.current.colorSpace = THREE.SRGBColorSpace;
            }
            // Assign DIRECTLY to material map
            if (planeMeshRef.current.material.map !== videoTextureRef.current) {
                 console.log("DEBUG: Setting material map to video texture.");
                 planeMeshRef.current.material.map = videoTextureRef.current;
                 planeMeshRef.current.material.needsUpdate = true;
            } else {
                // If map is already correct, maybe texture needs update?
                if(videoTextureRef.current) videoTextureRef.current.needsUpdate = true; // VideoTexture usually updates automatically, but let's try
            }


            // Scale and mirror plane
            if (videoW > 0) {
                fitPlaneToCamera(videoW, videoH);
                planeMeshRef.current.scale.x = -Math.abs(planeMeshRef.current.scale.x); // MIRROR
                 if (planeMeshRef.current.scale.x === 0) console.error("DEBUG: Plane scale became zero!"); // Add check
            } else {
                 planeMeshRef.current.scale.set(0,0,0); // Hide if no dimensions
                 console.log("DEBUG: Hiding plane, video dimensions 0.");
            }
            // console.log("DEBUG: renderResults finished."); // Reduce noise

        } catch (e) {
            console.error("!!! ERROR inside renderResults:", e);
        }

    },
    renderStaticImageResults: (imageElement, results) => { // For Selfie (Keep it simple for now)
        console.log("DEBUG: renderStaticImageResults called (currently NOOP).");
        // NOOP - Focus on fixing mirror first
         if (planeMeshRef.current) {
             planeMeshRef.current.material.map = null; // Clear texture
             planeMeshRef.current.material.needsUpdate = true;
             planeMeshRef.current.scale.set(0,0,0); // Hide plane
         }
    },
    clearCanvas: () => {
        console.log("DEBUG: clearCanvas called.");
         if (planeMeshRef.current?.material) {
             planeMeshRef.current.material.map?.dispose();
             planeMeshRef.current.material.map = null;
             planeMeshRef.current.material.needsUpdate = true;
             planeMeshRef.current.scale.set(0,0,0);
         }
    }
  }));

  // --- JSX ---
  return ( <canvas ref={canvasRef} className={`renderer-canvas ${className || ''}`} style={{ display: 'block', width: '100%', height: '100%', backgroundColor: '#444' }} /> );
});

TryOnRenderer.displayName = 'TryOnRenderer';
export default TryOnRenderer;