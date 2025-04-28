// src/components/TryOnRenderer.jsx - Use segmentationResults Prop + Re-enabled Logging + Refined Shader

import React, { useRef, forwardRef, useEffect, useCallback } from 'react';
import * as THREE from 'three';

const TryOnRenderer = forwardRef(({
    videoRefProp,
    imageElement,
    mediaPipeResults, // Landmark results (or null)
    segmentationResults, // <<< NEW PROP for segmentation data
    isStatic,
    brightness, contrast, effectIntensity,
    className, style
 }, ref) => {

    // Log received props
    // console.log(`TryOnRenderer RENDERING. isStatic=${isStatic}, Has segmentationResults? ${!!segmentationResults}`);
    // if (segmentationResults) {
    //     console.log(` -> segmentationResults contains confidenceMasks? ${!!segmentationResults.confidenceMasks}`);
    // }

    // Core Refs (no change)
    const canvasRef = useRef(null); /* ... */ const segmentationTextureRef = useRef(null);
    const rendererInstanceRef = useRef(null); const animationFrameHandle = useRef(null); const isInitialized = useRef(false);
    const baseSceneRef = useRef(null); const baseCameraRef = useRef(null); const basePlaneMeshRef = useRef(null);
    const videoTextureRef = useRef(null); const imageTextureRef = useRef(null); const postSceneRef = useRef(null);
    const postCameraRef = useRef(null); const postMaterialRef = useRef(null); const renderTargetRef = useRef(null);

    // Internal State Refs (no change)
    const currentBrightness = useRef(1.0); const currentContrast = useRef(1.0); const currentIntensity = useRef(0.5);
    const renderLoopCounter = useRef(0); const lastMaskUpdateTime = useRef(0);

    // Shaders (No change needed - keep exaggerated effect for now)
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

    // Update internal refs based on props (No change needed)
    useEffect(() => { currentBrightness.current = isStatic ? Math.max(0.01, brightness || 1.0) : 1.0; currentContrast.current = isStatic ? Math.max(0.01, contrast || 1.0) : 1.0; }, [isStatic, brightness, contrast]);
    useEffect(() => { currentIntensity.current = effectIntensity; }, [effectIntensity]);

    // Effects for Video/Image Textures (No change needed)
    useEffect(() => { /* ... Video Texture Logic ... */ }, [isStatic, videoRefProp]);
    useEffect(() => { /* ... Image Texture Logic ... */ }, [isStatic, imageElement]);


    // --- ***** MODIFIED Effect to manage Segmentation Mask Texture ***** ---
    useEffect(() => {
        // *** Use the NEW segmentationResults prop ***
        const results = segmentationResults;
        // *** Check confidenceMasks from ImageSegmenter output ***
        const hasMaskDataArray = Array.isArray(results?.confidenceMasks) && results.confidenceMasks.length > 0;

        // console.log(`TryOnRenderer Mask EFFECT Check: Received segmentationResults prop. Has valid confidenceMasks? ${hasMaskDataArray}`);

        if (hasMaskDataArray) {
            const confidenceMask = results.confidenceMasks[0]; // Get the first confidence mask
            // *** Access the mask data via the .mask property (MediaPipe v0.10+) ***
            const maskData = confidenceMask?.mask;
            const maskWidth = confidenceMask?.width;
            const maskHeight = confidenceMask?.height;

            // console.log(`TryOnRenderer Mask EFFECT Details: Mask Obj Type=${typeof confidenceMask}, maskData Type=${typeof maskData}, Width=${maskWidth}, Height=${maskHeight}, Constructor=${maskData?.constructor?.name}`);

             if (maskData instanceof Float32Array && maskWidth > 0 && maskHeight > 0) {
                // console.log(`TryOnRenderer Mask EFFECT: Processing Float32Array mask data. Length: ${maskData.length}`);
                 const now = performance.now(); const timeSinceLastUpdate = now - lastMaskUpdateTime.current; const throttleThreshold = isStatic ? 0 : 66; // ~15fps
                 if (timeSinceLastUpdate > throttleThreshold) {
                    lastMaskUpdateTime.current = now;
                    try {
                        // console.log(`TryOnRenderer Mask EFFECT Texture: Attempting to create/update DataTexture...`);
                        if (!segmentationTextureRef.current || segmentationTextureRef.current.image.width !== maskWidth || segmentationTextureRef.current.image.height !== maskHeight) {
                            console.log(` -> Creating NEW DataTexture (${maskWidth}x${maskHeight}) from confidenceMask`);
                            segmentationTextureRef.current?.dispose();
                            segmentationTextureRef.current = new THREE.DataTexture(maskData, maskWidth, maskHeight, THREE.RedFormat, THREE.FloatType);
                            segmentationTextureRef.current.minFilter = THREE.LinearFilter; segmentationTextureRef.current.magFilter = THREE.LinearFilter;
                            segmentationTextureRef.current.needsUpdate = true;
                            console.log(`TryOnRenderer Mask EFFECT Texture: New DataTexture CREATED.`);
                        } else {
                            // console.log(` -> Updating EXISTING DataTexture data from confidenceMask.`);
                            segmentationTextureRef.current.image.data = maskData;
                            segmentationTextureRef.current.needsUpdate = true;
                            // console.log(`TryOnRenderer Mask EFFECT Texture: Existing DataTexture UPDATED.`);
                        }
                    } catch (error) { /* ... error handling ... */ }
                 }
            } else if (maskData instanceof WebGLTexture) { // Keep check for future GPU delegate use
                 console.warn("TryOnRenderer Mask EFFECT Handling: Received WebGLTexture directly (GPU).");
                 if (segmentationTextureRef.current) { segmentationTextureRef.current.dispose(); segmentationTextureRef.current = null; }
            } else {
                 console.warn(`TryOnRenderer Mask EFFECT: Found confidenceMask[0] but mask data is not valid. Type: ${maskData?.constructor?.name}, Dims: ${maskWidth}x${maskHeight}`);
                 if (segmentationTextureRef.current) { segmentationTextureRef.current.dispose(); segmentationTextureRef.current = null; }
            }
        } else {
            // No valid mask array found in the segmentationResults prop
            if (segmentationTextureRef.current) {
                console.log("TryOnRenderer Mask EFFECT: No valid confidence mask array found in prop, disposing texture.");
                segmentationTextureRef.current.dispose();
                segmentationTextureRef.current = null;
            } else { /* console.log("TryOnRenderer Mask EFFECT: No confidence mask array found in prop."); */ }
        }
    // *** Depend on the NEW segmentationResults prop ***
    }, [segmentationResults, isStatic]);


    // Handle Resizing / Scale Base Plane (No changes needed)
    const handleResize = useCallback(() => { /* ... */ }, []);
    const fitPlaneToCamera = useCallback((textureWidth, textureHeight) => { /* ... */ }, []);

    // Render Loop (No changes needed - already uses segmentationTextureRef)
     const renderLoop = useCallback(() => { /* ... (same as previous) ... */ }, [fitPlaneToCamera, isStatic]);

    // Initialize Scene (No changes needed - already initializes mask uniform to null)
    const initThreeScene = useCallback(() => { /* ... (same as previous) ... */ }, [handleResize, postVertexShader, postFragmentShader, renderLoop]);

    // Setup / Cleanup Effect (No changes needed)
    useEffect(() => { /* ... (same as previous) ... */ }, [initThreeScene, handleResize]);

    // JSX (No changes needed)
    return ( <canvas ref={canvasRef} className={`renderer-canvas ${className || ''}`} style={{ display: 'block', width: '100%', height: '100%', ...(style || {}) }} /> );
});
TryOnRenderer.displayName = 'TryOnRenderer';
export default TryOnRenderer;