// src/components/TryOnRenderer.jsx

import React, { useRef, useImperativeHandle, forwardRef, useEffect, useCallback } from 'react';
import * as THREE from 'three';

// ... (Keep imports, console log, shaders, handleResize, initThreeScene, main useEffect, fitPlaneToCamera) ...

const TryOnRenderer = forwardRef(({ videoWidth, videoHeight, className }, ref) => {
  // ... (Keep refs) ...
  const currentBrightness = useRef(1.2); // Store current correction values
  const currentContrast = useRef(1.1);

  // ... (Keep shaders) ...

  // ... (Keep handleResize) ...

  // ... (Keep initThreeScene - ensuring uniforms are defined) ...

  // ... (Keep main useEffect for setup/cleanup) ...

  // ... (Keep fitPlaneToCamera) ...

  // --- Render Loop (Only update time, render) ---
  const renderLoop = useCallback(() => {
       animationFrameHandle.current = requestAnimationFrame(renderLoop);
       if (!isInitialized.current || !rendererInstanceRef.current || !sceneRef.current || !cameraRef.current || !planeMeshRef.current || !planeMeshRef.current.material?.uniforms) return;

       // --- Update Shader Uniforms (only those changing constantly) ---
       const uniforms = planeMeshRef.current.material.uniforms;
       // Example: Update time if shader uses it
       // if(uniforms.uTime) uniforms.uTime.value = performance.now() * 0.001;

       // Update brightness/contrast ONLY if static image flag is true
       // This ensures live video isn't accidentally corrected
       if (uniforms.uIsStaticImage.value) {
           uniforms.uBrightness.value = currentBrightness.current;
           uniforms.uContrast.value = currentContrast.current;
       }
       // We could also reset them to 1.0 if uIsStaticImage is false

       // --- Render Scene ---
       rendererInstanceRef.current.render(sceneRef.current, cameraRef.current);

  }, []); // No dependencies needed here


  // --- Start Render Loop ---
  useEffect(() => { /* ... start loop ... */
      if (isInitialized.current) { cancelAnimationFrame(animationFrameHandle.current); animationFrameHandle.current = requestAnimationFrame(renderLoop); }
  }, [renderLoop]);


  // --- Expose Methods ---
  useImperativeHandle(ref, () => ({
    renderResults: (videoElement, results) => {
        // Called every frame in Mirror mode
        if (!planeMeshRef.current || !planeMeshRef.current.material.uniforms || !videoElement || videoElement.readyState < 2) return;
        const uniforms = planeMeshRef.current.material.uniforms;
        const videoW = videoElement.videoWidth; const videoH = videoElement.videoHeight;

        // Update video texture if needed
        if (uniforms.uTexture.value !== videoTextureRef.current || !videoTextureRef.current || videoTextureRef.current.image !== videoElement) {
            videoTextureRef.current?.dispose(); imageTextureRef.current?.dispose(); imageTextureRef.current = null;
            videoTextureRef.current = new THREE.VideoTexture(videoElement); videoTextureRef.current.colorSpace = THREE.SRGBColorSpace;
            uniforms.uTexture.value = videoTextureRef.current;
        }
        uniforms.uIsStaticImage.value = false; // Set flag

        // Scale and mirror plane
        if (videoW > 0) { fitPlaneToCamera(videoW, videoH); planeMeshRef.current.scale.x = -Math.abs(planeMeshRef.current.scale.x); }
        else { planeMeshRef.current.scale.set(0,0,0); }
        currentResults.current = results; // Store results (for effects later)
    },
    // --- UPDATE renderStaticImageResults to accept new args ---
    renderStaticImageResults: (imageElement, results, brightness, contrast) => {
        console.log("Handle: renderStaticImageResults.", { brightness, contrast });
        if (!planeMeshRef.current || !planeMeshRef.current.material.uniforms || !imageElement || !imageElement.complete || imageElement.naturalWidth === 0) return;

        const uniforms = planeMeshRef.current.material.uniforms;
        const imgWidth = imageElement.naturalWidth; const imgHeight = imageElement.naturalHeight;

        // Update image texture if needed
        if (uniforms.uTexture.value !== imageTextureRef.current || !imageTextureRef.current || imageTextureRef.current.image !== imageElement) {
            videoTextureRef.current?.dispose(); videoTextureRef.current = null;
            imageTextureRef.current?.dispose();
            imageTextureRef.current = new THREE.Texture(imageElement); imageTextureRef.current.colorSpace = THREE.SRGBColorSpace; imageTextureRef.current.needsUpdate = true;
            uniforms.uTexture.value = imageTextureRef.current;
        } else { imageTextureRef.current.needsUpdate = true; }
        uniforms.uIsStaticImage.value = true; // Set flag

        // --- Store correction values in refs for render loop ---
        currentBrightness.current = brightness;
        currentContrast.current = contrast;
        // --- END store correction ---

        // Scale plane
        if (imgWidth > 0) { fitPlaneToCamera(imgWidth, imgHeight); planeMeshRef.current.scale.x = Math.abs(planeMeshRef.current.scale.x); }
        else { planeMeshRef.current.scale.set(0,0,0); }
         currentResults.current = results; // Store results
    },
    clearCanvas: () => { /* ... Keep clearCanvas method ... */ }
  }));

  // --- JSX ---
  return ( /* ... Keep canvas return ... */ <canvas ref={canvasRef} className={`renderer-canvas ${className || ''}`} style={{ display: 'block', width: '100%', height: '100%' }} /> );
});

TryOnRenderer.displayName = 'TryOnRenderer';
export default TryOnRenderer;