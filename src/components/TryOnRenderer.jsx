// src/components/TryOnRenderer.jsx - BASELINE WEBGL RENDER ONLY (Transparent Background)
// Renders Video/Image using MeshBasicMaterial - No Effects or Masks

import React, { useRef, forwardRef, useEffect, useCallback } from 'react';
import * as THREE from 'three';

const TryOnRenderer = forwardRef(({
    videoRefProp, imageElement, isStatic, className, style
 }, ref) => {

    // --- Core Refs --- (No change)
    const canvasRef = useRef(null); const rendererInstanceRef = useRef(null);
    const animationFrameHandle = useRef(null); const isInitialized = useRef(false);
    const sceneRef = useRef(null); const cameraRef = useRef(null);
    const planeMeshRef = useRef(null); const videoTextureRef = useRef(null);
    const imageTextureRef = useRef(null);

    // --- Texture Management --- (No change)
    useEffect(() => { /* Video Texture Effect */ }, [isStatic, videoRefProp, videoRefProp?.current?.readyState]);
    useEffect(() => { /* Image Texture Effect */ }, [isStatic, imageElement, imageElement?.complete]);

    // --- Resizing Logic --- (No change)
    const handleResize = useCallback(() => { /* ... */ }, []);
    // --- Plane Scaling Logic --- (No change)
    const fitPlaneToCamera = useCallback((textureWidth, textureHeight) => { /* ... */ }, []);

    // --- Render Loop --- (No change)
     const renderLoop = useCallback(() => { /* ... */ }, [fitPlaneToCamera, isStatic]);

    // --- Initialization (MODIFIED RENDERER OPTIONS) ---
    const initThreeScene = useCallback(() => {
        console.log("TryOnRenderer (WebGL Base): initThreeScene START"); if (!canvasRef.current || isInitialized.current) return;
        try {
            const canvas = canvasRef.current; const initialWidth = canvas.clientWidth || 640; const initialHeight = canvas.clientHeight || 480;

            // <<< MODIFICATION START >>>
            const renderer = new THREE.WebGLRenderer({
                canvas: canvas,
                antialias: true,
                alpha: true // <<< Set alpha to true for transparency
            });
            renderer.setClearColor(0x000000, 0); // <<< Set clear color alpha to 0
            // <<< MODIFICATION END >>>

            renderer.setSize(initialWidth, initialHeight); renderer.setPixelRatio(window.devicePixelRatio); renderer.outputColorSpace = THREE.SRGBColorSpace; rendererInstanceRef.current = renderer;
            sceneRef.current = new THREE.Scene(); cameraRef.current = new THREE.OrthographicCamera(-initialWidth / 2, initialWidth / 2, initialHeight / 2, -initialHeight / 2, 0.1, 10); cameraRef.current.position.z = 1;
            const planeGeometry = new THREE.PlaneGeometry(1, 1);
            // Make material transparent if background needs to show through *potential gaps*
            // Although alpha:true on renderer should be enough if plane covers area
             const planeMaterial = new THREE.MeshBasicMaterial({
                 map: null, side: THREE.DoubleSide, color: 0xffffff, // Use white color, map will override
                 // transparent: true, // Try adding this if needed
                 // opacity: 1.0
             });
            planeMeshRef.current = new THREE.Mesh(planeGeometry, planeMaterial); sceneRef.current.add(planeMeshRef.current);
            isInitialized.current = true; handleResize(); cancelAnimationFrame(animationFrameHandle.current); animationFrameHandle.current = requestAnimationFrame(renderLoop); console.log("TryOnRenderer (WebGL Base): initThreeScene SUCCESSFUL.");
        } catch (error) { console.error("TryOnRenderer (WebGL Base): initThreeScene FAILED:", error); isInitialized.current = false; }
    }, [handleResize, renderLoop]);

    // --- Setup / Cleanup Effect --- (No change)
    useEffect(() => { /* ... */ }, [initThreeScene, handleResize]);

    // --- JSX --- (No change)
    return ( <canvas ref={canvasRef} className={`webgl-canvas ${className || ''}`} style={{ display: 'block', width: '100%', height: '100%', ...(style || {}) }} /> );
});
TryOnRenderer.displayName = 'TryOnRenderer';
export default TryOnRenderer;