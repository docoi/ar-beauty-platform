// src/components/TryOnRenderer.jsx - BARE MINIMUM Fragment Shader

import React, { useRef, useImperativeHandle, forwardRef, useEffect, useCallback } from 'react';
import * as THREE from 'three';

console.log(`Using Three.js revision: ${THREE.REVISION}`);

const TryOnRenderer = forwardRef(({ videoWidth, videoHeight, className }, ref) => {
    // --- Core Refs, State Refs, etc. --- (Remain the same)
    const canvasRef = useRef(null);
    const rendererInstanceRef = useRef(null);
    const animationFrameHandle = useRef(null);
    // ... other refs ...
    const postMaterialRef = useRef(null); // Need this for shader update
    // ... other refs ...


    // --- Shaders ---
    const postVertexShader = `varying vec2 vUv; void main() { vUv = uv; gl_Position = vec4(position, 1.0); }`;
    // *** BARE MINIMUM FRAGMENT SHADER ***
    const postFragmentShader = `
        uniform sampler2D uSceneTexture; // Input texture from render target
        varying vec2 vUv;

        void main() {
            // Just sample the input texture and output its color directly
            gl_FragColor = texture2D(uSceneTexture, vUv);
        }
    `;
    // *** END BARE MINIMUM FRAGMENT SHADER ***


    // --- Handle Resizing --- (Remains the same)
    const handleResize = useCallback(() => { /* ... */ }, []);

    // --- Scale Base Plane (object-fit: cover logic) --- (Remains the same)
    const fitPlaneToCamera = useCallback((textureWidth, textureHeight) => { /* ... */ }, []);

    // --- Render Loop --- (Remains the same)
     const renderLoop = useCallback(() => {
         animationFrameHandle.current = requestAnimationFrame(renderLoop);
         if (!isInitialized.current /* ... etc ... */) return;
         try {
            // ... (Texture updates, Plane Scaling, Render Base Scene) ...

            // 4. Update Post-Processing Uniforms (Only uSceneTexture needed for this test)
            if (postMaterialRef.current?.uniforms?.uSceneTexture) { // Check if material exists
                postMaterialRef.current.uniforms.uSceneTexture.value = renderTargetRef.current.texture;
            }
            // No need to update other uniforms (B/C, Intensity, Mask, IsStatic) for this test

            // --- Update Segmentation Mask Texture --- (Keep this logic, it shouldn't break anything)
            const segmentationMask = currentMediaPipeResults.current?.segmentationMasks?.[0];
             if (segmentationMask && postMaterialRef.current?.uniforms?.uSegmentationMask && segmentationMask.mask) {
                 if (!segmentationTextureRef.current || segmentationTextureRef.current.image.width !== segmentationMask.width /*...*/) {
                     /* ... create/resize texture ... */
                     segmentationTextureRef.current = new THREE.DataTexture(/*...*/);
                     segmentationTextureRef.current.needsUpdate = true;
                 } else if (segmentationTextureRef.current.image.data !== segmentationMask.mask) {
                    /* ... update data ... */
                     segmentationTextureRef.current.needsUpdate = true;
                 }
                 // Even though shader isn't using it, keep uniform assigned IF IT EXISTS on the material
                 if (postMaterialRef.current.uniforms.uSegmentationMask) {
                    postMaterialRef.current.uniforms.uSegmentationMask.value = segmentationTextureRef.current;
                 }
             } else {
                 // Clear uniform IF IT EXISTS on the material
                 if (postMaterialRef.current?.uniforms?.uSegmentationMask?.value !== null) {
                    postMaterialRef.current.uniforms.uSegmentationMask.value = null;
                 }
             }


            // 5. Render Post-Processing Scene to Screen
            rendererInstanceRef.current.render(postSceneRef.current, postCameraRef.current);

         } catch (error) { console.error("Error in renderLoop:", error); }
     }, []); // Keep empty deps


    // --- Initialize Scene ---
    const initThreeScene = useCallback(() => {
        if (!canvasRef.current || isInitialized.current) return; console.log("DEBUG: initThreeScene START (Post-Processing)"); try { /* ... renderer, render target, base scene ... */
            // Create Post Scene
            postSceneRef.current = new THREE.Scene();
            postCameraRef.current = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
            const postPlaneGeometry = new THREE.PlaneGeometry(2, 2);

            // *** Create ShaderMaterial with ONLY uSceneTexture uniform ***
            postMaterialRef.current = new THREE.ShaderMaterial({
                vertexShader: postVertexShader,
                fragmentShader: postFragmentShader, // Use the BARE MINIMUM shader
                uniforms: {
                    // Only include the uniform actually used by the bare minimum shader
                    uSceneTexture: { value: renderTargetRef.current.texture },
                    // Temporarily remove other uniforms to ensure they aren't causing compile issues
                    // uSegmentationMask: { value: null },
                    // uEffectIntensity: { value: currentEffectIntensity.current },
                    // uIsStaticImage: { value: isStaticImage.current },
                    // uBrightness: { value: currentBrightness.current },
                    // uContrast: { value: currentContrast.current }
                 },
                depthWrite: false, depthTest: false,
            });
            // *** ----------------------------------------------------- ***

            const postPlaneMesh = new THREE.Mesh(postPlaneGeometry, postMaterialRef.current); postSceneRef.current.add(postPlaneMesh); console.log("DEBUG: Post-processing scene created (Bare Minimum Shader)."); /* ... rest of init ... */ isInitialized.current = true; console.log("DEBUG: Scene initialization complete."); handleResize(); console.log("DEBUG: Requesting first render loop frame from Init."); cancelAnimationFrame(animationFrameHandle.current); animationFrameHandle.current = requestAnimationFrame(renderLoop); } catch (error) { console.error("DEBUG: initThreeScene ERROR:", error); isInitialized.current = false; }
    // Re-add shader dependencies since they changed
    }, [handleResize, postVertexShader, postFragmentShader]);


    // --- Effect for Initial Setup / Resize Observer --- (Remains the same)
    useEffect(() => { /* ... */ }, [initThreeScene, handleResize]);

    // --- Expose Methods --- (Log handle creation, methods remain the same internally)
    useImperativeHandle(ref, () => {
        console.log(`TryOnRenderer: useImperativeHandle running @ ${performance.now().toFixed(0)}`);
        return { /* ... methods still update internal refs, even if shader doesn't use them yet ... */
             renderResults: (videoElement, results, intensity) => { /*...*/ },
             renderStaticImageResults: (imageElement, results, brightness, contrast, effectIntensity) => { /*...*/ },
             updateEffectIntensity: (intensity) => { /*...*/ },
             clearCanvas: () => { /*...*/ }
         };
    });

    // --- JSX --- (Remains the same)
    return ( <canvas ref={canvasRef} className={`renderer-canvas ${className || ''}`} style={{ display: 'block', width: '100%', height: '100%' }} /> );
});

TryOnRenderer.displayName = 'TryOnRenderer';
export default TryOnRenderer;