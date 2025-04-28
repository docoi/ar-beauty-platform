// src/components/TryOnRenderer.jsx - CORRECT Mask Data Access + Logging

import React, { useRef, forwardRef, useEffect, useCallback } from 'react';
import * as THREE from 'three';

const TryOnRenderer = forwardRef(({
    videoRefProp, imageElement, mediaPipeResults, // Still here but not used for mask
    segmentationResults, // <<< USE THIS PROP
    isStatic, brightness, contrast, effectIntensity,
    className, style
 }, ref) => {

    // --- Log received props ---
    // console.log(`TryOnRenderer RENDERING. isStatic=${isStatic}, Has segmentationResults? ${!!segmentationResults}`);

    // --- Core Refs / Internal State Refs --- (No changes)
    const canvasRef = useRef(null); const rendererInstanceRef = useRef(null); const animationFrameHandle = useRef(null); const isInitialized = useRef(false);
    const baseSceneRef = useRef(null); const baseCameraRef = useRef(null); const basePlaneMeshRef = useRef(null); const videoTextureRef = useRef(null);
    const imageTextureRef = useRef(null); const postSceneRef = useRef(null); const postCameraRef = useRef(null); const postMaterialRef = useRef(null);
    const renderTargetRef = useRef(null); const segmentationTextureRef = useRef(null);
    const currentBrightness = useRef(1.0); const currentContrast = useRef(1.0); const currentIntensity = useRef(0.5);
    const renderLoopCounter = useRef(0); const lastMaskUpdateTime = useRef(0);

    // --- Shaders --- (Keep exaggerated Red effect)
    const postVertexShader = `varying vec2 vUv; void main() { vUv = uv; gl_Position = vec4(position, 1.0); }`;
    const postFragmentShader = `
        uniform sampler2D uSceneTexture; uniform sampler2D uSegmentationMask;
        uniform float uBrightness; uniform float uContrast; uniform float uEffectIntensity; uniform bool uHasMask;
        varying vec2 vUv;
        vec3 applyBrightnessContrast(vec3 c, float b, float co){ c=c*b; c=(c-0.5)*co+0.5; return c; }
        vec3 applyHydrationEffect(vec3 c){ return vec3(1.0, 0.0, 0.0); } /* Red */
        void main() {
            vec4 b = texture2D(uSceneTexture, vUv); vec3 c = applyBrightnessContrast(b.rgb, uBrightness, uContrast); vec3 f = c;
            if (uHasMask && uEffectIntensity > 0.0) {
                float m = texture2D(uSegmentationMask, vUv).r; vec3 h = applyHydrationEffect(c);
                f = mix(c, h, m * uEffectIntensity);
            }
            f = clamp(f, 0.0, 1.0); gl_FragColor = vec4(f, b.a);
        }`;

    // --- Prop Effects (Intensity, Brightness/Contrast) --- (No changes)
    useEffect(() => { currentBrightness.current = isStatic ? Math.max(0.01, brightness || 1.0) : 1.0; currentContrast.current = isStatic ? Math.max(0.01, contrast || 1.0) : 1.0; }, [isStatic, brightness, contrast]);
    useEffect(() => { currentIntensity.current = effectIntensity; }, [effectIntensity]);

    // --- Video/Image Texture Effects --- (No changes)
    useEffect(() => { /* ... Video Texture Logic ... */ }, [isStatic, videoRefProp]);
    useEffect(() => { /* ... Image Texture Logic ... */ }, [isStatic, imageElement]);


    // --- ***** CORRECTED Segmentation Mask Texture Effect ***** ---
    useEffect(() => {
        const results = segmentationResults; // Use the correct prop
        const hasMaskDataArray = Array.isArray(results?.confidenceMasks) && results.confidenceMasks.length > 0;

        // console.log(`TryOnRenderer Mask EFFECT Check: Received segmentationResults prop. Has valid confidenceMasks? ${hasMaskDataArray}`);

        if (hasMaskDataArray) {
            const confidenceMaskObject = results.confidenceMasks[0]; // This is the MPImage object

            // *** Attempt to get data from the MPImage object ***
            // Common properties are .data or sometimes .getAsFloat32Array() might be needed
            // Let's prioritize .data for CPU delegate output
            const maskData = confidenceMaskObject?.data; // <<< TRY ACCESSING .data PROPERTY
            const maskWidth = confidenceMaskObject?.width;
            const maskHeight = confidenceMaskObject?.height;

            console.log(`TryOnRenderer Mask EFFECT Details: Mask Obj Type=${confidenceMaskObject?.constructor?.name}, Width=${maskWidth}, Height=${maskHeight}`);
            // Log the type of maskData we found
            console.log(` -> Trying .data property: Type=${maskData?.constructor?.name}, Length=${maskData?.length}`);

            // Check if maskData is the Float32Array we expect
             if (maskData instanceof Float32Array && maskWidth > 0 && maskHeight > 0) {
                // console.log(`TryOnRenderer Mask EFFECT: Processing Float32Array mask data.`);
                 const now = performance.now(); const timeSinceLastUpdate = now - lastMaskUpdateTime.current; const throttleThreshold = isStatic ? 0 : 66;
                 if (timeSinceLastUpdate > throttleThreshold) {
                    lastMaskUpdateTime.current = now;
                    try {
                        // console.log(`TryOnRenderer Mask EFFECT Texture: Attempting to create/update DataTexture...`);
                        if (!segmentationTextureRef.current || segmentationTextureRef.current.image.width !== maskWidth || segmentationTextureRef.current.image.height !== maskHeight) {
                            console.log(` -> Creating NEW DataTexture (${maskWidth}x${maskHeight}) from confidenceMask.data`);
                            segmentationTextureRef.current?.dispose();
                            segmentationTextureRef.current = new THREE.DataTexture(maskData, maskWidth, maskHeight, THREE.RedFormat, THREE.FloatType);
                            segmentationTextureRef.current.minFilter = THREE.LinearFilter; segmentationTextureRef.current.magFilter = THREE.LinearFilter;
                            segmentationTextureRef.current.needsUpdate = true;
                            console.log(`TryOnRenderer Mask EFFECT Texture: New DataTexture CREATED.`);
                        } else {
                            // console.log(` -> Updating EXISTING DataTexture data from confidenceMask.data.`);
                            segmentationTextureRef.current.image.data = maskData;
                            segmentationTextureRef.current.needsUpdate = true;
                            // console.log(`TryOnRenderer Mask EFFECT Texture: Existing DataTexture UPDATED.`);
                        }
                    } catch (error) { /* ... error handling ... */ console.error("TryOnRenderer Mask Texture: Error creating/updating DataTexture:", error); segmentationTextureRef.current?.dispose(); segmentationTextureRef.current = null; }
                 }
             }
             // Add a check for WebGLTexture just in case delegate changes later
             else if (maskData instanceof WebGLTexture) {
                 console.warn("TryOnRenderer Mask EFFECT Handling: Received WebGLTexture (GPU). Ensure delegate is CPU if expecting Float32Array.");
                 if (segmentationTextureRef.current) { segmentationTextureRef.current.dispose(); segmentationTextureRef.current = null; }
             }
             // Log failure if maskData wasn't the expected Float32Array
             else {
                 console.warn(`TryOnRenderer Mask EFFECT: confidenceMask.data was not a valid Float32Array. Type: ${maskData?.constructor?.name}`);
                 if (segmentationTextureRef.current) { segmentationTextureRef.current.dispose(); segmentationTextureRef.current = null; }
             }
        } else {
            // No valid confidenceMasks array found in prop
            if (segmentationTextureRef.current) {
                // console.log("TryOnRenderer Mask EFFECT: No valid confidence mask array in prop, disposing texture.");
                segmentationTextureRef.current.dispose();
                segmentationTextureRef.current = null;
            }
        }
    // Depend on segmentationResults prop and isStatic (for throttling)
    }, [segmentationResults, isStatic]);


    // --- Handle Resizing / Scale Plane / Render Loop / Init / Cleanup --- (No changes needed from previous version)
    const handleResize = useCallback(() => { /* ... */ }, []);
    const fitPlaneToCamera = useCallback((textureWidth, textureHeight) => { /* ... */ }, []);
    const renderLoop = useCallback(() => { /* ... */ }, [fitPlaneToCamera, isStatic]);
    const initThreeScene = useCallback(() => { /* ... */ }, [handleResize, postVertexShader, postFragmentShader, renderLoop]);
    useEffect(() => { /* ... */ }, [initThreeScene, handleResize]);


    // --- JSX --- (No change)
    return ( <canvas ref={canvasRef} className={`renderer-canvas ${className || ''}`} style={{ display: 'block', width: '100%', height: '100%', ...(style || {}) }} /> );
});
TryOnRenderer.displayName = 'TryOnRenderer';
export default TryOnRenderer;