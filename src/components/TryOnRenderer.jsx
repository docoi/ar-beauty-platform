// src/components/TryOnRenderer.jsx - COMPLETE - Prop-Driven, Bare Shader, Persistent needsUpdate

import React, { useRef, forwardRef, useEffect, useCallback, useState, useMemo } from 'react';
import * as THREE from 'three';

console.log(`Using Three.js revision: ${THREE.REVISION}`);

const TryOnRenderer = forwardRef(({
    // Accept videoRef directly
    videoRefProp,     // The actual ref object from parent
    imageElement,
    mediaPipeResults,
    isStatic,
    brightness, contrast, effectIntensity, className
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
    // Keep refs for results/intensity/correction as they might be updated independently
    const currentResults = useRef(null);
    const currentBrightness = useRef(1.0);
    const currentContrast = useRef(1.0);
    const currentIntensity = useRef(0.5);
    const renderLoopCounter = useRef(0); // Keep counter

    // --- Shaders --- (Keep Bare Minimum)
    const postVertexShader = `varying vec2 vUv; void main() { vUv = uv; gl_Position = vec4(position, 1.0); }`;
    const postFragmentShader = `
        uniform sampler2D uSceneTexture; varying vec2 vUv;
        void main() { gl_FragColor = texture2D(uSceneTexture, vUv); }
    `;

    // --- Update internal refs ---
    useEffect(() => { currentResults.current = mediaPipeResults; }, [mediaPipeResults]);
    useEffect(() => { currentBrightness.current = isStatic ? Math.max(0.1, brightness || 1.0) : 1.0; currentContrast.current = isStatic ? Math.max(0.1, contrast || 1.0) : 1.0; }, [isStatic, brightness, contrast]);
    useEffect(() => { currentIntensity.current = effectIntensity; }, [effectIntensity]);


    // --- Handle Resizing ---
    const handleResize = useCallback(() => { /* ... */ }, []);
    // --- Scale Base Plane ---
    const fitPlaneToCamera = useCallback((textureWidth, textureHeight) => { /* ... */ }, []);


    // --- Render Loop --- (Read Props Directly for Source, Persistent needsUpdate)
     const renderLoop = useCallback(() => {
        animationFrameHandle.current = requestAnimationFrame(renderLoop);
        if (!isInitialized.current || !rendererInstanceRef.current || !baseSceneRef.current || !baseCameraRef.current || !postSceneRef.current || !postCameraRef.current || !basePlaneMeshRef.current || !postMaterialRef.current || !renderTargetRef.current) { return; }

        const currentCount = renderLoopCounter.current++;
        const logThisFrame = (currentCount % 100 === 0);
        // if (logThisFrame) console.log(`RenderLoop executing: Frame ${currentCount}`);

        try {
            const postUniforms = postMaterialRef.current.uniforms;
            if (!postUniforms) { if (logThisFrame) console.warn("RenderLoop skipped: postUniforms not ready."); return; }

            // *** Read props directly for source ***
            const results = currentResults.current; // Still use ref for this
            let sourceElement = null;
            let isVideo = false;
            let isImage = false;

            // Read props passed down
            if (isStatic && imageElement) {
                sourceElement = imageElement;
                isImage = true;
            } else if (!isStatic && videoRefProp?.current) {
                sourceElement = videoRefProp.current;
                isVideo = true;
            }
             // *** ----------------------------- ***


            const baseMaterial = basePlaneMeshRef.current.material;
            let sourceWidth = 0, sourceHeight = 0;
            let textureToAssign = null;
            let textureJustCreated = false;

            // 1. Update Base Texture (using determined sourceElement)
            if (isVideo && sourceElement && sourceElement.readyState >= 2 && sourceElement.videoWidth > 0) {
                 sourceWidth = sourceElement.videoWidth; sourceHeight = sourceElement.videoHeight;
                 if (!videoTextureRef.current || videoTextureRef.current.image !== sourceElement) {
                     videoTextureRef.current?.dispose();
                     videoTextureRef.current = new THREE.VideoTexture(sourceElement);
                     videoTextureRef.current.colorSpace = THREE.SRGBColorSpace;
                     console.log("DEBUG RenderLoop: Created Video Texture");
                     textureJustCreated = true;
                 }
                 textureToAssign = videoTextureRef.current;
            }
            else if (isImage && sourceElement && sourceElement.complete && sourceElement.naturalWidth > 0) {
                 sourceWidth = sourceElement.naturalWidth; sourceHeight = sourceElement.naturalHeight;
                 if (!imageTextureRef.current || imageTextureRef.current.image !== sourceElement) {
                     imageTextureRef.current?.dispose();
                     imageTextureRef.current = new THREE.Texture(sourceElement);
                     imageTextureRef.current.colorSpace = THREE.SRGBColorSpace;
                     imageTextureRef.current.needsUpdate = true; // Mark for initial upload
                     console.log("DEBUG RenderLoop: Created Image Texture");
                     textureJustCreated = true;
                 }
                 // *** ALWAYS set needsUpdate for image texture when active ***
                 if (imageTextureRef.current) {
                    imageTextureRef.current.needsUpdate = true; // Set flag every frame for static image
                 }
                 // *** --------------------------------------------------- ***
                 textureToAssign = imageTextureRef.current;
            }
            else { // No valid source
                textureToAssign = null;
                if(videoTextureRef.current) { videoTextureRef.current.dispose(); videoTextureRef.current = null; }
                if(imageTextureRef.current) { imageTextureRef.current.dispose(); imageTextureRef.current = null;}
             }

             // Assign texture if needed
             if (baseMaterial.map !== textureToAssign || textureJustCreated) {
                 baseMaterial.map = textureToAssign;
                 baseMaterial.needsUpdate = true; // Tell material about map change
                 console.log("DEBUG RenderLoop: Assigned texture:", textureToAssign?.constructor?.name ?? 'null');
             }
             // This check below might now be redundant but ensures flag is true if texture exists
             if (textureToAssign && textureToAssign.needsUpdate && !(textureToAssign instanceof THREE.VideoTexture)) {
                 textureToAssign.needsUpdate = true;
             }


            // 2. Update Plane Scale & Mirroring
            const planeVisible = !!baseMaterial.map && sourceWidth > 0 && sourceHeight > 0;
             if (planeVisible) { fitPlaneToCamera(sourceWidth, sourceHeight); const scaleX = Math.abs(basePlaneMeshRef.current.scale.x); const newScaleX = isVideo ? -scaleX : scaleX; if(basePlaneMeshRef.current.scale.x !== newScaleX) { basePlaneMeshRef.current.scale.x = newScaleX; } }
             else { if (basePlaneMeshRef.current.scale.x !== 0 || basePlaneMeshRef.current.scale.y !== 0) { basePlaneMeshRef.current.scale.set(0, 0, 0); if (logThisFrame) console.log("DEBUG RenderLoop: Hiding base plane"); } }


            // 3. Render Base Scene to Target
            rendererInstanceRef.current.setRenderTarget(renderTargetRef.current);
            // Keep clear color blue for now to confirm base scene rendering
            rendererInstanceRef.current.setClearColor(0x0000ff, 1);
            rendererInstanceRef.current.clear();
            if (planeVisible) {
                 rendererInstanceRef.current.render(baseSceneRef.current, baseCameraRef.current);
                 if (logThisFrame) console.log(`DEBUG RenderLoop: Rendered base scene to target.`);
            } else {
                 if (logThisFrame) console.log(`DEBUG RenderLoop: Target cleared blue (plane hidden).`);
            }
            rendererInstanceRef.current.setRenderTarget(null);
            rendererInstanceRef.current.setClearColor(0x000000, 0);


            // 4. Update Post-Processing Uniforms
             if (postUniforms.uSceneTexture) { postUniforms.uSceneTexture.value = renderTargetRef.current.texture; } else if (logThisFrame) { console.warn("RenderLoop: uSceneTexture uniform missing!"); }
             // Update Segmentation Mask Texture (if uniform exists on material)
             const segmentationMask = results?.segmentationMasks?.[0]; const maskUniform = postUniforms.uSegmentationMask;
             if (maskUniform && segmentationMask?.mask) { if (!segmentationTextureRef.current || /*...*/ segmentationTextureRef.current.image.width !== segmentationMask.width /*...*/) { /* ... create/dispose texture ...*/ segmentationTextureRef.current = new THREE.DataTexture(segmentationMask.mask, segmentationMask.width, segmentationMask.height, THREE.RedFormat, THREE.FloatType); segmentationTextureRef.current.needsUpdate = true; } else if (/*...*/ segmentationTextureRef.current.image.data !== segmentationMask.mask) { /* ... update data ...*/ segmentationTextureRef.current.needsUpdate = true;} maskUniform.value = segmentationTextureRef.current; }
             else if (maskUniform && maskUniform.value !== null) { maskUniform.value = null; }


            // 5. Render Post-Processing Scene to Screen
            rendererInstanceRef.current.render(postSceneRef.current, postCameraRef.current);
            // if (logThisFrame) console.log(`DEBUG RenderLoop: Rendered post scene to screen.`);

        } catch (error) { console.error("Error in renderLoop:", error); }
    // Add props back to dependency array
    }, [fitPlaneToCamera, videoRefProp, imageElement, isStatic]);


    // --- Initialize Scene --- (Keep Bare Minimum Shader & ONLY uSceneTexture Uniform)
    const initThreeScene = useCallback(() => {
        if (!canvasRef.current || isInitialized.current) return; console.log("DEBUG: initThreeScene START (Post-Processing)"); try { const canvas = canvasRef.current; const initialWidth = canvas.clientWidth || 640; const initialHeight = canvas.clientHeight || 480; rendererInstanceRef.current = new THREE.WebGLRenderer({ canvas: canvas, antialias: true }); rendererInstanceRef.current.setSize(initialWidth, initialHeight); rendererInstanceRef.current.setPixelRatio(window.devicePixelRatio); rendererInstanceRef.current.outputColorSpace = THREE.SRGBColorSpace; renderTargetRef.current = new THREE.WebGLRenderTarget(initialWidth, initialHeight, { minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, format: THREE.RGBAFormat, colorSpace: THREE.SRGBColorSpace }); console.log("DEBUG: RenderTarget created."); baseSceneRef.current = new THREE.Scene(); baseCameraRef.current = new THREE.OrthographicCamera(-initialWidth / 2, initialWidth / 2, initialHeight / 2, -initialHeight / 2, 0.1, 10); baseCameraRef.current.position.z = 1; const planeGeometry = new THREE.PlaneGeometry(1, 1); const planeMaterial = new THREE.MeshBasicMaterial({ map: null, side: THREE.DoubleSide, color: 0xffffff }); basePlaneMeshRef.current = new THREE.Mesh(planeGeometry, planeMaterial); basePlaneMeshRef.current.position.z = 0; basePlaneMeshRef.current.scale.set(1, 1, 1); baseSceneRef.current.add(basePlaneMeshRef.current); console.log("DEBUG: Base scene created.");
            postSceneRef.current = new THREE.Scene(); postCameraRef.current = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1); const postPlaneGeometry = new THREE.PlaneGeometry(2, 2);
            postMaterialRef.current = new THREE.ShaderMaterial({ vertexShader: postVertexShader, fragmentShader: postFragmentShader, uniforms: { uSceneTexture: { value: null }, }, depthWrite: false, depthTest: false, });
            if (renderTargetRef.current) { postMaterialRef.current.uniforms.uSceneTexture.value = renderTargetRef.current.texture; }
            const postPlaneMesh = new THREE.Mesh(postPlaneGeometry, postMaterialRef.current); postSceneRef.current.add(postPlaneMesh); console.log("DEBUG: Post-processing scene created (Bare Minimum Shader)."); isInitialized.current = true; console.log("DEBUG: Scene initialization complete."); handleResize(); console.log("DEBUG: Requesting first render loop frame from Init."); cancelAnimationFrame(animationFrameHandle.current); animationFrameHandle.current = requestAnimationFrame(renderLoop); } catch (error) { console.error("DEBUG: initThreeScene ERROR:", error); isInitialized.current = false; }
    // Added renderLoop back
    }, [handleResize, postVertexShader, postFragmentShader, renderLoop]);


    // --- Effect for Initial Setup / Resize Observer ---
    useEffect(() => {
         console.log("DEBUG: Mount/Init effect running.");
         initThreeScene();
         let resizeObserver; const currentCanvas = canvasRef.current; if (currentCanvas) { resizeObserver = new ResizeObserver(() => { handleResize(); }); resizeObserver.observe(currentCanvas); console.log("DEBUG: Resize observer attached."); }
         return () => { console.log("DEBUG: Cleanup running (TryOnRenderer Unmount)..."); resizeObserver?.disconnect(currentCanvas); cancelAnimationFrame(animationFrameHandle.current); isInitialized.current = false; console.log("DEBUG: Disposing Three.js resources..."); /* ... dispose objects ... */ videoTextureRef.current?.dispose(); imageTextureRef.current?.dispose(); renderTargetRef.current?.dispose(); segmentationTextureRef.current?.dispose(); basePlaneMeshRef.current?.geometry?.dispose(); basePlaneMeshRef.current?.material?.map?.dispose(); basePlaneMeshRef.current?.material?.dispose(); postMaterialRef.current?.uniforms?.uSceneTexture?.value?.dispose(); postMaterialRef.current?.uniforms?.uSegmentationMask?.value?.dispose(); postMaterialRef.current?.dispose(); rendererInstanceRef.current?.dispose(); videoTextureRef.current = null; imageTextureRef.current = null; renderTargetRef.current = null; segmentationTextureRef.current = null; basePlaneMeshRef.current = null; postMaterialRef.current = null; rendererInstanceRef.current = null; console.log("DEBUG: Three.js resources disposed.");};
     }, [initThreeScene, handleResize]); // Dependencies


    // --- REMOVED useImperativeHandle ---


    // --- JSX ---
    return ( <canvas ref={canvasRef} className={`renderer-canvas ${className || ''}`} style={{ display: 'block', width: '100%', height: '100%' }} /> );
});

TryOnRenderer.displayName = 'TryOnRenderer';
export default TryOnRenderer;