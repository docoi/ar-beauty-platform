// src/components/TryOnRenderer.jsx - REFRACTOR to use EffectComposer + Granular Init Logging

import React, { useRef, forwardRef, useEffect, useCallback } from 'react';
import * as THREE from 'three';
// Import necessary EffectComposer passes
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';

const TryOnRenderer = forwardRef(({
    videoRefProp, imageElement, mediaPipeResults, segmentationResults,
    isStatic, brightness, contrast, effectIntensity,
    className, style
 }, ref) => {

    // --- Core Refs / Internal State Refs ---
    const canvasRef = useRef(null); const rendererInstanceRef = useRef(null); const animationFrameHandle = useRef(null); const isInitialized = useRef(false);
    const baseSceneRef = useRef(null); const baseCameraRef = useRef(null); const basePlaneMeshRef = useRef(null); const videoTextureRef = useRef(null);
    const imageTextureRef = useRef(null); const segmentationTextureRef = useRef(null);
    const composerRef = useRef(null); const effectPassRef = useRef(null);
    const currentIntensity = useRef(0.5); const renderLoopCounter = useRef(0); const lastMaskUpdateTime = useRef(0);


    // --- Shaders (for ShaderPass) ---
    const vertexShader = `varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 ); }`;
    const fragmentShader = `
        uniform sampler2D tDiffuse; uniform sampler2D uSegmentationMask; uniform float uEffectIntensity; uniform bool uHasMask; varying vec2 vUv;
        vec3 applyHydrationEffect(vec3 c){ vec3 h=c*(1.0+0.1); return h; }
        void main() { vec4 bC=texture2D(tDiffuse,vUv); vec3 fC=bC.rgb; if(uHasMask&&uEffectIntensity>0.0){ float mV=texture2D(uSegmentationMask,vec2(vUv.x,1.0-vUv.y)).r; vec3 hC=applyHydrationEffect(fC); float bA=smoothstep(0.3,0.8,mV)*uEffectIntensity; fC=mix(fC,hC,bA); } fC=clamp(fC,0.0,1.0); gl_FragColor=vec4(fC,bC.a); }`;

    // Define the shader object for ShaderPass
    const HydrationShader = {
        uniforms: { 'tDiffuse': { value: null }, 'uSegmentationMask': { value: null }, 'uEffectIntensity': { value: 0.5 }, 'uHasMask': { value: false } }, // Initialize intensity here too
        vertexShader: vertexShader, fragmentShader: fragmentShader
    };


    // --- Prop Effects / Texture Effects / Mask Effect ---
    useEffect(() => { currentIntensity.current = effectIntensity; if (effectPassRef.current) { effectPassRef.current.uniforms.uEffectIntensity.value = currentIntensity.current; } }, [effectIntensity]);
    useEffect(() => { /* Video Texture */ }, [isStatic, videoRefProp]);
    useEffect(() => { /* Image Texture */ }, [isStatic, imageElement]);
    useEffect(() => { /* Mask Texture Creation */ }, [segmentationResults, isStatic]);


    // --- Handle Resizing / Scale Plane ---
    const handleResize = useCallback(() => { /* ... */ }, []);
    const fitPlaneToCamera = useCallback((textureWidth, textureHeight) => { /* ... */ }, []);

    // --- Render Loop (Use EffectComposer) ---
     const renderLoop = useCallback(() => { /* ... (Same as previous) ... */ }, [fitPlaneToCamera, isStatic]);


    // --- ***** Initialize Scene (Granular Logging) ***** ---
    const initThreeScene = useCallback(() => {
        // Check if already initialized or canvas not ready
        if (!canvasRef.current || isInitialized.current) {
             console.log(`DEBUG: initThreeScene skipped (Canvas: ${!!canvasRef.current}, Initialized: ${isInitialized.current})`);
             return;
        }
        console.log("DEBUG: initThreeScene START (Using EffectComposer)");

        try {
            const canvas = canvasRef.current;
            const initialWidth = canvas.clientWidth || 640;
            const initialHeight = canvas.clientHeight || 480;
            console.log(`DEBUG: initThreeScene - Canvas dimensions: ${initialWidth}x${initialHeight}`);

            // 1. Renderer
            console.log("DEBUG: initThreeScene - Creating Renderer...");
            rendererInstanceRef.current = new THREE.WebGLRenderer({ canvas: canvas, antialias: true });
            rendererInstanceRef.current.setSize(initialWidth, initialHeight);
            rendererInstanceRef.current.setPixelRatio(window.devicePixelRatio);
            rendererInstanceRef.current.outputColorSpace = THREE.SRGBColorSpace;
            console.log("DEBUG: initThreeScene - Renderer CREATED.");

            // 2. Base Scene
            console.log("DEBUG: initThreeScene - Creating Base Scene...");
            baseSceneRef.current = new THREE.Scene();
            baseCameraRef.current = new THREE.OrthographicCamera(-initialWidth / 2, initialWidth / 2, initialHeight / 2, -initialHeight / 2, 0.1, 10);
            baseCameraRef.current.position.z = 1;
            const planeGeometry = new THREE.PlaneGeometry(1, 1);
            const planeMaterial = new THREE.MeshBasicMaterial({ map: null, side: THREE.DoubleSide, color: 0xffffff, transparent: true });
            basePlaneMeshRef.current = new THREE.Mesh(planeGeometry, planeMaterial);
            baseSceneRef.current.add(basePlaneMeshRef.current);
            console.log("DEBUG: initThreeScene - Base Scene CREATED.");

            // 3. EffectComposer
            console.log("DEBUG: initThreeScene - Creating EffectComposer...");
            composerRef.current = new EffectComposer(rendererInstanceRef.current);
            console.log("DEBUG: initThreeScene - EffectComposer CREATED.");

            // 4. RenderPass
            console.log("DEBUG: initThreeScene - Creating RenderPass...");
            const renderPass = new RenderPass(baseSceneRef.current, baseCameraRef.current);
            composerRef.current.addPass(renderPass);
            console.log("DEBUG: initThreeScene - RenderPass ADDED.");

            // 5. ShaderPass
            console.log("DEBUG: initThreeScene - Creating ShaderPass...");
             // Ensure HydrationShader object is fully defined before creating ShaderPass
             if (!HydrationShader || !HydrationShader.uniforms || !HydrationShader.vertexShader || !HydrationShader.fragmentShader) {
                  throw new Error("HydrationShader definition is incomplete!");
             }
            // Create a fresh copy for the pass to avoid state issues if component re-renders/re-initializes
            const shaderPassUniforms = THREE.UniformsUtils.clone(HydrationShader.uniforms);
            shaderPassUniforms.uEffectIntensity.value = currentIntensity.current; // Set initial intensity

            const hydrationShaderMaterial = new THREE.ShaderMaterial({
                 uniforms: shaderPassUniforms,
                 vertexShader: HydrationShader.vertexShader,
                 fragmentShader: HydrationShader.fragmentShader
            });

            effectPassRef.current = new ShaderPass(hydrationShaderMaterial); // Pass the material/shader definition
            console.log("DEBUG: initThreeScene - ShaderPass INSTANCE CREATED.");
            composerRef.current.addPass(effectPassRef.current);
            console.log("DEBUG: initThreeScene - ShaderPass ADDED.");

            // Set initialized flag ONLY after successful setup
            isInitialized.current = true;
            console.log("DEBUG: initThreeScene - Initialization COMPLETE.");

            handleResize(); // Call resize after setup
            console.log("DEBUG: initThreeScene - Requesting first render loop frame.");
            cancelAnimationFrame(animationFrameHandle.current); // Clear any previous frame request
            animationFrameHandle.current = requestAnimationFrame(renderLoop); // Start loop

        } catch (error) {
            console.error("DEBUG: initThreeScene FAILED:", error);
            // Ensure flag is false on error
            isInitialized.current = false;
            // Clean up potentially partially created resources? Maybe not essential here.
        }
    // Depend on the shader definition object, handleResize, renderLoop
    }, [handleResize, renderLoop, HydrationShader]);


    // --- Setup / Cleanup Effect ---
    useEffect(() => {
        initThreeScene(); // Attempt initialization on mount/dependency change
        let resizeObserver; const currentCanvas = canvasRef.current;
        if (currentCanvas) { resizeObserver = new ResizeObserver(() => { handleResize(); }); resizeObserver.observe(currentCanvas); }
        return () => { /* ... Full cleanup logic ... */ };
     }, [initThreeScene, handleResize]); // initThreeScene is now a dependency


    // --- JSX ---
    return ( <canvas ref={canvasRef} className={`renderer-canvas ${className || ''}`} style={{ display: 'block', width: '100%', height: '100%', ...(style || {}) }} /> );

});
TryOnRenderer.displayName = 'TryOnRenderer';
export default TryOnRenderer;