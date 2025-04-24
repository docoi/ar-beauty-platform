// src/components/TryOnRenderer.jsx - Log Post-Processing Objects

import React, { useRef, useImperativeHandle, forwardRef, useEffect, useCallback } from 'react';
import * as THREE from 'three';

console.log(`Using Three.js revision: ${THREE.REVISION}`);

const TryOnRenderer = forwardRef(({ videoWidth, videoHeight, className }, ref) => {
    // ... (Keep all refs: canvasRef, rendererInstanceRef, animationFrameHandle, isInitialized, baseSceneRef, baseCameraRef, basePlaneMeshRef, videoTextureRef, imageTextureRef, postSceneRef, postCameraRef, postMaterialRef, renderTargetRef, currentSourceElement, isStaticImage) ...

    // --- Shaders ---
    const postVertexShader = `varying vec2 vUv; void main() { vUv = uv; gl_Position = vec4(position, 1.0); }`;
    const postFragmentShader_DEBUG = `void main() { gl_FragColor = vec4(0.0, 0.8, 0.2, 1.0); }`; // Darker Green, Full Alpha

    // --- Handle Resizing ---
    const handleResize = useCallback(() => { /* ... as before ... */ }, []);

    // --- Initialize Scene ---
    const initThreeScene = useCallback(() => { /* ... as before ... */ }, [handleResize, postVertexShader, postFragmentShader_DEBUG]);

    // --- Effect for Initial Setup / Resize Observer ---
    useEffect(() => { /* ... as before ... */ }, [initThreeScene, handleResize]);

    // --- Scale Base Plane ---
    const fitPlaneToCamera = useCallback((textureWidth, textureHeight) => { /* ... as before ... */ }, []);

    // --- Render Loop (Conditional Rendering Path) ---
    const renderLoop = useCallback(() => {
        animationFrameHandle.current = requestAnimationFrame(renderLoop);
        if (!isInitialized.current || !rendererInstanceRef.current || !baseSceneRef.current || !baseCameraRef.current || !postSceneRef.current || !postCameraRef.current || !basePlaneMeshRef.current || !renderTargetRef.current ) return; // Simplified check

        const sourceElement = currentSourceElement.current;
        const baseMaterial = basePlaneMeshRef.current.material;
        let sourceWidth = 0, sourceHeight = 0;
        let isVideo = sourceElement instanceof HTMLVideoElement;
        let textureToAssign = null;

        // --- 1. Update Base Scene Texture ---
        // ... (Keep texture update logic as before) ...
        if (isVideo && sourceElement.readyState >= 2) { /* video texture */ sourceWidth = sourceElement.videoWidth; sourceHeight = sourceElement.videoHeight; if (videoTextureRef.current?.image !== sourceElement) { videoTextureRef.current?.dispose(); videoTextureRef.current = new THREE.VideoTexture(sourceElement); videoTextureRef.current.colorSpace = THREE.SRGBColorSpace; } textureToAssign = videoTextureRef.current; }
        else if (isImage && sourceElement.complete && sourceElement.naturalWidth > 0) { /* image texture */ sourceWidth = sourceElement.naturalWidth; sourceHeight = sourceElement.naturalHeight; if (imageTextureRef.current?.image !== sourceElement) { imageTextureRef.current?.dispose(); imageTextureRef.current = new THREE.Texture(sourceElement); imageTextureRef.current.colorSpace = THREE.SRGBColorSpace; imageTextureRef.current.needsUpdate = true; } else { imageTextureRef.current.needsUpdate = true; } textureToAssign = imageTextureRef.current; }
        else { /* no source / clear */ textureToAssign = null; if(videoTextureRef.current) { videoTextureRef.current.dispose(); videoTextureRef.current = null;} if(imageTextureRef.current) { imageTextureRef.current.dispose(); imageTextureRef.current = null;} }
        if (baseMaterial.map !== textureToAssign) { baseMaterial.map = textureToAssign; baseMaterial.needsUpdate = true; }

        // --- 2. Update Base Plane Scale & Mirroring ---
        // ... (Keep scaling logic as before) ...
        if (baseMaterial.map && sourceWidth > 0 && sourceHeight > 0) { fitPlaneToCamera(sourceWidth, sourceHeight); basePlaneMeshRef.current.scale.x = Math.abs(basePlaneMeshRef.current.scale.x) * (isVideo ? -1 : 1); } else { if (basePlaneMeshRef.current.scale.x !== 0) { basePlaneMeshRef.current.scale.set(0,0,0); } }

        // --- 3/4/5. Conditional Final Render ---
        if (isStaticImage.current) { // Use Post-Processing path for Static Image
             console.log("RenderLoop: Static Image Path"); // Log path entry

             // Render Base Scene to Target
             if (basePlaneMeshRef.current.scale.x !== 0) {
                 rendererInstanceRef.current.setRenderTarget(renderTargetRef.current);
                 rendererInstanceRef.current.render(baseSceneRef.current, baseCameraRef.current);
                 rendererInstanceRef.current.setRenderTarget(null);
                 console.log("RenderLoop: Rendered base scene to target."); // Log success
             } else {
                  rendererInstanceRef.current.setRenderTarget(renderTargetRef.current);
                  rendererInstanceRef.current.clear();
                  rendererInstanceRef.current.setRenderTarget(null);
                  console.log("RenderLoop: Cleared render target (base plane hidden)."); // Log clear
             }

             // *** Check objects before final render ***
             const canRenderPost = postSceneRef.current && postCameraRef.current && postMaterialRef.current;
             console.log(`RenderLoop: Post-processing check: Scene=${!!postSceneRef.current}, Cam=${!!postCameraRef.current}, Mat=${!!postMaterialRef.current}`);

             if (canRenderPost) {
                // Render Post-Processing Scene (with debug shader) to Screen
                console.log("RenderLoop: Rendering post scene (Debug Shader)..."); // Log before render
                try {
                     rendererInstanceRef.current.render(postSceneRef.current, postCameraRef.current);
                     console.log("RenderLoop: Post scene render call finished."); // Log after render
                } catch(e) {
                     console.error("!!! POST RENDER ERROR:", e);
                     cancelAnimationFrame(animationFrameHandle.current);
                }
             } else {
                  console.error("RenderLoop: Cannot render post scene, objects missing!");
                  // Maybe clear the screen explicitly?
                  rendererInstanceRef.current.clear();
             }
        } else { // Use Direct Rendering for Mirror/Preview
             // console.log("RenderLoop: Direct Render Path"); // Reduce noise
             rendererInstanceRef.current.setRenderTarget(null); // Ensure rendering to canvas
             rendererInstanceRef.current.render(baseSceneRef.current, baseCameraRef.current);
        }

    }, [fitPlaneToCamera]);

    // --- Start Render Loop ---
    useEffect(() => { if (isInitialized.current) { cancelAnimationFrame(animationFrameHandle.current); animationFrameHandle.current = requestAnimationFrame(renderLoop); } }, [renderLoop]);

    // --- Expose Methods ---
    useImperativeHandle(ref, () => ({
        renderResults: (videoElement, results) => { currentSourceElement.current = videoElement; isStaticImage.current = false; },
        renderStaticImageResults: (imageElement, results, brightness, contrast) => { console.log("Handle: renderStaticImageResults (Post Debug Test)."); currentSourceElement.current = imageElement; isStaticImage.current = true; },
        clearCanvas: () => { console.log("Handle: Clearing canvas source."); currentSourceElement.current = null; isStaticImage.current = false; /* Render loop clears base map */ }
    }));

    // --- JSX ---
    return ( <canvas ref={canvasRef} className={`renderer-canvas ${className || ''}`} style={{ display: 'block', width: '100%', height: '100%' }} /> );
});

TryOnRenderer.displayName = 'TryOnRenderer';
export default TryOnRenderer;