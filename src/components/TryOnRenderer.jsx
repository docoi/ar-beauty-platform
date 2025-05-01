// src/components/TryOnRenderer.jsx - BASELINE WEBGL RENDER ONLY
// Renders Video/Image using MeshBasicMaterial - No Effects or Masks

import React, { useRef, forwardRef, useEffect, useCallback } from 'react';
import * as THREE from 'three';

const TryOnRenderer = forwardRef(({
    videoRefProp, imageElement, isStatic, className, style
 }, ref) => {

    // Core Refs
    const canvasRef = useRef(null); const rendererInstanceRef = useRef(null);
    const animationFrameHandle = useRef(null); const isInitialized = useRef(false);
    const sceneRef = useRef(null); const cameraRef = useRef(null);
    const planeMeshRef = useRef(null); const videoTextureRef = useRef(null);
    const imageTextureRef = useRef(null);

    // Texture Management
    useEffect(() => { /* Video Texture (Assigns map directly if mesh exists) */
        const videoElement = videoRefProp?.current; const material = planeMeshRef.current?.material;
        if (!isStatic && videoElement && videoElement.readyState >= videoElement.HAVE_METADATA) {
            if (!videoTextureRef.current || videoTextureRef.current.image !== videoElement) {
                videoTextureRef.current?.dispose(); videoTextureRef.current = new THREE.VideoTexture(videoElement); videoTextureRef.current.colorSpace = THREE.SRGBColorSpace;
                if (material) { material.map = videoTextureRef.current; material.needsUpdate = true; }
            }
        } else if (!isStatic && videoTextureRef.current) {
             if (material?.map === videoTextureRef.current) { material.map = null; material.needsUpdate = true; }
             videoTextureRef.current.dispose(); videoTextureRef.current = null;
        }
     }, [isStatic, videoRefProp, videoRefProp?.current?.readyState]);

    useEffect(() => { /* Image Texture (Assigns map directly if mesh exists) */
        const material = planeMeshRef.current?.material;
        if (isStatic && imageElement && imageElement.complete && imageElement.naturalWidth > 0) {
             if (!imageTextureRef.current || imageTextureRef.current.image !== imageElement) {
                 imageTextureRef.current?.dispose(); imageTextureRef.current = new THREE.Texture(imageElement); imageTextureRef.current.colorSpace = THREE.SRGBColorSpace; imageTextureRef.current.needsUpdate = true;
                 if (material) { material.map = imageTextureRef.current; material.needsUpdate = true; }
             }
        } else if (isStatic && imageTextureRef.current) {
             if (material?.map === imageTextureRef.current) { material.map = null; material.needsUpdate = true; }
             imageTextureRef.current.dispose(); imageTextureRef.current = null;
        }
     }, [isStatic, imageElement, imageElement?.complete]);

    // Resizing Logic
    const handleResize = useCallback(() => { const canvas = canvasRef.current; const renderer = rendererInstanceRef.current; const camera = cameraRef.current; if (!renderer || !camera || !canvas) return; const newWidth = canvas.clientWidth; const newHeight = canvas.clientHeight; if (newWidth === 0 || newHeight === 0) return; const currentSize = renderer.getSize(new THREE.Vector2()); if (currentSize.x === newWidth && currentSize.y === newHeight) return; try { renderer.setSize(newWidth, newHeight); camera.left = -newWidth / 2; camera.right = newWidth / 2; camera.top = newHeight / 2; camera.bottom = -newHeight / 2; camera.updateProjectionMatrix(); } catch(e) { console.error("Resize Error:", e);} }, []);

    // Plane Scaling Logic
    const fitPlaneToCamera = useCallback((textureWidth, textureHeight) => { const canvas = canvasRef.current; const camera = cameraRef.current; const mesh = planeMeshRef.current; if (!camera || !mesh || !textureWidth || !textureHeight || !canvas) return; const viewWidth = canvas.clientWidth; const viewHeight = canvas.clientHeight; if (viewWidth === 0 || viewHeight === 0) return; const viewAspect = viewWidth / viewHeight; const textureAspect = textureWidth / textureHeight; let scaleX, scaleY; if (viewAspect > textureAspect) { scaleY = viewHeight; scaleX = scaleY * textureAspect; } else { scaleX = viewWidth; scaleY = scaleX / textureAspect; } const currentScale = mesh.scale; const signX = Math.sign(currentScale.x) || 1; const newScaleXWithSign = scaleX * signX; if (Math.abs(currentScale.y - scaleY) > 0.01 || Math.abs(currentScale.x - newScaleXWithSign) > 0.01) { currentScale.set(newScaleXWithSign, scaleY, 1); } }, []);

    // Render Loop
     const renderLoop = useCallback(() => {
        animationFrameHandle.current = requestAnimationFrame(renderLoop);
        if (!isInitialized.current || !rendererInstanceRef.current || !sceneRef.current || !cameraRef.current || !planeMeshRef.current?.material) return;
        try {
            const mesh = planeMeshRef.current; const material = mesh.material; let sourceWidth = 0, sourceHeight = 0; let currentTexture = null; const isVideo = !isStatic;
            // Select Texture & Update Map if needed
            if (isVideo && videoTextureRef.current) { currentTexture = videoTextureRef.current; const video = currentTexture.image; if (video?.readyState >= 2) { sourceWidth = video.videoWidth; sourceHeight = video.videoHeight; } if (material.map !== currentTexture) { material.map = currentTexture; material.needsUpdate = true; } }
            else if (isStatic && imageTextureRef.current) { currentTexture = imageTextureRef.current; const image = currentTexture.image; if (image?.complete) { sourceWidth = image.naturalWidth; sourceHeight = image.naturalHeight; } if (material.map !== currentTexture) { material.map = imageTextureRef.current; material.needsUpdate = true; } }
            else if (material.map !== null) { material.map = null; material.needsUpdate = true; } // Clear map if no texture
            // Update Scale/Mirroring
            const planeVisible = !!material.map && sourceWidth > 0 && sourceHeight > 0; if (planeVisible) { fitPlaneToCamera(sourceWidth, sourceHeight); const scaleX = Math.abs(mesh.scale.x); const newScaleX = isVideo ? -scaleX : scaleX; if(mesh.scale.x !== newScaleX) { mesh.scale.x = newScaleX; } } else { if (mesh.scale.x !== 0 || mesh.scale.y !== 0) { mesh.scale.set(0, 0, 0); } }
            if (currentTexture?.needsUpdate) { currentTexture.needsUpdate = false; }
            // Render
            rendererInstanceRef.current.render(sceneRef.current, cameraRef.current);
        } catch (error) { console.error("Error in renderLoop:", error); cancelAnimationFrame(animationFrameHandle.current); isInitialized.current = false; }
    }, [fitPlaneToCamera, isStatic]);

    // Initialization
    const initThreeScene = useCallback(() => {
        console.log("TryOnRenderer (WebGL Base): initThreeScene START"); if (!canvasRef.current || isInitialized.current) return;
        try {
            const canvas = canvasRef.current; const initialWidth = canvas.clientWidth || 640; const initialHeight = canvas.clientHeight || 480;
            const renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true }); renderer.setSize(initialWidth, initialHeight); renderer.setPixelRatio(window.devicePixelRatio); renderer.outputColorSpace = THREE.SRGBColorSpace; rendererInstanceRef.current = renderer;
            sceneRef.current = new THREE.Scene(); cameraRef.current = new THREE.OrthographicCamera(-initialWidth / 2, initialWidth / 2, initialHeight / 2, -initialHeight / 2, 0.1, 10); cameraRef.current.position.z = 1;
            const planeGeometry = new THREE.PlaneGeometry(1, 1); const planeMaterial = new THREE.MeshBasicMaterial({ map: null, side: THREE.DoubleSide, color: 0x808080 }); planeMeshRef.current = new THREE.Mesh(planeGeometry, planeMaterial); sceneRef.current.add(planeMeshRef.current);
            isInitialized.current = true; handleResize(); cancelAnimationFrame(animationFrameHandle.current); animationFrameHandle.current = requestAnimationFrame(renderLoop); console.log("TryOnRenderer (WebGL Base): initThreeScene SUCCESSFUL.");
        } catch (error) { console.error("TryOnRenderer (WebGL Base): initThreeScene FAILED:", error); isInitialized.current = false; }
    }, [handleResize, renderLoop]);

    // Setup / Cleanup Effect
    useEffect(() => { initThreeScene(); let resizeObserver; const currentCanvas = canvasRef.current; if (currentCanvas) { resizeObserver = new ResizeObserver(() => { handleResize(); }); resizeObserver.observe(currentCanvas); } return () => { resizeObserver?.disconnect(); cancelAnimationFrame(animationFrameHandle.current); isInitialized.current = false; videoTextureRef.current?.dispose(); imageTextureRef.current?.dispose(); planeMeshRef.current?.geometry?.dispose(); planeMeshRef.current?.material?.map?.dispose(); planeMeshRef.current?.material?.dispose(); rendererInstanceRef.current?.dispose(); /* Clear refs */ }; }, [initThreeScene, handleResize]);

    // JSX
    return ( <canvas ref={canvasRef} className={`webgl-canvas ${className || ''}`} style={{ display: 'block', width: '100%', height: '100%', ...(style || {}) }} /> );
});
TryOnRenderer.displayName = 'TryOnRenderer';
export default TryOnRenderer;