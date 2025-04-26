// src/components/TryOnRenderer.jsx - Add Shader Debug + Verify Post Scene

import React, { useRef, forwardRef, useEffect, useCallback, useState, useMemo } from 'react';
import * as THREE from 'three';

// ... console log revision ...

const TryOnRenderer = forwardRef(({ /* ... props ... */ }, ref) => {

    // ... refs ...
    const canvasRef = useRef(null);
    const rendererInstanceRef = useRef(null);
    const animationFrameHandle = useRef(null);
    const isInitialized = useRef(false);
    const baseSceneRef = useRef(null);
    const baseCameraRef = useRef(null);
    const basePlaneMeshRef = useRef(null);
    const videoTextureRef = useRef(null);
    const imageTextureRef = useRef(null);
    const postSceneRef = useRef(null);
    const postCameraRef = useRef(null);
    const postMaterialRef = useRef(null);
    const segmentationTextureRef = useRef(null);
    const renderTargetRef = useRef(null);
    const currentSource = useRef(null);
    const currentResults = useRef(null);
    const currentIsStatic = useRef(false);
    const currentBrightness = useRef(1.0);
    const currentContrast = useRef(1.0);
    const currentIntensity = useRef(0.5);


    // --- Shaders ---
    const postVertexShader = `varying vec2 vUv; void main() { vUv = uv; gl_Position = vec4(position, 1.0); }`;
    // *** ADD DEBUG COLOR TO FRAGMENT SHADER ***
    const postFragmentShader = `
        uniform sampler2D uSceneTexture;
        varying vec2 vUv;

        void main() {
            vec4 texColor = texture2D(uSceneTexture, vUv);

            // DEBUG: If texture alpha is very low, output bright magenta instead
            if (texColor.a < 0.1) {
                 gl_FragColor = vec4(1.0, 0.0, 1.0, 1.0); // Magenta
            } else {
                 gl_FragColor = texColor; // Otherwise output texture color
            }
        }
    `;
    // *** --------------- ***


    // --- Update internal refs when props change ---
    // ... useEffect hooks ...

    // --- Handle Resizing ---
    const handleResize = useCallback(() => { /* ... */ }, []);
    // --- Scale Base Plane ---
    const fitPlaneToCamera = useCallback((textureWidth, textureHeight) => { /* ... */ }, []);


    // --- Render Loop --- (Ensure needsUpdate is set)
     const renderLoop = useCallback(() => { /* ... render loop logic from previous step ... */ }, [fitPlaneToCamera]);


    // --- Initialize Scene --- (Verify post scene setup)
    const initThreeScene = useCallback(() => {
        if (!canvasRef.current || isInitialized.current) return;
        console.log("DEBUG: initThreeScene START");
        try {
            // ... Init renderer, render target, base scene, base camera, base plane ...
            const canvas = canvasRef.current; const initialWidth = canvas.clientWidth || 640; const initialHeight = canvas.clientHeight || 480; rendererInstanceRef.current = new THREE.WebGLRenderer({ canvas: canvas, antialias: true }); rendererInstanceRef.current.setSize(initialWidth, initialHeight); rendererInstanceRef.current.setPixelRatio(window.devicePixelRatio); rendererInstanceRef.current.outputColorSpace = THREE.SRGBColorSpace; renderTargetRef.current = new THREE.WebGLRenderTarget(initialWidth, initialHeight, { minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, format: THREE.RGBAFormat, colorSpace: THREE.SRGBColorSpace }); console.log("DEBUG: RenderTarget created."); baseSceneRef.current = new THREE.Scene(); baseCameraRef.current = new THREE.OrthographicCamera(-initialWidth / 2, initialWidth / 2, initialHeight / 2, -initialHeight / 2, 0.1, 10); baseCameraRef.current.position.z = 1; const planeGeometry = new THREE.PlaneGeometry(1, 1); const planeMaterial = new THREE.MeshBasicMaterial({ map: null, side: THREE.DoubleSide, color: 0xffffff }); basePlaneMeshRef.current = new THREE.Mesh(planeGeometry, planeMaterial); basePlaneMeshRef.current.position.z = 0; basePlaneMeshRef.current.scale.set(1, 1, 1); baseSceneRef.current.add(basePlaneMeshRef.current); console.log("DEBUG: Base scene created.");

            // Create Post Scene
            postSceneRef.current = new THREE.Scene();
            // *** ADD A BACKGROUND COLOR TO POST SCENE FOR DEBUGGING ***
            postSceneRef.current.background = new THREE.Color(0x0000ff); // Blue background
            // *** --------------------------------------------------- ***
            postCameraRef.current = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
            const postPlaneGeometry = new THREE.PlaneGeometry(2, 2);

            // Create ShaderMaterial with bare minimum shader + debug color logic
            postMaterialRef.current = new THREE.ShaderMaterial({
                vertexShader: postVertexShader,
                fragmentShader: postFragmentShader, // Uses the debug shader
                uniforms: {
                     uSceneTexture: { value: null }, // Initialize texture value to null
                 },
                depthWrite: false, depthTest: false,
                 transparent: true // Enable transparency in case alpha is low
            });
            if (renderTargetRef.current) {
                 postMaterialRef.current.uniforms.uSceneTexture.value = renderTargetRef.current.texture;
            }

            const postPlaneMesh = new THREE.Mesh(postPlaneGeometry, postMaterialRef.current);
            postSceneRef.current.add(postPlaneMesh); // Add the quad mesh to the scene
            console.log("DEBUG: Post-processing scene created (Debug Shader). Mesh added:", !!postPlaneMesh.parent); // Verify mesh added

            isInitialized.current = true; console.log("DEBUG: Scene initialization complete.");
            handleResize(); console.log("DEBUG: Requesting first render loop frame from Init.");
            cancelAnimationFrame(animationFrameHandle.current); animationFrameHandle.current = requestAnimationFrame(renderLoop);
        } catch (error) { console.error("DEBUG: initThreeScene ERROR:", error); isInitialized.current = false; }
    }, [handleResize, postVertexShader, postFragmentShader, renderLoop]); // Dependencies


    // --- Effect for Initial Setup / Resize Observer ---
    useEffect(() => { /* ... */ }, [initThreeScene, handleResize]);
    // --- REMOVED useImperativeHandle ---
    // --- JSX ---
// ... (Keep ALL the code above the return statement exactly as it was in message #77) ...

    // --- JSX ---
    return (
        <canvas
            ref={canvasRef}
            // *** USE className prop here ***
            className={`renderer-canvas ${className || ''}`}
            // *** ---------------------- ***
            style={{ display: 'block', width: '100%', height: '100%' }}
        />
    );
}); // End of forwardRef

TryOnRenderer.displayName = 'TryOnRenderer';
export default TryOnRenderer;