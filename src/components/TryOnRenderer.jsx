// src/components/TryOnRenderer.jsx - Try getAsFloat32Array() for Mask Data

import React, { useRef, forwardRef, useEffect, useCallback } from 'react';
import * as THREE from 'three';

const TryOnRenderer = forwardRef(({
    videoRefProp, imageElement, mediaPipeResults,
    segmentationResults, // <<< USE THIS PROP
    isStatic, brightness, contrast, effectIntensity,
    className, style
 }, ref) => {

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


    // --- ***** MODIFIED Segmentation Mask Texture Effect (Try getAsFloat32Array) ***** ---
    useEffect(() => {
        const results = segmentationResults;
        const hasMaskDataArray = Array.isArray(results?.confidenceMasks) && results.confidenceMasks.length > 0;

        if (hasMaskDataArray) {
            const confidenceMaskObject = results.confidenceMasks[0]; // MPImage
            const maskWidth = confidenceMaskObject?.width;
            const maskHeight = confidenceMaskObject?.height;
            let maskData = null; // Initialize maskData

            console.log(`TryOnRenderer Mask EFFECT Details: Mask Obj Type=${confidenceMaskObject?.constructor?.name}, Width=${maskWidth}, Height=${maskHeight}`);

            // *** Try calling getAsFloat32Array() method ***
            if (typeof confidenceMaskObject?.getAsFloat32Array === 'function') {
                try {
                    console.log(" -> Attempting to call confidenceMaskObject.getAsFloat32Array()...");
                    maskData = confidenceMaskObject.getAsFloat32Array(); // <<< CALL THE METHOD
                    console.log(` -> Called getAsFloat32Array(): Result Type=${maskData?.constructor?.name}, Length=${maskData?.length}`);
                } catch (error) {
                    console.error(" -> Error calling getAsFloat32Array():", error);
                    maskData = null; // Ensure maskData is null on error
                }
            } else {
                console.warn(" -> confidenceMaskObject.getAsFloat32Array is not a function.");
                // Fallback: Check .data again just in case (less likely now)
                if(confidenceMaskObject?.data){
                     console.warn(" -> Falling back to checking .data property.");
                     maskData = confidenceMaskObject.data;
                }
            }
            // **********************************************

            // Now check if maskData is the Float32Array we expect
             if (maskData instanceof Float32Array && maskWidth > 0 && maskHeight > 0) {
                 console.log(`TryOnRenderer Mask EFFECT: Processing Float32Array mask data (from getAsFloat32Array or fallback).`);
                 const now = performance.now(); const timeSinceLastUpdate = now - lastMaskUpdateTime.current; const throttleThreshold = isStatic ? 0 : 66;
                 if (timeSinceLastUpdate > throttleThreshold) {
                    lastMaskUpdateTime.current = now;
                    try {
                        // console.log(`TryOnRenderer Mask EFFECT Texture: Attempting to create/update DataTexture...`);
                        if (!segmentationTextureRef.current || segmentationTextureRef.current.image.width !== maskWidth || segmentationTextureRef.current.image.height !== maskHeight) {
                            console.log(` -> Creating NEW DataTexture (${maskWidth}x${maskHeight})`);
                            segmentationTextureRef.current?.dispose();
                            segmentationTextureRef.current = new THREE.DataTexture(maskData, maskWidth, maskHeight, THREE.RedFormat, THREE.FloatType);
                            segmentationTextureRef.current.minFilter = THREE.LinearFilter; segmentationTextureRef.current.magFilter = THREE.LinearFilter;
                            segmentationTextureRef.current.needsUpdate = true;
                            console.log(`TryOnRenderer Mask EFFECT Texture: New DataTexture CREATED.`);
                        } else {
                            // console.log(` -> Updating EXISTING DataTexture data.`);
                            segmentationTextureRef.current.image.data = maskData;
                            segmentationTextureRef.current.needsUpdate = true;
                            // console.log(`TryOnRenderer Mask EFFECT Texture: Existing DataTexture UPDATED.`);
                        }
                    } catch (error) { console.error("TryOnRenderer Mask Texture: Error creating/updating DataTexture:", error); segmentationTextureRef.current?.dispose(); segmentationTextureRef.current = null; }
                 } // else { console.log("Throttled mask update"); }
             }
             // Handle cases where maskData wasn't obtained or wasn't Float32Array
             else {
                 console.warn(`TryOnRenderer Mask EFFECT: Failed to obtain valid Float32Array mask data. Final maskData type: ${maskData?.constructor?.name}`);
                 if (segmentationTextureRef.current) {
                     segmentationTextureRef.current.dispose();
                     segmentationTextureRef.current = null;
                 }
             }
        } else {
            // No valid confidenceMasks array found in prop
            if (segmentationTextureRef.current) {
                // console.log("TryOnRenderer Mask EFFECT: No valid confidence mask array in prop, disposing texture.");
                segmentationTextureRef.current.dispose();
                segmentationTextureRef.current = null;
            }
        }
    // Depend on segmentationResults prop and isStatic
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