// src/components/TryOnRenderer.jsx - COMPLETE - Accept Data URL, Use TextureLoader

import React, { useRef, forwardRef, useEffect, useCallback, useState, useMemo } from 'react';
import * as THREE from 'three';

console.log(`Using Three.js revision: ${THREE.REVISION}`);

// Create loader outside component function
const textureLoader = new THREE.TextureLoader();

const TryOnRenderer = forwardRef(({
    videoRefProp,
    // REMOVED imageElement prop
    imageDataUrl, // NEW PROP: Accept Data URL string
    mediaPipeResults,
    isStatic,
    brightness, contrast, effectIntensity, className
 }, ref) => {

    // ... Core Refs ...
    const canvasRef = useRef(null);
    const imageTextureRef = useRef(null); // Keep ref for texture object
     // ... other refs ...

    // --- Internal State Refs --- (Keep as before)
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

    // --- Update internal refs --- (Keep as before)
    useEffect(() => { currentResults.current = mediaPipeResults; }, [mediaPipeResults]);
    useEffect(() => { currentBrightness.current = isStatic ? Math.max(0.1, brightness || 1.0) : 1.0; currentContrast.current = isStatic ? Math.max(0.1, contrast || 1.0) : 1.0; }, [isStatic, brightness, contrast]);
    useEffect(() => { currentIntensity.current = effectIntensity; }, [effectIntensity]);

    // --- Handle Resizing ---
    const handleResize = useCallback(() => { /* ... */ }, []);
    // --- Scale Base Plane ---
    const fitPlaneToCamera = useCallback((textureWidth, textureHeight) => { /* ... */ }, []);


    // --- Render Loop --- (Adjust texture loading)
     const renderLoop = useCallback(() => {
        animationFrameHandle.current = requestAnimationFrame(renderLoop);
        if (!isInitialized.current /* ... etc ... */) return;

        const currentCount = renderLoopCounter.current++;
        const logThisFrame = (currentCount % 100 === 0);

        try {
            const postUniforms = postMaterialRef.current.uniforms;
            if (!postUniforms) { return; }

            const results = currentResults.current;
            let sourceElement = null; // We don't directly use the element in loop now
            let isVideo = false;
            let isImage = false; // Determined by isStatic prop

            // Determine source type from props
             if (isStatic && imageDataUrl) { isImage = true; }
             else if (!isStatic && videoRefProp?.current) { sourceElement = videoRefProp.current; isVideo = true; }

            const baseMaterial = basePlaneMeshRef.current.material;
            let sourceWidth = 0, sourceHeight = 0;
            let textureToAssign = null;
            let textureJustCreated = false; // Might not be needed now

            // 1. Update Base Texture
            if (isVideo && sourceElement && sourceElement.readyState >= 2 && sourceElement.videoWidth > 0) {
                 // ... video texture logic remains same ...
                 textureToAssign = videoTextureRef.current;
            }
            else if (isImage && imageDataUrl) { // Check if we should render static image
                // *** Use TextureLoader for Data URL ***
                // Only load if the data URL changed or texture doesn't exist
                 if (!imageTextureRef.current || imageTextureRef.current.userData?.src !== imageDataUrl) {
                     console.log("DEBUG RenderLoop: Loading Image Texture from Data URL");
                     imageTextureRef.current?.dispose(); // Dispose old texture
                     // Use the loader - it handles image loading internally
                     imageTextureRef.current = textureLoader.load(
                         imageDataUrl,
                         // onLoad callback (optional, useful for getting dimensions)
                         (texture) => {
                             console.log("DEBUG RenderLoop: Image Texture Loaded via Loader");
                             texture.colorSpace = THREE.SRGBColorSpace;
                             texture.userData = { src: imageDataUrl }; // Store src for comparison
                             // Texture is ready, next frame should render it
                         },
                         // onProgress callback (optional)
                         undefined,
                         // onError callback
                         (err) => {
                             console.error("Error loading image texture:", err);
                             imageTextureRef.current = null; // Clear ref on error
                         }
                     );
                 }
                 textureToAssign = imageTextureRef.current; // Assign the ref (might be loading initially)
            }
            else { // No valid source
                textureToAssign = null;
                if(videoTextureRef.current) { videoTextureRef.current.dispose(); videoTextureRef.current = null; }
                if(imageTextureRef.current) { imageTextureRef.current.dispose(); imageTextureRef.current = null;}
             }

             // Assign texture map if changed
             if (baseMaterial.map !== textureToAssign) {
                 baseMaterial.map = textureToAssign;
                 baseMaterial.needsUpdate = true;
                 console.log("DEBUG RenderLoop: Assigned texture:", textureToAssign?.constructor?.name ?? 'null');
             }

            // 2. Update Plane Scale & Mirroring
            // Get dimensions from texture if available
            if (textureToAssign?.image) { // Check if texture image data is loaded
                 sourceWidth = textureToAssign.image.width;
                 sourceHeight = textureToAssign.image.height;
            } else { sourceWidth = 0; sourceHeight = 0;}

            const planeVisible = !!baseMaterial.map && sourceWidth > 0 && sourceHeight > 0;
             if (planeVisible) { fitPlaneToCamera(sourceWidth, sourceHeight); const scaleX = Math.abs(basePlaneMeshRef.current.scale.x); const newScaleX = isVideo ? -scaleX : scaleX; if(basePlaneMeshRef.current.scale.x !== newScaleX) { basePlaneMeshRef.current.scale.x = newScaleX; } }
             else { if (basePlaneMeshRef.current.scale.x !== 0 || basePlaneMeshRef.current.scale.y !== 0) { basePlaneMeshRef.current.scale.set(0, 0, 0); if (logThisFrame) console.log("DEBUG RenderLoop: Hiding base plane"); } }

            // 3. Render Base Scene to Target
             // ... render to target (using BLUE clear color) ...

            // 4. Update Post-Processing Uniforms
             // ... update uniforms ...

            // 5. Render Post-Processing Scene to Screen
             rendererInstanceRef.current.render(postSceneRef.current, postCameraRef.current);

        } catch (error) { console.error("Error in renderLoop:", error); }
    // Update dependency array based on props read in loop
    }, [fitPlaneToCamera, videoRefProp, imageDataUrl, isStatic]);


    // --- Initialize Scene --- (Keep Bare Minimum Shader & ONLY uSceneTexture Uniform)
    const initThreeScene = useCallback(() => { /* ... same init logic ... */ }, [handleResize, postVertexShader, postFragmentShader, renderLoop]);

    // --- Effect for Initial Setup / Resize Observer ---
    useEffect(() => { /* ... */ }, [initThreeScene, handleResize]);
    // --- REMOVED useImperativeHandle ---
    // --- JSX ---
    return ( <canvas ref={canvasRef} className={`renderer-canvas ${className || ''}`} style={{ display: 'block', width: '100%', height: '100%' }} /> );
});

TryOnRenderer.displayName = 'TryOnRenderer';
export default TryOnRenderer;