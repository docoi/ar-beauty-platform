// src/components/TryOnRenderer.jsx - CORRECTED - Define isStatic in renderLoop

import React, { useRef, forwardRef, useEffect, useCallback, useState, useMemo } from 'react';
import * as THREE from 'three';

console.log(`Using Three.js revision: ${THREE.REVISION}`);

const TryOnRenderer = forwardRef(({
    videoElement, imageElement, mediaPipeResults, isStatic: isStaticProp, // Renamed prop slightly
    brightness, contrast, effectIntensity, className
 }, ref) => {

    // --- Core Refs ---
    const canvasRef = useRef(null);
    // ... other refs ...
    const postMaterialRef = useRef(null);
    const renderTargetRef = useRef(null);
    const segmentationTextureRef = useRef(null);
    const isInitialized = useRef(false);
    const animationFrameHandle = useRef(null);
    const baseSceneRef = useRef(null);
    const baseCameraRef = useRef(null);
    const postSceneRef = useRef(null);
    const postCameraRef = useRef(null);
    const rendererInstanceRef = useRef(null);
    const basePlaneMeshRef = useRef(null);
    const videoTextureRef = useRef(null);
    const imageTextureRef = useRef(null);

    // --- Internal State Refs (updated by props) ---
    const currentSource = useRef(null);
    const currentResults = useRef(null);
    const currentIsStatic = useRef(false); // Tracks the internal state based on prop
    const currentBrightness = useRef(1.0);
    const currentContrast = useRef(1.0);
    const currentIntensity = useRef(0.5);


    // --- Shaders --- (Keep Bare Minimum)
    const postVertexShader = `varying vec2 vUv; void main() { vUv = uv; gl_Position = vec4(position, 1.0); }`;
    const postFragmentShader = `
        uniform sampler2D uSceneTexture; varying vec2 vUv;
        void main() { gl_FragColor = texture2D(uSceneTexture, vUv); }
    `;

    // --- Update internal refs when props change ---
    useEffect(() => {
        // console.log("TryOnRenderer Effect: Props changed", { videoElement, imageElement, isStaticProp });
        if (isStaticProp && imageElement) { currentSource.current = imageElement; }
        else if (!isStaticProp && imageElement) { currentSource.current = imageElement; } // Mirror uses imageElement (canvas)
        else if (!isStaticProp && videoElement) { currentSource.current = videoElement; } // Fallback
         else { currentSource.current = null; }
        currentIsStatic.current = isStaticProp; // Update internal ref based on prop
    }, [videoElement, imageElement, isStaticProp]); // Depend on the prop

    useEffect(() => { currentResults.current = mediaPipeResults; }, [mediaPipeResults]);

    useEffect(() => {
        // Use isStaticProp to decide if correction applies
        currentBrightness.current = isStaticProp ? Math.max(0.1, brightness || 1.0) : 1.0;
        currentContrast.current = isStaticProp ? Math.max(0.1, contrast || 1.0) : 1.0;
    }, [isStaticProp, brightness, contrast]); // Depend on the prop

    useEffect(() => { currentIntensity.current = effectIntensity; }, [effectIntensity]);


    // --- Handle Resizing ---
    const handleResize = useCallback(() => { /* ... */ }, []);
    // --- Scale Base Plane ---
    const fitPlaneToCamera = useCallback((textureWidth, textureHeight) => { /* ... */ }, []);


    // --- Render Loop --- (Reads internal refs, safety checks added previously)
     const renderLoop = useCallback(() => {
        animationFrameHandle.current = requestAnimationFrame(renderLoop);
        if (!isInitialized.current || !rendererInstanceRef.current || !baseSceneRef.current || !baseCameraRef.current || !postSceneRef.current || !postCameraRef.current || !basePlaneMeshRef.current || !postMaterialRef.current || !renderTargetRef.current) return;

        try {
            const postUniforms = postMaterialRef.current.uniforms;
            if (!postUniforms) { console.warn("RenderLoop skipped: postUniforms not ready."); return; }

            // *** Read internal state refs ***
            const sourceElement = currentSource.current;
            const results = currentResults.current;
            const isStatic = currentIsStatic.current; // *** DEFINE isStatic from ref ***
            // const brightness = currentBrightness.current; // Not used in bare shader
            // const contrast = currentContrast.current;   // Not used in bare shader
            // const intensity = currentIntensity.current; // Not used in bare shader
             // *** ----------------------- ***

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
             if (textureToAssign && textureToAssign.needsUpdate && !(textureToAssign instanceof THREE.VideoTexture)) { textureToAssign.needsUpdate = true; }


            // 2. Update Plane Scale & Mirroring
            const planeVisible = baseMaterial.map && sourceWidth > 0 && sourceHeight > 0;
             if (planeVisible) {
                fitPlaneToCamera(sourceWidth, sourceHeight);
                const scaleX = Math.abs(basePlaneMeshRef.current.scale.x);
                // *** Now uses the defined 'isStatic' variable ***
                const newScaleX = !isStatic ? -scaleX : scaleX; // Flip if NOT static (Mirror mode uses canvas but isStatic=false)
                if(basePlaneMeshRef.current.scale.x !== newScaleX) { basePlaneMeshRef.current.scale.x = newScaleX; }
             } else { /* ... hide plane ... */ }


            // 3. Render Base Scene to Target
             if (planeVisible) { /* ... render to target ... */ }
             else { /* ... clear target ... */ }


            // 4. Update Post-Processing Uniforms
            if (postUniforms.uSceneTexture) { postUniforms.uSceneTexture.value = renderTargetRef.current.texture; } else { /*...*/ }
             // Update Segmentation Mask Texture (if uniform defined on material)
             const segmentationMask = results?.segmentationMasks?.[0]; const maskUniform = postUniforms.uSegmentationMask;
             if (maskUniform && segmentationMask?.mask) { /* ... update mask texture ... */ }
             else if (maskUniform && maskUniform.value !== null) { maskUniform.value = null; }


            // 5. Render Post-Processing Scene to Screen
            rendererInstanceRef.current.render(postSceneRef.current, postCameraRef.current);

        } catch (error) { console.error("Error in renderLoop:", error); }
    }, [fitPlaneToCamera]);


    // --- Initialize Scene --- (Keep Bare Minimum Shader & ONLY uSceneTexture Uniform)
    const initThreeScene = useCallback(() => { /* ... */ }, [handleResize, postVertexShader, postFragmentShader, renderLoop]);


    // --- Effect for Initial Setup / Resize Observer ---
    useEffect(() => { /* ... */ }, [initThreeScene, handleResize]);
    // --- REMOVED useImperativeHandle ---
    // --- JSX ---
    return ( <canvas ref={canvasRef} className={`renderer-canvas ${className || ''}`} style={{ display: 'block', width: '100%', height: '100%' }} /> );
});

TryOnRenderer.displayName = 'TryOnRenderer';
export default TryOnRenderer;