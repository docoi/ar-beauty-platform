// src/components/TryOnRenderer.jsx - EffectComposer with RenderPass ONLY

import React, { useRef, forwardRef, useEffect, useCallback } from 'react';
import * as THREE from 'three';
// Import necessary EffectComposer passes
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
// REMOVED: ShaderPass import for this test
// import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
// REMOVED: UniformsUtils import for this test
// import { UniformsUtils } from 'three';

const TryOnRenderer = forwardRef(({
    videoRefProp, imageElement,
    // All other props are currently unused
    mediaPipeResults, segmentationResults, isStatic, brightness, contrast, effectIntensity,
    className, style
 }, ref) => {

    // --- Core Refs ---
    const canvasRef = useRef(null); const rendererInstanceRef = useRef(null); const animationFrameHandle = useRef(null); const isInitialized = useRef(false);
    const baseSceneRef = useRef(null); const baseCameraRef = useRef(null); const basePlaneMeshRef = useRef(null); const videoTextureRef = useRef(null);
    const imageTextureRef = useRef(null);
    // REMOVED: segmentationTextureRef
    const composerRef = useRef(null);
    // REMOVED: effectPassRef
    // --- Internal State Refs --- (Intensity only needed if we pass it somewhere, not here)
    // const currentIntensity = useRef(0.5);
    const renderLoopCounter = useRef(0);
    // REMOVED: lastMaskUpdateTime


    // --- Prop Effects / Texture Effects --- (No changes needed)
    // useEffect(() => { currentIntensity.current = effectIntensity; }, [effectIntensity]); // No intensity needed now
    useEffect(() => { /* Video Texture */ }, [isStatic, videoRefProp]);
    useEffect(() => { /* Image Texture */ }, [isStatic, imageElement]);
    // --- REMOVED Mask Texture Effect ---
    // useEffect(() => { /* Mask Texture Creation */ }, [segmentationResults, isStatic]);


    // --- Handle Resizing / Scale Plane --- (No changes needed)
    const handleResize = useCallback(() => { /* ... Composer resize needed ... */ const canvas = canvasRef.current; if (!rendererInstanceRef.current || !baseCameraRef.current || !composerRef.current || !canvas) return; const newWidth = canvas.clientWidth; const newHeight = canvas.clientHeight; if (newWidth === 0 || newHeight === 0) return; const currentSize = rendererInstanceRef.current.getSize(new THREE.Vector2()); if (currentSize.x === newWidth && currentSize.y === newHeight) return; try { rendererInstanceRef.current.setSize(newWidth, newHeight); composerRef.current.setSize(newWidth, newHeight); baseCameraRef.current.left = -newWidth / 2; baseCameraRef.current.right = newWidth / 2; baseCameraRef.current.top = newHeight / 2; baseCameraRef.current.bottom = -newHeight / 2; baseCameraRef.current.updateProjectionMatrix(); } catch(e) { console.error("Resize Error:", e);} }, []);
    const fitPlaneToCamera = useCallback((textureWidth, textureHeight) => { /* ... */ }, []);


    // --- Render Loop (Use EffectComposer - RenderPass Only) ---
     const renderLoop = useCallback(() => {
        animationFrameHandle.current = requestAnimationFrame(renderLoop);
        renderLoopCounter.current++; // Increment counter

        // Check initialization and essential refs for composer rendering
        if (!isInitialized.current || !rendererInstanceRef.current || !composerRef.current || !basePlaneMeshRef.current ) {
            // Log skip periodically if needed
            // if (renderLoopCounter.current % 150 === 1) console.log("RenderLoop skipping: Not initialized or refs missing.");
             return;
        }

        // Log entry point periodically
        const logThisFrame = (renderLoopCounter.current === 1 || renderLoopCounter.current % 150 === 0);
        if (logThisFrame) console.log(`RenderLoop Frame ${renderLoopCounter.current}, isInitialized=${isInitialized.current}`);

        try {
            // 1 & 2: Select Texture & Update Plane (Condensed)
            const baseMaterial = basePlaneMeshRef.current.material; let sourceWidth = 0, sourceHeight = 0; let textureToAssign = null; let isVideo = false;
            if (!isStatic && videoTextureRef.current) { textureToAssign = videoTextureRef.current; isVideo = true; if(textureToAssign.image) {sourceWidth=textureToAssign.image.videoWidth; sourceHeight=textureToAssign.image.videoHeight;} } else if (isStatic && imageTextureRef.current) { textureToAssign = imageTextureRef.current; if(textureToAssign.image){sourceWidth=textureToAssign.image.naturalWidth; sourceHeight=textureToAssign.image.naturalHeight;} if(textureToAssign.needsUpdate){textureToAssign.needsUpdate=true;} }
            if(baseMaterial){ if (baseMaterial.map !== textureToAssign) { baseMaterial.map = textureToAssign; baseMaterial.needsUpdate = true; } else if (textureToAssign && textureToAssign.needsUpdate) { baseMaterial.needsUpdate = true; } }
            const planeVisible = !!baseMaterial?.map && sourceWidth > 0 && sourceHeight > 0;
             if (planeVisible) { fitPlaneToCamera(sourceWidth, sourceHeight); const scaleX = Math.abs(basePlaneMeshRef.current.scale.x); const newScaleX = isVideo ? -scaleX : scaleX; if(basePlaneMeshRef.current.scale.x !== newScaleX) { basePlaneMeshRef.current.scale.x = newScaleX; } } else { if (basePlaneMeshRef.current?.scale.x !== 0 || basePlaneMeshRef.current?.scale.y !== 0) { basePlaneMeshRef.current?.scale.set(0, 0, 0); } }

            // *** NO Uniforms to update for RenderPass only ***

            // Render using the Composer (which only contains RenderPass)
            if(logThisFrame) console.log(" -> RenderLoop: Calling composer.render()...");
            composerRef.current.render(); // Renders the base scene via RenderPass
            if(logThisFrame) console.log(" -> RenderLoop: composer.render() finished.");

            // Reset texture update flag AFTER composer might have used it
            if (planeVisible && textureToAssign?.needsUpdate) {
                 textureToAssign.needsUpdate = false;
             }

        } catch (error) { console.error("Error in renderLoop:", error); }
    }, [fitPlaneToCamera, isStatic]); // Dependencies


    // --- Initialize Scene (RenderPass ONLY) ---
    const initThreeScene = useCallback(() => {
        if (!canvasRef.current || isInitialized.current) { return; }
        console.log("DEBUG: initThreeScene START (EffectComposer - RenderPass ONLY)");
        try {
            const canvas = canvasRef.current; const initialWidth = canvas.clientWidth || 640; const initialHeight = canvas.clientHeight || 480;
            rendererInstanceRef.current = new THREE.WebGLRenderer({ canvas: canvas, antialias: true }); rendererInstanceRef.current.setSize(initialWidth, initialHeight); rendererInstanceRef.current.setPixelRatio(window.devicePixelRatio); rendererInstanceRef.current.outputColorSpace = THREE.SRGBColorSpace;

            // Base Scene setup
            baseSceneRef.current = new THREE.Scene(); baseCameraRef.current = new THREE.OrthographicCamera(-initialWidth / 2, initialWidth / 2, initialHeight / 2, -initialHeight / 2, 0.1, 10); baseCameraRef.current.position.z = 1; const planeGeometry = new THREE.PlaneGeometry(1, 1); const planeMaterial = new THREE.MeshBasicMaterial({ map: null, side: THREE.DoubleSide, color: 0xffffff, transparent: true }); basePlaneMeshRef.current = new THREE.Mesh(planeGeometry, planeMaterial); baseSceneRef.current.add(basePlaneMeshRef.current);

            // Setup EffectComposer
            composerRef.current = new EffectComposer(rendererInstanceRef.current);
            // 1. ONLY Add RenderPass
            const renderPass = new RenderPass(baseSceneRef.current, baseCameraRef.current);
            // *** RenderPass usually doesn't render to screen by default if it's not the last pass
            // *** but if it's the ONLY pass, the composer might render it automatically.
            // *** Let's set it explicitly just in case composer needs it.
             renderPass.renderToScreen = true; // Explicitly render this pass to screen
            composerRef.current.addPass(renderPass);
            console.log("DEBUG: EffectComposer setup complete (RenderPass ONLY).");
            // *** NO ShaderPass added ***

            isInitialized.current = true; handleResize(); cancelAnimationFrame(animationFrameHandle.current); animationFrameHandle.current = requestAnimationFrame(renderLoop);
        } catch (error) { console.error("DEBUG: initThreeScene FAILED:", error); isInitialized.current = false; }
    // Update dependencies
    }, [handleResize, renderLoop]); // Removed shader dependencies


    // --- Setup / Cleanup Effect --- (Simplified Cleanup)
    useEffect(() => {
        initThreeScene();
        let resizeObserver; const currentCanvas = canvasRef.current;
        if (currentCanvas) { resizeObserver = new ResizeObserver(() => { handleResize(); }); resizeObserver.observe(currentCanvas); }
        return () => {
             console.log("DEBUG: Cleanup running (TryOnRenderer Unmount)...");
             resizeObserver?.disconnect(); cancelAnimationFrame(animationFrameHandle.current); isInitialized.current = false;
             console.log("DEBUG: Disposing Three.js resources (Composer Minimal)...");
             videoTextureRef.current?.dispose(); imageTextureRef.current?.dispose();
             // segmentationTextureRef?.dispose(); // No ref to dispose
             // renderTargetRef?.dispose(); // Composer manages targets
             basePlaneMeshRef.current?.geometry?.dispose(); basePlaneMeshRef.current?.material?.map?.dispose(); basePlaneMeshRef.current?.material?.dispose();
             // effectPassRef?.material?.dispose(); // No pass ref
             rendererInstanceRef.current?.dispose();
             videoTextureRef.current = null; imageTextureRef.current = null; segmentationTextureRef.current = null; renderTargetRef.current = null;
             basePlaneMeshRef.current = null; // postMaterialRef = null; // No ref
             rendererInstanceRef.current = null; baseSceneRef.current = null; // postSceneRef = null; // No ref
             baseCameraRef.current = null; // postCameraRef = null; // No ref
             composerRef.current = null; effectPassRef.current = null; // Nullify refs
             console.log("DEBUG: Three.js resources disposed.");
        };
     }, [initThreeScene, handleResize]);


    // --- JSX --- (No change)
    return ( <canvas ref={canvasRef} className={`renderer-canvas ${className || ''}`} style={{ display: 'block', width: '100%', height: '100%', ...(style || {}) }} /> );

});
TryOnRenderer.displayName = 'TryOnRenderer';
export default TryOnRenderer;