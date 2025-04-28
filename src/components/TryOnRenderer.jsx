// src/components/TryOnRenderer.jsx - REMOVE Mask Creation, Keep Pass-Through Post-Processing

import React, { useRef, forwardRef, useEffect, useCallback } from 'react';
import * as THREE from 'three';

const TryOnRenderer = forwardRef(({
    videoRefProp, imageElement,
    // These props are received but NOT used at all in this version
    mediaPipeResults, segmentationResults,
    isStatic, brightness, contrast, effectIntensity,
    className, style
 }, ref) => {

    // --- Core Refs --- (Keep Post-Processing Refs, remove mask ref)
    const canvasRef = useRef(null); const rendererInstanceRef = useRef(null); const animationFrameHandle = useRef(null); const isInitialized = useRef(false);
    const baseSceneRef = useRef(null); const baseCameraRef = useRef(null); const basePlaneMeshRef = useRef(null); const videoTextureRef = useRef(null);
    const imageTextureRef = useRef(null); const postSceneRef = useRef(null); const postCameraRef = useRef(null); const postMaterialRef = useRef(null);
    const renderTargetRef = useRef(null);
    // const segmentationTextureRef = useRef(null); // <<< REMOVED MASK REF

    // --- Internal State Refs --- (Remove unused)
    // const currentBrightness = useRef(1.0); const currentContrast = useRef(1.0); const currentIntensity = useRef(0.5);
    const renderLoopCounter = useRef(0);
    // const lastMaskUpdateTime = useRef(0); // REMOVED

    // --- Shaders --- (Minimal Pass-Through)
    const postVertexShader = `varying vec2 vUv; void main() { vUv = uv; gl_Position = vec4(position, 1.0); }`;
    const postFragmentShader = `uniform sampler2D uSceneTexture; varying vec2 vUv; void main() { gl_FragColor = texture2D(uSceneTexture, vUv); }`;

    // --- Prop Effects --- (Remove unused B/C/I updates)
    // useEffect(() => { /* ... B/C ... */ }, [isStatic, brightness, contrast]);
    // useEffect(() => { /* ... Intensity ... */ }, [effectIntensity]);

    // --- Video/Image Texture Effects --- (No changes needed)
    useEffect(() => { /* ... Video Texture Logic ... */ }, [isStatic, videoRefProp]);
    useEffect(() => { /* ... Image Texture Logic ... */ }, [isStatic, imageElement]);

    // --- ***** REMOVED Segmentation Mask Texture Effect ***** ---
    // useEffect(() => { /* ... */ }, [segmentationResults, isStatic]);

    // --- Handle Resizing --- (No changes needed)
    const handleResize = useCallback(() => { /* ... */ }, []);
    // --- Scale Base Plane --- (No changes needed)
    const fitPlaneToCamera = useCallback(/* ... */, []);

    // --- Render Loop --- (No changes needed - uses pass-through)
     const renderLoop = useCallback(() => {
        animationFrameHandle.current = requestAnimationFrame(renderLoop);
        if (!isInitialized.current || !rendererInstanceRef.current || !baseSceneRef.current || !baseCameraRef.current || !postSceneRef.current || !postCameraRef.current || !basePlaneMeshRef.current || !postMaterialRef.current || !renderTargetRef.current) { return; }

        const currentCount = renderLoopCounter.current++;
        const logThisFrame = (currentCount % 150 === 0);

        try {
            const postUniforms = postMaterialRef.current.uniforms;
            if (!postUniforms?.uSceneTexture) { if(logThisFrame) console.warn("RenderLoop: uSceneTexture uniform not ready."); return; }

            // 1 & 2: Select Texture & Update Plane
            const baseMaterial = basePlaneMeshRef.current.material; let sourceWidth = 0, sourceHeight = 0; let textureToAssign = null; let isVideo = false;
            if (!isStatic && videoTextureRef.current) { textureToAssign = videoTextureRef.current; isVideo = true; if(textureToAssign.image) {sourceWidth=textureToAssign.image.videoWidth; sourceHeight=textureToAssign.image.videoHeight;} } else if (isStatic && imageTextureRef.current) { textureToAssign = imageTextureRef.current; if(textureToAssign.image){sourceWidth=textureToAssign.image.naturalWidth; sourceHeight=textureToAssign.image.naturalHeight;} if(textureToAssign.needsUpdate){textureToAssign.needsUpdate=true;} }
            if(baseMaterial){ if (baseMaterial.map !== textureToAssign) { baseMaterial.map = textureToAssign; baseMaterial.needsUpdate = true; } else if (textureToAssign && textureToAssign.needsUpdate) { baseMaterial.needsUpdate = true; } }
            const planeVisible = !!baseMaterial?.map && sourceWidth > 0 && sourceHeight > 0;
             if (planeVisible) { fitPlaneToCamera(sourceWidth, sourceHeight); const scaleX = Math.abs(basePlaneMeshRef.current.scale.x); const newScaleX = isVideo ? -scaleX : scaleX; if(basePlaneMeshRef.current.scale.x !== newScaleX) { basePlaneMeshRef.current.scale.x = newScaleX; } } else { if (basePlaneMeshRef.current?.scale.x !== 0 || basePlaneMeshRef.current?.scale.y !== 0) { basePlaneMeshRef.current?.scale.set(0, 0, 0); } }

            // 3. Render Base Scene to Target
            rendererInstanceRef.current.setRenderTarget(renderTargetRef.current);
            rendererInstanceRef.current.setClearColor(0x000000, 0); rendererInstanceRef.current.clear();
             if (planeVisible) { rendererInstanceRef.current.render(baseSceneRef.current, baseCameraRef.current); if (textureToAssign?.needsUpdate) { textureToAssign.needsUpdate = false; } }

            // 4. Unbind Render Target
             rendererInstanceRef.current.setRenderTarget(null);

            // 5. Update Post-Processing Uniform
             postUniforms.uSceneTexture.value = renderTargetRef.current.texture;

            // 6. Render Post-Processing Scene to Screen
             rendererInstanceRef.current.render(postSceneRef.current, postCameraRef.current);

        } catch (error) { console.error("Error in renderLoop:", error); }
    }, [fitPlaneToCamera, isStatic]);


    // --- Initialize Scene --- (Keep Depth/Stencil, No mask uniforms defined)
    const initThreeScene = useCallback(() => {
        if (!canvasRef.current || isInitialized.current) return;
        console.log("DEBUG: initThreeScene START (Pass-Through + Depth/Stencil, NO MASK HANDLING)");
        try {
            const canvas = canvasRef.current; const initialWidth = canvas.clientWidth || 640; const initialHeight = canvas.clientHeight || 480;
            rendererInstanceRef.current = new THREE.WebGLRenderer({ canvas: canvas, antialias: true }); rendererInstanceRef.current.setSize(initialWidth, initialHeight); rendererInstanceRef.current.setPixelRatio(window.devicePixelRatio); rendererInstanceRef.current.outputColorSpace = THREE.SRGBColorSpace;
            renderTargetRef.current = new THREE.WebGLRenderTarget(initialWidth, initialHeight, { minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, format: THREE.RGBAFormat, colorSpace: THREE.SRGBColorSpace, depthBuffer: true, stencilBuffer: true });
            baseSceneRef.current = new THREE.Scene(); baseCameraRef.current = new THREE.OrthographicCamera(-initialWidth / 2, initialWidth / 2, initialHeight / 2, -initialHeight / 2, 0.1, 10); baseCameraRef.current.position.z = 1; const planeGeometry = new THREE.PlaneGeometry(1, 1); const planeMaterial = new THREE.MeshBasicMaterial({ map: null, side: THREE.DoubleSide, color: 0xffffff, transparent: true }); basePlaneMeshRef.current = new THREE.Mesh(planeGeometry, planeMaterial); baseSceneRef.current.add(basePlaneMeshRef.current);
            postSceneRef.current = new THREE.Scene(); postCameraRef.current = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1); const postPlaneGeometry = new THREE.PlaneGeometry(2, 2);

            // *** Initialize material with ONLY uSceneTexture uniform ***
            postMaterialRef.current = new THREE.ShaderMaterial({
                vertexShader: postVertexShader,
                fragmentShader: postFragmentShader,
                uniforms: {
                    uSceneTexture: { value: renderTargetRef.current.texture },
                    // NO other uniforms needed or defined for this test
                },
                transparent: true, depthWrite: false, depthTest: false,
            });
            const postPlaneMesh = new THREE.Mesh(postPlaneGeometry, postMaterialRef.current); postSceneRef.current.add(postPlaneMesh);

            isInitialized.current = true;
            handleResize();
            cancelAnimationFrame(animationFrameHandle.current);
            animationFrameHandle.current = requestAnimationFrame(renderLoop);
        } catch (error) { console.error("DEBUG: initThreeScene ERROR:", error); isInitialized.current = false; }
    }, [handleResize, postVertexShader, postFragmentShader, renderLoop]);


    // --- Setup / Cleanup Effect --- (Remove Mask Texture Disposal)
    useEffect(() => {
        initThreeScene();
        let resizeObserver; const currentCanvas = canvasRef.current;
        if (currentCanvas) { resizeObserver = new ResizeObserver(() => { handleResize(); }); resizeObserver.observe(currentCanvas); }
        return () => {
             console.log("DEBUG: Cleanup running (TryOnRenderer Unmount)...");
             resizeObserver?.disconnect(); cancelAnimationFrame(animationFrameHandle.current); isInitialized.current = false;
             console.log("DEBUG: Disposing Three.js resources (No Mask)...");
             videoTextureRef.current?.dispose(); imageTextureRef.current?.dispose();
             // segmentationTextureRef.current?.dispose(); // REMOVED
             renderTargetRef.current?.dispose();
             basePlaneMeshRef.current?.geometry?.dispose(); basePlaneMeshRef.current?.material?.map?.dispose(); basePlaneMeshRef.current?.material?.dispose();
             if(postMaterialRef.current) {
                 postMaterialRef.current.uniforms?.uSceneTexture?.value?.dispose();
                 // postMaterialRef.current.uniforms?.uSegmentationMask?.value?.dispose(); // REMOVED
                 postMaterialRef.current.dispose();
             }
             rendererInstanceRef.current?.dispose();
             // Nullify refs...
             videoTextureRef.current = null; imageTextureRef.current = null; segmentationTextureRef.current = null; renderTargetRef.current = null;
             basePlaneMeshRef.current = null; postMaterialRef.current = null; rendererInstanceRef.current = null; baseSceneRef.current = null;
             postSceneRef.current = null; baseCameraRef.current = null; postCameraRef.current = null;
             console.log("DEBUG: Three.js resources disposed.");
        };
     }, [initThreeScene, handleResize]);


    // --- JSX --- (No change)
    return ( <canvas ref={canvasRef} className={`renderer-canvas ${className || ''}`} style={{ display: 'block', width: '100%', height: '100%', ...(style || {}) }} /> );
});
TryOnRenderer.displayName = 'TryOnRenderer';
export default TryOnRenderer;