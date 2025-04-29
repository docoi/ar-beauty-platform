// src/components/TryOnRenderer.jsx - CORRECT DataTexture Filtering for Mask

import React, { useRef, forwardRef, useEffect, useCallback } from 'react';
import * as THREE from 'three';
// Import necessary EffectComposer passes
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
// Import UniformsUtils for cloning
import { UniformsUtils } from 'three';

const TryOnRenderer = forwardRef(({
    videoRefProp, imageElement,
    mediaPipeResults, // Unused
    segmentationResults, // <<< Used for mask texture
    isStatic,
    // Unused props:
    brightness, contrast,
    effectIntensity, // <<< Used for effect strength
    className, style
 }, ref) => {

    // --- Core Refs / Internal State Refs ---
    const canvasRef = useRef(null); const rendererInstanceRef = useRef(null); const animationFrameHandle = useRef(null); const isInitialized = useRef(false);
    const baseSceneRef = useRef(null); const baseCameraRef = useRef(null); const basePlaneMeshRef = useRef(null); const videoTextureRef = useRef(null);
    const imageTextureRef = useRef(null); const segmentationTextureRef = useRef(null);
    const composerRef = useRef(null); const effectPassRef = useRef(null);
    const currentIntensity = useRef(0.5);
    const renderLoopCounter = useRef(0); const lastMaskUpdateTime = useRef(0);


    // --- Shaders (Subtle Effect + Mask Flip) ---
    const customVertexShader = `varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 ); }`;
    const customFragmentShader = `
        uniform sampler2D tDiffuse;          // Texture from previous pass
        uniform sampler2D uSegmentationMask; // Our mask texture
        uniform float uEffectIntensity;      // Slider value
        uniform bool uHasMask;               // Mask flag

        varying vec2 vUv;

        vec3 applyHydrationEffect(vec3 c){ vec3 h=c*(1.0+0.1); return h; } // Subtle Brighten

        void main() {
            vec4 baseColor = texture2D(tDiffuse, vUv); // Sample previous pass
            vec3 finalColor = baseColor.rgb;

            if (uHasMask && uEffectIntensity > 0.0) {
                // Flip the Y coordinate for mask sampling
                float maskValue = texture2D(uSegmentationMask, vec2(vUv.x, 1.0 - vUv.y)).r;
                vec3 hydratedColor = applyHydrationEffect(finalColor);
                float blendAmount = smoothstep(0.3, 0.8, maskValue) * uEffectIntensity;
                finalColor = mix(finalColor, hydratedColor, blendAmount);
            }

            finalColor = clamp(finalColor, 0.0, 1.0);
            gl_FragColor = vec4(finalColor, baseColor.a);
        }
    `;

    // Define the shader object for ShaderPass
    const HydrationShader = {
        uniforms: { 'tDiffuse': { value: null }, 'uSegmentationMask': { value: null }, 'uEffectIntensity': { value: 0.5 }, 'uHasMask': { value: false } },
        vertexShader: customVertexShader, fragmentShader: customFragmentShader
    };


    // --- Prop Effects / Texture Effects ---
    useEffect(() => { currentIntensity.current = effectIntensity; if (effectPassRef.current) { effectPassRef.current.uniforms.uEffectIntensity.value = currentIntensity.current; } }, [effectIntensity]);
    useEffect(() => { /* Video Texture */ }, [isStatic, videoRefProp]);
    useEffect(() => { /* Image Texture */ }, [isStatic, imageElement]);

    // --- ***** Segmentation Mask Texture Effect (Correct Filtering) ***** ---
    useEffect(() => {
        const results = segmentationResults;
        const hasMaskDataArray = Array.isArray(results?.confidenceMasks) && results.confidenceMasks.length > 0;
        if (hasMaskDataArray) {
            const confidenceMaskObject = results.confidenceMasks[0];
            const maskWidth = confidenceMaskObject?.width;
            const maskHeight = confidenceMaskObject?.height;
            let maskData = null;
            if (typeof confidenceMaskObject?.getAsFloat32Array === 'function') { try { maskData = confidenceMaskObject.getAsFloat32Array(); } catch (error) { maskData = null; } }
             else if(confidenceMaskObject?.data) { maskData = confidenceMaskObject.data;}

             if (maskData instanceof Float32Array && maskWidth > 0 && maskHeight > 0) {
                 const now = performance.now(); const timeSinceLastUpdate = now - lastMaskUpdateTime.current; const throttleThreshold = isStatic ? 0 : 66;
                 if (timeSinceLastUpdate > throttleThreshold) {
                    lastMaskUpdateTime.current = now;
                    try {
                        let texture = segmentationTextureRef.current;
                        if (!texture || texture.image.width !== maskWidth || texture.image.height !== maskHeight) {
                            texture?.dispose(); // Dispose old one if exists
                            console.log(`TryOnRenderer Mask Texture: Creating NEW DataTexture (${maskWidth}x${maskHeight}) with NearestFilter.`);
                            texture = new THREE.DataTexture(maskData, maskWidth, maskHeight, THREE.RedFormat, THREE.FloatType);
                            // ***** APPLY CORRECT FILTERING *****
                            texture.minFilter = THREE.NearestFilter;
                            texture.magFilter = THREE.NearestFilter;
                            texture.generateMipmaps = false; // Explicitly false
                            // ***********************************
                            texture.needsUpdate = true;
                            segmentationTextureRef.current = texture; // Assign to ref
                            console.log(`TryOnRenderer Mask Texture: New DataTexture CREATED.`);
                        } else {
                            // Update existing texture data
                            // console.log(`TryOnRenderer Mask Texture: Updating existing DataTexture data.`);
                            texture.image.data = maskData;
                            texture.needsUpdate = true;
                        }
                    } catch (error) { console.error("Mask Texture Error:", error); segmentationTextureRef.current?.dispose(); segmentationTextureRef.current = null; }
                 }
             } else { if (segmentationTextureRef.current) { segmentationTextureRef.current.dispose(); segmentationTextureRef.current = null; } }
        } else { if (segmentationTextureRef.current) { segmentationTextureRef.current.dispose(); segmentationTextureRef.current = null; } }
    }, [segmentationResults, isStatic]);


    // --- Handle Resizing / Scale Plane --- (No changes needed)
    const handleResize = useCallback(() => { /* ... */ }, []);
    const fitPlaneToCamera = useCallback((textureWidth, textureHeight) => { /* ... */ }, []);

    // --- Render Loop (Use EffectComposer) --- (No changes needed)
     const renderLoop = useCallback(() => { /* ... (Same as previous working EffectComposer step) ... */ }, [fitPlaneToCamera, isStatic]);

    // --- Initialize Scene (Use EffectComposer) --- (No changes needed)
    const initThreeScene = useCallback(() => { /* ... (Same as previous working EffectComposer step) ... */ }, [handleResize, renderLoop, HydrationShader]);


    // --- Setup / Cleanup Effect --- (No changes needed)
    useEffect(() => { initThreeScene(); let resizeObserver; const currentCanvas = canvasRef.current; if (currentCanvas) { resizeObserver = new ResizeObserver(() => { handleResize(); }); resizeObserver.observe(currentCanvas); } return () => { /* ... Full cleanup logic ... */ }; }, [initThreeScene, handleResize]);


    // --- JSX --- (No change)
    return ( <canvas ref={canvasRef} className={`renderer-canvas ${className || ''}`} style={{ display: 'block', width: '100%', height: '100%', ...(style || {}) }} /> );

});
TryOnRenderer.displayName = 'TryOnRenderer';
export default TryOnRenderer;