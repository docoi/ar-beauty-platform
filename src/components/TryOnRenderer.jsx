// src/components/TryOnRenderer.jsx - REFRACTOR to use EffectComposer

import React, { useRef, forwardRef, useEffect, useCallback } from 'react';
import * as THREE from 'three';
// Import necessary EffectComposer passes
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';

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

    // --- Core Refs ---
    const canvasRef = useRef(null);
    const rendererInstanceRef = useRef(null);
    const animationFrameHandle = useRef(null);
    const isInitialized = useRef(false);
    // Base scene refs (still needed)
    const baseSceneRef = useRef(null);
    const baseCameraRef = useRef(null);
    const basePlaneMeshRef = useRef(null);
    const videoTextureRef = useRef(null);
    const imageTextureRef = useRef(null);
    // Segmentation texture ref (still needed)
    const segmentationTextureRef = useRef(null);
    // *** EffectComposer Ref ***
    const composerRef = useRef(null);
    // *** ShaderPass Ref (to update uniforms) ***
    const effectPassRef = useRef(null);

    // --- Internal State Refs ---
    const currentIntensity = useRef(0.5);
    const renderLoopCounter = useRef(0);
    const lastMaskUpdateTime = useRef(0);

    // --- ***** Shaders (for ShaderPass) ***** ---
    const vertexShader = `varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 ); }`; // Default vertex shader
    const fragmentShader = `
        uniform sampler2D tDiffuse;          // <<< Texture from previous pass (provided by EffectComposer)
        uniform sampler2D uSegmentationMask; // Our mask texture
        uniform float uEffectIntensity;      // Slider value
        uniform bool uHasMask;               // Mask flag

        varying vec2 vUv;

        // Subtle "Hydration" effect function
        vec3 applyHydrationEffect(vec3 color) {
             vec3 hydratedLook = color * (1.0 + 0.1); // 10% brighter base for effect
             return hydratedLook;
        }

        void main() {
            vec4 baseColor = texture2D(tDiffuse, vUv); // <<< Sample previous pass texture
            vec3 finalColor = baseColor.rgb;           // Start with base color (no S/B/C)

            // Apply Serum Effect based on Mask and Intensity
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
        uniforms: {
            'tDiffuse': { value: null }, // Required by ShaderPass, composer will set it
            'uSegmentationMask': { value: null },
            'uEffectIntensity': { value: currentIntensity.current },
            'uHasMask': { value: false }
        },
        vertexShader: vertexShader,
        fragmentShader: fragmentShader
    };
    // --- **************************************** ---


    // --- Prop Effects --- (Only Intensity)
    useEffect(() => {
        currentIntensity.current = effectIntensity;
        // Update uniform directly if pass exists
        if (effectPassRef.current) {
            effectPassRef.current.uniforms.uEffectIntensity.value = currentIntensity.current;
        }
     }, [effectIntensity]);

    // --- Video/Image Texture Effects --- (No changes needed)
    useEffect(() => { /* ... Video Texture Logic ... */ }, [isStatic, videoRefProp]);
    useEffect(() => { /* ... Image Texture Logic ... */ }, [isStatic, imageElement]);

    // --- Segmentation Mask Texture Effect --- (No changes needed - creates texture)
    useEffect(() => { /* ... Segmentation Mask Texture Logic ... */ }, [segmentationResults, isStatic]);

    // --- Handle Resizing --- (Update Renderer AND Composer)
    const handleResize = useCallback(() => {
         const canvas = canvasRef.current;
         if (!rendererInstanceRef.current || !baseCameraRef.current || !composerRef.current || !canvas) return; // Check composer too
         const newWidth = canvas.clientWidth; const newHeight = canvas.clientHeight;
         if (newWidth === 0 || newHeight === 0) return;
         const currentSize = rendererInstanceRef.current.getSize(new THREE.Vector2());
         if (currentSize.x === newWidth && currentSize.y === newHeight) return;
         console.log(`DEBUG: Resizing Renderer & Composer -> ${newWidth}x${newHeight}`);
         try {
             rendererInstanceRef.current.setSize(newWidth, newHeight);
             composerRef.current.setSize(newWidth, newHeight); // <<< Resize composer
             // Update Base Camera
             baseCameraRef.current.left = -newWidth / 2; baseCameraRef.current.right = newWidth / 2;
             baseCameraRef.current.top = newHeight / 2; baseCameraRef.current.bottom = -newHeight / 2;
             baseCameraRef.current.updateProjectionMatrix();
         } catch(e) { console.error("Resize Error:", e);}
    }, []);

    // --- Scale Base Plane --- (No changes needed)
    const fitPlaneToCamera = useCallback((textureWidth, textureHeight) => { /* ... */ }, []);


    // --- ***** Render Loop (Use EffectComposer) ***** ---
     const renderLoop = useCallback(() => {
        animationFrameHandle.current = requestAnimationFrame(renderLoop);
        if (!isInitialized.current || !rendererInstanceRef.current || !composerRef.current || !basePlaneMeshRef.current || !effectPassRef.current) {
            return; // Wait for init
        }

        try {
            // 1 & 2: Select Texture & Update Plane (same logic)
            const baseMaterial = basePlaneMeshRef.current.material; let sourceWidth = 0, sourceHeight = 0; let textureToAssign = null; let isVideo = false;
            if (!isStatic && videoTextureRef.current) { textureToAssign = videoTextureRef.current; isVideo = true; if(textureToAssign.image) {sourceWidth=textureToAssign.image.videoWidth; sourceHeight=textureToAssign.image.videoHeight;} } else if (isStatic && imageTextureRef.current) { textureToAssign = imageTextureRef.current; if(textureToAssign.image){sourceWidth=textureToAssign.image.naturalWidth; sourceHeight=textureToAssign.image.naturalHeight;} if(textureToAssign.needsUpdate){textureToAssign.needsUpdate=true;} }
            if(baseMaterial){ if (baseMaterial.map !== textureToAssign) { baseMaterial.map = textureToAssign; baseMaterial.needsUpdate = true; } else if (textureToAssign && textureToAssign.needsUpdate) { baseMaterial.needsUpdate = true; } }
            const planeVisible = !!baseMaterial?.map && sourceWidth > 0 && sourceHeight > 0;
             if (planeVisible) { fitPlaneToCamera(sourceWidth, sourceHeight); const scaleX = Math.abs(basePlaneMeshRef.current.scale.x); const newScaleX = isVideo ? -scaleX : scaleX; if(basePlaneMeshRef.current.scale.x !== newScaleX) { basePlaneMeshRef.current.scale.x = newScaleX; } } else { if (basePlaneMeshRef.current?.scale.x !== 0 || basePlaneMeshRef.current?.scale.y !== 0) { basePlaneMeshRef.current?.scale.set(0, 0, 0); } }
             // Ensure texture update flag is handled after potential assignment
             if (planeVisible && textureToAssign?.needsUpdate) { textureToAssign.needsUpdate = false; }

            // *** Update ShaderPass Uniforms ***
            const effectUniforms = effectPassRef.current.uniforms;
            effectUniforms.uSegmentationMask.value = segmentationTextureRef.current;
            effectUniforms.uHasMask.value = !!segmentationTextureRef.current;
            // Intensity is updated via useEffect directly on the ref

            // *** Render using the Composer ***
            composerRef.current.render();

        } catch (error) { console.error("Error in renderLoop:", error); }
    }, [fitPlaneToCamera, isStatic]); // Dependencies


    // --- ***** Initialize Scene (Use EffectComposer) ***** ---
    const initThreeScene = useCallback(() => {
        if (!canvasRef.current || isInitialized.current) return;
        console.log("DEBUG: initThreeScene START (Using EffectComposer)");
        try {
            const canvas = canvasRef.current; const initialWidth = canvas.clientWidth || 640; const initialHeight = canvas.clientHeight || 480;
            rendererInstanceRef.current = new THREE.WebGLRenderer({ canvas: canvas, antialias: true }); rendererInstanceRef.current.setSize(initialWidth, initialHeight); rendererInstanceRef.current.setPixelRatio(window.devicePixelRatio); rendererInstanceRef.current.outputColorSpace = THREE.SRGBColorSpace;

            // Base Scene setup (same)
            baseSceneRef.current = new THREE.Scene(); baseCameraRef.current = new THREE.OrthographicCamera(-initialWidth / 2, initialWidth / 2, initialHeight / 2, -initialHeight / 2, 0.1, 10); baseCameraRef.current.position.z = 1; const planeGeometry = new THREE.PlaneGeometry(1, 1); const planeMaterial = new THREE.MeshBasicMaterial({ map: null, side: THREE.DoubleSide, color: 0xffffff, transparent: true }); basePlaneMeshRef.current = new THREE.Mesh(planeGeometry, planeMaterial); baseSceneRef.current.add(basePlaneMeshRef.current);

            // *** Setup EffectComposer ***
            composerRef.current = new EffectComposer(rendererInstanceRef.current);
            // 1. Render the base scene
            const renderPass = new RenderPass(baseSceneRef.current, baseCameraRef.current);
            composerRef.current.addPass(renderPass);
            // 2. Apply our custom hydration effect shader
            // Clone the shader definition to avoid modification issues if reused
            const hydrationShaderInstance = JSON.parse(JSON.stringify(HydrationShader)); // Simple clone for uniforms
            hydrationShaderInstance.uniforms.uEffectIntensity.value = currentIntensity.current; // Set initial intensity
            effectPassRef.current = new ShaderPass(hydrationShaderInstance); // Use the shader object
            // effectPassRef.current.renderToScreen = true; // Render final pass to screen (often default if last pass)
            composerRef.current.addPass(effectPassRef.current);
            console.log("DEBUG: EffectComposer setup complete.");
            // ****************************

            isInitialized.current = true; handleResize(); cancelAnimationFrame(animationFrameHandle.current); animationFrameHandle.current = requestAnimationFrame(renderLoop);
        } catch (error) { console.error("DEBUG: initThreeScene ERROR:", error); isInitialized.current = false; }
    // Depend on the shader definition object
    }, [handleResize, renderLoop, HydrationShader]); // Added HydrationShader and renderLoop


    // --- Setup / Cleanup Effect --- (Dispose Composer)
    useEffect(() => {
        initThreeScene();
        let resizeObserver; const currentCanvas = canvasRef.current;
        if (currentCanvas) { resizeObserver = new ResizeObserver(() => { handleResize(); }); resizeObserver.observe(currentCanvas); }
        return () => {
             console.log("DEBUG: Cleanup running (TryOnRenderer Unmount)...");
             resizeObserver?.disconnect(); cancelAnimationFrame(animationFrameHandle.current); isInitialized.current = false;
             console.log("DEBUG: Disposing Three.js resources (Composer)...");
             videoTextureRef.current?.dispose(); imageTextureRef.current?.dispose(); segmentationTextureRef.current?.dispose();
             // renderTargetRef is managed internally by composer now
             basePlaneMeshRef.current?.geometry?.dispose(); basePlaneMeshRef.current?.material?.map?.dispose(); basePlaneMeshRef.current?.material?.dispose();
             // Dispose shader pass material if possible (might not be directly accessible/needed)
             effectPassRef.current?.material?.dispose();
             // No need to dispose composer's internal render targets manually usually
             rendererInstanceRef.current?.dispose();
             videoTextureRef.current = null; imageTextureRef.current = null; segmentationTextureRef.current = null; renderTargetRef.current = null;
             basePlaneMeshRef.current = null; postMaterialRef.current = null; rendererInstanceRef.current = null; baseSceneRef.current = null;
             postSceneRef.current = null; // These weren't used but nullify anyway
             postCameraRef.current = null; baseCameraRef.current = null;
             composerRef.current = null; // Nullify composer ref
             effectPassRef.current = null; // Nullify pass ref
             console.log("DEBUG: Three.js resources disposed.");
        };
     }, [initThreeScene, handleResize]); // Keep dependencies


    // --- JSX --- (No change)
    return ( <canvas ref={canvasRef} className={`renderer-canvas ${className || ''}`} style={{ display: 'block', width: '100%', height: '100%', ...(style || {}) }} /> );

});
TryOnRenderer.displayName = 'TryOnRenderer';
export default TryOnRenderer;