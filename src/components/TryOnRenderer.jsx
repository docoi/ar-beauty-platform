// src/components/TryOnRenderer.jsx - Add Uniform Existence Checks in Loop

import React, { useRef, forwardRef, useEffect, useCallback, useState, useMemo } from 'react';
import * as THREE from 'three';

// ... console.log THREE revision ...

const TryOnRenderer = forwardRef(({ /* ... props ... */ videoElement, imageElement, mediaPipeResults, isStatic, brightness, contrast, effectIntensity, className }, ref) => {

    // ... refs ...
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

    // Internal State Refs
    const currentSource = useRef(null);
    const currentResults = useRef(null);
    const currentIsStatic = useRef(false);
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
    useEffect(() => { /* ... update currentSource, currentIsStatic ... */ }, [videoElement, imageElement, isStatic]);
    useEffect(() => { /* ... update currentResults ... */ }, [mediaPipeResults]);
    useEffect(() => { /* ... update currentBrightness, currentContrast ... */ }, [isStatic, brightness, contrast]);
    useEffect(() => { /* ... update currentIntensity ... */ }, [effectIntensity]);


    // --- Handle Resizing ---
    const handleResize = useCallback(() => { /* ... */ }, []);
    // --- Scale Base Plane ---
    const fitPlaneToCamera = useCallback((textureWidth, textureHeight) => { /* ... */ }, []);


    // --- Render Loop --- (Add Safety Checks for Uniforms)
     const renderLoop = useCallback(() => {
        animationFrameHandle.current = requestAnimationFrame(renderLoop);
        // Add check for postMaterialRef itself here
        if (!isInitialized.current || !rendererInstanceRef.current || !baseSceneRef.current || !baseCameraRef.current || !postSceneRef.current || !postCameraRef.current || !basePlaneMeshRef.current || !postMaterialRef.current || !renderTargetRef.current) {
             // console.log("RenderLoop skipped: Not fully initialized");
             return;
        }


        try {
            // Ensure uniforms object exists before accessing it
            const postUniforms = postMaterialRef.current.uniforms;
            if (!postUniforms) {
                 console.warn("RenderLoop skipped: postUniforms not ready.");
                 return;
            }

            const sourceElement = currentSource.current;
            const results = currentResults.current;
            const baseMaterial = basePlaneMeshRef.current.material;
            let sourceWidth = 0, sourceHeight = 0;
            let isVideo = sourceElement instanceof HTMLVideoElement;
            let isImage = sourceElement instanceof HTMLImageElement;
            let textureToAssign = null;

            // 1. Update Base Texture (No change needed)
            // ... texture update logic ...

            // 2. Update Plane Scale & Mirroring (No change needed)
            // ... plane scale logic ...

            // 3. Render Base Scene to Target (No change needed)
            // ... render to target logic ...


            // 4. Update Post-Processing Uniforms (SAFER CHECKS)
            // Check uniform object itself exists before setting .value
            if (postUniforms.uSceneTexture) {
                postUniforms.uSceneTexture.value = renderTargetRef.current.texture;
            } else {
                 console.warn("RenderLoop: uSceneTexture uniform missing!");
            }

            // Update Segmentation Mask Texture (SAFER CHECKS)
             const segmentationMask = results?.segmentationMasks?.[0];
             const maskUniform = postUniforms.uSegmentationMask; // Check if uniform was defined

             if (maskUniform && segmentationMask?.mask) {
                  if (!segmentationTextureRef.current || segmentationTextureRef.current.image.width !== segmentationMask.width /*...*/) {
                      segmentationTextureRef.current?.dispose();
                      segmentationTextureRef.current = new THREE.DataTexture(segmentationMask.mask, segmentationMask.width, segmentationMask.height, THREE.RedFormat, THREE.FloatType);
                      segmentationTextureRef.current.needsUpdate = true;
                  } else if (segmentationTextureRef.current.image.data !== segmentationMask.mask) {
                       segmentationTextureRef.current.image.data = segmentationMask.mask;
                       segmentationTextureRef.current.needsUpdate = true;
                  }
                  maskUniform.value = segmentationTextureRef.current; // Set value only if uniform exists
             } else if (maskUniform && maskUniform.value !== null) {
                   maskUniform.value = null; // Clear value only if uniform exists
             }


            // 5. Render Post-Processing Scene to Screen
            rendererInstanceRef.current.render(postSceneRef.current, postCameraRef.current);

        } catch (error) { console.error("Error in renderLoop:", error); }
    }, [fitPlaneToCamera]);


    // --- Initialize Scene --- (Keep Bare Minimum Shader & ONLY uSceneTexture Uniform)
    const initThreeScene = useCallback(() => {
        if (!canvasRef.current || isInitialized.current) return; console.log("DEBUG: initThreeScene START (Post-Processing)"); try { const canvas = canvasRef.current; const initialWidth = canvas.clientWidth || 640; const initialHeight = canvas.clientHeight || 480; rendererInstanceRef.current = new THREE.WebGLRenderer({ canvas: canvas, antialias: true }); /*...*/ renderTargetRef.current = new THREE.WebGLRenderTarget(/*...*/); /*...*/ baseSceneRef.current = new THREE.Scene(); /*...*/ baseCameraRef.current = new THREE.OrthographicCamera(/*...*/); /*...*/ basePlaneMeshRef.current = new THREE.Mesh(/*...*/); baseSceneRef.current.add(basePlaneMeshRef.current); console.log("DEBUG: Base scene created.");
            // Create Post Scene
            postSceneRef.current = new THREE.Scene(); postCameraRef.current = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1); const postPlaneGeometry = new THREE.PlaneGeometry(2, 2);
            // Create ShaderMaterial with ONLY uSceneTexture uniform
            postMaterialRef.current = new THREE.ShaderMaterial({
                vertexShader: postVertexShader, fragmentShader: postFragmentShader,
                uniforms: {
                     uSceneTexture: { value: null }, // Initialize texture value to null
                 },
                depthWrite: false, depthTest: false,
            });
            // Assign texture *after* material creation
            if (renderTargetRef.current) {
                 postMaterialRef.current.uniforms.uSceneTexture.value = renderTargetRef.current.texture;
            }
            const postPlaneMesh = new THREE.Mesh(postPlaneGeometry, postMaterialRef.current); postSceneRef.current.add(postPlaneMesh); console.log("DEBUG: Post-processing scene created (Bare Minimum Shader)."); isInitialized.current = true; console.log("DEBUG: Scene initialization complete."); handleResize(); console.log("DEBUG: Requesting first render loop frame from Init."); cancelAnimationFrame(animationFrameHandle.current); animationFrameHandle.current = requestAnimationFrame(renderLoop); } catch (error) { console.error("DEBUG: initThreeScene ERROR:", error); isInitialized.current = false; }
    }, [handleResize, postVertexShader, postFragmentShader, renderLoop]);


    // --- Effect for Initial Setup / Resize Observer ---
    useEffect(() => { /* ... */ }, [initThreeScene, handleResize]);
    // --- REMOVED useImperativeHandle ---
    // --- JSX ---
    return ( <canvas ref={canvasRef} className={`renderer-canvas ${className || ''}`} style={{ display: 'block', width: '100%', height: '100%' }} /> );
});

TryOnRenderer.displayName = 'TryOnRenderer';
export default TryOnRenderer;