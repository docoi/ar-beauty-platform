// src/components/TryOnRenderer.jsx - Restore Logs in RenderLoop

import React, { useRef, useImperativeHandle, forwardRef, useEffect, useCallback } from 'react';
import * as THREE from 'three';

console.log(`Using Three.js revision: ${THREE.REVISION}`);

const TryOnRenderer = forwardRef(({ videoWidth, videoHeight, className }, ref) => {
    // --- Core Refs, State Refs, etc. ---
    const canvasRef = useRef(null); // ... other refs ...
    const postMaterialRef = useRef(null); const videoTextureRef = useRef(null); const imageTextureRef = useRef(null); const renderTargetRef = useRef(null); const basePlaneMeshRef = useRef(null); const isInitialized = useRef(false); const currentSourceElement = useRef(null); const currentMediaPipeResults = useRef(null); const segmentationTextureRef = useRef(null); const baseSceneRef = useRef(null); const baseCameraRef = useRef(null); const postSceneRef = useRef(null); const postCameraRef = useRef(null); const rendererInstanceRef = useRef(null); const animationFrameHandle = useRef(null); const isStaticImage = useRef(false); const currentBrightness = useRef(1.0); const currentContrast = useRef(1.0); const currentEffectIntensity = useRef(0.5);
    const renderLoopCounter = useRef(0);


    // --- Shaders --- (Keep Bare Minimum)
    const postVertexShader = `varying vec2 vUv; void main() { vUv = uv; gl_Position = vec4(position, 1.0); }`;
    const postFragmentShader = `
        uniform sampler2D uSceneTexture; varying vec2 vUv;
        void main() { gl_FragColor = texture2D(uSceneTexture, vUv); }
    `;


    // --- Handle Resizing ---
    const handleResize = useCallback(() => { /* ... */ }, []);
    // --- Scale Base Plane ---
    const fitPlaneToCamera = useCallback((textureWidth, textureHeight) => { /* ... */ }, []);


    // --- Render Loop --- (RESTORE LOGS)
     const renderLoop = useCallback(() => {
        animationFrameHandle.current = requestAnimationFrame(renderLoop);
        if (!isInitialized.current || !rendererInstanceRef.current || !baseSceneRef.current || !baseCameraRef.current || !postSceneRef.current || !postCameraRef.current || !basePlaneMeshRef.current || !postMaterialRef.current?.uniforms || !renderTargetRef.current) return;

        // *** RESTORED LOGGING ***
        const currentCount = renderLoopCounter.current++;
        if (currentCount % 100 === 0) { // Log periodically
            console.log(`RenderLoop executing: Frame ${currentCount}`);
        }
        // *** END RESTORED LOGGING ***

        try {
            const sourceElement = currentSourceElement.current; const baseMaterial = basePlaneMeshRef.current.material; const postUniforms = postMaterialRef.current.uniforms;
            const results = currentMediaPipeResults.current; let sourceWidth = 0, sourceHeight = 0; let isVideo = sourceElement instanceof HTMLVideoElement; let isImage = sourceElement instanceof HTMLImageElement;
            let textureToAssign = null;

            // 1. Update Base Texture
            if (isVideo && sourceElement.readyState >= 2 && sourceElement.videoWidth > 0) { sourceWidth = sourceElement.videoWidth; sourceHeight = sourceElement.videoHeight; if (videoTextureRef.current?.image !== sourceElement) { videoTextureRef.current?.dispose(); videoTextureRef.current = new THREE.VideoTexture(sourceElement); videoTextureRef.current.colorSpace = THREE.SRGBColorSpace; console.log("DEBUG RenderLoop: Created Video Texture"); } textureToAssign = videoTextureRef.current; } // Add Log
            else if (isImage && sourceElement.complete && sourceElement.naturalWidth > 0) { sourceWidth = sourceElement.naturalWidth; sourceHeight = sourceElement.naturalHeight; if (imageTextureRef.current?.image !== sourceElement) { imageTextureRef.current?.dispose(); imageTextureRef.current = new THREE.Texture(sourceElement); imageTextureRef.current.colorSpace = THREE.SRGBColorSpace; imageTextureRef.current.needsUpdate = true; console.log("DEBUG RenderLoop: Created Image Texture"); } else if (imageTextureRef.current && imageTextureRef.current.needsUpdate) { imageTextureRef.current.needsUpdate = true; } textureToAssign = imageTextureRef.current; } // Add Log
            else { textureToAssign = null; if(videoTextureRef.current) { videoTextureRef.current.dispose(); videoTextureRef.current = null; } if(imageTextureRef.current) { imageTextureRef.current.dispose(); imageTextureRef.current = null;} }

            const textureChanged = baseMaterial.map !== textureToAssign;
            if (textureChanged) { baseMaterial.map = textureToAssign; baseMaterial.needsUpdate = true; console.log("DEBUG RenderLoop: Assigned texture to base material:", textureToAssign ? textureToAssign.constructor.name : 'null'); } // Add Log
            if (textureToAssign && textureToAssign.needsUpdate && !(textureToAssign instanceof THREE.VideoTexture)) { textureToAssign.needsUpdate = true; }

            // 2. Update Plane Scale & Mirroring
            const planeVisible = baseMaterial.map && sourceWidth > 0 && sourceHeight > 0;
            if (planeVisible) { fitPlaneToCamera(sourceWidth, sourceHeight); const scaleX = Math.abs(basePlaneMeshRef.current.scale.x); const newScaleX = isVideo ? -scaleX : scaleX; if(basePlaneMeshRef.current.scale.x !== newScaleX) { basePlaneMeshRef.current.scale.x = newScaleX; } }
            else { if (basePlaneMeshRef.current.scale.x !== 0 || basePlaneMeshRef.current.scale.y !== 0) { basePlaneMeshRef.current.scale.set(0, 0, 0); console.log("DEBUG RenderLoop: Hiding base plane"); } } // Add Log

            // 3. Render Base Scene to Target
            if (planeVisible) { // Only render if plane should be visible
                 rendererInstanceRef.current.setRenderTarget(renderTargetRef.current);
                 rendererInstanceRef.current.clear(); // Ensure target is clear
                 rendererInstanceRef.current.render(baseSceneRef.current, baseCameraRef.current);
                 rendererInstanceRef.current.setRenderTarget(null);
                 // if (currentCount % 100 === 0) console.log(`DEBUG RenderLoop: Rendered base scene to target.`); // Add Log
            } else {
                 // Optional: Clear target if nothing to render? Or rely on post-scene background?
                 // Let's try clearing it explicitly
                  rendererInstanceRef.current.setRenderTarget(renderTargetRef.current);
                  rendererInstanceRef.current.clear(); // Clear the target explicitly
                  rendererInstanceRef.current.setRenderTarget(null);
                  // if (currentCount % 100 === 0) console.log(`DEBUG RenderLoop: Cleared render target (plane hidden).`); // Add Log
            }

            // 4. Update Post-Processing Uniforms
            if (postUniforms?.uSceneTexture) { // Check uniform exists
                postUniforms.uSceneTexture.value = renderTargetRef.current.texture;
            }
            // Update Segmentation Mask Texture (Keep logic, but ensure uniform exists)
            const segmentationMask = currentMediaPipeResults.current?.segmentationMasks?.[0];
             if (postUniforms?.uSegmentationMask && segmentationMask?.mask) { // Check uniform and data
                  // ... (create/update segmentationTextureRef) ...
                  postUniforms.uSegmentationMask.value = segmentationTextureRef.current;
             } else if (postUniforms?.uSegmentationMask?.value !== null) {
                    postUniforms.uSegmentationMask.value = null; // Clear if exists
             }

            // 5. Render Post-Processing Scene to Screen
            rendererInstanceRef.current.render(postSceneRef.current, postCameraRef.current);
             // if (currentCount % 100 === 0) console.log(`DEBUG RenderLoop: Rendered post scene to screen.`); // Add Log


        } catch (error) { console.error("Error in renderLoop:", error); }
    }, []); // Keep empty deps


    // --- Initialize Scene --- (Keep Bare Minimum Shader Uniforms)
    const initThreeScene = useCallback(() => {
        if (!canvasRef.current || isInitialized.current) return; console.log("DEBUG: initThreeScene START (Post-Processing)"); try { /* ... renderer, render target, base scene ... */ const canvas = canvasRef.current; const initialWidth = canvas.clientWidth || 640; const initialHeight = canvas.clientHeight || 480; rendererInstanceRef.current = new THREE.WebGLRenderer({ canvas: canvas, antialias: true }); rendererInstanceRef.current.setSize(initialWidth, initialHeight); rendererInstanceRef.current.setPixelRatio(window.devicePixelRatio); rendererInstanceRef.current.outputColorSpace = THREE.SRGBColorSpace; renderTargetRef.current = new THREE.WebGLRenderTarget(initialWidth, initialHeight, { minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, format: THREE.RGBAFormat, colorSpace: THREE.SRGBColorSpace }); console.log("DEBUG: RenderTarget created."); baseSceneRef.current = new THREE.Scene(); baseCameraRef.current = new THREE.OrthographicCamera(-initialWidth / 2, initialWidth / 2, initialHeight / 2, -initialHeight / 2, 0.1, 10); baseCameraRef.current.position.z = 1; const planeGeometry = new THREE.PlaneGeometry(1, 1); const planeMaterial = new THREE.MeshBasicMaterial({ map: null, side: THREE.DoubleSide, color: 0xffffff }); basePlaneMeshRef.current = new THREE.Mesh(planeGeometry, planeMaterial); basePlaneMeshRef.current.position.z = 0; basePlaneMeshRef.current.scale.set(1, 1, 1); baseSceneRef.current.add(basePlaneMeshRef.current); console.log("DEBUG: Base scene created.");
            // Create Post Scene
            postSceneRef.current = new THREE.Scene(); postCameraRef.current = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1); const postPlaneGeometry = new THREE.PlaneGeometry(2, 2);
            // Create ShaderMaterial with ONLY uSceneTexture uniform
            postMaterialRef.current = new THREE.ShaderMaterial({
                vertexShader: postVertexShader, fragmentShader: postFragmentShader,
                uniforms: { uSceneTexture: { value: renderTargetRef.current.texture }, },
                depthWrite: false, depthTest: false,
            });
            const postPlaneMesh = new THREE.Mesh(postPlaneGeometry, postMaterialRef.current); postSceneRef.current.add(postPlaneMesh); console.log("DEBUG: Post-processing scene created (Bare Minimum Shader)."); isInitialized.current = true; console.log("DEBUG: Scene initialization complete."); handleResize(); console.log("DEBUG: Requesting first render loop frame from Init."); cancelAnimationFrame(animationFrameHandle.current); animationFrameHandle.current = requestAnimationFrame(renderLoop); } catch (error) { console.error("DEBUG: initThreeScene ERROR:", error); isInitialized.current = false; }
    }, [handleResize, postVertexShader, postFragmentShader]);


    // --- Effect for Initial Setup / Resize Observer ---
    useEffect(() => { /* ... */ }, [initThreeScene, handleResize]);
    // --- Expose Methods ---
    useImperativeHandle(ref, () => { console.log(`TryOnRenderer: useImperativeHandle running @ ${performance.now().toFixed(0)}`); return { /* ... methods ... */ }; });
    // --- JSX ---
    return ( <canvas ref={canvasRef} className={`renderer-canvas ${className || ''}`} style={{ display: 'block', width: '100%', height: '100%' }} /> );
});

TryOnRenderer.displayName = 'TryOnRenderer';
export default TryOnRenderer;