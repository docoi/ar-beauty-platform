// src/components/TryOnRenderer.jsx - Ensure needsUpdate for Image/Canvas

import React, { useRef, forwardRef, useEffect, useCallback, useState, useMemo } from 'react';
import * as THREE from 'three';

console.log(`Using Three.js revision: ${THREE.REVISION}`);

const TryOnRenderer = forwardRef(({
    videoElement, imageElement, mediaPipeResults, isStatic: isStaticProp,
    brightness, contrast, effectIntensity, className
 }, ref) => {

    // --- Core Refs ---
    const canvasRef = useRef(null); // Ensure this is defined
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
    useEffect(() => { /* ... */ }, [videoElement, imageElement, isStaticProp]);
    useEffect(() => { /* ... */ }, [mediaPipeResults]);
    useEffect(() => { /* ... */ }, [isStaticProp, brightness, contrast]);
    useEffect(() => { /* ... */ }, [effectIntensity]);

    // --- Handle Resizing ---
    const handleResize = useCallback(() => { /* ... */ }, []);
    // --- Scale Base Plane ---
    const fitPlaneToCamera = useCallback((textureWidth, textureHeight) => { /* ... */ }, []);


    // --- Render Loop --- (Handle Canvas Texture Update)
     const renderLoop = useCallback(() => {
        animationFrameHandle.current = requestAnimationFrame(renderLoop);
        if (!isInitialized.current || !rendererInstanceRef.current || !baseSceneRef.current || !baseCameraRef.current || !postSceneRef.current || !postCameraRef.current || !basePlaneMeshRef.current || !postMaterialRef.current || !renderTargetRef.current) return;

        try {
            const postUniforms = postMaterialRef.current.uniforms;
            if (!postUniforms) { /*console.warn(...)*/ return; }

            const sourceElement = currentSource.current;
            const results = currentResults.current;
            const isStatic = currentIsStatic.current; // Defined from ref
            const baseMaterial = basePlaneMeshRef.current.material;
            let sourceWidth = 0, sourceHeight = 0;
            let isVideo = sourceElement instanceof HTMLVideoElement;
            let isImage = sourceElement instanceof HTMLImageElement || sourceElement instanceof HTMLCanvasElement;
            let textureToAssign = null;

            // 1. Update Base Texture
            if (isVideo && sourceElement.readyState >= 2 && sourceElement.videoWidth > 0) {
                 sourceWidth = sourceElement.videoWidth; sourceHeight = sourceElement.videoHeight;
                 if (videoTextureRef.current?.image !== sourceElement) { /* create VideoTexture */ }
                 textureToAssign = videoTextureRef.current;
                 // Ensure image texture isn't marked needsUpdate if switching from image
                 if (imageTextureRef.current) imageTextureRef.current.needsUpdate = false;
            }
            else if (isImage && sourceElement.width > 0 && sourceElement.height > 0) {
                sourceWidth = sourceElement.width; sourceHeight = sourceElement.height;
                if (imageTextureRef.current?.image !== sourceElement) { // If source element changed (e.g., first frame or new static image)
                    imageTextureRef.current?.dispose();
                    imageTextureRef.current = new THREE.Texture(sourceElement);
                    imageTextureRef.current.colorSpace = THREE.SRGBColorSpace;
                    imageTextureRef.current.needsUpdate = true; // Update needed on creation
                    console.log(`DEBUG RenderLoop: Created/Replaced Image/Canvas Texture`);
                } else if (imageTextureRef.current) {
                    // *** ALWAYS SET needsUpdate FOR CANVAS/IMAGE TEXTURES ***
                    // This ensures the latest frame drawn onto the intermediate canvas is uploaded
                    imageTextureRef.current.needsUpdate = true;
                    // *** -------------------------------------------- ***
                }
                textureToAssign = imageTextureRef.current;
                 // Ensure video texture isn't marked needsUpdate
                 if (videoTextureRef.current) videoTextureRef.current.needsUpdate = false; // VideoTexture updates automatically

            } else { textureToAssign = null; /* ... dispose ... */ }

            // Assign texture to material map
            if (baseMaterial.map !== textureToAssign) {
                baseMaterial.map = textureToAssign;
                baseMaterial.needsUpdate = true; // Material needs update when map changes
                 console.log("DEBUG RenderLoop: Assigned texture to base material:", textureToAssign ? textureToAssign.constructor.name : 'null');
            }

            // 2. Update Plane Scale & Mirroring
            const planeVisible = baseMaterial.map && sourceWidth > 0 && sourceHeight > 0;
            if (planeVisible) { fitPlaneToCamera(sourceWidth, sourceHeight); const scaleX = Math.abs(basePlaneMeshRef.current.scale.x); const newScaleX = !isStatic ? -scaleX : scaleX; if(basePlaneMeshRef.current.scale.x !== newScaleX) { basePlaneMeshRef.current.scale.x = newScaleX; } }
            else { if (basePlaneMeshRef.current.scale.x !== 0 || basePlaneMeshRef.current.scale.y !== 0) { basePlaneMeshRef.current.scale.set(0, 0, 0); /*console.log(...)*/; } }

            // 3. Render Base Scene to Target
            if (planeVisible) { rendererInstanceRef.current.setRenderTarget(renderTargetRef.current); rendererInstanceRef.current.clear(); rendererInstanceRef.current.render(baseSceneRef.current, baseCameraRef.current); rendererInstanceRef.current.setRenderTarget(null); }
            else { rendererInstanceRef.current.setRenderTarget(renderTargetRef.current); rendererInstanceRef.current.clear(); rendererInstanceRef.current.setRenderTarget(null); }

            // 4. Update Post-Processing Uniforms
            if (postUniforms.uSceneTexture) { postUniforms.uSceneTexture.value = renderTargetRef.current.texture; }

            // Update Segmentation Mask Texture (if uniform defined on material)
            const segmentationMask = results?.segmentationMasks?.[0]; const maskUniform = postUniforms.uSegmentationMask;
            if (maskUniform && segmentationMask?.mask) { /* ... update mask texture ... */ }
            else if (maskUniform && maskUniform.value !== null) { maskUniform.value = null; }

            // 5. Render Post-Processing Scene to Screen
            rendererInstanceRef.current.render(postSceneRef.current, postCameraRef.current);

        } catch (error) { console.error("Error in renderLoop:", error); }
    }, [fitPlaneToCamera]);


    // --- Initialize Scene ---
    const initThreeScene = useCallback(() => { /* ... */ }, [handleResize, postVertexShader, postFragmentShader, renderLoop]);
    // --- Effect for Initial Setup / Resize Observer ---
    useEffect(() => { /* ... */ }, [initThreeScene, handleResize]);
    // --- REMOVED useImperativeHandle ---
    // --- JSX ---
    return ( <canvas ref={canvasRef} className={`renderer-canvas ${className || ''}`} style={{ display: 'block', width: '100%', height: '100%' }} /> );
});

TryOnRenderer.displayName = 'TryOnRenderer';
export default TryOnRenderer;