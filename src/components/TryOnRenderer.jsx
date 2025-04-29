// src/components/TryOnRenderer.jsx - Direct Render + MeshBasicMaterial + EMPTY onBeforeCompile

import React, { useRef, forwardRef, useEffect, useCallback } from 'react';
import * as THREE from 'three';

const TryOnRenderer = forwardRef(({
    videoRefProp, imageElement, mediaPipeResults, segmentationResults, isStatic,
    brightness, contrast, effectIntensity, className, style
 }, ref) => {

    // --- Core Refs / Internal State Refs ---
    const canvasRef = useRef(null); const rendererInstanceRef = useRef(null); const animationFrameHandle = useRef(null); const isInitialized = useRef(false);
    const baseSceneRef = useRef(null); const baseCameraRef = useRef(null); const basePlaneMeshRef = useRef(null);
    const videoTextureRef = useRef(null); const imageTextureRef = useRef(null);
    const segmentationTextureRef = useRef(null); const currentIntensity = useRef(0.5);
    const renderLoopCounter = useRef(0); const lastMaskUpdateTime = useRef(0);
    const customUniforms = useRef({ uSegmentationMask: { value: null }, uEffectIntensity: { value: 0.5 }, uHasMask: { value: false } });

    // --- Prop Effects / Texture Effects / Mask Effect ---
    useEffect(() => { currentIntensity.current = effectIntensity; customUniforms.current.uEffectIntensity.value = effectIntensity; }, [effectIntensity]);
    useEffect(() => { /* Video Texture Creation */ }, [isStatic, videoRefProp]);
    useEffect(() => { /* Image Texture Creation */ }, [isStatic, imageElement]);
    useEffect(() => { /* Mask Texture Creation */ }, [segmentationResults, isStatic]);


    // --- Handle Resizing / Scale Plane ---
    const handleResize = useCallback(() => { /* ... */ }, []);
    const fitPlaneToCamera = useCallback((textureWidth, textureHeight) => { /* ... */ }, []);

    // --- ***** Shader Injection Logic (EMPTY) *****---
    const patchShader = useCallback((shader) => {
        console.log("DEBUG: EMPTY patchShader called. No modifications applied.");
        // DO NOTHING - Just log that it was called
    }, []); // No dependencies needed for empty function
    // --- ****************************************** ---


    // --- Render Loop (Direct Rendering, Update Uniforms on Material - though unused) ---
     const renderLoop = useCallback(() => {
        animationFrameHandle.current = requestAnimationFrame(renderLoop);
        if (!isInitialized.current || !rendererInstanceRef.current || !baseSceneRef.current || !baseCameraRef.current || !basePlaneMeshRef.current || !basePlaneMeshRef.current.material ) { return; }

        try {
            // 1. Select Source Texture & Update Material Map
            const baseMaterial = basePlaneMeshRef.current.material;
            let sourceWidth = 0, sourceHeight = 0; let textureToAssign = null; let isVideo = false;
            if (!isStatic && videoTextureRef.current) { textureToAssign = videoTextureRef.current; isVideo = true; if(textureToAssign.image) {sourceWidth=textureToAssign.image.videoWidth; sourceHeight=textureToAssign.image.videoHeight;} } else if (isStatic && imageTextureRef.current) { textureToAssign = imageTextureRef.current; if(textureToAssign.image){sourceWidth=textureToAssign.image.naturalWidth; sourceHeight=textureToAssign.image.naturalHeight;} if(textureToAssign.needsUpdate){textureToAssign.needsUpdate=true;} }
            if (baseMaterial.map !== textureToAssign) { baseMaterial.map = textureToAssign; baseMaterial.needsUpdate = true; } else if (textureToAssign?.needsUpdate) { baseMaterial.needsUpdate = true; }

            // 2. Update Plane Scale & Mirroring
            const planeVisible = !!baseMaterial.map && sourceWidth > 0 && sourceHeight > 0;
             if (planeVisible) { fitPlaneToCamera(sourceWidth, sourceHeight); const scaleX = Math.abs(basePlaneMeshRef.current.scale.x); const newScaleX = isVideo ? -scaleX : scaleX; if(basePlaneMeshRef.current.scale.x !== newScaleX) { basePlaneMeshRef.current.scale.x = newScaleX; } } else { if (basePlaneMeshRef.current?.scale.x !== 0 || basePlaneMeshRef.current?.scale.y !== 0) { basePlaneMeshRef.current?.scale.set(0, 0, 0); } }

            // 3. Update Uniforms (but shader is not patched)
             if (baseMaterial.userData.shader) {
                 baseMaterial.userData.shader.uniforms.uSegmentationMask.value = segmentationTextureRef.current;
                 baseMaterial.userData.shader.uniforms.uHasMask.value = !!segmentationTextureRef.current;
             }

            // 4. Render Base Scene DIRECTLY to Screen
            rendererInstanceRef.current.setRenderTarget(null);
            rendererInstanceRef.current.setClearColor(0x000000, 1);
            rendererInstanceRef.current.clear();
             if (planeVisible) { rendererInstanceRef.current.render(baseSceneRef.current, baseCameraRef.current); if (textureToAssign?.needsUpdate) { textureToAssign.needsUpdate = false; } }

        } catch (error) { console.error("Error in renderLoop:", error); }
    }, [fitPlaneToCamera, isStatic]); // Keep dependencies


    // --- Initialize Scene (Direct Rendering with MeshBasicMaterial + EMPTY onBeforeCompile) ---
    const initThreeScene = useCallback(() => {
        if (!canvasRef.current || isInitialized.current) return;
        console.log("DEBUG: initThreeScene START (Direct Rendering + EMPTY onBeforeCompile)");
        try {
            const canvas = canvasRef.current; const initialWidth = canvas.clientWidth || 640; const initialHeight = canvas.clientHeight || 480;
            rendererInstanceRef.current = new THREE.WebGLRenderer({ canvas: canvas, antialias: true }); rendererInstanceRef.current.setSize(initialWidth, initialHeight); rendererInstanceRef.current.setPixelRatio(window.devicePixelRatio); rendererInstanceRef.current.outputColorSpace = THREE.SRGBColorSpace;
            baseSceneRef.current = new THREE.Scene(); baseCameraRef.current = new THREE.OrthographicCamera(-initialWidth / 2, initialWidth / 2, initialHeight / 2, -initialHeight / 2, 0.1, 10); baseCameraRef.current.position.z = 1;
            const planeGeometry = new THREE.PlaneGeometry(1, 1);

            // *** Create MeshBasicMaterial ***
            const planeMaterial = new THREE.MeshBasicMaterial({ map: null, side: THREE.DoubleSide, color: 0xffffff, transparent: true });
            // *** Assign EMPTY patchShader ***
            planeMaterial.onBeforeCompile = patchShader; // Assign the empty function
            // ******************************

            basePlaneMeshRef.current = new THREE.Mesh(planeGeometry, planeMaterial);
            baseSceneRef.current.add(basePlaneMeshRef.current);
            console.log("DEBUG: Base scene created with MeshBasicMaterial + EMPTY onBeforeCompile.");

            isInitialized.current = true; handleResize(); cancelAnimationFrame(animationFrameHandle.current); animationFrameHandle.current = requestAnimationFrame(renderLoop);
        } catch (error) { console.error("DEBUG: initThreeScene ERROR:", error); isInitialized.current = false; }
    // Update dependencies
    }, [handleResize, renderLoop, patchShader]); // Include patchShader


    // --- Setup / Cleanup Effect --- (Simplified Cleanup)
    useEffect(() => { initThreeScene(); let resizeObserver; const currentCanvas = canvasRef.current; if (currentCanvas) { resizeObserver = new ResizeObserver(() => { handleResize(); }); resizeObserver.observe(currentCanvas); } return () => { /* ... Simplified cleanup ... */ }; }, [initThreeScene, handleResize]);


    // --- JSX --- (No change)
    return ( <canvas ref={canvasRef} className={`renderer-canvas ${className || ''}`} style={{ display: 'block', width: '100%', height: '100%', ...(style || {}) }} /> );

});
TryOnRenderer.displayName = 'TryOnRenderer';
export default TryOnRenderer;