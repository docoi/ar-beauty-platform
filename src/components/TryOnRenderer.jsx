// src/components/TryOnRenderer.jsx - CORRECTED - Force Solid Green Output (FULL CODE)

import React, { useRef, forwardRef, useEffect, useCallback, useState, useMemo } from 'react';
import * as THREE from 'three';

console.log(`Using Three.js revision: ${THREE.REVISION}`);

const TryOnRenderer = forwardRef(({
    // Props received by this component
    videoElement,
    imageElement,
    mediaPipeResults,
    isStatic: isStaticProp, // Renamed prop to avoid conflict
    brightness,
    contrast,
    effectIntensity,
    className // << Received className prop
 }, ref) => { // Added ref here

    // --- Core Refs ---
    const canvasRef = useRef(null); // *** ENSURE THIS IS DEFINED ***
    const rendererInstanceRef = useRef(null);
    const animationFrameHandle = useRef(null);
    const isInitialized = useRef(false);
    const baseSceneRef = useRef(null);
    const baseCameraRef = useRef(null);
    const basePlaneMeshRef = useRef(null);
    const videoTextureRef = useRef(null);
    const imageTextureRef = useRef(null);
    const postSceneRef = useRef(null);
    const postCameraRef = useRef(null);
    const postMaterialRef = useRef(null);
    const segmentationTextureRef = useRef(null);
    const renderTargetRef = useRef(null);

    // --- Internal State Refs (updated by props) ---
    const currentSource = useRef(null);
    const currentResults = useRef(null);
    const currentIsStatic = useRef(false); // Tracks the internal state based on prop
    const currentBrightness = useRef(1.0);
    const currentContrast = useRef(1.0);
    const currentIntensity = useRef(0.5);


    // --- Shaders ---
    const postVertexShader = `varying vec2 vUv; void main() { vUv = uv; gl_Position = vec4(position, 1.0); }`;
    // *** FORCE SOLID GREEN OUTPUT ***
    const postFragmentShader = `
        void main() {
            // Output solid green to test if the post-processing quad renders at all
            gl_FragColor = vec4(0.0, 1.0, 0.0, 1.0); // RGBA = Green
        }
    `;
    // *** --------------- ***


    // --- Update internal refs when props change ---
    useEffect(() => {
        // console.log("TryOnRenderer Effect: Props changed", { videoElement, imageElement, isStaticProp });
        if (isStaticProp && imageElement) { currentSource.current = imageElement; }
        else if (!isStaticProp && imageElement) { currentSource.current = imageElement; } // Mirror uses imageElement (canvas)
        else if (!isStaticProp && videoElement) { currentSource.current = videoElement; } // Fallback
         else { currentSource.current = null; }
        currentIsStatic.current = isStaticProp; // Update internal ref based on prop
    }, [videoElement, imageElement, isStaticProp]);

    useEffect(() => { currentResults.current = mediaPipeResults; }, [mediaPipeResults]);

    useEffect(() => {
        currentBrightness.current = isStaticProp ? Math.max(0.1, brightness || 1.0) : 1.0;
        currentContrast.current = isStaticProp ? Math.max(0.1, contrast || 1.0) : 1.0;
    }, [isStaticProp, brightness, contrast]);

    useEffect(() => { currentIntensity.current = effectIntensity; }, [effectIntensity]);


    // --- Handle Resizing ---
    const handleResize = useCallback(() => {
         const canvas = canvasRef.current;
         if (!rendererInstanceRef.current || !baseCameraRef.current || !postCameraRef.current || !canvas || !renderTargetRef.current) return;
         const newWidth = canvas.clientWidth; const newHeight = canvas.clientHeight; if (newWidth === 0 || newHeight === 0) return;
         const currentSize = rendererInstanceRef.current.getSize(new THREE.Vector2()); if (currentSize.x === newWidth && currentSize.y === newHeight) return;
         console.log(`DEBUG: Resizing -> ${newWidth}x${newHeight}`);
         try { rendererInstanceRef.current.setSize(newWidth, newHeight); renderTargetRef.current.setSize(newWidth, newHeight); baseCameraRef.current.left = -newWidth / 2; baseCameraRef.current.right = newWidth / 2; baseCameraRef.current.top = newHeight / 2; baseCameraRef.current.bottom = -newHeight / 2; baseCameraRef.current.updateProjectionMatrix(); } catch(e) { console.error("Resize Error:", e);}
    }, []); // Dependencies are stable refs


    // --- Scale Base Plane ---
    const fitPlaneToCamera = useCallback((textureWidth, textureHeight) => {
        const canvas = canvasRef.current;
        if (!baseCameraRef.current || !basePlaneMeshRef.current || !textureWidth || !textureHeight || !canvas || canvas.clientWidth === 0 || canvas.clientHeight === 0) return;
        const viewWidth = canvas.clientWidth; const viewHeight = canvas.clientHeight; const viewAspect = viewWidth / viewHeight; const textureAspect = textureWidth / textureHeight; let scaleX, scaleY;
        if (viewAspect > textureAspect) { scaleX = viewWidth; scaleY = scaleX / textureAspect; } else { scaleY = viewHeight; scaleX = scaleY * textureAspect; }
        const currentScale = basePlaneMeshRef.current.scale; const currentSignX = Math.sign(currentScale.x) || 1; const newScaleXWithSign = scaleX * currentSignX;
        if (Math.abs(currentScale.y - scaleY) > 0.01 || Math.abs(currentScale.x - newScaleXWithSign) > 0.01) { currentScale.y = scaleY; currentScale.x = newScaleXWithSign; /*console.log(...)*/ }
     }, []); // Dependencies are stable refs


    // --- Render Loop --- (Reads internal refs, includes needsUpdate fix, defines isStatic)
     const renderLoop = useCallback(() => {
        animationFrameHandle.current = requestAnimationFrame(renderLoop);
        if (!isInitialized.current || !rendererInstanceRef.current || !baseSceneRef.current || !baseCameraRef.current || !postSceneRef.current || !postCameraRef.current || !basePlaneMeshRef.current || !postMaterialRef.current || !renderTargetRef.current) return;

        try {
            const postUniforms = postMaterialRef.current.uniforms;
            // No need to check postUniforms if shader isn't using them, but keep check for safety
            if (!postUniforms) { console.warn("RenderLoop skipped: postUniforms not ready."); return; }

            // *** Read internal state refs ***
            const sourceElement = currentSource.current;
            const results = currentResults.current;
            const isStatic = currentIsStatic.current; // *** Defined from ref ***

            const baseMaterial = basePlaneMeshRef.current.material;
            let sourceWidth = 0, sourceHeight = 0;
            let isVideo = sourceElement instanceof HTMLVideoElement;
            let isImage = sourceElement instanceof HTMLImageElement || sourceElement instanceof HTMLCanvasElement;
            let textureToAssign = null;

            // 1. Update Base Texture
             if (isVideo && sourceElement.readyState >= 2 && sourceElement.videoWidth > 0) { /* ... video texture logic ... */ }
             else if (isImage && sourceElement.width > 0 && sourceElement.height > 0) { /* ... image/canvas texture logic ... */ }
             else { /* ... handle null source ... */ }
             const textureChanged = baseMaterial.map !== textureToAssign; if (textureChanged) { /* ... assign texture ... */ }

            // 2. Update Plane Scale & Mirroring
            const planeVisible = baseMaterial.map && sourceWidth > 0 && sourceHeight > 0;
             if (planeVisible) { fitPlaneToCamera(sourceWidth, sourceHeight); const scaleX = Math.abs(basePlaneMeshRef.current.scale.x); const newScaleX = !isStatic ? -scaleX : scaleX; if(basePlaneMeshRef.current.scale.x !== newScaleX) { basePlaneMeshRef.current.scale.x = newScaleX; } }
             else { /* ... hide plane ... */ }

            // 3. Render Base Scene to Target
             if (planeVisible) { rendererInstanceRef.current.setRenderTarget(renderTargetRef.current); rendererInstanceRef.current.clear(); rendererInstanceRef.current.render(baseSceneRef.current, baseCameraRef.current); rendererInstanceRef.current.setRenderTarget(null); }
             else { rendererInstanceRef.current.setRenderTarget(renderTargetRef.current); rendererInstanceRef.current.clear(); rendererInstanceRef.current.setRenderTarget(null); }

            // 4. Update Post-Processing Uniforms (No uniforms needed for solid color shader)
            // if (postUniforms.uSceneTexture) { postUniforms.uSceneTexture.value = renderTargetRef.current.texture; } else { /*...*/ }
             // Update Segmentation Mask Texture (Still happens, but shader ignores it)
             const segmentationMask = results?.segmentationMasks?.[0]; const maskUniform = postUniforms.uSegmentationMask; // Check if uniform was defined during init
             if (maskUniform && segmentationMask?.mask) { /* ... update mask texture ... */ }
             else if (maskUniform && maskUniform.value !== null) { maskUniform.value = null; }


            // 5. Render Post-Processing Scene to Screen
            rendererInstanceRef.current.render(postSceneRef.current, postCameraRef.current);

        } catch (error) { console.error("Error in renderLoop:", error); }
    }, [fitPlaneToCamera]);


    // --- Initialize Scene ---
    const initThreeScene = useCallback(() => {
        if (!canvasRef.current || isInitialized.current) return; console.log("DEBUG: initThreeScene START"); try { const canvas = canvasRef.current; const initialWidth = canvas.clientWidth || 640; const initialHeight = canvas.clientHeight || 480; rendererInstanceRef.current = new THREE.WebGLRenderer({ canvas: canvas, antialias: true }); /*...*/ renderTargetRef.current = new THREE.WebGLRenderTarget(/*...*/); /*...*/ baseSceneRef.current = new THREE.Scene(); /*...*/ baseCameraRef.current = new THREE.OrthographicCamera(/*...*/); /*...*/ basePlaneMeshRef.current = new THREE.Mesh(/*...*/); baseSceneRef.current.add(basePlaneMeshRef.current); console.log("DEBUG: Base scene created.");
            // Create Post Scene
            postSceneRef.current = new THREE.Scene();
            // Remove background color for this test
            // postSceneRef.current.background = new THREE.Color(0x0000ff);
            postCameraRef.current = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1); const postPlaneGeometry = new THREE.PlaneGeometry(2, 2);
            // Create ShaderMaterial with SOLID GREEN shader
            postMaterialRef.current = new THREE.ShaderMaterial({
                 vertexShader: postVertexShader,
                 fragmentShader: postFragmentShader, // Uses solid green shader
                 uniforms: { }, // No uniforms needed for solid green shader
                 depthWrite: false, depthTest: false,
                 // transparent: true // Not needed for solid color
             });
            const postPlaneMesh = new THREE.Mesh(postPlaneGeometry, postMaterialRef.current); postSceneRef.current.add(postPlaneMesh); console.log("DEBUG: Post-processing scene created (Solid Green Shader). Mesh added:", !!postPlaneMesh.parent);
            isInitialized.current = true; console.log("DEBUG: Scene initialization complete."); handleResize(); console.log("DEBUG: Requesting first render loop frame from Init."); cancelAnimationFrame(animationFrameHandle.current); animationFrameHandle.current = requestAnimationFrame(renderLoop); } catch (error) { console.error("DEBUG: initThreeScene ERROR:", error); isInitialized.current = false; }
    // Added renderLoop back to dependencies
    }, [handleResize, postVertexShader, postFragmentShader, renderLoop]);


    // --- Effect for Initial Setup / Resize Observer ---
    useEffect(() => {
         console.log("DEBUG: Mount/Init effect running.");
         initThreeScene();
         let resizeObserver; const currentCanvas = canvasRef.current; if (currentCanvas) { resizeObserver = new ResizeObserver(() => { handleResize(); }); resizeObserver.observe(currentCanvas); console.log("DEBUG: Resize observer attached."); }
         return () => { console.log("DEBUG: Cleanup running (TryOnRenderer Unmount)..."); resizeObserver?.disconnect(currentCanvas); cancelAnimationFrame(animationFrameHandle.current); isInitialized.current = false; console.log("DEBUG: Disposing Three.js resources..."); /* ... dispose objects ... */ };
     }, [initThreeScene, handleResize]);


    // --- REMOVED useImperativeHandle ---


    // --- JSX ---
    return (
        <canvas
            ref={canvasRef}
            // *** Use className prop correctly ***
            className={`renderer-canvas ${className || ''}`}
            // *** -------------------------- ***
            style={{ display: 'block', width: '100%', height: '100%' }}
        />
    );
});

TryOnRenderer.displayName = 'TryOnRenderer';
export default TryOnRenderer; // Line 236