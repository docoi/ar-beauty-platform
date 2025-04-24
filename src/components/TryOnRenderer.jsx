// src/components/TryOnRenderer.jsx - Visualize Render Target for Static Image

import React, { useRef, useImperativeHandle, forwardRef, useEffect, useCallback } from 'react';
import * as THREE from 'three';

console.log(`Using Three.js revision: ${THREE.REVISION}`);

const TryOnRenderer = forwardRef(({ videoWidth, videoHeight, className }, ref) => {
    const canvasRef = useRef(null);
    const rendererInstanceRef = useRef(null);
    const animationFrameHandle = useRef(null);
    const isInitialized = useRef(false);
    const baseSceneRef = useRef(null);
    const baseCameraRef = useRef(null);
    const basePlaneMeshRef = useRef(null);
    const videoTextureRef = useRef(null);
    const imageTextureRef = useRef(null);
    const postSceneRef = useRef(null); // Keep refs even if not always used
    const postCameraRef = useRef(null);
    const postMaterialRef = useRef(null);
    const renderTargetRef = useRef(null);
    const currentSourceElement = useRef(null);
    const isStaticImage = useRef(false);
    // Remove brightness/contrast refs, we aren't using them in this test
    // const currentBrightness = useRef(1.0);
    // const currentContrast = useRef(1.0);

    // --- Shaders (Only for Post-Processing Scene, not used in this specific test render path) ---
    const postVertexShader = `varying vec2 vUv; void main() { vUv = uv; gl_Position = vec4(position, 1.0); }`;
    const postFragmentShader = `uniform sampler2D uSceneTexture; varying vec2 vUv; void main() { gl_FragColor = texture2D(uSceneTexture, vUv); }`; // Simplest possible post shader

    // --- Handle Resizing ---
    const handleResize = useCallback(() => { /* ... as before ... */
        const canvas = canvasRef.current; if (!rendererInstanceRef.current || !baseCameraRef.current || !postCameraRef.current || !canvas || !renderTargetRef.current) return; const newWidth = canvas.clientWidth; const newHeight = canvas.clientHeight; if (newWidth === 0 || newHeight === 0) return; const currentSize = rendererInstanceRef.current.getSize(new THREE.Vector2()); if (currentSize.x === newWidth && currentSize.y === newHeight) return; console.log(`DEBUG: Resizing -> ${newWidth}x${newHeight}`); rendererInstanceRef.current.setSize(newWidth, newHeight); renderTargetRef.current.setSize(newWidth, newHeight); baseCameraRef.current.left = -newWidth / 2; baseCameraRef.current.right = newWidth / 2; baseCameraRef.current.top = newHeight / 2; baseCameraRef.current.bottom = -newHeight / 2; baseCameraRef.current.updateProjectionMatrix();
    }, []);

    // --- Initialize Scene ---
    const initThreeScene = useCallback(() => { /* ... as before, but simplify post material ... */
        if (!canvasRef.current || isInitialized.current) return; console.log("DEBUG: initThreeScene START (RenderTarget Test)"); try { const canvas = canvasRef.current; const initialWidth = canvas.clientWidth || 640; const initialHeight = canvas.clientHeight || 480; rendererInstanceRef.current = new THREE.WebGLRenderer({ canvas: canvas, antialias: true }); rendererInstanceRef.current.setSize(initialWidth, initialHeight); rendererInstanceRef.current.setPixelRatio(window.devicePixelRatio); rendererInstanceRef.current.outputColorSpace = THREE.SRGBColorSpace; renderTargetRef.current = new THREE.WebGLRenderTarget(initialWidth, initialHeight, { minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, format: THREE.RGBAFormat, type: THREE.UnsignedByteType, colorSpace: THREE.SRGBColorSpace }); baseSceneRef.current = new THREE.Scene(); baseCameraRef.current = new THREE.OrthographicCamera(-initialWidth / 2, initialWidth / 2, initialHeight / 2, -initialHeight / 2, 0.1, 10); baseCameraRef.current.position.z = 1; const planeGeometry = new THREE.PlaneGeometry(1, 1); const planeMaterial = new THREE.MeshBasicMaterial({ map: null, side: THREE.DoubleSide, color: 0xffffff }); basePlaneMeshRef.current = new THREE.Mesh(planeGeometry, planeMaterial); basePlaneMeshRef.current.position.z = 0; basePlaneMeshRef.current.scale.set(1, 1, 1); baseSceneRef.current.add(basePlaneMeshRef.current); postSceneRef.current = new THREE.Scene(); postCameraRef.current = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1); const postPlaneGeometry = new THREE.PlaneGeometry(2, 2);
        // Post material simplified, only needs scene texture input for this test path
        postMaterialRef.current = new THREE.ShaderMaterial({ vertexShader: postVertexShader, fragmentShader: postFragmentShader, uniforms: { uSceneTexture: { value: renderTargetRef.current.texture } }, depthWrite: false, depthTest: false, });
        const postPlaneMesh = new THREE.Mesh(postPlaneGeometry, postMaterialRef.current); postSceneRef.current.add(postPlaneMesh); isInitialized.current = true; console.log("DEBUG: Scene initialization complete."); handleResize(); } catch (error) { console.error("DEBUG: initThreeScene ERROR:", error); }
    }, [handleResize, postVertexShader, postFragmentShader]);

    // --- Effect for Initial Setup / Resize Observer ---
    useEffect(() => { /* ... as before ... */
         initThreeScene(); let resizeObserver; if (canvasRef.current) { resizeObserver = new ResizeObserver(() => { handleResize(); }); resizeObserver.observe(canvasRef.current); } return () => { console.log("DEBUG: Cleanup running..."); /* ... full cleanup ... */ };
     }, [initThreeScene, handleResize]);

    // --- Scale Base Plane ---
    const fitPlaneToCamera = useCallback((textureWidth, textureHeight) => { /* ... */
        if (!baseCameraRef.current || !basePlaneMeshRef.current || !textureWidth || !textureHeight) return; const canvas = canvasRef.current; if (!canvas) return; const cameraWidth = canvas.clientWidth; const cameraHeight = canvas.clientHeight; if (cameraWidth === 0 || cameraHeight === 0) return; const cameraAspect = cameraWidth / cameraHeight; const textureAspect = textureWidth / textureHeight; let scaleX, scaleY; if (cameraAspect > textureAspect) { scaleY = cameraHeight; scaleX = scaleY * textureAspect; } else { scaleX = cameraWidth; scaleY = scaleX / textureAspect; } basePlaneMeshRef.current.scale.y = scaleY; basePlaneMeshRef.current.scale.x = scaleX;
    }, []);

    // --- Render Loop (Visualize Render Target for Static Image) ---
    const renderLoop = useCallback(() => {
        animationFrameHandle.current = requestAnimationFrame(renderLoop);
        if (!isInitialized.current || !rendererInstanceRef.current || !baseSceneRef.current || !baseCameraRef.current || !postSceneRef.current || !postCameraRef.current || !basePlaneMeshRef.current || !postMaterialRef.current?.uniforms || !renderTargetRef.current) return;

        const sourceElement = currentSourceElement.current;
        const baseMaterial = basePlaneMeshRef.current.material; // MeshBasicMaterial
        const postUniforms = postMaterialRef.current.uniforms; // ShaderMaterial uniforms
        let sourceWidth = 0, sourceHeight = 0;
        let isVideo = sourceElement instanceof HTMLVideoElement;
        let textureToAssign = null;

        // --- 1. Update Base Scene Texture ---
        if (isVideo && sourceElement.readyState >= 2) { /* video texture */ sourceWidth = sourceElement.videoWidth; sourceHeight = sourceElement.videoHeight; if (videoTextureRef.current?.image !== sourceElement) { videoTextureRef.current?.dispose(); videoTextureRef.current = new THREE.VideoTexture(sourceElement); videoTextureRef.current.colorSpace = THREE.SRGBColorSpace; } textureToAssign = videoTextureRef.current; }
        else if (isImage && sourceElement.complete && sourceElement.naturalWidth > 0) { /* image texture */ sourceWidth = sourceElement.naturalWidth; sourceHeight = sourceElement.naturalHeight; if (imageTextureRef.current?.image !== sourceElement) { imageTextureRef.current?.dispose(); imageTextureRef.current = new THREE.Texture(sourceElement); imageTextureRef.current.colorSpace = THREE.SRGBColorSpace; imageTextureRef.current.needsUpdate = true; } else { imageTextureRef.current.needsUpdate = true; } textureToAssign = imageTextureRef.current; }
        else { /* no source / clear */ textureToAssign = null; if(videoTextureRef.current) { videoTextureRef.current.dispose(); videoTextureRef.current = null;} if(imageTextureRef.current) { imageTextureRef.current.dispose(); imageTextureRef.current = null;} }
        if (baseMaterial.map !== textureToAssign) { baseMaterial.map = textureToAssign; baseMaterial.needsUpdate = true; }

        // --- 2. Update Base Plane Scale & Mirroring ---
        if (baseMaterial.map && sourceWidth > 0 && sourceHeight > 0) { fitPlaneToCamera(sourceWidth, sourceHeight); basePlaneMeshRef.current.scale.x = Math.abs(basePlaneMeshRef.current.scale.x) * (isVideo ? -1 : 1); }
        else { if (basePlaneMeshRef.current.scale.x !== 0) { basePlaneMeshRef.current.scale.set(0,0,0); } }

        // --- 3. Render Base Scene to Target (Always do this if plane is visible) ---
         if (basePlaneMeshRef.current.scale.x !== 0) {
             rendererInstanceRef.current.setRenderTarget(renderTargetRef.current);
             rendererInstanceRef.current.render(baseSceneRef.current, baseCameraRef.current);
             rendererInstanceRef.current.setRenderTarget(null);
         } else {
              rendererInstanceRef.current.setRenderTarget(renderTargetRef.current);
              rendererInstanceRef.current.clear();
              rendererInstanceRef.current.setRenderTarget(null);
         }

        // --- 4/5. Conditional Final Render ---
        if (isStaticImage.current) {
            // *** DEBUG: Render RenderTarget Texture Directly using Base Scene ***
            if(basePlaneMeshRef.current.scale.x !== 0) { // Check if base plane was rendered
                baseMaterial.map = renderTargetRef.current.texture; // Use RT texture
                baseMaterial.needsUpdate = true;
                // Ensure base plane is scaled correctly and NOT mirrored for final render
                basePlaneMeshRef.current.scale.x = Math.abs(basePlaneMeshRef.current.scale.x);
                rendererInstanceRef.current.render(baseSceneRef.current, baseCameraRef.current); // Render base scene to screen
            } else {
                 rendererInstanceRef.current.clear(); // Clear screen if base wasn't rendered
            }
        } else {
             // --- Render Base Scene DIRECTLY to Screen (for Mirror & Preview) ---
             rendererInstanceRef.current.render(baseSceneRef.current, baseCameraRef.current);
        }

    }, [fitPlaneToCamera]);

    // --- Start Render Loop ---
    useEffect(() => { if (isInitialized.current) { cancelAnimationFrame(animationFrameHandle.current); animationFrameHandle.current = requestAnimationFrame(renderLoop); } }, [renderLoop]);

    // --- Expose Methods (Set State Refs) ---
    useImperativeHandle(ref, () => ({
        renderResults: (videoElement, results) => { // Mirror & Preview
            currentSourceElement.current = videoElement;
            isStaticImage.current = false;
            // No need to update correction refs now
        },
        renderStaticImageResults: (imageElement, results, brightness, contrast) => { // Selfie
            console.log("Handle: renderStaticImageResults called for RT Vis Test");
            currentSourceElement.current = imageElement;
            isStaticImage.current = true; // Set flag to trigger RT visualization path
            // Don't need brightness/contrast for this test
        },
        clearCanvas: () => {
             console.log("Handle: Clearing canvas source.");
             currentSourceElement.current = null;
             isStaticImage.current = false;
             // Render loop will clear the texture from baseMaterial.map
        }
    }));

    // --- JSX ---
    return ( <canvas ref={canvasRef} className={`renderer-canvas ${className || ''}`} style={{ display: 'block', width: '100%', height: '100%' }} /> );
});

TryOnRenderer.displayName = 'TryOnRenderer';
export default TryOnRenderer;