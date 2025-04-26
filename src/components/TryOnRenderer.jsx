// src/components/TryOnRenderer.jsx - REVISED - Internal Loop, Prop-Driven

import React, { useRef, forwardRef, useEffect, useCallback, useState, useMemo } from 'react'; // Added useState, useMemo
import * as THREE from 'three';

console.log(`Using Three.js revision: ${THREE.REVISION}`);

// Keep using forwardRef, maybe parent still needs access for something else later
const TryOnRenderer = forwardRef(({
    // Accept source elements and results directly as props
    videoElement,     // HTMLVideoElement or null
    imageElement,     // HTMLImageElement or null
    mediaPipeResults, // MediaPipe results or null
    isStatic,         // Boolean indicating if imageElement is the source
    brightness,       // Brightness for static image
    contrast,         // Contrast for static image
    effectIntensity,  // Effect intensity
    className
 }, ref) => {

    // --- Core Refs ---
    const canvasRef = useRef(null);
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
    // Use state refs to track the *current* values based on props
    const currentSource = useRef(null);
    const currentResults = useRef(null);
    const currentIsStatic = useRef(false);
    const currentBrightness = useRef(1.0);
    const currentContrast = useRef(1.0);
    const currentIntensity = useRef(0.5);

    // --- Shaders --- (Keep Bare Minimum for now)
    const postVertexShader = `varying vec2 vUv; void main() { vUv = uv; gl_Position = vec4(position, 1.0); }`;
    const postFragmentShader = `
        uniform sampler2D uSceneTexture; varying vec2 vUv;
        void main() { gl_FragColor = texture2D(uSceneTexture, vUv); }
    `;

    // --- Update internal refs when props change ---
    useEffect(() => {
        console.log("TryOnRenderer Effect: Props changed", { videoElement, imageElement, isStatic });
        if (isStatic && imageElement) {
            currentSource.current = imageElement;
        } else if (!isStatic && videoElement) {
            currentSource.current = videoElement;
        } else {
            currentSource.current = null;
        }
        currentIsStatic.current = isStatic;
    }, [videoElement, imageElement, isStatic]);

    useEffect(() => {
        // console.log("TryOnRenderer Effect: Results changed", mediaPipeResults);
        currentResults.current = mediaPipeResults;
    }, [mediaPipeResults]);

    useEffect(() => {
        // console.log("TryOnRenderer Effect: Correction changed", { brightness, contrast });
        // Apply correction only if static image is active
        currentBrightness.current = isStatic ? Math.max(0.1, brightness || 1.0) : 1.0;
        currentContrast.current = isStatic ? Math.max(0.1, contrast || 1.0) : 1.0;
    }, [isStatic, brightness, contrast]);

    useEffect(() => {
        // console.log("TryOnRenderer Effect: Intensity changed", effectIntensity);
        currentIntensity.current = effectIntensity;
    }, [effectIntensity]);


    // --- Handle Resizing ---
    const handleResize = useCallback(() => { /* ... same ... */ }, []);

    // --- Scale Base Plane ---
    const fitPlaneToCamera = useCallback((textureWidth, textureHeight) => { /* ... same ... */ }, []);

    // --- Render Loop --- (Reads internal refs)
     const renderLoop = useCallback(() => {
        animationFrameHandle.current = requestAnimationFrame(renderLoop);
        if (!isInitialized.current /* ... etc ... */) return;

        try {
            // *** Read internal state refs ***
            const sourceElement = currentSource.current;
            const results = currentResults.current;
            const isStatic = currentIsStatic.current;
            const brightness = currentBrightness.current;
            const contrast = currentContrast.current;
            const intensity = currentIntensity.current;
             // *** ----------------------- ***

            const baseMaterial = basePlaneMeshRef.current.material;
            const postUniforms = postMaterialRef.current.uniforms;
            let sourceWidth = 0, sourceHeight = 0;
            let isVideo = sourceElement instanceof HTMLVideoElement;
            let isImage = sourceElement instanceof HTMLImageElement;
            let textureToAssign = null;

            // 1. Update Base Texture (using sourceElement from ref)
             if (isVideo && sourceElement.readyState >= 2 && sourceElement.videoWidth > 0) { sourceWidth = sourceElement.videoWidth; sourceHeight = sourceElement.videoHeight; if (videoTextureRef.current?.image !== sourceElement) { videoTextureRef.current?.dispose(); videoTextureRef.current = new THREE.VideoTexture(sourceElement); videoTextureRef.current.colorSpace = THREE.SRGBColorSpace; console.log("DEBUG RenderLoop: Created Video Texture"); } textureToAssign = videoTextureRef.current; }
             else if (isImage && sourceElement.complete && sourceElement.naturalWidth > 0) { sourceWidth = sourceElement.naturalWidth; sourceHeight = sourceElement.naturalHeight; if (imageTextureRef.current?.image !== sourceElement) { imageTextureRef.current?.dispose(); imageTextureRef.current = new THREE.Texture(sourceElement); imageTextureRef.current.colorSpace = THREE.SRGBColorSpace; imageTextureRef.current.needsUpdate = true; console.log("DEBUG RenderLoop: Created Image Texture"); } else if (imageTextureRef.current && imageTextureRef.current.needsUpdate) { imageTextureRef.current.needsUpdate = true; } textureToAssign = imageTextureRef.current; }
             else { textureToAssign = null; if(videoTextureRef.current) { videoTextureRef.current.dispose(); videoTextureRef.current = null; } if(imageTextureRef.current) { imageTextureRef.current.dispose(); imageTextureRef.current = null;} }
             const textureChanged = baseMaterial.map !== textureToAssign; if (textureChanged) { baseMaterial.map = textureToAssign; baseMaterial.needsUpdate = true; console.log("DEBUG RenderLoop: Assigned texture to base material:", textureToAssign ? textureToAssign.constructor.name : 'null'); }
             if (textureToAssign && textureToAssign.needsUpdate && !(textureToAssign instanceof THREE.VideoTexture)) { textureToAssign.needsUpdate = true; }


            // 2. Update Plane Scale & Mirroring
            const planeVisible = baseMaterial.map && sourceWidth > 0 && sourceHeight > 0;
             if (planeVisible) { fitPlaneToCamera(sourceWidth, sourceHeight); const scaleX = Math.abs(basePlaneMeshRef.current.scale.x); const newScaleX = isVideo ? -scaleX : scaleX; if(basePlaneMeshRef.current.scale.x !== newScaleX) { basePlaneMeshRef.current.scale.x = newScaleX; } }
             else { if (basePlaneMeshRef.current.scale.x !== 0 || basePlaneMeshRef.current.scale.y !== 0) { basePlaneMeshRef.current.scale.set(0, 0, 0); console.log("DEBUG RenderLoop: Hiding base plane"); } }


            // 3. Render Base Scene to Target
             if (planeVisible) { rendererInstanceRef.current.setRenderTarget(renderTargetRef.current); rendererInstanceRef.current.clear(); rendererInstanceRef.current.render(baseSceneRef.current, baseCameraRef.current); rendererInstanceRef.current.setRenderTarget(null); }
             else { rendererInstanceRef.current.setRenderTarget(renderTargetRef.current); rendererInstanceRef.current.clear(); rendererInstanceRef.current.setRenderTarget(null); }


            // 4. Update Post-Processing Uniforms (using internal refs)
            if (postUniforms?.uSceneTexture) { postUniforms.uSceneTexture.value = renderTargetRef.current.texture; }
            // Example if we add back other uniforms:
            // if (postUniforms?.uIsStaticImage) { postUniforms.uIsStaticImage.value = isStatic; }
            // if (postUniforms?.uBrightness) { postUniforms.uBrightness.value = brightness; } // Use internal ref value
            // etc...

             // Update Segmentation Mask Texture (using results ref)
             const segmentationMask = results?.segmentationMasks?.[0];
             if (postUniforms?.uSegmentationMask && segmentationMask?.mask) { /* ... update mask texture ... */ }
             else if (postUniforms?.uSegmentationMask?.value !== null) { postUniforms.uSegmentationMask.value = null; }

            // 5. Render Post-Processing Scene to Screen
            rendererInstanceRef.current.render(postSceneRef.current, postCameraRef.current);

        } catch (error) { console.error("Error in renderLoop:", error); }
    }, [fitPlaneToCamera]); // Only depends on fitPlaneToCamera now


    // --- Initialize Scene --- (Bare Minimum Shader & Uniforms)
    const initThreeScene = useCallback(() => {
        if (!canvasRef.current || isInitialized.current) return; console.log("DEBUG: initThreeScene START (Post-Processing)"); try { const canvas = canvasRef.current; const initialWidth = canvas.clientWidth || 640; const initialHeight = canvas.clientHeight || 480; rendererInstanceRef.current = new THREE.WebGLRenderer({ canvas: canvas, antialias: true }); rendererInstanceRef.current.setSize(initialWidth, initialHeight); rendererInstanceRef.current.setPixelRatio(window.devicePixelRatio); rendererInstanceRef.current.outputColorSpace = THREE.SRGBColorSpace; renderTargetRef.current = new THREE.WebGLRenderTarget(initialWidth, initialHeight, { minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, format: THREE.RGBAFormat, colorSpace: THREE.SRGBColorSpace }); console.log("DEBUG: RenderTarget created."); baseSceneRef.current = new THREE.Scene(); baseCameraRef.current = new THREE.OrthographicCamera(-initialWidth / 2, initialWidth / 2, initialHeight / 2, -initialHeight / 2, 0.1, 10); baseCameraRef.current.position.z = 1; const planeGeometry = new THREE.PlaneGeometry(1, 1); const planeMaterial = new THREE.MeshBasicMaterial({ map: null, side: THREE.DoubleSide, color: 0xffffff }); basePlaneMeshRef.current = new THREE.Mesh(planeGeometry, planeMaterial); basePlaneMeshRef.current.position.z = 0; basePlaneMeshRef.current.scale.set(1, 1, 1); baseSceneRef.current.add(basePlaneMeshRef.current); console.log("DEBUG: Base scene created.");
            // Create Post Scene
            postSceneRef.current = new THREE.Scene(); postCameraRef.current = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1); const postPlaneGeometry = new THREE.PlaneGeometry(2, 2);
            // Create ShaderMaterial with ONLY uSceneTexture uniform
            postMaterialRef.current = new THREE.ShaderMaterial({ vertexShader: postVertexShader, fragmentShader: postFragmentShader, uniforms: { uSceneTexture: { value: renderTargetRef.current.texture }, }, depthWrite: false, depthTest: false, });
            const postPlaneMesh = new THREE.Mesh(postPlaneGeometry, postMaterialRef.current); postSceneRef.current.add(postPlaneMesh); console.log("DEBUG: Post-processing scene created (Bare Minimum Shader)."); isInitialized.current = true; console.log("DEBUG: Scene initialization complete."); handleResize(); console.log("DEBUG: Requesting first render loop frame from Init."); cancelAnimationFrame(animationFrameHandle.current); animationFrameHandle.current = requestAnimationFrame(renderLoop); } catch (error) { console.error("DEBUG: initThreeScene ERROR:", error); isInitialized.current = false; }
    }, [handleResize, postVertexShader, postFragmentShader, renderLoop]); // Add renderLoop back


    // --- Effect for Initial Setup / Resize Observer ---
    useEffect(() => {
         console.log("DEBUG: Mount/Init effect running.");
         initThreeScene(); // Start scene and loop
         let resizeObserver; const currentCanvas = canvasRef.current; if (currentCanvas) { resizeObserver = new ResizeObserver(() => { handleResize(); }); resizeObserver.observe(currentCanvas); console.log("DEBUG: Resize observer attached."); }
         return () => { console.log("DEBUG: Cleanup running (TryOnRenderer Unmount)..."); resizeObserver?.disconnect(currentCanvas); cancelAnimationFrame(animationFrameHandle.current); isInitialized.current = false; console.log("DEBUG: Disposing Three.js resources..."); /* ... dispose objects ... */ };
     }, [initThreeScene, handleResize]); // Dependencies


    // --- REMOVED useImperativeHandle ---


    // --- JSX ---
    return ( <canvas ref={canvasRef} className={`renderer-canvas ${className || ''}`} style={{ display: 'block', width: '100%', height: '100%' }} /> );
});

TryOnRenderer.displayName = 'TryOnRenderer';
export default TryOnRenderer;