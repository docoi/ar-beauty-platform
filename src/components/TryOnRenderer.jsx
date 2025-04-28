// src/components/TryOnRenderer.jsx - RE-ENABLE Mask Sampling (Keep Red Effect)

import React, { useRef, forwardRef, useEffect, useCallback } from 'react';
import * as THREE from 'three';

const TryOnRenderer = forwardRef(({
    videoRefProp, imageElement, mediaPipeResults, segmentationResults,
    isStatic, brightness, contrast, effectIntensity,
    className, style
 }, ref) => {

    // --- Core Refs / Internal State Refs --- (No changes)
    const canvasRef = useRef(null); /* ... */ const segmentationTextureRef = useRef(null);
    const currentIntensity = useRef(0.5);
    // ... rest of refs ...

    // --- ***** Shaders (Re-enable Mask Sampling, Keep Red Effect) ***** ---
    const postVertexShader = `varying vec2 vUv; void main() { vUv = uv; gl_Position = vec4(position, 1.0); }`;
    const postFragmentShader = `
        uniform sampler2D uSceneTexture;
        uniform sampler2D uSegmentationMask; // <<< Use this uniform
        uniform float uEffectIntensity;
        uniform bool uHasMask;              // <<< Use this uniform

        varying vec2 vUv;

        // Effect function (output red - intensity doesn't scale color here, just blend amount)
        vec3 applyHydrationEffect(vec3 color) {
            return vec3(1.0, 0.0, 0.0); // Return solid red for test
        }

        void main() {
            vec4 baseColor = texture2D(uSceneTexture, vUv);
            vec3 finalColor = baseColor.rgb; // Start with base color

            // *** Apply Effect ONLY if Mask is present and Intensity > 0 ***
            if (uHasMask && uEffectIntensity > 0.0) {
                // Sample the mask texture
                float maskValue = texture2D(uSegmentationMask, vUv).r;

                // Get the effect color (solid red)
                vec3 hydratedColor = applyHydrationEffect(finalColor);

                // Blend based on mask value and intensity slider
                // Use smoothstep for potentially smoother edges
                float blendAmount = smoothstep(0.3, 0.8, maskValue) * uEffectIntensity; // Adjust thresholds 0.3, 0.8 if needed
                finalColor = mix(finalColor, hydratedColor, blendAmount);
            }
            // *************************************************************

            finalColor = clamp(finalColor, 0.0, 1.0);
            gl_FragColor = vec4(finalColor, baseColor.a);
        }
    `;
    // --- ************************************************************* ---

    // --- Prop Effects / Texture Effects / Mask Effect --- (No changes needed from previous step)
    useEffect(() => { currentIntensity.current = effectIntensity; }, [effectIntensity]);
    useEffect(() => { /* Video Texture */ }, [isStatic, videoRefProp]);
    useEffect(() => { /* Image Texture */ }, [isStatic, imageElement]);
    useEffect(() => { /* Mask Texture Creation */ }, [segmentationResults, isStatic]);

    // --- Handle Resizing / Scale Plane --- (No changes needed)
    const handleResize = useCallback(() => { /* ... */ }, []);
    const fitPlaneToCamera = useCallback((textureWidth, textureHeight) => { /* ... */ }, []);

    // --- Render Loop --- (No changes needed - already updates all relevant uniforms)
     const renderLoop = useCallback(() => {
        animationFrameHandle.current = requestAnimationFrame(renderLoop);
        if (!isInitialized.current || !rendererInstanceRef.current || !postMaterialRef.current /* etc */ ) { return; }

        try {
            const postUniforms = postMaterialRef.current.uniforms;
            // Check all uniforms needed by this shader
            if (!postUniforms?.uSceneTexture || !postUniforms?.uSegmentationMask || !postUniforms?.uHasMask || !postUniforms?.uEffectIntensity) { return; }

            // 1 & 2: Select Texture & Update Plane (same)
            /* ... */
             const baseMaterial = basePlaneMeshRef.current.material; let sourceWidth = 0, sourceHeight = 0; let textureToAssign = null; let isVideo = false;
            if (!isStatic && videoTextureRef.current) { textureToAssign = videoTextureRef.current; isVideo = true; if(textureToAssign.image) {sourceWidth=textureToAssign.image.videoWidth; sourceHeight=textureToAssign.image.videoHeight;} } else if (isStatic && imageTextureRef.current) { textureToAssign = imageTextureRef.current; if(textureToAssign.image){sourceWidth=textureToAssign.image.naturalWidth; sourceHeight=textureToAssign.image.naturalHeight;} if(textureToAssign.needsUpdate){textureToAssign.needsUpdate=true;} }
            if(baseMaterial){ if (baseMaterial.map !== textureToAssign) { baseMaterial.map = textureToAssign; baseMaterial.needsUpdate = true; } else if (textureToAssign && textureToAssign.needsUpdate) { baseMaterial.needsUpdate = true; } }
            const planeVisible = !!baseMaterial?.map && sourceWidth > 0 && sourceHeight > 0;
             if (planeVisible) { fitPlaneToCamera(sourceWidth, sourceHeight); const scaleX = Math.abs(basePlaneMeshRef.current.scale.x); const newScaleX = isVideo ? -scaleX : scaleX; if(basePlaneMeshRef.current.scale.x !== newScaleX) { basePlaneMeshRef.current.scale.x = newScaleX; } } else { if (basePlaneMeshRef.current?.scale.x !== 0 || basePlaneMeshRef.current?.scale.y !== 0) { basePlaneMeshRef.current?.scale.set(0, 0, 0); } }


            // 3. Render Base Scene to Target
            rendererInstanceRef.current.setRenderTarget(renderTargetRef.current);
            rendererInstanceRef.current.setClearColor(0x000000, 0); rendererInstanceRef.current.clear();
             if (planeVisible) { rendererInstanceRef.current.render(baseSceneRef.current, baseCameraRef.current); if (textureToAssign?.needsUpdate) { textureToAssign.needsUpdate = false; } }

            // 4. Unbind Render Target
             rendererInstanceRef.current.setRenderTarget(null);

            // 5. Update Post-Processing Uniforms
             postUniforms.uSceneTexture.value = renderTargetRef.current.texture;
             postUniforms.uSegmentationMask.value = segmentationTextureRef.current; // Assign mask texture ref
             const hasMask = !!segmentationTextureRef.current;
             postUniforms.uHasMask.value = hasMask; // Set boolean flag
             postUniforms.uEffectIntensity.value = currentIntensity.current; // Update intensity

            // Optional: Log uniforms periodically
            // if (currentCount % 100 === 1) { console.log(`RenderLoop Uniforms: uIntensity=${postUniforms.uEffectIntensity.value?.toFixed(2)}, uHasMask=${postUniforms.uHasMask.value}, Mask ID: ${postUniforms.uSegmentationMask.value?.id ?? 'null'}`); }


            // 6. Render Post-Processing Scene to Screen
             rendererInstanceRef.current.render(postSceneRef.current, postCameraRef.current);

        } catch (error) { console.error("Error in renderLoop:", error); }
    }, [fitPlaneToCamera, isStatic]);


    // --- Initialize Scene --- (No changes needed from previous - keep mipmap fix attempt)
    const initThreeScene = useCallback(() => {
        if (!canvasRef.current || isInitialized.current) return;
        console.log("DEBUG: initThreeScene START (Re-enable Mask Sampling)");
        try {
            // ... (Renderer, Render Target w/ Mipmap fix, Base Scene, Post Scene setup exactly as before) ...
             const canvas = canvasRef.current; const initialWidth = canvas.clientWidth || 640; const initialHeight = canvas.clientHeight || 480;
            rendererInstanceRef.current = new THREE.WebGLRenderer({ canvas: canvas, antialias: true }); rendererInstanceRef.current.setSize(initialWidth, initialHeight); rendererInstanceRef.current.setPixelRatio(window.devicePixelRatio); rendererInstanceRef.current.outputColorSpace = THREE.SRGBColorSpace;
            renderTargetRef.current = new THREE.WebGLRenderTarget(initialWidth, initialHeight, { minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, format: THREE.RGBAFormat, colorSpace: THREE.SRGBColorSpace, depthBuffer: true, stencilBuffer: true });
            renderTargetRef.current.texture.generateMipmaps = false; renderTargetRef.current.texture.minFilter = THREE.LinearFilter; renderTargetRef.current.texture.magFilter = THREE.LinearFilter;
            baseSceneRef.current = new THREE.Scene(); baseCameraRef.current = new THREE.OrthographicCamera(-initialWidth / 2, initialWidth / 2, initialHeight / 2, -initialHeight / 2, 0.1, 10); baseCameraRef.current.position.z = 1; const planeGeometry = new THREE.PlaneGeometry(1, 1); const planeMaterial = new THREE.MeshBasicMaterial({ map: null, side: THREE.DoubleSide, color: 0xffffff, transparent: true }); basePlaneMeshRef.current = new THREE.Mesh(planeGeometry, planeMaterial); baseSceneRef.current.add(basePlaneMeshRef.current);
            postSceneRef.current = new THREE.Scene(); postCameraRef.current = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1); const postPlaneGeometry = new THREE.PlaneGeometry(2, 2);

            // Initialize Material with all needed uniforms for this shader
            postMaterialRef.current = new THREE.ShaderMaterial({
                vertexShader: postVertexShader,
                fragmentShader: postFragmentShader, // <<< Shader that USES mask
                uniforms: {
                    uSceneTexture: { value: renderTargetRef.current.texture },
                    uSegmentationMask: { value: null }, // Initialize
                    uEffectIntensity: { value: currentIntensity.current },
                    uHasMask: { value: false }, // Initialize
                    // No B/C uniforms
                },
                transparent: true, depthWrite: false, depthTest: false,
            });
            const postPlaneMesh = new THREE.Mesh(postPlaneGeometry, postMaterialRef.current); postSceneRef.current.add(postPlaneMesh);

            isInitialized.current = true; handleResize(); cancelAnimationFrame(animationFrameHandle.current); animationFrameHandle.current = requestAnimationFrame(renderLoop);
        } catch (error) { console.error("DEBUG: initThreeScene ERROR:", error); isInitialized.current = false; }
    }, [handleResize, postVertexShader, postFragmentShader, renderLoop]);


    // --- Setup / Cleanup Effect --- (No changes needed)
    useEffect(() => { initThreeScene(); let resizeObserver; const currentCanvas = canvasRef.current; if (currentCanvas) { resizeObserver = new ResizeObserver(() => { handleResize(); }); resizeObserver.observe(currentCanvas); } return () => { /* ... Full cleanup ... */ console.log("DEBUG: Cleanup running (TryOnRenderer Unmount)..."); resizeObserver?.disconnect(); cancelAnimationFrame(animationFrameHandle.current); isInitialized.current = false; console.log("DEBUG: Disposing Three.js resources (Full)..."); videoTextureRef.current?.dispose(); imageTextureRef.current?.dispose(); segmentationTextureRef.current?.dispose(); renderTargetRef.current?.dispose(); basePlaneMeshRef.current?.geometry?.dispose(); basePlaneMeshRef.current?.material?.map?.dispose(); basePlaneMeshRef.current?.material?.dispose(); if(postMaterialRef.current) { postMaterialRef.current.uniforms?.uSceneTexture?.value?.dispose(); postMaterialRef.current.uniforms?.uSegmentationMask?.value?.dispose(); postMaterialRef.current.dispose(); } rendererInstanceRef.current?.dispose(); videoTextureRef.current = null; imageTextureRef.current = null; segmentationTextureRef.current = null; renderTargetRef.current = null; basePlaneMeshRef.current = null; postMaterialRef.current = null; rendererInstanceRef.current = null; baseSceneRef.current = null; postSceneRef.current = null; baseCameraRef.current = null; postCameraRef.current = null; console.log("DEBUG: Three.js resources disposed."); }; }, [initThreeScene, handleResize]);


    // --- JSX --- (No change)
    return ( <canvas ref={canvasRef} className={`renderer-canvas ${className || ''}`} style={{ display: 'block', width: '100%', height: '100%', ...(style || {}) }} /> );

});
TryOnRenderer.displayName = 'TryOnRenderer';
export default TryOnRenderer;