// src/components/TryOnRenderer.jsx - Direct Render + MeshBasicMaterial + onBeforeCompile for Effect

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
    const baseSceneRef = useRef(null); const baseCameraRef = useRef(null); const basePlaneMeshRef = useRef(null); // Ref to the Mesh itself
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
        customUniforms.current.uEffectIntensity.value = effectIntensity;
     }, [effectIntensity]);
    useEffect(() => { /* Video Texture Creation */ }, [isStatic, videoRefProp]);
    useEffect(() => { /* Image Texture Creation */ }, [isStatic, imageElement]);
    useEffect(() => { /* Mask Texture Creation (with Nearest Filter) */
        // This effect still creates segmentationTextureRef.current
        const results = segmentationResults; const hasMaskDataArray = Array.isArray(results?.confidenceMasks) && results.confidenceMasks.length > 0;
        if (hasMaskDataArray) { const confidenceMaskObject = results.confidenceMasks[0]; const maskWidth = confidenceMaskObject?.width; const maskHeight = confidenceMaskObject?.height; let maskData = null; if (typeof confidenceMaskObject?.getAsFloat32Array === 'function') { try { maskData = confidenceMaskObject.getAsFloat32Array(); } catch (error) { maskData = null; } } else if(confidenceMaskObject?.data) { maskData = confidenceMaskObject.data;} if (maskData instanceof Float32Array && maskWidth > 0 && maskHeight > 0) { const now = performance.now(); const timeSinceLastUpdate = now - lastMaskUpdateTime.current; const throttleThreshold = isStatic ? 0 : 66; if (timeSinceLastUpdate > throttleThreshold) { lastMaskUpdateTime.current = now; try { let texture = segmentationTextureRef.current; if (!texture || texture.image.width !== maskWidth || texture.image.height !== maskHeight) { texture?.dispose(); /*console.log(`Mask Texture: Creating NEW DataTexture (${maskWidth}x${maskHeight})`);*/ texture = new THREE.DataTexture(maskData, maskWidth, maskHeight, THREE.RedFormat, THREE.FloatType); texture.minFilter = THREE.NearestFilter; texture.magFilter = THREE.NearestFilter; texture.generateMipmaps = false; texture.needsUpdate = true; segmentationTextureRef.current = texture; } else { texture.image.data = maskData; texture.needsUpdate = true; } } catch (error) { console.error("Mask Texture Error:", error); segmentationTextureRef.current?.dispose(); segmentationTextureRef.current = null; } } } else { if (segmentationTextureRef.current) { segmentationTextureRef.current.dispose(); segmentationTextureRef.current = null; } } } else { if (segmentationTextureRef.current) { segmentationTextureRef.current.dispose(); segmentationTextureRef.current = null; } }
    }, [segmentationResults, isStatic]);


    // --- Handle Resizing / Scale Plane --- (Simplified versions)
    const handleResize = useCallback(() => { /* ... Updates baseCamera ... */ }, []);
    const fitPlaneToCamera = useCallback((textureWidth, textureHeight) => { /* ... */ }, []);

    // --- Shader Injection Logic for onBeforeCompile ---
    const patchShader = (shader) => {
        // Add Uniforms
        shader.uniforms.uSegmentationMask = customUniforms.current.uSegmentationMask;
        shader.uniforms.uEffectIntensity = customUniforms.current.uEffectIntensity;
        shader.uniforms.uHasMask = customUniforms.current.uHasMask;

        // Add Varying
        shader.vertexShader = 'varying vec2 vUv;\n' + shader.vertexShader;
        shader.vertexShader = shader.vertexShader.replace(
            '#include <uv_vertex>',
            '#include <uv_vertex>\nvUv = uv;' // Pass UV to fragment shader
        );

        // Add Fragment Shader Logic
        shader.fragmentShader = `
            uniform sampler2D uSegmentationMask;
            uniform float uEffectIntensity;
            uniform bool uHasMask;
            varying vec2 vUv; // Receive UVs

            vec3 applyHydrationEffect(vec3 color) {
                 vec3 hydratedLook = color * (1.0 + 0.12); // Subtle brighten
                 return hydratedLook;
            }
        \n` + shader.fragmentShader; // Prepend custom uniforms and functions

        // Modify the end of the fragment shader's main() function
        shader.fragmentShader = shader.fragmentShader.replace(
            '#include <tonemapping_fragment>', // A common injection point near the end
            `
            #include <tonemapping_fragment> // Include the original code first

            vec3 finalColor = gl_FragColor.rgb; // Get color before tonemapping

            // --- Apply our effect ---
            if (uHasMask && uEffectIntensity > 0.0) {
                float maskValue = texture2D(uSegmentationMask, vec2(vUv.x, 1.0 - vUv.y)).r; // Flip Y
                vec3 hydratedColor = applyHydrationEffect(finalColor);
                float blendAmount = smoothstep(0.3, 0.8, maskValue) * uEffectIntensity;
                finalColor = mix(finalColor, hydratedColor, blendAmount);
            }
            // -----------------------

            gl_FragColor.rgb = finalColor; // Output modified color
            `
        );
        console.log("DEBUG: Shader patched with onBeforeCompile.");
    };


    // --- Render Loop (Direct Rendering, Update Uniforms on Material) ---
     const renderLoop = useCallback(() => {
        animationFrameHandle.current = requestAnimationFrame(renderLoop);
        if (!isInitialized.current || !rendererInstanceRef.current || !baseSceneRef.current || !baseCameraRef.current || !basePlaneMeshRef.current || !basePlaneMeshRef.current.material ) { return; } // Check material exists

        try {
            // 1. Select Source Texture & Update Material Map
            const baseMaterial = basePlaneMeshRef.current.material;
            let sourceWidth = 0, sourceHeight = 0; let textureToAssign = null; let isVideo = false;
            if (!isStatic && videoTextureRef.current) { textureToAssign = videoTextureRef.current; isVideo = true; if(textureToAssign.image) {sourceWidth=textureToAssign.image.videoWidth; sourceHeight=textureToAssign.image.videoHeight;} } else if (isStatic && imageTextureRef.current) { textureToAssign = imageTextureRef.current; if(textureToAssign.image){sourceWidth=textureToAssign.image.naturalWidth; sourceHeight=textureToAssign.image.naturalHeight;} if(textureToAssign.needsUpdate){textureToAssign.needsUpdate=true;} }

            // Assign texture directly to the material's map property
            if (baseMaterial.map !== textureToAssign) {
                 // console.log("DEBUG RenderLoop: Assigning material.map");
                 baseMaterial.map = textureToAssign; // <<< Assign to map
                 baseMaterial.needsUpdate = true;
            } else if (textureToAssign?.needsUpdate) {
                 baseMaterial.needsUpdate = true;
            }

            // 2. Update Plane Scale & Mirroring
            const planeVisible = !!baseMaterial.map && sourceWidth > 0 && sourceHeight > 0;
             if (planeVisible) { fitPlaneToCamera(sourceWidth, sourceHeight); const scaleX = Math.abs(basePlaneMeshRef.current.scale.x); const newScaleX = isVideo ? -scaleX : scaleX; if(basePlaneMeshRef.current.scale.x !== newScaleX) { basePlaneMeshRef.current.scale.x = newScaleX; } } else { if (basePlaneMeshRef.current?.scale.x !== 0 || basePlaneMeshRef.current?.scale.y !== 0) { basePlaneMeshRef.current?.scale.set(0, 0, 0); } }

            // 3. Update Uniforms (stored separately and assigned in onBeforeCompile or updated here)
             if (baseMaterial.userData.shader) { // Check if shader was patched
                 baseMaterial.userData.shader.uniforms.uSegmentationMask.value = segmentationTextureRef.current;
                 baseMaterial.userData.shader.uniforms.uHasMask.value = !!segmentationTextureRef.current;
                 // Intensity is updated via useEffect directly on customUniforms, which patchShader uses
                 // baseMaterial.userData.shader.uniforms.uEffectIntensity.value = currentIntensity.current;
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
        console.log("DEBUG: initThreeScene START (Direct Rendering + onBeforeCompile)");
        try {
            const canvas = canvasRef.current; const initialWidth = canvas.clientWidth || 640; const initialHeight = canvas.clientHeight || 480;
            rendererInstanceRef.current = new THREE.WebGLRenderer({ canvas: canvas, antialias: true }); rendererInstanceRef.current.setSize(initialWidth, initialHeight); rendererInstanceRef.current.setPixelRatio(window.devicePixelRatio); rendererInstanceRef.current.outputColorSpace = THREE.SRGBColorSpace;
            baseSceneRef.current = new THREE.Scene(); baseCameraRef.current = new THREE.OrthographicCamera(-initialWidth / 2, initialWidth / 2, initialHeight / 2, -initialHeight / 2, 0.1, 10); baseCameraRef.current.position.z = 1;
            const planeGeometry = new THREE.PlaneGeometry(1, 1);

            // *** Create MeshBasicMaterial ***
            const planeMaterial = new THREE.MeshBasicMaterial({
                 map: null, // Texture assigned in render loop
                 side: THREE.DoubleSide,
                 color: 0xffffff,
                 transparent: true
                 });
            // ******************************

            // *** Inject Shader Logic using onBeforeCompile ***
            planeMaterial.onBeforeCompile = patchShader;
            // Store reference to uniforms object after patch if needed later, maybe on material itself
            // planeMaterial.userData.uniforms = customUniforms.current; // Not needed if patchShader accesses ref directly
            // ***********************************************

            basePlaneMeshRef.current = new THREE.Mesh(planeGeometry, planeMaterial);
            baseSceneRef.current.add(basePlaneMeshRef.current);
            console.log("DEBUG: Base scene created with MeshBasicMaterial + onBeforeCompile.");

            isInitialized.current = true; handleResize(); cancelAnimationFrame(animationFrameHandle.current); animationFrameHandle.current = requestAnimationFrame(renderLoop);
        } catch (error) { console.error("DEBUG: initThreeScene ERROR:", error); isInitialized.current = false; }
    // Update dependencies - patchShader accesses customUniforms ref
    }, [handleResize, renderLoop, patchShader]); // Removed shader strings


    // --- Setup / Cleanup Effect --- (Simplified Cleanup)
    useEffect(() => { initThreeScene(); let resizeObserver; const currentCanvas = canvasRef.current; if (currentCanvas) { resizeObserver = new ResizeObserver(() => { handleResize(); }); resizeObserver.observe(currentCanvas); } return () => { console.log("DEBUG: Cleanup running..."); resizeObserver?.disconnect(); cancelAnimationFrame(animationFrameHandle.current); isInitialized.current = false; console.log("DEBUG: Disposing Three.js resources (Direct Basic)..."); videoTextureRef.current?.dispose(); imageTextureRef.current?.dispose(); segmentationTextureRef.current?.dispose(); basePlaneMeshRef.current?.geometry?.dispose(); basePlaneMeshRef.current?.material?.map?.dispose(); basePlaneMeshRef.current?.material?.dispose(); rendererInstanceRef.current?.dispose(); videoTextureRef.current = null; imageTextureRef.current = null; segmentationTextureRef.current=null; basePlaneMeshRef.current = null; rendererInstanceRef.current = null; baseSceneRef.current = null; baseCameraRef.current = null; console.log("DEBUG: Three.js resources disposed."); }; }, [initThreeScene, handleResize]);


    // --- JSX --- (No change)
    return ( <canvas ref={canvasRef} className={`renderer-canvas ${className || ''}`} style={{ display: 'block', width: '100%', height: '100%', ...(style || {}) }} /> );

});
TryOnRenderer.displayName = 'TryOnRenderer';
export default TryOnRenderer;