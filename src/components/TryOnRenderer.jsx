// src/components/TryOnRenderer.jsx - Direct Render + onBeforeCompile + Verify Uniforms + Red Effect

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
    const baseSceneRef = useRef(null); const baseCameraRef = useRef(null); const basePlaneMeshRef = useRef(null);
    const videoTextureRef = useRef(null); const imageTextureRef = useRef(null);
    const segmentationTextureRef = useRef(null); // Keep Mask Texture Ref
    const currentIntensity = useRef(0.5);
    const renderLoopCounter = useRef(0); const lastMaskUpdateTime = useRef(0);
    // Store uniforms separately to update material
    const customUniforms = useRef({
        uSegmentationMask: { value: null },
        uEffectIntensity: { value: 0.5 },
        uHasMask: { value: false }
    });

    // --- Prop Effects / Texture Effects / Mask Effect ---
    useEffect(() => { // Update intensity uniform value
        currentIntensity.current = effectIntensity;
        customUniforms.current.uEffectIntensity.value = effectIntensity; // Update the ref object
     }, [effectIntensity]);
    useEffect(() => { /* Video Texture Creation */ }, [isStatic, videoRefProp]);
    useEffect(() => { /* Image Texture Creation */ }, [isStatic, imageElement]);
    useEffect(() => { /* Mask Texture Creation (with Nearest Filter) */ }, [segmentationResults, isStatic]);


    // --- Handle Resizing / Scale Plane ---
    const handleResize = useCallback(() => { /* ... */ }, []);
    const fitPlaneToCamera = useCallback((textureWidth, textureHeight) => { /* ... */ }, []);

    // --- ***** Shader Injection Logic for onBeforeCompile (RED EFFECT) ***** ---
    const patchShader = (shader) => { // shader object passed by Three.js
        // Add Uniforms to the shader object Three.js provides
        shader.uniforms.uSegmentationMask = customUniforms.current.uSegmentationMask;
        shader.uniforms.uEffectIntensity = customUniforms.current.uEffectIntensity;
        shader.uniforms.uHasMask = customUniforms.current.uHasMask;

        // Add Varying
        shader.vertexShader = 'varying vec2 vUv;\n' + shader.vertexShader;
        shader.vertexShader = shader.vertexShader.replace(
            '#include <uv_vertex>',
            '#include <uv_vertex>\nvUv = uv;'
        );

        // Add Fragment Shader Logic
        shader.fragmentShader = `
            // Declarations matching uniforms added above
            uniform sampler2D uSegmentationMask;
            uniform float uEffectIntensity;
            uniform bool uHasMask;
            varying vec2 vUv;

            // Effect function (RED)
            vec3 applyHydrationEffect(vec3 color) {
                 return vec3(1.0, 0.0, 0.0); // Solid Red
            }
        \n` + shader.fragmentShader; // Prepend

        // Modify the end of the fragment shader's main() function
        shader.fragmentShader = shader.fragmentShader.replace(
            '#include <tonemapping_fragment>',
            `
            #include <tonemapping_fragment> // Original tonemapping

            vec3 finalColor = gl_FragColor.rgb; // Color before this injection

            // --- Apply our effect ---
            if (uHasMask && uEffectIntensity > 0.0) {
                float maskValue = texture2D(uSegmentationMask, vec2(vUv.x, 1.0 - vUv.y)).r; // Flip Y
                vec3 effectColor = applyHydrationEffect(finalColor); // Get Red
                float blendAmount = smoothstep(0.3, 0.8, maskValue) * uEffectIntensity;
                finalColor = mix(finalColor, effectColor, blendAmount); // Blend base with Red
            }
            // -----------------------

            gl_FragColor.rgb = finalColor; // Output potentially modified color
            `
        );
        // console.log("DEBUG: Shader patched with onBeforeCompile.");

        // Store the patched shader object's uniforms reference on the material's userData
        // This allows us to update uniforms later in the render loop
        if (basePlaneMeshRef.current && basePlaneMeshRef.current.material) {
             basePlaneMeshRef.current.material.userData.shader = shader;
             console.log("DEBUG: Stored patched shader reference in material.userData.");
        }

    };
    // --- ************************************************************** ---


    // --- Render Loop (Direct Rendering, Update Uniforms on Patched Material) ---
     const renderLoop = useCallback(() => {
        animationFrameHandle.current = requestAnimationFrame(renderLoop);
        // Check if initialized and if the material/shader exists
        if (!isInitialized.current || !rendererInstanceRef.current || !baseSceneRef.current || !baseCameraRef.current || !basePlaneMeshRef.current || !basePlaneMeshRef.current.material?.userData?.shader ) {
            return;
        }

        const currentCount = renderLoopCounter.current++;
        const logThisFrame = (currentCount === 1 || currentCount % 150 === 0);

        try {
            // 1. Select Source Texture & Update Material Map
            const baseMaterial = basePlaneMeshRef.current.material;
            let sourceWidth = 0, sourceHeight = 0; let textureToAssign = null; let isVideo = false;
            if (!isStatic && videoTextureRef.current) { textureToAssign = videoTextureRef.current; isVideo = true; if(textureToAssign.image) {sourceWidth=textureToAssign.image.videoWidth; sourceHeight=textureToAssign.image.videoHeight;} } else if (isStatic && imageTextureRef.current) { textureToAssign = imageTextureRef.current; if(textureToAssign.image){sourceWidth=textureToAssign.image.naturalWidth; sourceHeight=textureToAssign.image.naturalHeight;} if(textureToAssign.needsUpdate){textureToAssign.needsUpdate=true;} }
            if (baseMaterial.map !== textureToAssign) { baseMaterial.map = textureToAssign; baseMaterial.needsUpdate = true; } else if (textureToAssign?.needsUpdate) { baseMaterial.needsUpdate = true; }

            // 2. Update Plane Scale & Mirroring
            const planeVisible = !!baseMaterial.map && sourceWidth > 0 && sourceHeight > 0;
             if (planeVisible) { fitPlaneToCamera(sourceWidth, sourceHeight); const scaleX = Math.abs(basePlaneMeshRef.current.scale.x); const newScaleX = isVideo ? -scaleX : scaleX; if(basePlaneMeshRef.current.scale.x !== newScaleX) { basePlaneMeshRef.current.scale.x = newScaleX; } } else { if (basePlaneMeshRef.current?.scale.x !== 0 || basePlaneMeshRef.current?.scale.y !== 0) { basePlaneMeshRef.current?.scale.set(0, 0, 0); } }

            // 3. Update Uniforms on the Patched Shader Object
             const uniforms = baseMaterial.userData.shader.uniforms;
             uniforms.uSegmentationMask.value = segmentationTextureRef.current;
             uniforms.uHasMask.value = !!segmentationTextureRef.current;
             // Intensity is updated via the customUniforms ref object used by patchShader and updated in useEffect
             // uniforms.uEffectIntensity.value = currentIntensity.current; // This direct update should also work

            // Log uniform states periodically
             if (logThisFrame) {
                console.log(`RenderLoop Uniform Check: Intensity=${uniforms.uEffectIntensity.value.toFixed(2)}, HasMask=${uniforms.uHasMask.value}, MaskTexID=${uniforms.uSegmentationMask.value?.id ?? 'null'}`);
             }


            // 4. Render Base Scene DIRECTLY to Screen
            rendererInstanceRef.current.setRenderTarget(null);
            rendererInstanceRef.current.setClearColor(0x000000, 1);
            rendererInstanceRef.current.clear();
             if (planeVisible) {
                 rendererInstanceRef.current.render(baseSceneRef.current, baseCameraRef.current);
                 if (textureToAssign?.needsUpdate) { textureToAssign.needsUpdate = false; }
             }

        } catch (error) { console.error("Error in renderLoop:", error); }
    }, [fitPlaneToCamera, isStatic]); // Keep dependencies


    // --- Initialize Scene (Direct Rendering with MeshBasicMaterial + onBeforeCompile) ---
    const initThreeScene = useCallback(() => {
        if (!canvasRef.current || isInitialized.current) return;
        console.log("DEBUG: initThreeScene START (Direct Rendering + onBeforeCompile + Red Effect)");
        try {
            const canvas = canvasRef.current; const initialWidth = canvas.clientWidth || 640; const initialHeight = canvas.clientHeight || 480;
            rendererInstanceRef.current = new THREE.WebGLRenderer({ canvas: canvas, antialias: true }); rendererInstanceRef.current.setSize(initialWidth, initialHeight); rendererInstanceRef.current.setPixelRatio(window.devicePixelRatio); rendererInstanceRef.current.outputColorSpace = THREE.SRGBColorSpace;
            baseSceneRef.current = new THREE.Scene(); baseCameraRef.current = new THREE.OrthographicCamera(-initialWidth / 2, initialWidth / 2, initialHeight / 2, -initialHeight / 2, 0.1, 10); baseCameraRef.current.position.z = 1;
            const planeGeometry = new THREE.PlaneGeometry(1, 1);

            // Create MeshBasicMaterial
            const planeMaterial = new THREE.MeshBasicMaterial({ map: null, side: THREE.DoubleSide, color: 0xffffff, transparent: true });
            // Inject Shader Logic using onBeforeCompile
            planeMaterial.onBeforeCompile = patchShader;
            // Initialize intensity uniform in our separate object
            customUniforms.current.uEffectIntensity.value = currentIntensity.current;

            basePlaneMeshRef.current = new THREE.Mesh(planeGeometry, planeMaterial);
            baseSceneRef.current.add(basePlaneMeshRef.current);
            console.log("DEBUG: Base scene created with MeshBasicMaterial + onBeforeCompile.");

            isInitialized.current = true; handleResize(); cancelAnimationFrame(animationFrameHandle.current); animationFrameHandle.current = requestAnimationFrame(renderLoop);
        } catch (error) { console.error("DEBUG: initThreeScene ERROR:", error); isInitialized.current = false; }
    // Update dependencies
    }, [handleResize, renderLoop, patchShader]); // patchShader is stable


    // --- Setup / Cleanup Effect --- (Simplified Cleanup)
    useEffect(() => { initThreeScene(); let resizeObserver; const currentCanvas = canvasRef.current; if (currentCanvas) { resizeObserver = new ResizeObserver(() => { handleResize(); }); resizeObserver.observe(currentCanvas); } return () => { console.log("DEBUG: Cleanup running..."); resizeObserver?.disconnect(); cancelAnimationFrame(animationFrameHandle.current); isInitialized.current = false; console.log("DEBUG: Disposing Three.js resources (Direct Basic)..."); videoTextureRef.current?.dispose(); imageTextureRef.current?.dispose(); segmentationTextureRef.current?.dispose(); basePlaneMeshRef.current?.geometry?.dispose(); basePlaneMeshRef.current?.material?.map?.dispose(); basePlaneMeshRef.current?.material?.dispose(); rendererInstanceRef.current?.dispose(); videoTextureRef.current = null; imageTextureRef.current = null; segmentationTextureRef.current=null; basePlaneMeshRef.current = null; rendererInstanceRef.current = null; baseSceneRef.current = null; baseCameraRef.current = null; console.log("DEBUG: Three.js resources disposed."); }; }, [initThreeScene, handleResize]);


    // --- JSX --- (No change)
    return ( <canvas ref={canvasRef} className={`renderer-canvas ${className || ''}`} style={{ display: 'block', width: '100%', height: '100%', ...(style || {}) }} /> );

});
TryOnRenderer.displayName = 'TryOnRenderer';
export default TryOnRenderer;