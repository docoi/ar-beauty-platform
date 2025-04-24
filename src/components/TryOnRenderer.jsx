// src/components/TryOnRenderer.jsx - Background Color Debugging

import React, { useRef, useImperativeHandle, forwardRef, useEffect, useCallback } from 'react';
import * as THREE from 'three';

console.log(`Using Three.js revision: ${THREE.REVISION}`);

const TryOnRenderer = forwardRef(({ videoWidth, videoHeight, className }, ref) => {
    const canvasRef = useRef(null);
    const rendererInstanceRef = useRef(null);
    const animationFrameHandle = useRef(null);
    const isInitialized = useRef(false);
    const baseSceneRef = useRef(null);
    const baseCameraRef = useRef(null);
    // ... other refs (planeMeshRef, postSceneRef, postCameraRef, etc.) are not strictly needed for this basic test

    // --- Handle Resizing (Simplified for debug) ---
    const handleResize = useCallback(() => {
        const canvas = canvasRef.current; if (!rendererInstanceRef.current || !baseCameraRef.current || !canvas) return;
        const newWidth = canvas.clientWidth; const newHeight = canvas.clientHeight; if (newWidth === 0 || newHeight === 0) return;
        const currentSize = rendererInstanceRef.current.getSize(new THREE.Vector2()); if (currentSize.x === newWidth && currentSize.y === newHeight) return;
        console.log(`DEBUG Resizing -> ${newWidth}x${newHeight}`);
        rendererInstanceRef.current.setSize(newWidth, newHeight);
        baseCameraRef.current.left = -newWidth / 2; baseCameraRef.current.right = newWidth / 2; baseCameraRef.current.top = newHeight / 2; baseCameraRef.current.bottom = -newHeight / 2; baseCameraRef.current.updateProjectionMatrix();
    }, []);

    // --- Initialize Scene (with background color steps) ---
    const initThreeScene = useCallback(() => {
        if (!canvasRef.current) {
            console.error("DEBUG Init: Canvas Ref is NULL!");
            return; // Cannot proceed without canvas
        }
        if (isInitialized.current) {
             console.log("DEBUG Init: Already initialized, skipping.");
             return;
        }

        // --- Step 1: Indicate Init Started ---
        console.log("DEBUG: initThreeScene START");
        canvasRef.current.style.backgroundColor = 'yellow'; // VISUAL CUE 1

        try {
            const canvas = canvasRef.current;
            const initialWidth = canvas.clientWidth || 300; // Use smaller default
            const initialHeight = canvas.clientHeight || 150;

            // --- Renderer (Check for context creation) ---
            rendererInstanceRef.current = new THREE.WebGLRenderer({ canvas: canvas, antialias: true, alpha: false }); // Ensure alpha is false
             if (!rendererInstanceRef.current.getContext()) {
                console.error("DEBUG Init: Failed to get WebGL Context!");
                canvasRef.current.style.backgroundColor = 'red'; // VISUAL CUE: Context failure
                return; // Stop if context fails
            }
            rendererInstanceRef.current.setClearColor(0x111111, 1); // Dark Gray clear
            rendererInstanceRef.current.setSize(initialWidth, initialHeight);
            rendererInstanceRef.current.setPixelRatio(window.devicePixelRatio);
            rendererInstanceRef.current.outputColorSpace = THREE.SRGBColorSpace;
             console.log("DEBUG Init: Renderer created.");

            // --- Scene & Camera (Basic) ---
            baseSceneRef.current = new THREE.Scene();
            baseCameraRef.current = new THREE.OrthographicCamera(-initialWidth / 2, initialWidth / 2, initialHeight / 2, -initialHeight / 2, 0.1, 10);
            baseCameraRef.current.position.z = 1;
            console.log("DEBUG Init: Scene & Camera created.");

            // --- Mark Initialized BEFORE starting loop ---
            isInitialized.current = true;
            console.log("DEBUG: initThreeScene ALMOST COMPLETE.");
            handleResize(); // Initial resize

            // --- Step 2: Indicate Init Success & Start Loop ---
            canvasRef.current.style.backgroundColor = 'blue'; // VISUAL CUE 2: Init successful
            console.log("DEBUG: Requesting first render loop frame.");
            cancelAnimationFrame(animationFrameHandle.current);
            animationFrameHandle.current = requestAnimationFrame(renderLoop);

        } catch (error) {
            console.error("DEBUG: initThreeScene ERROR:", error);
            if(canvasRef.current) canvasRef.current.style.backgroundColor = 'orange'; // VISUAL CUE: Init Error
            isInitialized.current = false; // Ensure flag is false on error
        }
    }, [handleResize, renderLoop]); // Added renderLoop dependency

    // --- Effect for Initial Setup / Resize Observer ---
    useEffect(() => {
         console.log("DEBUG: Mount/Init effect running.");
         initThreeScene(); // Attempt initialization

         let resizeObserver;
         const currentCanvas = canvasRef.current;
         if (currentCanvas) {
             resizeObserver = new ResizeObserver(() => { handleResize(); });
             resizeObserver.observe(currentCanvas);
         }

         return () => {
             console.log("DEBUG: Cleanup running...");
             resizeObserver?.disconnect(currentCanvas);
             cancelAnimationFrame(animationFrameHandle.current);
             isInitialized.current = false;
             // Only dispose if they were created
             rendererInstanceRef.current?.dispose();
             console.log("DEBUG: Cleanup finished.");
        };
    }, [initThreeScene, handleResize]); // Dependencies for setup

    // --- Render Loop (Changes background color) ---
    const renderLoop = useCallback((time) => {
        animationFrameHandle.current = requestAnimationFrame(renderLoop);

        if (!isInitialized.current || !rendererInstanceRef.current || !baseSceneRef.current || !baseCameraRef.current || !canvasRef.current) {
             // console.log("DEBUG Loop: Waiting..."); // Reduce noise
             return; // Stop if not initialized
        }

        // --- Step 3: Indicate Loop is Running ---
        // Cycle background color to show loop activity
        const cycle = Math.floor(time / 1000) % 2; // Change every second
        canvasRef.current.style.backgroundColor = cycle === 0 ? 'lightgreen' : 'darkgreen';

        try {
            // Minimal render: just clear the WebGL buffer
            rendererInstanceRef.current.render(baseSceneRef.current, baseCameraRef.current); // Render empty scene (or scene with just camera)
        } catch (renderError) {
             console.error("!!! RENDER LOOP ERROR:", renderError);
             if(canvasRef.current) canvasRef.current.style.backgroundColor = 'purple'; // VISUAL CUE: Render Loop Error
             cancelAnimationFrame(animationFrameHandle.current); // Stop loop on error
        }

    }, []); // No external dependencies for this simple loop


    // --- Expose Methods (NOOP for this test) ---
    useImperativeHandle(ref, () => ({
        renderResults: () => { /* NOOP */ },
        renderStaticImageResults: () => { /* NOOP */ },
        clearCanvas: () => { /* NOOP */ }
    }));

    // --- JSX ---
    return (
        // Make canvas background visible initially via CSS maybe?
        <canvas
            ref={canvasRef}
            className={`renderer-canvas ${className || ''}`}
            style={{ display: 'block', width: '100%', height: '100%', backgroundColor: 'pink' }} // Initial Pink CSS background
        />
    );
});

TryOnRenderer.displayName = 'TryOnRenderer';
export default TryOnRenderer;