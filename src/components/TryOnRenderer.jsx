// src/components/TryOnRenderer.jsx - Log Texture Assignment + Minimal Composer

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
    useEffect(() => { /* Video Texture */ }, [isStatic, videoRefProp]);
    useEffect(() => { /* Image Texture */ }, [isStatic, imageElement]);


    // --- Handle Resizing / Scale Plane ---
    const handleResize = useCallback(() => { /* ... */ }, []);
    const fitPlaneToCamera = useCallback((textureWidth, textureHeight) => { /* ... */ }, []);


    // --- Render Loop (Log Texture Assignment) ---
     const renderLoop = useCallback(() => {
        animationFrameHandle.current = requestAnimationFrame(renderLoop);
        renderLoopCounter.current++;

        if (!isInitialized.current || !rendererInstanceRef.current || !composerRef.current || !basePlaneMeshRef.current || !basePlaneMeshRef.current.material) { // Add material check
             return;
        }

        const logThisFrame = (renderLoopCounter.current <= 5 || renderLoopCounter.current % 150 === 0); // Log first 5 frames + periodically
        if (logThisFrame) console.log(`RenderLoop Frame ${renderLoopCounter.current}, isInitialized=${isInitialized.current}`);


        try {
            // 1 & 2: Select Texture & Update Plane
            const baseMaterial = basePlaneMeshRef.current.material; // Should be MeshBasicMaterial
            let sourceWidth = 0, sourceHeight = 0; let textureToAssign = null; let isVideo = false;
            if (!isStatic && videoTextureRef.current) { textureToAssign = videoTextureRef.current; isVideo = true; if(textureToAssign.image) {sourceWidth=textureToAssign.image.videoWidth; sourceHeight=textureToAssign.image.videoHeight;} } else if (isStatic && imageTextureRef.current) { textureToAssign = imageTextureRef.current; if(textureToAssign.image){sourceWidth=textureToAssign.image.naturalWidth; sourceHeight=textureToAssign.image.naturalHeight;} if(textureToAssign.needsUpdate){textureToAssign.needsUpdate=true;} }

            // *** LOG Texture Assignment Status ***
             if (logThisFrame) {
                 console.log(` -> Loop ${renderLoopCounter.current}: Texture check: textureToAssign=${textureToAssign?.constructor?.name ?? 'null'}, current map=${baseMaterial.map?.constructor?.name ?? 'null'}, needsUpdate=${textureToAssign?.needsUpdate}`);
             }
            // ************************************

            // Assign texture directly to map
            if (baseMaterial.map !== textureToAssign) {
                 if(logThisFrame) console.log(` -> Loop ${renderLoopCounter.current}: Assigning texture map!`);
                 baseMaterial.map = textureToAssign;
                 baseMaterial.needsUpdate = true; // Material needs update when map changes
            } else if (textureToAssign && textureToAssign.needsUpdate) {
                 // If texture instance is same but content updated (e.g., static image loaded)
                 if(logThisFrame) console.log(` -> Loop ${renderLoopCounter.current}: Marking material needsUpdate (texture content updated).`);
                 baseMaterial.needsUpdate = true;
            }

            const planeVisible = !!baseMaterial.map && sourceWidth > 0 && sourceHeight > 0;
             if (planeVisible) {
                fitPlaneToCamera(sourceWidth, sourceHeight);
                const scaleX = Math.abs(basePlaneMeshRef.current.scale.x);
                const newScaleX = isVideo ? -scaleX : scaleX;
                if(basePlaneMeshRef.current.scale.x !== newScaleX) { basePlaneMeshRef.current.scale.x = newScaleX; }
             } else {
                if (basePlaneMeshRef.current?.scale.x !== 0 || basePlaneMeshRef.current?.scale.y !== 0) { basePlaneMeshRef.current?.scale.set(0, 0, 0); }
             }

             // Log before render call
             if (logThisFrame) console.log(` -> Loop ${renderLoopCounter.current}: Calling composer.render(). Plane visible: ${planeVisible}`);

            // Render using the Composer
            composerRef.current.render();

            // Log after render call
             if (logThisFrame) console.log(` -> Loop ${renderLoopCounter.current}: composer.render() finished.`);


            if (planeVisible && textureToAssign?.needsUpdate) {
                 textureToAssign.needsUpdate = false; // Reset flag *after* rendering
             }

        } catch (error) { console.error("Error in renderLoop:", error); }
    }, [fitPlaneToCamera, isStatic]); // Keep dependencies


    // --- Initialize Scene (Use EffectComposer with RenderPass + CopyShader Pass) ---
    const initThreeScene = useCallback(() => {
        if (!canvasRef.current || isInitialized.current) { return; }
        console.log("DEBUG: initThreeScene START (EffectComposer - RenderPass + Copy Pass)");
        try {
            const canvas = canvasRef.current; const initialWidth = canvas.clientWidth || 640; const initialHeight = canvas.clientHeight || 480;
            rendererInstanceRef.current = new THREE.WebGLRenderer({ canvas: canvas, antialias: true }); rendererInstanceRef.current.setSize(initialWidth, initialHeight); rendererInstanceRef.current.setPixelRatio(window.devicePixelRatio); rendererInstanceRef.current.outputColorSpace = THREE.SRGBColorSpace;
            baseSceneRef.current = new THREE.Scene(); baseCameraRef.current = new THREE.OrthographicCamera(-initialWidth / 2, initialWidth / 2, initialHeight / 2, -initialHeight / 2, 0.1, 10); baseCameraRef.current.position.z = 1;
            const planeGeometry = new THREE.PlaneGeometry(1, 1);
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
    }, [handleResize, renderLoop]);


    // --- Setup / Cleanup Effect ---
    useEffect(() => { initThreeScene(); let resizeObserver; const currentCanvas = canvasRef.current; if (currentCanvas) { resizeObserver = new ResizeObserver(() => { handleResize(); }); resizeObserver.observe(currentCanvas); } return () => { /* ... Simplified cleanup ... */ }; }, [initThreeScene, handleResize]);


    // --- JSX --- (No change)
    return ( <canvas ref={canvasRef} className={`renderer-canvas ${className || ''}`} style={{ display: 'block', width: '100%', height: '100%', ...(style || {}) }} /> );

});
TryOnRenderer.displayName = 'TryOnRenderer';
export default TryOnRenderer;