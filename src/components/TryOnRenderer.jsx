// src/components/TryOnRenderer.jsx - Restore Minimal Texture Sampling Shader

import React, { useRef, forwardRef, useEffect, useCallback, useState, useMemo } from 'react';
import * as THREE from 'three';

console.log(`Using Three.js revision: ${THREE.REVISION}`);

const TryOnRenderer = forwardRef(({ /* ... props ... */ className }, ref) => {

    // ... refs ...
    const canvasRef = useRef(null);
    // ... other refs ...
    const postMaterialRef = useRef(null);
    const renderTargetRef = useRef(null); // << Need this
    // ... other refs ...


    // --- Shaders ---
    const postVertexShader = `varying vec2 vUv; void main() { vUv = uv; gl_Position = vec4(position, 1.0); }`;
    // *** RESTORE BARE MINIMUM TEXTURE SAMPLING SHADER ***
    const postFragmentShader = `
        uniform sampler2D uSceneTexture; // Input texture from render target
        varying vec2 vUv;

        void main() {
            // Just sample the input texture and output its color directly
            gl_FragColor = texture2D(uSceneTexture, vUv);
        }
    `;
    // *** ------------------------------------------ ***


    // ... useEffect hooks for props ...
    // ... handleResize, fitPlaneToCamera ...


    // --- Render Loop ---
     const renderLoop = useCallback(() => {
        // ... (render loop logic remains the same) ...
        // It will update uSceneTexture.value if the uniform exists

        try {
             // ... Read internal refs ...
             const postUniforms = postMaterialRef.current.uniforms;
             if (!postUniforms) { /*...*/ return; }
             // ... Texture/Plane/Target logic ...

            // 4. Update Post-Processing Uniforms
             if (postUniforms.uSceneTexture) { // Check uniform exists
                 postUniforms.uSceneTexture.value = renderTargetRef.current.texture; // Assign texture value
             }

             // ... Update Segmentation Mask (if uniform exists) ...

             // 5. Render Post-Processing Scene to Screen
             rendererInstanceRef.current.render(postSceneRef.current, postCameraRef.current);

        } catch (error) { console.error("Error in renderLoop:", error); }

     }, [fitPlaneToCamera]);


    // --- Initialize Scene ---
    const initThreeScene = useCallback(() => {
        if (!canvasRef.current || isInitialized.current) return; console.log("DEBUG: initThreeScene START"); try { /* ... Init renderer, render target, base scene ... */
            // Create Post Scene
            postSceneRef.current = new THREE.Scene();
            // Remove background color again
            // postSceneRef.current.background = new THREE.Color(0x0000ff);
            postCameraRef.current = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1); const postPlaneGeometry = new THREE.PlaneGeometry(2, 2);

            // *** Create ShaderMaterial with uSceneTexture uniform RESTORED ***
            postMaterialRef.current = new THREE.ShaderMaterial({
                 vertexShader: postVertexShader,
                 fragmentShader: postFragmentShader, // Uses texture sampling shader
                 uniforms: {
                     // Restore the necessary uniform
                     uSceneTexture: { value: null },
                 },
                 depthWrite: false, depthTest: false,
                 // transparent: false // No longer need transparency
             });
            // Assign texture after material creation
            if (renderTargetRef.current) {
                 postMaterialRef.current.uniforms.uSceneTexture.value = renderTargetRef.current.texture;
            }
            // *** ------------------------------------------------------- ***

            const postPlaneMesh = new THREE.Mesh(postPlaneGeometry, postMaterialRef.current); postSceneRef.current.add(postPlaneMesh); console.log("DEBUG: Post-processing scene created (Minimal Texture Shader). Mesh added:", !!postPlaneMesh.parent);
            isInitialized.current = true; console.log("DEBUG: Scene initialization complete."); handleResize(); console.log("DEBUG: Requesting first render loop frame from Init."); cancelAnimationFrame(animationFrameHandle.current); animationFrameHandle.current = requestAnimationFrame(renderLoop); } catch (error) { console.error("DEBUG: initThreeScene ERROR:", error); isInitialized.current = false; }
    }, [handleResize, postVertexShader, postFragmentShader, renderLoop]);


    // ... Effect for Initial Setup / Resize Observer ...
    // ... JSX ...
    return ( <canvas ref={canvasRef} className={`renderer-canvas ${className || ''}`} style={{ display: 'block', width: '100%', height: '100%' }} /> );
});

TryOnRenderer.displayName = 'TryOnRenderer';
export default TryOnRenderer;