// src/components/TryOnRenderer.jsx - Simplify init deps, Log Loop Entry

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


    // --- Render Loop (Log Entry and Check) ---
     const renderLoop = useCallback(() => {
        animationFrameHandle.current = requestAnimationFrame(renderLoop);
        renderLoopCounter.current++;

        // *** Log immediately on entry ***
        // console.log(`RenderLoop CALLED - Frame ${renderLoopCounter.current}`);

        // Check initialization and essential refs
        if (!isInitialized.current || !rendererInstanceRef.current || !composerRef.current || !basePlaneMeshRef.current || !basePlaneMeshRef.current.material) {
            // *** Log if skipping ***
            if (renderLoopCounter.current % 10 === 1) { // Log periodically if stuck here
                 console.log(`RenderLoop skipping Frame ${renderLoopCounter.current}: isInitialized=${isInitialized.current}, renderer=${!!rendererInstanceRef.current}, composer=${!!composerRef.current}, plane=${!!basePlaneMeshRef.current}, material=${!!basePlaneMeshRef.current?.material}`);
            }
             return;
        }

        const logThisFrame = (renderLoopCounter.current === 1 || renderLoopCounter.current % 150 === 0);
        if (logThisFrame) console.log(` -> RenderLoop Frame ${renderLoopCounter.current}: Executing...`);

        try {
            // Log right before main logic
            // if (logThisFrame) console.log("   -> Entering render logic...");

            // 1 & 2: Select Texture & Update Plane (Condensed)
             const baseMaterial = basePlaneMeshRef.current.material; let sourceWidth = 0, sourceHeight = 0; let textureToAssign = null; let isVideo = false; if (!isStatic && videoTextureRef.current) { textureToAssign = videoTextureRef.current; isVideo = true; if(textureToAssign.image) {sourceWidth=textureToAssign.image.videoWidth; sourceHeight=textureToAssign.image.videoHeight;} } else if (isStatic && imageTextureRef.current) { textureToAssign = imageTextureRef.current; if(textureToAssign.image){sourceWidth=textureToAssign.image.naturalWidth; sourceHeight=textureToAssign.image.naturalHeight;} if(textureToAssign.needsUpdate){textureToAssign.needsUpdate=true;} } if(baseMaterial){ if (baseMaterial.map !== textureToAssign) { baseMaterial.map = textureToAssign; baseMaterial.needsUpdate = true; } else if (textureToAssign && textureToAssign.needsUpdate) { baseMaterial.needsUpdate = true; } } const planeVisible = !!baseMaterial?.map && sourceWidth > 0 && sourceHeight > 0; if (planeVisible) { fitPlaneToCamera(sourceWidth, sourceHeight); const scaleX = Math.abs(basePlaneMeshRef.current.scale.x); const newScaleX = isVideo ? -scaleX : scaleX; if(basePlaneMeshRef.current.scale.x !== newScaleX) { basePlaneMeshRef.current.scale.x = newScaleX; } } else { if (basePlaneMeshRef.current?.scale.x !== 0 || basePlaneMeshRef.current?.scale.y !== 0) { basePlaneMeshRef.current?.scale.set(0, 0, 0); } }

            // Render using the Composer
            // if(logThisFrame) console.log("   -> Calling composer.render()...");
            composerRef.current.render();
            // if(logThisFrame) console.log("   -> composer.render() finished.");


            if (planeVisible && textureToAssign?.needsUpdate) { textureToAssign.needsUpdate = false; }

        } catch (error) {
            console.error("Error in renderLoop:", error);
            // Stop loop on error to prevent spamming console
            cancelAnimationFrame(animationFrameHandle.current);
        }
    }, [fitPlaneToCamera, isStatic]); // Keep dependencies


    // --- Initialize Scene (SIMPLIFIED Dependency Array) ---
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

            composerRef.current = new EffectComposer(rendererInstanceRef.current);
            const renderPass = new RenderPass(baseSceneRef.current, baseCameraRef.current);
            composerRef.current.addPass(renderPass);
            const outputPass = new OutputPass(); // OutputPass handles renderToScreen implicitly
            composerRef.current.addPass(outputPass);
            console.log("DEBUG: EffectComposer setup complete (RenderPass + OutputPass).");

            isInitialized.current = true; // Set initialized flag
            console.log("DEBUG: isInitialized set to true.");
            handleResize(); // Call resize after setup

            console.log("DEBUG: Requesting first animation frame...");
            cancelAnimationFrame(animationFrameHandle.current); // Clear previous just in case
            // *** Directly call the renderLoop function instance created in this scope ***
            animationFrameHandle.current = requestAnimationFrame(renderLoop);

        } catch (error) { console.error("DEBUG: initThreeScene FAILED:", error); isInitialized.current = false; }
    // *** REMOVED renderLoop from dependency array ***
    }, [handleResize]);


    // --- Setup / Cleanup Effect ---
    useEffect(() => {
        console.log("DEBUG: Setup Effect RUNNING, calling initThreeScene...");
        initThreeScene();
        let resizeObserver; const currentCanvas = canvasRef.current;
        if (currentCanvas) { resizeObserver = new ResizeObserver(() => { handleResize(); }); resizeObserver.observe(currentCanvas); }
        return () => { console.log("DEBUG: Cleanup Effect RUNNING..."); /* ... Simplified cleanup ... */ };
     }, [initThreeScene, handleResize]); // Keep dependencies


    // --- JSX --- (No change)
    return ( <canvas ref={canvasRef} className={`renderer-canvas ${className || ''}`} style={{ display: 'block', width: '100%', height: '100%', ...(style || {}) }} /> );

});
TryOnRenderer.displayName = 'TryOnRenderer';
export default TryOnRenderer;