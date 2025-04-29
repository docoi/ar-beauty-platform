// src/components/TryOnRenderer.jsx - Direct Rendering with Integrated Masked Effect Shader

import React, { useRef, forwardRef, useEffect, useCallback } from 'react';
import * as THREE from 'three';

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
    // Only Base Scene refs needed
    const baseSceneRef = useRef(null); const baseCameraRef = useRef(null); const basePlaneMeshRef = useRef(null);
    const videoTextureRef = useRef(null); const imageTextureRef = useRef(null);
    // Keep Mask Texture Ref
    const segmentationTextureRef = useRef(null);
    // Keep Intensity Ref
    const currentIntensity = useRef(0.5);
    const renderLoopCounter = useRef(0); const lastMaskUpdateTime = useRef(0);


    // --- ***** Shaders for Base Plane Material ***** ---
    const meshVertexShader = `
        varying vec2 vUv;
        void main() {
            vUv = uv;
            // Use modelViewMatrix and projectionMatrix provided by Three.js
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
    `;
    const meshFragmentShader = `
        uniform sampler2D uMainTexture;        // <<< Video or Image Texture
        uniform sampler2D uSegmentationMask; // Mask texture
        uniform float uEffectIntensity;      // Slider value
        uniform bool uHasMask;               // Mask flag

        varying vec2 vUv;

        // Subtle "Hydration" effect function
        vec3 applyHydrationEffect(vec3 color) {
             vec3 hydratedLook = color * (1.0 + 0.12); // Slightly increased brightness for effect
             return hydratedLook;
        }

        void main() {
            // Sample the main texture (video or image)
            vec4 baseColor = texture2D(uMainTexture, vUv);
            vec3 finalColor = baseColor.rgb;

            // Apply Serum Effect based on Mask and Intensity
            if (uHasMask && uEffectIntensity > 0.0) {
                // Flip the Y coordinate for mask sampling
                float maskValue = texture2D(uSegmentationMask, vec2(vUv.x, 1.0 - vUv.y)).r;

                vec3 hydratedColor = applyHydrationEffect(finalColor);

                // Blend based on mask value and intensity slider
                float blendAmount = smoothstep(0.3, 0.8, maskValue) * uEffectIntensity;
                finalColor = mix(finalColor, hydratedColor, blendAmount);
            }

            finalColor = clamp(finalColor, 0.0, 1.0);
            gl_FragColor = vec4(finalColor, baseColor.a);
        }
    `;
    // --- ***************************************** ---


    // --- Prop Effects / Texture Effects / Mask Effect ---
    useEffect(() => { currentIntensity.current = effectIntensity; }, [effectIntensity]);
    useEffect(() => { /* Video Texture Creation */ }, [isStatic, videoRefProp]);
    useEffect(() => { /* Image Texture Creation */ }, [isStatic, imageElement]);
    useEffect(() => { /* Mask Texture Creation (with Nearest Filter) */ }, [segmentationResults, isStatic]); // Keep mask creation logic


    // --- Handle Resizing --- (Updates Base Camera Only)
    const handleResize = useCallback(() => { /* ... (Simplified version) ... */ }, []);
    // --- Scale Base Plane ---
    const fitPlaneToCamera = useCallback((textureWidth, textureHeight) => { /* ... */ }, []);


    // --- Render Loop (Direct Rendering, Update Material Uniforms) ---
     const renderLoop = useCallback(() => {
        animationFrameHandle.current = requestAnimationFrame(renderLoop);
        if (!isInitialized.current || !rendererInstanceRef.current || !baseSceneRef.current || !baseCameraRef.current || !basePlaneMeshRef.current || !basePlaneMeshRef.current.material?.uniforms ) {
            return; // Wait for init and shader material uniforms
        }

        try {
            // 1. Select Source Texture
            const baseMaterial = basePlaneMeshRef.current.material;
            const uniforms = baseMaterial.uniforms;
            let sourceWidth = 0, sourceHeight = 0; let textureToAssign = null; let isVideo = false;
            if (!isStatic && videoTextureRef.current) { textureToAssign = videoTextureRef.current; isVideo = true; if(textureToAssign.image) {sourceWidth=textureToAssign.image.videoWidth; sourceHeight=textureToAssign.image.videoHeight;} } else if (isStatic && imageTextureRef.current) { textureToAssign = imageTextureRef.current; if(textureToAssign.image){sourceWidth=textureToAssign.image.naturalWidth; sourceHeight=textureToAssign.image.naturalHeight;} if(textureToAssign.needsUpdate){textureToAssign.needsUpdate=true;} }

            // Assign texture to uMainTexture uniform
            if (uniforms.uMainTexture.value !== textureToAssign) {
                 // console.log("DEBUG RenderLoop: Assigning uMainTexture");
                 uniforms.uMainTexture.value = textureToAssign;
            }
            // Ensure material updates if texture content changes (e.g., static image loads)
            if (textureToAssign?.needsUpdate) {
                 baseMaterial.needsUpdate = true;
            }


            // 2. Update Plane Scale & Mirroring
            const planeVisible = !!uniforms.uMainTexture.value && sourceWidth > 0 && sourceHeight > 0;
             if (planeVisible) { fitPlaneToCamera(sourceWidth, sourceHeight); const scaleX = Math.abs(basePlaneMeshRef.current.scale.x); const newScaleX = isVideo ? -scaleX : scaleX; if(basePlaneMeshRef.current.scale.x !== newScaleX) { basePlaneMeshRef.current.scale.x = newScaleX; } } else { if (basePlaneMeshRef.current?.scale.x !== 0 || basePlaneMeshRef.current?.scale.y !== 0) { basePlaneMeshRef.current?.scale.set(0, 0, 0); } }

            // 3. Update Other Uniforms for ShaderMaterial
             uniforms.uSegmentationMask.value = segmentationTextureRef.current;
             uniforms.uHasMask.value = !!segmentationTextureRef.current;
             uniforms.uEffectIntensity.value = currentIntensity.current;


            // 4. Render Base Scene DIRECTLY to Screen
            rendererInstanceRef.current.setRenderTarget(null); // Render to canvas
            rendererInstanceRef.current.setClearColor(0x000000, 1); // Clear black
            rendererInstanceRef.current.clear();
             if (planeVisible) {
                 rendererInstanceRef.current.render(baseSceneRef.current, baseCameraRef.current);
                 if (textureToAssign?.needsUpdate) { textureToAssign.needsUpdate = false; }
             }

        } catch (error) { console.error("Error in renderLoop:", error); }
    }, [fitPlaneToCamera, isStatic]); // Keep dependencies


    // --- Initialize Scene (Direct Rendering with ShaderMaterial) ---
    const initThreeScene = useCallback(() => {
        if (!canvasRef.current || isInitialized.current) return;
        console.log("DEBUG: initThreeScene START (Direct Rendering + Effect Shader)");
        try {
            const canvas = canvasRef.current; const initialWidth = canvas.clientWidth || 640; const initialHeight = canvas.clientHeight || 480;
            rendererInstanceRef.current = new THREE.WebGLRenderer({ canvas: canvas, antialias: true }); rendererInstanceRef.current.setSize(initialWidth, initialHeight); rendererInstanceRef.current.setPixelRatio(window.devicePixelRatio); rendererInstanceRef.current.outputColorSpace = THREE.SRGBColorSpace;

            baseSceneRef.current = new THREE.Scene();
            baseCameraRef.current = new THREE.OrthographicCamera(-initialWidth / 2, initialWidth / 2, initialHeight / 2, -initialHeight / 2, 0.1, 10);
            baseCameraRef.current.position.z = 1;
            const planeGeometry = new THREE.PlaneGeometry(1, 1);

            // *** Create ShaderMaterial for the base plane ***
            const planeMaterial = new THREE.ShaderMaterial({
                uniforms: {
                    uMainTexture: { value: null }, // Will be video or image
                    uSegmentationMask: { value: null },
                    uEffectIntensity: { value: currentIntensity.current },
                    uHasMask: { value: false },
                },
                vertexShader: meshVertexShader,
                fragmentShader: meshFragmentShader,
                side: THREE.DoubleSide,
                transparent: true, // Needed if base texture might have alpha
                depthWrite: false, // Usually false for 2D planes
                depthTest: false,
            });
            // ***********************************************

            basePlaneMeshRef.current = new THREE.Mesh(planeGeometry, planeMaterial);
            baseSceneRef.current.add(basePlaneMeshRef.current);
            console.log("DEBUG: Base scene created with ShaderMaterial.");

            isInitialized.current = true; handleResize(); cancelAnimationFrame(animationFrameHandle.current); animationFrameHandle.current = requestAnimationFrame(renderLoop);
        } catch (error) { console.error("DEBUG: initThreeScene ERROR:", error); isInitialized.current = false; }
    // Update dependencies
    }, [handleResize, renderLoop, meshVertexShader, meshFragmentShader]);


    // --- Setup / Cleanup Effect --- (Simplified Cleanup)
    useEffect(() => { initThreeScene(); let resizeObserver; const currentCanvas = canvasRef.current; if (currentCanvas) { resizeObserver = new ResizeObserver(() => { handleResize(); }); resizeObserver.observe(currentCanvas); } return () => { /* ... Simplified cleanup ... */ }; }, [initThreeScene, handleResize]);


    // --- JSX --- (No change)
    return ( <canvas ref={canvasRef} className={`renderer-canvas ${className || ''}`} style={{ display: 'block', width: '100%', height: '100%', ...(style || {}) }} /> );

});
TryOnRenderer.displayName = 'TryOnRenderer';
export default TryOnRenderer;