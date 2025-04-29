// src/components/TryOnRenderer.jsx - Log Video Texture Effect + Minimal Composer

import React, { useRef, forwardRef, useEffect, useCallback } from 'react';
import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { CopyShader } from 'three/examples/jsm/shaders/CopyShader.js';

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

    // ***** ADD LOGGING to Video Texture Effect *****
    useEffect(() => {
        const videoElement = videoRefProp?.current;
        console.log(`VideoTexture Effect Triggered: isStatic=${isStatic}, videoElement Exists=${!!videoElement}`);

        if (!isStatic && videoElement) {
            console.log(` -> Condition MET: Not static and videoElement exists.`);
            // Check if texture needs creation/update
            if (!videoTextureRef.current || videoTextureRef.current.image !== videoElement) {
                 console.log(" -> Creating/Updating Video Texture...");
                 videoTextureRef.current?.dispose(); // Dispose previous if exists
                 try {
                      videoTextureRef.current = new THREE.VideoTexture(videoElement);
                      videoTextureRef.current.colorSpace = THREE.SRGBColorSpace;
                      console.log(" -> VideoTexture CREATED/ASSIGNED to ref:", videoTextureRef.current);
                 } catch (texError) {
                      console.error(" -> ERROR Creating VideoTexture:", texError);
                      videoTextureRef.current = null; // Ensure ref is null on error
                 }
            } else {
                 console.log(" -> VideoTexture already exists and matches videoElement.");
            }
        } else {
             console.log(` -> Condition NOT MET: isStatic=${isStatic} or videoElement missing.`);
             // Dispose texture if mode switched or element removed
             if (videoTextureRef.current) {
                 console.log(" -> Disposing existing Video Texture because mode changed or element removed.");
                 videoTextureRef.current.dispose();
                 videoTextureRef.current = null;
             }
        }
        // Log the final state of the ref after logic
        console.log(` -> VideoTexture Effect END: videoTextureRef.current is ${videoTextureRef.current ? 'set' : 'null'}`);
    }, [isStatic, videoRefProp]); // Keep dependencies
    // ********************************************

    useEffect(() => { /* Image Texture Logic (no changes) */ }, [isStatic, imageElement]);


    // --- Handle Resizing / Scale Plane ---
    const handleResize = useCallback(() => { /* ... */ }, []);
    const fitPlaneToCamera = useCallback((textureWidth, textureHeight) => { /* ... */ }, []);


    // --- Render Loop (Use EffectComposer - Minimal) ---
     const renderLoop = useCallback(() => {
        animationFrameHandle.current = requestAnimationFrame(renderLoop);
        renderLoopCounter.current++;
        if (!isInitialized.current || !rendererInstanceRef.current || !composerRef.current || !basePlaneMeshRef.current || !basePlaneMeshRef.current.material) { return; }

        const logThisFrame = (renderLoopCounter.current <= 5 || renderLoopCounter.current % 150 === 0);

        try {
            // 1 & 2: Select Texture & Update Plane
            const baseMaterial = basePlaneMeshRef.current.material; let sourceWidth = 0, sourceHeight = 0; let textureToAssign = null; let isVideo = false;
            // *** Use videoTextureRef directly here ***
            if (!isStatic && videoTextureRef.current) {
                 textureToAssign = videoTextureRef.current; // Assign from ref
                 isVideo = true;
                 if(textureToAssign.image) {sourceWidth=textureToAssign.image.videoWidth; sourceHeight=textureToAssign.image.videoHeight;}
            } else if (isStatic && imageTextureRef.current) {
                 textureToAssign = imageTextureRef.current;
                 if(textureToAssign.image){sourceWidth=textureToAssign.image.naturalWidth; sourceHeight=textureToAssign.image.naturalHeight;}
                 if(textureToAssign.needsUpdate){textureToAssign.needsUpdate=true;}
            }

            if (logThisFrame) { console.log(` -> Loop ${renderLoopCounter.current}: textureToAssign=${textureToAssign?.constructor?.name ?? 'null'}, current map=${baseMaterial.map?.constructor?.name ?? 'null'}`); }

            if (baseMaterial.map !== textureToAssign) { baseMaterial.map = textureToAssign; baseMaterial.needsUpdate = true; }
            else if (textureToAssign && textureToAssign.needsUpdate) { baseMaterial.needsUpdate = true; }

            const planeVisible = !!baseMaterial.map && sourceWidth > 0 && sourceHeight > 0;
             if (planeVisible) { fitPlaneToCamera(sourceWidth, sourceHeight); const scaleX = Math.abs(basePlaneMeshRef.current.scale.x); const newScaleX = isVideo ? -scaleX : scaleX; if(basePlaneMeshRef.current.scale.x !== newScaleX) { basePlaneMeshRef.current.scale.x = newScaleX; } } else { if (basePlaneMeshRef.current?.scale.x !== 0 || basePlaneMeshRef.current?.scale.y !== 0) { basePlaneMeshRef.current?.scale.set(0, 0, 0); } }

            // Render using the Composer
            composerRef.current.render();

            if (planeVisible && textureToAssign?.needsUpdate) { textureToAssign.needsUpdate = false; }

        } catch (error) { console.error("Error in renderLoop:", error); }
    }, [fitPlaneToCamera, isStatic]);


    // --- Initialize Scene (Use EffectComposer with RenderPass + CopyShader Pass) ---
    const initThreeScene = useCallback(() => {
        if (!canvasRef.current || isInitialized.current) { return; }
        console.log("DEBUG: initThreeScene START (EffectComposer - RenderPass + Copy Pass)");
        try {
            const canvas = canvasRef.current; const initialWidth = canvas.clientWidth || 640; const initialHeight = canvas.clientHeight || 480;
            rendererInstanceRef.current = new THREE.WebGLRenderer({ canvas: canvas, antialias: true }); rendererInstanceRef.current.setSize(initialWidth, initialHeight); rendererInstanceRef.current.setPixelRatio(window.devicePixelRatio); rendererInstanceRef.current.outputColorSpace = THREE.SRGBColorSpace;
            baseSceneRef.current = new THREE.Scene(); baseCameraRef.current = new THREE.OrthographicCamera(-initialWidth / 2, initialWidth / 2, initialHeight / 2, -initialHeight / 2, 0.1, 10); baseCameraRef.current.position.z = 1; const planeGeometry = new THREE.PlaneGeometry(1, 1);
            // *** Use MeshBasicMaterial ***
            const planeMaterial = new THREE.MeshBasicMaterial({ map: null, side: THREE.DoubleSide, color: 0xffffff, transparent: true });
            basePlaneMeshRef.current = new THREE.Mesh(planeGeometry, planeMaterial);
            baseSceneRef.current.add(basePlaneMeshRef.current);

            composerRef.current = new EffectComposer(rendererInstanceRef.current);
            const renderPass = new RenderPass(baseSceneRef.current, baseCameraRef.current);
            composerRef.current.addPass(renderPass);
            const copyPass = new ShaderPass(CopyShader);
            copyPass.renderToScreen = true;
            composerRef.current.addPass(copyPass);
            console.log("DEBUG: EffectComposer setup complete (RenderPass + Copy Pass).");

            isInitialized.current = true; handleResize(); cancelAnimationFrame(animationFrameHandle.current); animationFrameHandle.current = requestAnimationFrame(renderLoop);
        } catch (error) { console.error("DEBUG: initThreeScene FAILED:", error); isInitialized.current = false; }
    }, [handleResize, renderLoop]); // Dependencies


    // --- Setup / Cleanup Effect ---
    useEffect(() => { initThreeScene(); let resizeObserver; const currentCanvas = canvasRef.current; if (currentCanvas) { resizeObserver = new ResizeObserver(() => { handleResize(); }); resizeObserver.observe(currentCanvas); } return () => { /* ... Simplified cleanup ... */ }; }, [initThreeScene, handleResize]);


    // --- JSX --- (No change)
    return ( <canvas ref={canvasRef} className={`renderer-canvas ${className || ''}`} style={{ display: 'block', width: '100%', height: '100%', ...(style || {}) }} /> );

});
TryOnRenderer.displayName = 'TryOnRenderer';
export default TryOnRenderer;