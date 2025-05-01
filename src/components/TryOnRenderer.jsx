// src/components/TryOnRenderer.jsx - onBeforeCompile STRUCTURE ONLY (No Effect Logic)
// Tests if the basic component mount + onBeforeCompile structure works

import React, { useRef, forwardRef, useEffect, useCallback, useState } from 'react';
import * as THREE from 'three';

// Constants not needed for this test
// const FACE_OUTLINE_INDICES = [ ... ];
// const MAX_FACE_POINTS = ...;

const TryOnRenderer = forwardRef(({
    videoRefProp, imageElement,
    // Props below are passed but IGNORED in this test version
    mediaPipeResults, segmentationResults,
    isStatic, effectIntensity,
    className, style
 }, ref) => {

    // --- Core Refs ---
    const canvasRef = useRef(null); const rendererInstanceRef = useRef(null); const animationFrameHandle = useRef(null);
    const isInitialized = useRef(false); const sceneRef = useRef(null); const cameraRef = useRef(null);
    const planeMeshRef = useRef(null); const videoTextureRef = useRef(null); const imageTextureRef = useRef(null);
    // Remove effect-specific refs
    // const segmentationTextureRef = useRef(null);
    // const faceOutlinePoints = useRef(null);
    // const numFacePoints = useRef(0);

    // --- State ---
    // Keep state flag, although not strictly needed if onBeforeCompile is simplified
    const [isMaterialReady, setIsMaterialReady] = useState(false);

    // --- Internal Refs ---
    const renderLoopCounter = useRef(0);
    // const lastMaskUpdateTime = useRef(0);
    // const lastLandmarkUpdateTime = useRef(0);


    // --- Texture Management Effects --- (No Change from Baseline) ---
    // Video Texture Effect (Assigns to material.map if ready)
    useEffect(() => {
        const videoElement = videoRefProp?.current;
        const material = planeMeshRef.current?.material; // Get material ref

        if (!isStatic && videoElement && videoElement.readyState >= videoElement.HAVE_METADATA) {
            if (!videoTextureRef.current || videoTextureRef.current.image !== videoElement) {
                console.log("TryOnRenderer Structure Test: Creating/Updating Video Texture");
                videoTextureRef.current?.dispose();
                videoTextureRef.current = new THREE.VideoTexture(videoElement);
                videoTextureRef.current.colorSpace = THREE.SRGBColorSpace;
                // Assign to material map directly
                if (material) {
                     material.map = videoTextureRef.current;
                     material.needsUpdate = true;
                 }
            }
        } else if (!isStatic && videoTextureRef.current) {
             console.log("TryOnRenderer Structure Test: Disposing Video Texture");
             if (material?.map === videoTextureRef.current) { material.map = null; material.needsUpdate = true; }
             videoTextureRef.current.dispose();
             videoTextureRef.current = null;
        }
    }, [isStatic, videoRefProp, videoRefProp?.current?.readyState]); // Material is not a dependency here

    // Image Texture Effect (Assigns to material.map if ready)
    useEffect(() => {
        const material = planeMeshRef.current?.material; // Get material ref
        if (isStatic && imageElement && imageElement.complete && imageElement.naturalWidth > 0) {
             if (!imageTextureRef.current || imageTextureRef.current.image !== imageElement) {
                 console.log("TryOnRenderer Structure Test: Creating/Updating Image Texture");
                 imageTextureRef.current?.dispose();
                 imageTextureRef.current = new THREE.Texture(imageElement);
                 imageTextureRef.current.colorSpace = THREE.SRGBColorSpace;
                 imageTextureRef.current.needsUpdate = true;
                 if (material) {
                     material.map = imageTextureRef.current;
                     material.needsUpdate = true;
                 }
             }
        } else if (isStatic && imageTextureRef.current) {
             console.log("TryOnRenderer Structure Test: Disposing Image Texture");
             if (material?.map === imageTextureRef.current) { material.map = null; material.needsUpdate = true; }
             imageTextureRef.current.dispose();
             imageTextureRef.current = null;
        }
    }, [isStatic, imageElement, imageElement?.complete]); // Material is not a dependency here


    // --- REMOVED Uniform Update Effects ---
    // useEffect(() => { /* Segmentation Mask */ }, [segmentationResults, isStatic, isMaterialReady]);
    // useEffect(() => { /* Landmarks */ }, [mediaPipeResults, isStatic, isMaterialReady]);
    // useEffect(() => { /* Intensity */ }, [effectIntensity, isMaterialReady]);


    // --- Resizing Logic (No Change) ---
    const handleResize = useCallback(() => { /* ... (Standard resize logic) ... */ const canvas = canvasRef.current; const renderer = rendererInstanceRef.current; const camera = cameraRef.current; if (!renderer || !camera || !canvas) return; const newWidth = canvas.clientWidth; const newHeight = canvas.clientHeight; if (newWidth === 0 || newHeight === 0) return; const currentSize = renderer.getSize(new THREE.Vector2()); if (currentSize.x === newWidth && currentSize.y === newHeight) return; try { renderer.setSize(newWidth, newHeight); camera.left = -newWidth / 2; camera.right = newWidth / 2; camera.top = newHeight / 2; camera.bottom = -newHeight / 2; camera.updateProjectionMatrix(); } catch(e) { console.error("Resize Error:", e);} }, []);
    // --- Plane Scaling Logic (No Change) ---
    const fitPlaneToCamera = useCallback((textureWidth, textureHeight) => { /* ... (Standard fit logic) ... */ const canvas = canvasRef.current; const camera = cameraRef.current; const mesh = planeMeshRef.current; if (!camera || !mesh || !textureWidth || !textureHeight || !canvas) return; const viewWidth = canvas.clientWidth; const viewHeight = canvas.clientHeight; if (viewWidth === 0 || viewHeight === 0) return; const viewAspect = viewWidth / viewHeight; const textureAspect = textureWidth / textureHeight; let scaleX, scaleY; if (viewAspect > textureAspect) { scaleY = viewHeight; scaleX = scaleY * textureAspect; } else { scaleX = viewWidth; scaleY = scaleX / textureAspect; } const currentScale = mesh.scale; const signX = Math.sign(currentScale.x) || 1; const newScaleXWithSign = scaleX * signX; if (Math.abs(currentScale.y - scaleY) > 0.01 || Math.abs(currentScale.x - newScaleXWithSign) > 0.01) { currentScale.set(newScaleXWithSign, scaleY, 1); } }, []);


    // --- Render Loop (Simplified - just render) ---
     const renderLoop = useCallback(() => {
        animationFrameHandle.current = requestAnimationFrame(renderLoop);
        if (!isInitialized.current || !rendererInstanceRef.current || !sceneRef.current || !cameraRef.current || !planeMeshRef.current?.material) { return; }

        try {
            const mesh = planeMeshRef.current;
            const material = mesh.material;
            let sourceWidth = 0, sourceHeight = 0;
            let currentTexture = null;
            const isVideo = !isStatic;

            // --- Select Texture (Simplified) ---
            if (isVideo && videoTextureRef.current) { currentTexture = videoTextureRef.current; const video = currentTexture.image; if (video?.readyState >= 2) { sourceWidth = video.videoWidth; sourceHeight = video.videoHeight; } }
            else if (isStatic && imageTextureRef.current) { currentTexture = imageTextureRef.current; const image = currentTexture.image; if (image?.complete) { sourceWidth = image.naturalWidth; sourceHeight = image.naturalHeight; } }

            // --- Update Material Map ---
            // This needs to happen reliably now as it's not set in useEffect initially
            if (material.map !== currentTexture) {
                // console.log("Assigning map in render loop");
                material.map = currentTexture;
                material.needsUpdate = true;
            }

             // --- Update Scale/Mirroring ---
            const planeVisible = !!material.map && sourceWidth > 0 && sourceHeight > 0;
            if (planeVisible) { fitPlaneToCamera(sourceWidth, sourceHeight); const scaleX = Math.abs(mesh.scale.x); const newScaleX = isVideo ? -scaleX : scaleX; if(mesh.scale.x !== newScaleX) { mesh.scale.x = newScaleX; } }
            else { if (mesh.scale.x !== 0 || mesh.scale.y !== 0) { mesh.scale.set(0, 0, 0); } }
            if (currentTexture?.needsUpdate) { currentTexture.needsUpdate = false; }

            // --- Render ---
            rendererInstanceRef.current.render(sceneRef.current, cameraRef.current);

        } catch (error) {
            console.error("TryOnRenderer Structure Test: Error in renderLoop:", error);
            cancelAnimationFrame(animationFrameHandle.current); isInitialized.current = false;
        }
    }, [fitPlaneToCamera, isStatic]); // Dependencies


    // --- Initialization (onBeforeCompile does almost nothing now) ---
    const initThreeScene = useCallback(() => {
        console.log("DEBUG: initThreeScene START (Structure Test)");
        if (!canvasRef.current || isInitialized.current) return;
        setIsMaterialReady(false); // Reset flag

        try {
            const canvas = canvasRef.current; const initialWidth = canvas.clientWidth || 640; const initialHeight = canvas.clientHeight || 480;
            console.log("DEBUG: Init Renderer");
            const renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true }); renderer.setSize(initialWidth, initialHeight); renderer.setPixelRatio(window.devicePixelRatio); renderer.outputColorSpace = THREE.SRGBColorSpace; rendererInstanceRef.current = renderer;
            console.log("DEBUG: Init Scene");
            sceneRef.current = new THREE.Scene();
            console.log("DEBUG: Init Camera");
            cameraRef.current = new THREE.OrthographicCamera(-initialWidth / 2, initialWidth / 2, initialHeight / 2, -initialHeight / 2, 0.1, 10); cameraRef.current.position.z = 1;
            console.log("DEBUG: Init Geometry");
            const planeGeometry = new THREE.PlaneGeometry(1, 1);
            console.log("DEBUG: Init Material");
            const planeMaterial = new THREE.MeshBasicMaterial({ map: null, side: THREE.DoubleSide, color: 0x808080 }); // Grey default

            planeMaterial.onBeforeCompile = (shader) => {
                console.log("DEBUG: onBeforeCompile triggered (Structure Test - No modifications).");
                // We DON'T inject uniforms or modify the shader code here
                // Just set the flag to allow texture assignment
                setIsMaterialReady(true); // Set ready immediately
            };
            console.log("DEBUG: Assigned onBeforeCompile");

            console.log("DEBUG: Init Mesh");
            planeMeshRef.current = new THREE.Mesh(planeGeometry, planeMaterial);
            console.log("DEBUG: Add Mesh to Scene");
            sceneRef.current.add(planeMeshRef.current);

            console.log("DEBUG: Finalizing Init");
            isInitialized.current = true; handleResize(); cancelAnimationFrame(animationFrameHandle.current); animationFrameHandle.current = requestAnimationFrame(renderLoop);
            console.log("DEBUG: initThreeScene SUCCESSFUL.");

        } catch (error) {
            console.error("DEBUG: initThreeScene FAILED:", error); isInitialized.current = false; setIsMaterialReady(false);
        }
    }, [handleResize, renderLoop]);


    // --- Setup / Cleanup Effect ---
    useEffect(() => {
        console.log("TryOnRenderer Structure Test: Mounting, calling initThreeScene.");
        initThreeScene();
        let resizeObserver; const currentCanvas = canvasRef.current;
        if (currentCanvas) { resizeObserver = new ResizeObserver(() => { handleResize(); }); resizeObserver.observe(currentCanvas); }
        return () => {
            console.log("TryOnRenderer Structure Test: Unmounting, cleaning up...");
            resizeObserver?.disconnect(); cancelAnimationFrame(animationFrameHandle.current); isInitialized.current = false;
            videoTextureRef.current?.dispose(); videoTextureRef.current = null;
            imageTextureRef.current?.dispose(); imageTextureRef.current = null;
            // segmentationTextureRef.current?.dispose(); segmentationTextureRef.current = null; // No seg texture ref used
            planeMeshRef.current?.geometry?.dispose();
            planeMeshRef.current?.material?.map?.dispose();
            planeMeshRef.current?.material?.dispose(); planeMeshRef.current = null;
            rendererInstanceRef.current?.dispose(); rendererInstanceRef.current = null;
            sceneRef.current = null; cameraRef.current = null;
            console.log("TryOnRenderer Structure Test: Cleanup complete.");
        };
     }, [initThreeScene, handleResize]);


    // --- JSX ---
    return ( <canvas ref={canvasRef} className={`renderer-canvas ${className || ''}`} style={{ display: 'block', width: '100%', height: '100%', ...(style || {}) }} /> );

});
TryOnRenderer.displayName = 'TryOnRenderer';
export default TryOnRenderer;