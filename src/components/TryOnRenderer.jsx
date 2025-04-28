// src/components/TryOnRenderer.jsx - Minimal RenderTarget, Keep Mask Sampling Shader

import React, { useRef, forwardRef, useEffect, useCallback } from 'react';
import * as THREE from 'three';

const TryOnRenderer = forwardRef(({
    videoRefProp, imageElement, mediaPipeResults, segmentationResults,
    isStatic, brightness, contrast, effectIntensity,
    className, style
 }, ref) => {

    // --- Core Refs / Internal State Refs --- (No changes)
    const canvasRef = useRef(null); /* ... */ const segmentationTextureRef = useRef(null);
    // ... rest of refs ...

    // --- Shaders --- (Keep Mask Sampling + Red Effect)
    const postVertexShader = `varying vec2 vUv; void main() { vUv = uv; gl_Position = vec4(position, 1.0); }`;
    const postFragmentShader = `
        uniform sampler2D uSceneTexture; uniform sampler2D uSegmentationMask;
        uniform float uEffectIntensity; uniform bool uHasMask; varying vec2 vUv;
        vec3 applyHydrationEffect(vec3 c){ return vec3(1.0, 0.0, 0.0); } /* Red */
        void main() {
            vec4 b = texture2D(uSceneTexture, vUv); vec3 f = b.rgb;
            if (uHasMask && uEffectIntensity > 0.0) {
                float m = texture2D(uSegmentationMask, vUv).r; vec3 h = applyHydrationEffect(f);
                float blendAmount = smoothstep(0.3, 0.8, m) * uEffectIntensity;
                f = mix(f, h, blendAmount);
            }
            f = clamp(f, 0.0, 1.0); gl_FragColor = vec4(f, b.a);
        }`;


    // --- Prop Effects / Texture Effects / Mask Effect --- (No changes needed)
    useEffect(() => { /* Intensity update */ currentIntensity.current = effectIntensity; }, [effectIntensity]);
    useEffect(() => { /* Video Texture */ }, [isStatic, videoRefProp]);
    useEffect(() => { /* Image Texture */ }, [isStatic, imageElement]);
    useEffect(() => { /* Mask Texture Creation */ }, [segmentationResults, isStatic]);

    // --- Handle Resizing / Scale Plane --- (No changes needed)
    const handleResize = useCallback(() => { /* ... */ }, []);
    const fitPlaneToCamera = useCallback((textureWidth, textureHeight) => { /* ... */ }, []);

    // --- Render Loop --- (No changes needed)
     const renderLoop = useCallback(() => { /* ... (same as previous step) ... */ }, [fitPlaneToCamera, isStatic]);


    // --- Initialize Scene --- (MINIMAL RenderTarget Options) ---
    const initThreeScene = useCallback(() => {
        if (!canvasRef.current || isInitialized.current) return;
        console.log("DEBUG: initThreeScene START (Minimal RenderTarget)");
        try {
            const canvas = canvasRef.current; const initialWidth = canvas.clientWidth || 640; const initialHeight = canvas.clientHeight || 480;
            rendererInstanceRef.current = new THREE.WebGLRenderer({ canvas: canvas, antialias: true }); rendererInstanceRef.current.setSize(initialWidth, initialHeight); rendererInstanceRef.current.setPixelRatio(window.devicePixelRatio); rendererInstanceRef.current.outputColorSpace = THREE.SRGBColorSpace;

            // *** Create Render Target with MINIMAL options ***
            // Let Three.js use defaults, don't explicitly request depth/stencil
            renderTargetRef.current = new THREE.WebGLRenderTarget(initialWidth, initialHeight, {
                // Use Linear filtering for smooth results (usually default but good to keep)
                minFilter: THREE.LinearFilter,
                magFilter: THREE.LinearFilter,
                format: THREE.RGBAFormat, // Default
                colorSpace: THREE.SRGBColorSpace // Important for color
                // REMOVED: depthBuffer, stencilBuffer explicit settings
            });
             // Still ensure mipmaps are off for the texture
            renderTargetRef.current.texture.generateMipmaps = false;
            renderTargetRef.current.texture.minFilter = THREE.LinearFilter;
            renderTargetRef.current.texture.magFilter = THREE.LinearFilter;
            console.log("DEBUG: RenderTarget created (Minimal Options).");

            // Base Scene setup (same)
            baseSceneRef.current = new THREE.Scene(); baseCameraRef.current = new THREE.OrthographicCamera(-initialWidth / 2, initialWidth / 2, initialHeight / 2, -initialHeight / 2, 0.1, 10); baseCameraRef.current.position.z = 1; const planeGeometry = new THREE.PlaneGeometry(1, 1); const planeMaterial = new THREE.MeshBasicMaterial({ map: null, side: THREE.DoubleSide, color: 0xffffff, transparent: true }); basePlaneMeshRef.current = new THREE.Mesh(planeGeometry, planeMaterial); baseSceneRef.current.add(basePlaneMeshRef.current);

            // Post-Processing Scene (same, using mask shader)
            postSceneRef.current = new THREE.Scene(); postCameraRef.current = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1); const postPlaneGeometry = new THREE.PlaneGeometry(2, 2);
            postMaterialRef.current = new THREE.ShaderMaterial({
                vertexShader: postVertexShader,
                fragmentShader: postFragmentShader, // Uses mask
                uniforms: {
                    uSceneTexture: { value: renderTargetRef.current.texture },
                    uSegmentationMask: { value: null },
                    uEffectIntensity: { value: currentIntensity.current },
                    uHasMask: { value: false },
                },
                transparent: true, depthWrite: false, depthTest: false,
            });
            const postPlaneMesh = new THREE.Mesh(postPlaneGeometry, postMaterialRef.current); postSceneRef.current.add(postPlaneMesh);

            isInitialized.current = true; handleResize(); cancelAnimationFrame(animationFrameHandle.current); animationFrameHandle.current = requestAnimationFrame(renderLoop);
        } catch (error) { console.error("DEBUG: initThreeScene ERROR:", error); isInitialized.current = false; }
    }, [handleResize, postVertexShader, postFragmentShader, renderLoop]);


    // --- Setup / Cleanup Effect --- (No changes)
    useEffect(() => { /* ... */ }, [initThreeScene, handleResize]);


    // --- JSX --- (No change)
    return ( <canvas ref={canvasRef} className={`renderer-canvas ${className || ''}`} style={{ display: 'block', width: '100%', height: '100%', ...(style || {}) }} /> );

});
TryOnRenderer.displayName = 'TryOnRenderer';
export default TryOnRenderer;