// src/components/TryOnRenderer.jsx - CORRECTED - Add Depth/Stencil to Render Target

import React, { useRef, forwardRef, useEffect, useCallback } from 'react';
import * as THREE from 'three';

const TryOnRenderer = forwardRef(({
    videoRefProp, imageElement,
    mediaPipeResults, // Not used by this shader version
    segmentationResults, // Used by mask effect hook
    isStatic, brightness, contrast, effectIntensity, // B/C/I Not used by this shader version
    className, style
 }, ref) => {

    // --- Core Refs --- (Includes Post-Processing Refs)
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
    const renderTargetRef = useRef(null);
    const segmentationTextureRef = useRef(null); // Mask texture ref

    // --- Internal State Refs ---
    const currentBrightness = useRef(1.0);
    const currentContrast = useRef(1.0);
    const currentIntensity = useRef(0.5);
    const renderLoopCounter = useRef(0);
    const lastMaskUpdateTime = useRef(0);

    // --- Shaders --- (Minimal Pass-Through Post-Processing Shader)
    const postVertexShader = `varying vec2 vUv; void main() { vUv = uv; gl_Position = vec4(position, 1.0); }`;
    const postFragmentShader = `
        uniform sampler2D uSceneTexture; // Input from the render target
        varying vec2 vUv;
        void main() {
            // Just display the texture from the render target
            gl_FragColor = texture2D(uSceneTexture, vUv);
        }
    `;

    // --- Prop Effects --- (Update internal refs even if shader doesn't use them yet)
    useEffect(() => { currentBrightness.current = isStatic ? Math.max(0.01, brightness || 1.0) : 1.0; currentContrast.current = isStatic ? Math.max(0.01, contrast || 1.0) : 1.0; }, [isStatic, brightness, contrast]);
    useEffect(() => { currentIntensity.current = effectIntensity; }, [effectIntensity]);

    // --- Video/Image Texture Effects --- (Load textures for base plane)
    useEffect(() => {
        const videoElement = videoRefProp?.current;
        if (!isStatic && videoElement) { if (!videoTextureRef.current || videoTextureRef.current.image !== videoElement) { /*console.log("TryOnRenderer Effect: Creating/Updating Video Texture");*/ videoTextureRef.current?.dispose(); videoTextureRef.current = new THREE.VideoTexture(videoElement); videoTextureRef.current.colorSpace = THREE.SRGBColorSpace; } } else { if (videoTextureRef.current) { /*console.log("TryOnRenderer Effect: Disposing Video Texture");*/ videoTextureRef.current.dispose(); videoTextureRef.current = null; } }
    }, [isStatic, videoRefProp]);
    useEffect(() => {
        if (isStatic && imageElement) { if (!imageTextureRef.current || imageTextureRef.current.image !== imageElement) { /*console.log("TryOnRenderer Effect: Creating/Updating Image Texture");*/ imageTextureRef.current?.dispose(); imageTextureRef.current = new THREE.Texture(imageElement); imageTextureRef.current.colorSpace = THREE.SRGBColorSpace; imageTextureRef.current.needsUpdate = true; } else if (imageTextureRef.current && imageTextureRef.current.image === imageElement) { imageTextureRef.current.needsUpdate = true; } } else { if (imageTextureRef.current) { /*console.log("TryOnRenderer Effect: Disposing Image Texture");*/ imageTextureRef.current.dispose(); imageTextureRef.current = null; } }
    }, [isStatic, imageElement]);

    // --- Segmentation Mask Texture Effect --- (Create texture from segmenter results)
    useEffect(() => {
        const results = segmentationResults;
        const hasMaskDataArray = Array.isArray(results?.confidenceMasks) && results.confidenceMasks.length > 0;
        if (hasMaskDataArray) {
            const confidenceMaskObject = results.confidenceMasks[0];
            const maskWidth = confidenceMaskObject?.width;
            const maskHeight = confidenceMaskObject?.height;
            let maskData = null;
            if (typeof confidenceMaskObject?.getAsFloat32Array === 'function') {
                try { maskData = confidenceMaskObject.getAsFloat32Array(); } catch (error) { maskData = null; }
            } else if(confidenceMaskObject?.data) { maskData = confidenceMaskObject.data;}

             if (maskData instanceof Float32Array && maskWidth > 0 && maskHeight > 0) {
                 const now = performance.now(); const timeSinceLastUpdate = now - lastMaskUpdateTime.current; const throttleThreshold = isStatic ? 0 : 66;
                 if (timeSinceLastUpdate > throttleThreshold) {
                    lastMaskUpdateTime.current = now;
                    try {
                        if (!segmentationTextureRef.current || segmentationTextureRef.current.image.width !== maskWidth || segmentationTextureRef.current.image.height !== maskHeight) {
                            // console.log(` -> Creating NEW DataTexture (${maskWidth}x${maskHeight}) - (Unused by shader)`);
                            segmentationTextureRef.current?.dispose();
                            segmentationTextureRef.current = new THREE.DataTexture(maskData, maskWidth, maskHeight, THREE.RedFormat, THREE.FloatType);
                            segmentationTextureRef.current.minFilter = THREE.LinearFilter; segmentationTextureRef.current.magFilter = THREE.LinearFilter;
                            segmentationTextureRef.current.needsUpdate = true;
                            // console.log(`TryOnRenderer Mask EFFECT Texture: New DataTexture CREATED (Unused).`);
                        } else {
                            segmentationTextureRef.current.image.data = maskData;
                            segmentationTextureRef.current.needsUpdate = true;
                        }
                    } catch (error) { console.error("Mask Texture Error:", error); segmentationTextureRef.current?.dispose(); segmentationTextureRef.current = null; }
                 }
             } else { if (segmentationTextureRef.current) { segmentationTextureRef.current.dispose(); segmentationTextureRef.current = null; } }
        } else { if (segmentationTextureRef.current) { segmentationTextureRef.current.dispose(); segmentationTextureRef.current = null; } }
    }, [segmentationResults, isStatic]);

    // --- Handle Resizing --- (Includes Render Target)
    const handleResize = useCallback(() => {
         const canvas = canvasRef.current;
         if (!rendererInstanceRef.current || !baseCameraRef.current || !postCameraRef.current || !canvas || !renderTargetRef.current) return;
         const newWidth = canvas.clientWidth; const newHeight = canvas.clientHeight;
         if (newWidth === 0 || newHeight === 0) return;
         const currentSize = rendererInstanceRef.current.getSize(new THREE.Vector2());
         if (currentSize.x === newWidth && currentSize.y === newHeight) return;
        //  console.log(`DEBUG: Resizing Renderer & Target -> ${newWidth}x${newHeight}`);
         try {
             rendererInstanceRef.current.setSize(newWidth, newHeight);
             renderTargetRef.current.setSize(newWidth, newHeight); // Resize target
             // Update Base Camera
             baseCameraRef.current.left = -newWidth / 2; baseCameraRef.current.right = newWidth / 2;
             baseCameraRef.current.top = newHeight / 2; baseCameraRef.current.bottom = -newHeight / 2;
             baseCameraRef.current.updateProjectionMatrix();
         } catch(e) { console.error("Resize Error:", e);}
    }, []);

    // --- Scale Base Plane ---
    const fitPlaneToCamera = useCallback((textureWidth, textureHeight) => {
        const canvas = canvasRef.current; if (!baseCameraRef.current || !basePlaneMeshRef.current || !textureWidth || !textureHeight || !canvas || canvas.clientWidth === 0 || canvas.clientHeight === 0) return; const viewWidth = canvas.clientWidth; const viewHeight = canvas.clientHeight; const viewAspect = viewWidth / viewHeight; const textureAspect = textureWidth / textureHeight; let scaleX, scaleY; if (viewAspect > textureAspect) { scaleX = viewWidth; scaleY = scaleX / textureAspect; } else { scaleY = viewHeight; scaleX = scaleY * textureAspect; } const currentScale = basePlaneMeshRef.current.scale; const currentSignX = Math.sign(currentScale.x) || 1; const newScaleXWithSign = scaleX * currentSignX; if (Math.abs(currentScale.y - scaleY) > 0.01 || Math.abs(currentScale.x - newScaleXWithSign) > 0.01) { currentScale.y = scaleY; currentScale.x = newScaleXWithSign; }
     }, []);

    // --- Render Loop (Basic Post-Processing) ---
     const renderLoop = useCallback(() => {
        animationFrameHandle.current = requestAnimationFrame(renderLoop);
        if (!isInitialized.current || !rendererInstanceRef.current || !baseSceneRef.current || !baseCameraRef.current || !postSceneRef.current || !postCameraRef.current || !basePlaneMeshRef.current || !postMaterialRef.current || !renderTargetRef.current) { return; }

        const currentCount = renderLoopCounter.current++;
        const logThisFrame = (currentCount % 150 === 0);

        try {
            const postUniforms = postMaterialRef.current.uniforms;
            if (!postUniforms?.uSceneTexture) { if(logThisFrame) console.warn("RenderLoop: uSceneTexture uniform not ready."); return; }

            // 1. Select Source Texture
            const baseMaterial = basePlaneMeshRef.current.material; let sourceWidth = 0, sourceHeight = 0; let textureToAssign = null; let isVideo = false;
            if (!isStatic && videoTextureRef.current) { textureToAssign = videoTextureRef.current; isVideo = true; if(textureToAssign.image) {sourceWidth=textureToAssign.image.videoWidth; sourceHeight=textureToAssign.image.videoHeight;} } else if (isStatic && imageTextureRef.current) { textureToAssign = imageTextureRef.current; if(textureToAssign.image){sourceWidth=textureToAssign.image.naturalWidth; sourceHeight=textureToAssign.image.naturalHeight;} if(textureToAssign.needsUpdate){textureToAssign.needsUpdate=true;} }
            if(baseMaterial){ if (baseMaterial.map !== textureToAssign) { baseMaterial.map = textureToAssign; baseMaterial.needsUpdate = true; } else if (textureToAssign && textureToAssign.needsUpdate) { baseMaterial.needsUpdate = true; } }

            // 2. Update Plane Scale & Mirroring
            const planeVisible = !!baseMaterial?.map && sourceWidth > 0 && sourceHeight > 0;
            if (planeVisible) { fitPlaneToCamera(sourceWidth, sourceHeight); const scaleX = Math.abs(basePlaneMeshRef.current.scale.x); const newScaleX = isVideo ? -scaleX : scaleX; if(basePlaneMeshRef.current.scale.x !== newScaleX) { basePlaneMeshRef.current.scale.x = newScaleX; } } else { if (basePlaneMeshRef.current?.scale.x !== 0 || basePlaneMeshRef.current?.scale.y !== 0) { basePlaneMeshRef.current?.scale.set(0, 0, 0); } }

            // 3. Render Base Scene to Target
            rendererInstanceRef.current.setRenderTarget(renderTargetRef.current);
            rendererInstanceRef.current.setClearColor(0x000000, 0); rendererInstanceRef.current.clear();
             if (planeVisible) { rendererInstanceRef.current.render(baseSceneRef.current, baseCameraRef.current); if (textureToAssign?.needsUpdate) { textureToAssign.needsUpdate = false; } }

            // 4. Update Post-Processing Uniforms (Minimal)
             rendererInstanceRef.current.setRenderTarget(null);
             postUniforms.uSceneTexture.value = renderTargetRef.current.texture;

            // 5. Render Post-Processing Scene to Screen
             rendererInstanceRef.current.render(postSceneRef.current, postCameraRef.current);

        } catch (error) { console.error("Error in renderLoop:", error); }
    }, [fitPlaneToCamera, isStatic]);


    // --- Initialize Scene (WITH Depth/Stencil Buffer) ---
    const initThreeScene = useCallback(() => {
        if (!canvasRef.current || isInitialized.current) return;
        console.log("DEBUG: initThreeScene START (Adding Depth/Stencil to RT)");
        try {
            const canvas = canvasRef.current; const initialWidth = canvas.clientWidth || 640; const initialHeight = canvas.clientHeight || 480;
            rendererInstanceRef.current = new THREE.WebGLRenderer({ canvas: canvas, antialias: true }); rendererInstanceRef.current.setSize(initialWidth, initialHeight); rendererInstanceRef.current.setPixelRatio(window.devicePixelRatio); rendererInstanceRef.current.outputColorSpace = THREE.SRGBColorSpace;

            // *** Create Render Target WITH Depth and Stencil Buffers ***
            renderTargetRef.current = new THREE.WebGLRenderTarget(initialWidth, initialHeight, {
                minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter,
                format: THREE.RGBAFormat, colorSpace: THREE.SRGBColorSpace,
                depthBuffer: true,  // <<< Explicitly add depth buffer
                stencilBuffer: true // <<< Explicitly add stencil buffer (Corrected from false)
            });
            console.log("DEBUG: RenderTarget created with Depth/Stencil buffers.");

            // Base Scene setup
            baseSceneRef.current = new THREE.Scene(); baseCameraRef.current = new THREE.OrthographicCamera(-initialWidth / 2, initialWidth / 2, initialHeight / 2, -initialHeight / 2, 0.1, 10); baseCameraRef.current.position.z = 1; const planeGeometry = new THREE.PlaneGeometry(1, 1); const planeMaterial = new THREE.MeshBasicMaterial({ map: null, side: THREE.DoubleSide, color: 0xffffff, transparent: true }); basePlaneMeshRef.current = new THREE.Mesh(planeGeometry, planeMaterial); baseSceneRef.current.add(basePlaneMeshRef.current);

            // Post-Processing Scene
            postSceneRef.current = new THREE.Scene(); postCameraRef.current = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1); const postPlaneGeometry = new THREE.PlaneGeometry(2, 2);
            postMaterialRef.current = new THREE.ShaderMaterial({ vertexShader: postVertexShader, fragmentShader: postFragmentShader, uniforms: { uSceneTexture: { value: renderTargetRef.current.texture }, }, transparent: true, depthWrite: false, depthTest: false, });
            const postPlaneMesh = new THREE.Mesh(postPlaneGeometry, postMaterialRef.current); postSceneRef.current.add(postPlaneMesh);

            isInitialized.current = true;
            console.log("DEBUG: Scene initialization complete.");
            handleResize();
            console.log("DEBUG: Requesting first render loop frame from Init.");
            cancelAnimationFrame(animationFrameHandle.current);
            animationFrameHandle.current = requestAnimationFrame(renderLoop);
        } catch (error) { console.error("DEBUG: initThreeScene ERROR:", error); isInitialized.current = false; }
    }, [handleResize, postVertexShader, postFragmentShader, renderLoop]); // Added renderLoop


    // --- Setup / Cleanup Effect --- (Full Disposal)
    useEffect(() => {
        initThreeScene();
        let resizeObserver; const currentCanvas = canvasRef.current;
        if (currentCanvas) { resizeObserver = new ResizeObserver(() => { handleResize(); }); resizeObserver.observe(currentCanvas); }
        return () => {
             console.log("DEBUG: Cleanup running (TryOnRenderer Unmount)...");
             resizeObserver?.disconnect(); cancelAnimationFrame(animationFrameHandle.current); isInitialized.current = false;
             console.log("DEBUG: Disposing Three.js resources (Full)...");
             videoTextureRef.current?.dispose(); imageTextureRef.current?.dispose(); segmentationTextureRef.current?.dispose();
             renderTargetRef.current?.dispose();
             basePlaneMeshRef.current?.geometry?.dispose(); basePlaneMeshRef.current?.material?.map?.dispose(); basePlaneMeshRef.current?.material?.dispose();
             postMaterialRef.current?.uniforms?.uSceneTexture?.value?.dispose(); postMaterialRef.current?.uniforms?.uSegmentationMask?.value?.dispose(); postMaterialRef.current?.dispose();
             rendererInstanceRef.current?.dispose();
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