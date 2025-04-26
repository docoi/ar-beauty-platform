// src/components/TryOnRenderer.jsx - COMPLETE - Post-Processing, useEffect Textures, Bare Shader

import React, { useRef, forwardRef, useEffect, useCallback, useState, useMemo } from 'react';
import * as THREE from 'three';

console.log(`Using Three.js revision: ${THREE.REVISION}`);

const TryOnRenderer = forwardRef(({
    videoRefProp,     // Ref object for video element
    imageElement,     // Actual image element
    mediaPipeResults,
    isStatic,
    brightness, contrast, effectIntensity, className,
    style // Accept style prop
 }, ref) => {

    // --- Core Refs ---
    const canvasRef = useRef(null);
    const rendererInstanceRef = useRef(null);
    const animationFrameHandle = useRef(null);
    const isInitialized = useRef(false);
    const baseSceneRef = useRef(null);
    const baseCameraRef = useRef(null);
    const basePlaneMeshRef = useRef(null);
    const videoTextureRef = useRef(null); // Ref to hold the VideoTexture object
    const imageTextureRef = useRef(null); // Ref to hold the Image Texture object
    const postSceneRef = useRef(null);
    const postCameraRef = useRef(null);
    const postMaterialRef = useRef(null);
    const segmentationTextureRef = useRef(null);
    const renderTargetRef = useRef(null);

    // --- Internal State Refs ---
    const currentResults = useRef(null);
    const currentBrightness = useRef(1.0);
    const currentContrast = useRef(1.0);
    const currentIntensity = useRef(0.5);
    const renderLoopCounter = useRef(0);


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

    // --- Effect to manage Video Texture ---
    useEffect(() => {
        const videoElement = videoRefProp?.current;
        if (!isStatic && videoElement) {
             if (!videoTextureRef.current || videoTextureRef.current.image !== videoElement) {
                console.log("TryOnRenderer Effect: Creating/Updating Video Texture");
                videoTextureRef.current?.dispose();
                videoTextureRef.current = new THREE.VideoTexture(videoElement);
                videoTextureRef.current.colorSpace = THREE.SRGBColorSpace;
             }
        } else {
             if (videoTextureRef.current) {
                console.log("TryOnRenderer Effect: Disposing Video Texture");
                videoTextureRef.current.dispose();
                videoTextureRef.current = null;
             }
        }
    }, [isStatic, videoRefProp]);


     // --- Effect to manage Image Texture ---
    useEffect(() => {
        if (isStatic && imageElement) {
             if (!imageTextureRef.current || imageTextureRef.current.image !== imageElement) {
                console.log("TryOnRenderer Effect: Creating/Updating Image Texture");
                imageTextureRef.current?.dispose();
                imageTextureRef.current = new THREE.Texture(imageElement);
                imageTextureRef.current.colorSpace = THREE.SRGBColorSpace;
                imageTextureRef.current.needsUpdate = true; // Mark for upload on creation
             } else if (imageTextureRef.current) {
                 // If the element is the same, we still need to trigger update
                 imageTextureRef.current.needsUpdate = true;
                 console.log("TryOnRenderer Effect: Marking existing Image Texture needsUpdate=true");
             }
        } else {
             if (imageTextureRef.current) {
                 console.log("TryOnRenderer Effect: Disposing Image Texture");
                 imageTextureRef.current.dispose();
                 imageTextureRef.current = null;
             }
        }
    }, [isStatic, imageElement]);


    // --- Handle Resizing ---
    const handleResize = useCallback(() => {
         const canvas = canvasRef.current; if (!rendererInstanceRef.current || !baseCameraRef.current || !postCameraRef.current || !canvas || !renderTargetRef.current) return; const newWidth = canvas.clientWidth; const newHeight = canvas.clientHeight; if (newWidth === 0 || newHeight === 0) return; const currentSize = rendererInstanceRef.current.getSize(new THREE.Vector2()); if (currentSize.x === newWidth && currentSize.y === newHeight) return; console.log(`DEBUG: Resizing -> ${newWidth}x${newHeight}`); try { rendererInstanceRef.current.setSize(newWidth, newHeight); renderTargetRef.current.setSize(newWidth, newHeight); baseCameraRef.current.left = -newWidth / 2; baseCameraRef.current.right = newWidth / 2; baseCameraRef.current.top = newHeight / 2; baseCameraRef.current.bottom = -newHeight / 2; baseCameraRef.current.updateProjectionMatrix(); } catch(e) { console.error("Resize Error:", e);}
    }, []);


    // --- Scale Base Plane ---
    const fitPlaneToCamera = useCallback((textureWidth, textureHeight) => {
        const canvas = canvasRef.current; if (!baseCameraRef.current || !basePlaneMeshRef.current || !textureWidth || !textureHeight || !canvas || canvas.clientWidth === 0 || canvas.clientHeight === 0) return; const viewWidth = canvas.clientWidth; const viewHeight = canvas.clientHeight; const viewAspect = viewWidth / viewHeight; const textureAspect = textureWidth / textureHeight; let scaleX, scaleY; if (viewAspect > textureAspect) { scaleX = viewWidth; scaleY = scaleX / textureAspect; } else { scaleY = viewHeight; scaleX = scaleY * textureAspect; } const currentScale = basePlaneMeshRef.current.scale; const currentSignX = Math.sign(currentScale.x) || 1; const newScaleXWithSign = scaleX * currentSignX; if (Math.abs(currentScale.y - scaleY) > 0.01 || Math.abs(currentScale.x - newScaleXWithSign) > 0.01) { currentScale.y = scaleY; currentScale.x = newScaleXWithSign; /*console.log(...)*/ }
     }, []);


    // --- Render Loop --- (Uses texture refs)
     const renderLoop = useCallback(() => {
        animationFrameHandle.current = requestAnimationFrame(renderLoop);
        if (!isInitialized.current || !rendererInstanceRef.current || !baseSceneRef.current || !baseCameraRef.current || !postSceneRef.current || !postCameraRef.current || !basePlaneMeshRef.current || !postMaterialRef.current || !renderTargetRef.current) { return; }

        const currentCount = renderLoopCounter.current++;
        const logThisFrame = (currentCount % 100 === 0);

        try {
            const postUniforms = postMaterialRef.current.uniforms;
            if (!postUniforms) { return; }

            const results = currentResults.current; // Read results ref
            const baseMaterial = basePlaneMeshRef.current.material;
            let sourceWidth = 0, sourceHeight = 0;
            let textureToAssign = null;
            let isVideo = false;

            // *** Select texture based on props and internal texture refs ***
            if (!isStatic && videoTextureRef.current) {
                 textureToAssign = videoTextureRef.current;
                 if (textureToAssign.image) { sourceWidth = textureToAssign.image.videoWidth; sourceHeight = textureToAssign.image.videoHeight; isVideo = true;}
            } else if (isStatic && imageTextureRef.current) {
                 textureToAssign = imageTextureRef.current;
                  if (textureToAssign.image) { sourceWidth = textureToAssign.image.naturalWidth; sourceHeight = textureToAssign.image.naturalHeight; }
                  // Ensure needsUpdate is set for rendering if it's the active texture
                  if(textureToAssign.needsUpdate) {
                      textureToAssign.needsUpdate = true;
                  }
            }
            // *** ------------------------------------ ***


             // Assign texture map if changed
             if (baseMaterial.map !== textureToAssign) {
                 baseMaterial.map = textureToAssign;
                 baseMaterial.needsUpdate = true;
                 console.log("DEBUG RenderLoop: Assigned texture:", textureToAssign?.constructor?.name ?? 'null');
             }


            // 2. Update Plane Scale & Mirroring
            const planeVisible = !!baseMaterial.map && sourceWidth > 0 && sourceHeight > 0;
             if (planeVisible) { fitPlaneToCamera(sourceWidth, sourceHeight); const scaleX = Math.abs(basePlaneMeshRef.current.scale.x); const newScaleX = isVideo ? -scaleX : scaleX; if(basePlaneMeshRef.current.scale.x !== newScaleX) { basePlaneMeshRef.current.scale.x = newScaleX; } }
             else { if (basePlaneMeshRef.current.scale.x !== 0 || basePlaneMeshRef.current.scale.y !== 0) { basePlaneMeshRef.current.scale.set(0, 0, 0); if (logThisFrame) console.log("DEBUG RenderLoop: Hiding base plane"); } }


            // 3. Render Base Scene to Target
             rendererInstanceRef.current.setRenderTarget(renderTargetRef.current);
             rendererInstanceRef.current.setClearColor(0x000000, 0); // Original clear color
             rendererInstanceRef.current.clear();
             if (planeVisible) { rendererInstanceRef.current.render(baseSceneRef.current, baseCameraRef.current); if (logThisFrame) console.log(`DEBUG RenderLoop: Rendered base scene to target.`); }
             else { if (logThisFrame) console.log(`DEBUG RenderLoop: Target cleared (plane hidden).`); }
             rendererInstanceRef.current.setRenderTarget(null);


            // 4. Update Post-Processing Uniforms
             if (postUniforms.uSceneTexture) { postUniforms.uSceneTexture.value = renderTargetRef.current.texture; }
             // Update Segmentation Mask Texture (if uniform exists on material)
             const segmentationMask = results?.segmentationMasks?.[0]; const maskUniform = postUniforms.uSegmentationMask;
             if (maskUniform && segmentationMask?.mask) { /* ... update/assign mask texture ... */ }
             else if (maskUniform && maskUniform.value !== null) { maskUniform.value = null; }


            // 5. Render Post-Processing Scene to Screen
             rendererInstanceRef.current.render(postSceneRef.current, postCameraRef.current);


        } catch (error) { console.error("Error in renderLoop:", error); }
    // Dependency only on fitPlaneToCamera and isStatic prop
    }, [fitPlaneToCamera, isStatic]); // isStatic needed because loop logic branches


    // --- Initialize Scene --- (Bare Minimum Shader, Only uSceneTexture Uniform)
    const initThreeScene = useCallback(() => {
        if (!canvasRef.current || isInitialized.current) return; console.log("DEBUG: initThreeScene START (Post-Processing)"); try { const canvas = canvasRef.current; const initialWidth = canvas.clientWidth || 640; const initialHeight = canvas.clientHeight || 480; rendererInstanceRef.current = new THREE.WebGLRenderer({ canvas: canvas, antialias: true }); rendererInstanceRef.current.setSize(initialWidth, initialHeight); rendererInstanceRef.current.setPixelRatio(window.devicePixelRatio); rendererInstanceRef.current.outputColorSpace = THREE.SRGBColorSpace; renderTargetRef.current = new THREE.WebGLRenderTarget(initialWidth, initialHeight, { minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, format: THREE.RGBAFormat, colorSpace: THREE.SRGBColorSpace }); console.log("DEBUG: RenderTarget created."); baseSceneRef.current = new THREE.Scene(); baseCameraRef.current = new THREE.OrthographicCamera(-initialWidth / 2, initialWidth / 2, initialHeight / 2, -initialHeight / 2, 0.1, 10); baseCameraRef.current.position.z = 1; const planeGeometry = new THREE.PlaneGeometry(1, 1); const planeMaterial = new THREE.MeshBasicMaterial({ map: null, side: THREE.DoubleSide, color: 0xffffff }); basePlaneMeshRef.current = new THREE.Mesh(planeGeometry, planeMaterial); basePlaneMeshRef.current.position.z = 0; basePlaneMeshRef.current.scale.set(1, 1, 1); baseSceneRef.current.add(basePlaneMeshRef.current); console.log("DEBUG: Base scene created.");
            postSceneRef.current = new THREE.Scene(); postCameraRef.current = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1); const postPlaneGeometry = new THREE.PlaneGeometry(2, 2);
            postMaterialRef.current = new THREE.ShaderMaterial({ vertexShader: postVertexShader, fragmentShader: postFragmentShader, uniforms: { uSceneTexture: { value: null }, }, depthWrite: false, depthTest: false, });
            if (renderTargetRef.current) { postMaterialRef.current.uniforms.uSceneTexture.value = renderTargetRef.current.texture; }
            const postPlaneMesh = new THREE.Mesh(postPlaneGeometry, postMaterialRef.current); postSceneRef.current.add(postPlaneMesh); console.log("DEBUG: Post-processing scene created (Bare Minimum Shader)."); isInitialized.current = true; console.log("DEBUG: Scene initialization complete."); handleResize(); console.log("DEBUG: Requesting first render loop frame from Init."); cancelAnimationFrame(animationFrameHandle.current); animationFrameHandle.current = requestAnimationFrame(renderLoop); } catch (error) { console.error("DEBUG: initThreeScene ERROR:", error); isInitialized.current = false; }
    // Add renderLoop back
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
    // Pass style prop down to canvas
    return ( <canvas ref={canvasRef} className={`renderer-canvas ${className || ''}`} style={{ display: 'block', width: '100%', height: '100%', ...(style || {}) }} /> );
});

TryOnRenderer.displayName = 'TryOnRenderer';
export default TryOnRenderer;