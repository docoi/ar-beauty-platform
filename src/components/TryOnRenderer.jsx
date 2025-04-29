// src/components/TryOnRenderer.jsx - Initial Direct Render + Minimal Composer

import React, { useRef, forwardRef, useEffect, useCallback } from 'react';
import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';

const TryOnRenderer = forwardRef(({
    videoRefProp, imageElement,
    mediaPipeResults, segmentationResults, isStatic, brightness, contrast, effectIntensity,
    className, style
 }, ref) => {

    // --- Core Refs / Internal State Refs ---
    const canvasRef = useRef(null); const rendererInstanceRef = useRef(null); const animationFrameHandle = useRef(null); const isInitialized = useRef(false);
    const baseSceneRef = useRef(null); const baseCameraRef = useRef(null); const basePlaneMeshRef = useRef(null); const videoTextureRef = useRef(null);
    const imageTextureRef = useRef(null);
    const composerRef = useRef(null);
    const renderLoopCounter = useRef(0);

    // --- Prop Effects / Texture Effects ---
    useEffect(() => { /* Video Texture */ }, [isStatic, videoRefProp]);
    useEffect(() => { /* Image Texture */ }, [isStatic, imageElement]);


    // --- Handle Resizing / Scale Plane ---
    const handleResize = useCallback(() => { /* ... Includes composer resize ... */ }, []);
    const fitPlaneToCamera = useCallback((textureWidth, textureHeight) => { /* ... */ }, []);


    // --- Render Loop (Use EffectComposer - Minimal) ---
     const renderLoop = useCallback(() => {
        animationFrameHandle.current = requestAnimationFrame(renderLoop);
        renderLoopCounter.current++;
        if (!isInitialized.current || !rendererInstanceRef.current || !composerRef.current || !basePlaneMeshRef.current || !basePlaneMeshRef.current.material) { return; }

        try {
            // 1 & 2: Select Texture & Update Plane (Condensed)
             const baseMaterial = basePlaneMeshRef.current.material; let sourceWidth = 0, sourceHeight = 0; let textureToAssign = null; let isVideo = false; if (!isStatic && videoTextureRef.current) { textureToAssign = videoTextureRef.current; isVideo = true; if(textureToAssign.image) {sourceWidth=textureToAssign.image.videoWidth; sourceHeight=textureToAssign.image.videoHeight;} } else if (isStatic && imageTextureRef.current) { textureToAssign = imageTextureRef.current; if(textureToAssign.image){sourceWidth=textureToAssign.image.naturalWidth; sourceHeight=textureToAssign.image.naturalHeight;} if(textureToAssign.needsUpdate){textureToAssign.needsUpdate=true;} } if(baseMaterial){ if (baseMaterial.map !== textureToAssign) { baseMaterial.map = textureToAssign; baseMaterial.needsUpdate = true; } else if (textureToAssign && textureToAssign.needsUpdate) { baseMaterial.needsUpdate = true; } } const planeVisible = !!baseMaterial?.map && sourceWidth > 0 && sourceHeight > 0; if (planeVisible) { fitPlaneToCamera(sourceWidth, sourceHeight); const scaleX = Math.abs(basePlaneMeshRef.current.scale.x); const newScaleX = isVideo ? -scaleX : scaleX; if(basePlaneMeshRef.current.scale.x !== newScaleX) { basePlaneMeshRef.current.scale.x = newScaleX; } } else { if (basePlaneMeshRef.current?.scale.x !== 0 || basePlaneMeshRef.current?.scale.y !== 0) { basePlaneMeshRef.current?.scale.set(0, 0, 0); } }

            // Render using the Composer
            composerRef.current.render();

            if (planeVisible && textureToAssign?.needsUpdate) { textureToAssign.needsUpdate = false; }

        } catch (error) { console.error("Error in renderLoop:", error); }
    }, [fitPlaneToCamera, isStatic]);


    // --- Initialize Scene (Initial Direct Render Attempt) ---
    const initThreeScene = useCallback(() => {
        if (!canvasRef.current || isInitialized.current) { return; }
        console.log("DEBUG: initThreeScene START (EffectComposer - RenderPass + OutputPass)");
        try {
            const canvas = canvasRef.current; const initialWidth = canvas.clientWidth || 640; const initialHeight = canvas.clientHeight || 480;
            rendererInstanceRef.current = new THREE.WebGLRenderer({ canvas: canvas, antialias: true }); rendererInstanceRef.current.setSize(initialWidth, initialHeight); rendererInstanceRef.current.setPixelRatio(window.devicePixelRatio); rendererInstanceRef.current.outputColorSpace = THREE.SRGBColorSpace;
            baseSceneRef.current = new THREE.Scene(); baseCameraRef.current = new THREE.OrthographicCamera(-initialWidth / 2, initialWidth / 2, initialHeight / 2, -initialHeight / 2, 0.1, 10); baseCameraRef.current.position.z = 1; const planeGeometry = new THREE.PlaneGeometry(1, 1);
            const planeMaterial = new THREE.MeshBasicMaterial({ map: null, side: THREE.DoubleSide, color: 0xffffff, transparent: true });
            basePlaneMeshRef.current = new THREE.Mesh(planeGeometry, planeMaterial);
            baseSceneRef.current.add(basePlaneMeshRef.current);

            // *** ATTEMPT an initial direct render before composer setup ***
            // This requires the video texture to be ready almost immediately.
            // We might need a short delay or a check for texture readiness.
             console.log("DEBUG: Attempting initial direct render...");
             const initialTexture = !isStatic ? videoTextureRef.current : imageTextureRef.current;
             if (initialTexture && basePlaneMeshRef.current) {
                  basePlaneMeshRef.current.material.map = initialTexture;
                  basePlaneMeshRef.current.material.needsUpdate = true;
                  // Need to size the plane first
                   let initialW = 0, initialH = 0;
                   if(!isStatic && initialTexture.image) {initialW = initialTexture.image.videoWidth; initialH = initialTexture.image.videoHeight;}
                   else if (isStatic && initialTexture.image) { initialW = initialTexture.image.naturalWidth; initialH = initialTexture.image.naturalHeight;}
                   if(initialW > 0 && initialH > 0) {
                       fitPlaneToCamera(initialW, initialH); // Size the plane
                       // Mirror if video
                       if (!isStatic) {
                           const scaleX = Math.abs(basePlaneMeshRef.current.scale.x);
                           basePlaneMeshRef.current.scale.x = -scaleX;
                       }
                       rendererInstanceRef.current.render(baseSceneRef.current, baseCameraRef.current);
                       console.log("DEBUG: Initial direct render executed.");
                   } else {
                       console.log("DEBUG: Initial direct render skipped (texture not ready/sized).");
                   }
             } else {
                  console.log("DEBUG: Initial direct render skipped (texture or plane not ready).");
             }
            // **************************************************************

            // Now setup EffectComposer
            composerRef.current = new EffectComposer(rendererInstanceRef.current);
            const renderPass = new RenderPass(baseSceneRef.current, baseCameraRef.current);
            composerRef.current.addPass(renderPass);
            const outputPass = new OutputPass();
            composerRef.current.addPass(outputPass);
            console.log("DEBUG: EffectComposer setup complete.");

            isInitialized.current = true; handleResize(); cancelAnimationFrame(animationFrameHandle.current); animationFrameHandle.current = requestAnimationFrame(renderLoop);
        } catch (error) { console.error("DEBUG: initThreeScene FAILED:", error); isInitialized.current = false; }
    // Add fitPlaneToCamera to dependencies as it's used in init now
    }, [handleResize, renderLoop, fitPlaneToCamera]);


    // --- Setup / Cleanup Effect ---
    useEffect(() => { initThreeScene(); let resizeObserver; const currentCanvas = canvasRef.current; if (currentCanvas) { resizeObserver = new ResizeObserver(() => { handleResize(); }); resizeObserver.observe(currentCanvas); } return () => { /* ... Simplified cleanup ... */ }; }, [initThreeScene, handleResize]);


    // --- JSX --- (No change)
    return ( <canvas ref={canvasRef} className={`renderer-canvas ${className || ''}`} style={{ display: 'block', width: '100%', height: '100%', ...(style || {}) }} /> );

});
TryOnRenderer.displayName = 'TryOnRenderer';
export default TryOnRenderer;