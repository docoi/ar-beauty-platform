// src/components/TryOnRenderer.jsx - Bypass Post-Processing for Mirror Mode

import React, { useRef, useImperativeHandle, forwardRef, useEffect, useCallback } from 'react';
import * as THREE from 'three';

console.log(`Using Three.js revision: ${THREE.REVISION}`);

const TryOnRenderer = forwardRef(({ videoWidth, videoHeight, className }, ref) => {
    // Core Refs
    const canvasRef = useRef(null);
    const rendererInstanceRef = useRef(null);
    const animationFrameHandle = useRef(null);
    const isInitialized = useRef(false);

    // Scene 1 (Base)
    const baseSceneRef = useRef(null);
    const baseCameraRef = useRef(null);
    const basePlaneMeshRef = useRef(null);
    const videoTextureRef = useRef(null);
    const imageTextureRef = useRef(null);

    // Scene 2 (Post-Processing) - Still needed for Selfie mode
    const postSceneRef = useRef(null);
    const postCameraRef = useRef(null);
    const postMaterialRef = useRef(null);

    // Render Target - Still needed for Selfie mode
    const renderTargetRef = useRef(null);

    // State Refs
    const currentSourceElement = useRef(null);
    const isStaticImage = useRef(false);
    const currentBrightness = useRef(1.0);
    const currentContrast = useRef(1.0);
    const usePostProcessing = useRef(false); // NEW: Flag to control rendering path

    // --- Shaders (Only for Post-Processing) ---
    const postVertexShader = `varying vec2 vUv; void main() { vUv = uv; gl_Position = vec4(position, 1.0); }`;
    const postFragmentShader = `uniform sampler2D uSceneTexture; uniform bool uIsStaticImage; uniform float uBrightness; uniform float uContrast; varying vec2 vUv; vec3 cAdjust(vec3 c, float v){ return 0.5 + v * (c - 0.5); } void main() { vec4 sColor = texture2D(uSceneTexture, vUv); if (uIsStaticImage) { sColor.rgb *= uBrightness; sColor.rgb = cAdjust(sColor.rgb, uContrast); sColor.rgb = clamp(sColor.rgb, 0.0, 1.0); } gl_FragColor = sColor; }`;

    // --- Handle Resizing ---
    const handleResize = useCallback(() => { /* ... as before ... */
        const canvas = canvasRef.current; if (!rendererInstanceRef.current || !baseCameraRef.current || !postCameraRef.current || !canvas || !renderTargetRef.current) return; const newWidth = canvas.clientWidth; const newHeight = canvas.clientHeight; if (newWidth === 0 || newHeight === 0) return; const currentSize = rendererInstanceRef.current.getSize(new THREE.Vector2()); if (currentSize.x === newWidth && currentSize.y === newHeight) return; console.log(`DEBUG: Resizing -> ${newWidth}x${newHeight}`); rendererInstanceRef.current.setSize(newWidth, newHeight); renderTargetRef.current.setSize(newWidth, newHeight); baseCameraRef.current.left = -newWidth / 2; baseCameraRef.current.right = newWidth / 2; baseCameraRef.current.top = newHeight / 2; baseCameraRef.current.bottom = -newHeight / 2; baseCameraRef.current.updateProjectionMatrix();
    }, []);

    // --- Initialize Scene ---
    const initThreeScene = useCallback(() => { /* ... as before ... */
        if (!canvasRef.current || isInitialized.current) return; console.log("DEBUG: initThreeScene START (Post-Processing)"); try { const canvas = canvasRef.current; const initialWidth = canvas.clientWidth || 640; const initialHeight = canvas.clientHeight || 480; rendererInstanceRef.current = new THREE.WebGLRenderer({ canvas: canvas, antialias: true }); rendererInstanceRef.current.setSize(initialWidth, initialHeight); rendererInstanceRef.current.setPixelRatio(window.devicePixelRatio); rendererInstanceRef.current.outputColorSpace = THREE.SRGBColorSpace; renderTargetRef.current = new THREE.WebGLRenderTarget(initialWidth, initialHeight, { minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, format: THREE.RGBAFormat, type: THREE.UnsignedByteType, colorSpace: THREE.SRGBColorSpace }); baseSceneRef.current = new THREE.Scene(); baseCameraRef.current = new THREE.OrthographicCamera(-initialWidth / 2, initialWidth / 2, initialHeight / 2, -initialHeight / 2, 0.1, 10); baseCameraRef.current.position.z = 1; const planeGeometry = new THREE.PlaneGeometry(1, 1); const planeMaterial = new THREE.MeshBasicMaterial({ map: null, side: THREE.DoubleSide, color: 0xffffff }); basePlaneMeshRef.current = new THREE.Mesh(planeGeometry, planeMaterial); basePlaneMeshRef.current.position.z = 0; basePlaneMeshRef.current.scale.set(1, 1, 1); baseSceneRef.current.add(basePlaneMeshRef.current); postSceneRef.current = new THREE.Scene(); postCameraRef.current = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1); const postPlaneGeometry = new THREE.PlaneGeometry(2, 2); postMaterialRef.current = new THREE.ShaderMaterial({ vertexShader: postVertexShader, fragmentShader: postFragmentShader, uniforms: { uSceneTexture: { value: renderTargetRef.current.texture }, uIsStaticImage: { value: false }, uBrightness: { value: 1.0 }, uContrast: { value: 1.0 }, }, depthWrite: false, depthTest: false, }); const postPlaneMesh = new THREE.Mesh(postPlaneGeometry, postMaterialRef.current); postSceneRef.current.add(postPlaneMesh); isInitialized.current = true; console.log("DEBUG: Scene initialization complete."); handleResize(); } catch (error) { console.error("DEBUG: initThreeScene ERROR:", error); }
    }, [handleResize, postVertexShader, postFragmentShader]);

    // --- Effect for Initial Setup / Resize Observer ---
    useEffect(() => { /* ... as before ... */
         initThreeScene(); let resizeObserver; if (canvasRef.current) { resizeObserver = new ResizeObserver(() => { handleResize(); }); resizeObserver.observe(canvasRef.current); } return () => { console.log("DEBUG: Cleanup running..."); resizeObserver?.disconnect(); cancelAnimationFrame(animationFrameHandle.current); isInitialized.current = false; videoTextureRef.current?.dispose(); imageTextureRef.current?.dispose(); renderTargetRef.current?.dispose(); basePlaneMeshRef.current?.geometry?.dispose(); basePlaneMeshRef.current?.material?.map?.dispose(); basePlaneMeshRef.current?.material?.dispose(); postMaterialRef.current?.uniforms?.uSceneTexture?.value?.dispose(); postMaterialRef.current?.dispose(); rendererInstanceRef.current?.dispose(); /* Clear refs */ };
     }, [initThreeScene, handleResize]);

    // --- Scale Base Plane ---
    const fitPlaneToCamera = useCallback((textureWidth, textureHeight) => { /* ... */
        if (!baseCameraRef.current || !basePlaneMeshRef.current || !textureWidth || !textureHeight) return; const canvas = canvasRef.current; if (!canvas) return; const cameraWidth = canvas.clientWidth; const cameraHeight = canvas.clientHeight; if (cameraWidth === 0 || cameraHeight === 0) return; const cameraAspect = cameraWidth / cameraHeight; const textureAspect = textureWidth / textureHeight; let scaleX, scaleY; if (cameraAspect > textureAspect) { scaleY = cameraHeight; scaleX = scaleY * textureAspect; } else { scaleX = cameraWidth; scaleY = scaleX / textureAspect; } basePlaneMeshRef.current.scale.y = scaleY; basePlaneMeshRef.current.scale.x = scaleX;
    }, []);

    // --- Render Loop (Conditional Post-Processing) ---
    const renderLoop = useCallback(() => {
        animationFrameHandle.current = requestAnimationFrame(renderLoop);
        if (!isInitialized.current || !rendererInstanceRef.current || !baseSceneRef.current || !baseCameraRef.current || !postSceneRef.current || !postCameraRef.current || !basePlaneMeshRef.current || !postMaterialRef.current?.uniforms || !renderTargetRef.current) return;

        const sourceElement = currentSourceElement.current;
        const baseMaterial = basePlaneMeshRef.current.material;
        const postUniforms = postMaterialRef.current.uniforms;
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

        // --- 3/4/5. Conditional Rendering ---
        if (usePostProcessing.current) {
            // --- Render Base Scene to Target ---
             if (basePlaneMeshRef.current.scale.x !== 0) { rendererInstanceRef.current.setRenderTarget(renderTargetRef.current); rendererInstanceRef.current.render(baseSceneRef.current, baseCameraRef.current); rendererInstanceRef.current.setRenderTarget(null); }
             else { rendererInstanceRef.current.setRenderTarget(renderTargetRef.current); rendererInstanceRef.current.clear(); rendererInstanceRef.current.setRenderTarget(null); }

            // --- Update Post-Processing Uniforms ---
            postUniforms.uSceneTexture.value = renderTargetRef.current.texture;
            postUniforms.uIsStaticImage.value = isStaticImage.current;
            postUniforms.uBrightness.value = currentBrightness.current;
            postUniforms.uContrast.value = currentContrast.current;

            // --- Render Post-Processing Scene to Screen ---
            rendererInstanceRef.current.render(postSceneRef.current, postCameraRef.current);
        } else {
            // --- Render Base Scene DIRECTLY to Screen ---
            rendererInstanceRef.current.setRenderTarget(null); // Ensure rendering to canvas
            rendererInstanceRef.current.render(baseSceneRef.current, baseCameraRef.current);
        }

    }, [fitPlaneToCamera]);

    // --- Start Render Loop ---
    useEffect(() => { if (isInitialized.current) { cancelAnimationFrame(animationFrameHandle.current); animationFrameHandle.current = requestAnimationFrame(renderLoop); } }, [renderLoop]);

    // --- Expose Methods (Control Post-Processing Flag) ---
    useImperativeHandle(ref, () => ({
        renderResults: (videoElement, results) => { // For Mirror
            currentSourceElement.current = videoElement;
            usePostProcessing.current = false; // *** BYPASS POST-PROCESSING FOR MIRROR ***
            // isStaticImage, brightness, contrast refs are not used when post-processing is off
        },
        renderStaticImageResults: (imageElement, results, brightness, contrast) => { // For Selfie
            console.log("Handle: renderStaticImageResults.", { brightness, contrast });
            currentSourceElement.current = imageElement;
            isStaticImage.current = true; // State ref for post shader
            currentBrightness.current = Math.max(0.1, brightness); // State ref for post shader
            currentContrast.current = Math.max(0.1, contrast); // State ref for post shader
            usePostProcessing.current = true; // *** USE POST-PROCESSING FOR SELFIE ***
        },
        clearCanvas: () => {
             console.log("Handle: Clearing canvas source.");
             currentSourceElement.current = null;
             isStaticImage.current = false;
             usePostProcessing.current = false; // Turn off post-processing when clearing
             // Render loop will clear the texture from baseMaterial.map
        }
    }));

    // --- JSX ---
    return ( <canvas ref={canvasRef} className={`renderer-canvas ${className || ''}`} style={{ display: 'block', width: '100%', height: '100%' }} /> );
});

TryOnRenderer.displayName = 'TryOnRenderer';
export default TryOnRenderer;