// src/components/TryOnRenderer.jsx - Implement Post-Processing

import React, { useRef, useImperativeHandle, forwardRef, useEffect, useCallback } from 'react';
import * as THREE from 'three';

console.log(`Using Three.js revision: ${THREE.REVISION}`);

const TryOnRenderer = forwardRef(({ videoWidth, videoHeight, className }, ref) => {
    // Core Refs
    const canvasRef = useRef(null);
    const rendererInstanceRef = useRef(null);
    const animationFrameHandle = useRef(null);
    const isInitialized = useRef(false);

    // Scene 1 (Base: Video/Image Plane)
    const baseSceneRef = useRef(null);
    const baseCameraRef = useRef(null);
    const basePlaneMeshRef = useRef(null); // Mesh with MeshBasicMaterial
    const videoTextureRef = useRef(null);
    const imageTextureRef = useRef(null);

    // Scene 2 (Post-Processing: Fullscreen Quad + Effect Shader)
    const postSceneRef = useRef(null);
    const postCameraRef = useRef(null); // Simple orthographic for fullscreen quad
    const postMaterialRef = useRef(null); // ShaderMaterial for effects

    // Off-screen Render Target
    const renderTargetRef = useRef(null);

    // State Refs (Updated by imperative handles, read by render loop)
    const currentSourceElement = useRef(null);
    const isStaticImage = useRef(false);
    const currentBrightness = useRef(1.5); // Default correction values
    const currentContrast = useRef(1.1);
    // Add refs for results later if needed for effects
    // const currentMediaPipeResults = useRef(null);

    // --- Shaders ---
    // Shader for post-processing pass (applies correction/effects)
    const postVertexShader = `
        varying vec2 vUv;
        void main() {
            vUv = uv;
            gl_Position = vec4(position, 1.0); // Position is already -1 to 1
        }
    `;
    const postFragmentShader = `
        uniform sampler2D uSceneTexture; // Texture from the first render pass
        uniform bool uIsStaticImage;
        uniform float uBrightness;
        uniform float uContrast;
        varying vec2 vUv;

        vec3 contrastAdjust(vec3 color, float value) { return 0.5 + value * (color - 0.5); }

        void main() {
            vec4 sceneColor = texture2D(uSceneTexture, vUv);

            // Apply correction only if it's the static image
            if (uIsStaticImage) {
                sceneColor.rgb *= uBrightness;
                sceneColor.rgb = contrastAdjust(sceneColor.rgb, uContrast);
                sceneColor.rgb = clamp(sceneColor.rgb, 0.0, 1.0);
            }

            // TODO: Apply serum/makeup effects here based on segmentation/landmarks
            // if (isSkinPixel) { sceneColor.rgb = applySerumEffect(sceneColor.rgb); }

            gl_FragColor = sceneColor;
        }
    `;

    // --- Handle Resizing ---
    const handleResize = useCallback(() => {
        const canvas = canvasRef.current;
        if (!rendererInstanceRef.current || !baseCameraRef.current || !postCameraRef.current || !canvas) return;
        const newWidth = canvas.clientWidth; const newHeight = canvas.clientHeight;
        if (newWidth === 0 || newHeight === 0) return;
        const currentSize = rendererInstanceRef.current.getSize(new THREE.Vector2());
        if (currentSize.x === newWidth && currentSize.y === newHeight) return;

        console.log(`DEBUG: Resizing -> ${newWidth}x${newHeight}`);
        rendererInstanceRef.current.setSize(newWidth, newHeight); // Resize renderer
        renderTargetRef.current?.setSize(newWidth, newHeight); // Resize render target

        // Update base camera
        baseCameraRef.current.left = -newWidth / 2; baseCameraRef.current.right = newWidth / 2;
        baseCameraRef.current.top = newHeight / 2; baseCameraRef.current.bottom = -newHeight / 2;
        baseCameraRef.current.updateProjectionMatrix();

        // Post camera usually doesn't need update if using simple quad
        // postCameraRef.current.updateProjectionMatrix();

    }, []);

    // --- Initialize Scene ---
    const initThreeScene = useCallback(() => {
        if (!canvasRef.current || isInitialized.current) return;
        console.log("DEBUG: initThreeScene START (Post-Processing)");
        try {
            const canvas = canvasRef.current; const initialWidth = canvas.clientWidth || 640; const initialHeight = canvas.clientHeight || 480;

            // --- Renderer ---
            rendererInstanceRef.current = new THREE.WebGLRenderer({ canvas: canvas, antialias: true });
            rendererInstanceRef.current.setSize(initialWidth, initialHeight);
            rendererInstanceRef.current.setPixelRatio(window.devicePixelRatio);
            rendererInstanceRef.current.outputColorSpace = THREE.SRGBColorSpace;

            // --- Render Target ---
            renderTargetRef.current = new THREE.WebGLRenderTarget(initialWidth, initialHeight, {
                minFilter: THREE.LinearFilter, // Or NearestFilter
                magFilter: THREE.LinearFilter,
                format: THREE.RGBAFormat, // Or RGBFormat
                type: THREE.UnsignedByteType, // Common type
                colorSpace: THREE.SRGBColorSpace // Match output
            });
            console.log("DEBUG: RenderTarget created.");

            // --- Base Scene (Scene 1) ---
            baseSceneRef.current = new THREE.Scene();
            baseCameraRef.current = new THREE.OrthographicCamera(-initialWidth / 2, initialWidth / 2, initialHeight / 2, -initialHeight / 2, 0.1, 10);
            baseCameraRef.current.position.z = 1;
            const planeGeometry = new THREE.PlaneGeometry(1, 1);
            const planeMaterial = new THREE.MeshBasicMaterial({ map: null, side: THREE.DoubleSide, color: 0xffffff }); // Use MeshBasicMaterial here
            basePlaneMeshRef.current = new THREE.Mesh(planeGeometry, planeMaterial);
            basePlaneMeshRef.current.position.z = 0;
            basePlaneMeshRef.current.scale.set(1, 1, 1);
            baseSceneRef.current.add(basePlaneMeshRef.current);
            console.log("DEBUG: Base scene created.");

            // --- Post-Processing Scene (Scene 2) ---
            postSceneRef.current = new THREE.Scene();
            // Simple camera for fullscreen quad
            postCameraRef.current = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
            // Fullscreen Quad geometry (covers -1 to 1 in X and Y)
            const postPlaneGeometry = new THREE.PlaneGeometry(2, 2);
            postMaterialRef.current = new THREE.ShaderMaterial({ // Use ShaderMaterial here
                vertexShader: postVertexShader,
                fragmentShader: postFragmentShader,
                uniforms: {
                    uSceneTexture: { value: renderTargetRef.current.texture }, // Use RT texture
                    uIsStaticImage: { value: false },
                    uBrightness: { value: currentBrightness.current }, // Use ref's initial value
                    uContrast: { value: currentContrast.current },
                    // Add uniforms for results later (e.g., segmentation mask texture)
                    // uSegmentationMask: { value: null },
                },
                depthWrite: false, // No need to write depth for post-processing quad
                depthTest: false,
            });
            const postPlaneMesh = new THREE.Mesh(postPlaneGeometry, postMaterialRef.current);
            postSceneRef.current.add(postPlaneMesh);
            console.log("DEBUG: Post-processing scene created.");

            isInitialized.current = true; console.log("DEBUG: Scene initialization complete.");
            handleResize(); // Set initial sizes correctly
        } catch (error) { console.error("DEBUG: initThreeScene ERROR:", error); }
    }, [handleResize, postVertexShader, postFragmentShader]);

    // --- Effect for Initial Setup / Resize Observer ---
    useEffect(() => {
        initThreeScene(); let resizeObserver; if (canvasRef.current) { resizeObserver = new ResizeObserver(() => { handleResize(); }); resizeObserver.observe(canvasRef.current); }
        return () => { /* ... cleanup ... */ console.log("DEBUG: Cleanup running..."); resizeObserver?.disconnect(); cancelAnimationFrame(animationFrameHandle.current); isInitialized.current = false; videoTextureRef.current?.dispose(); imageTextureRef.current?.dispose(); renderTargetRef.current?.dispose(); basePlaneMeshRef.current?.geometry?.dispose(); basePlaneMeshRef.current?.material?.map?.dispose(); basePlaneMeshRef.current?.material?.dispose(); postMaterialRef.current?.uniforms?.uSceneTexture?.value?.dispose(); postMaterialRef.current?.dispose(); rendererInstanceRef.current?.dispose(); /* Clear refs */ };
    }, [initThreeScene, handleResize]);

    // --- Scale Base Plane ---
    const fitPlaneToCamera = useCallback((textureWidth, textureHeight) => {
        if (!baseCameraRef.current || !basePlaneMeshRef.current || !textureWidth || !textureHeight) return; const canvas = canvasRef.current; if (!canvas) return; const cameraWidth = canvas.clientWidth; const cameraHeight = canvas.clientHeight; if (cameraWidth === 0 || cameraHeight === 0) return; const cameraAspect = cameraWidth / cameraHeight; const textureAspect = textureWidth / textureHeight; let scaleX, scaleY; if (cameraAspect > textureAspect) { scaleY = cameraHeight; scaleX = scaleY * textureAspect; } else { scaleX = cameraWidth; scaleY = scaleX / textureAspect; } basePlaneMeshRef.current.scale.y = scaleY; basePlaneMeshRef.current.scale.x = scaleX;
    }, []);

    // --- Render Loop ---
    const renderLoop = useCallback(() => {
        animationFrameHandle.current = requestAnimationFrame(renderLoop);
        if (!isInitialized.current || !rendererInstanceRef.current || !baseSceneRef.current || !baseCameraRef.current || !postSceneRef.current || !postCameraRef.current || !basePlaneMeshRef.current || !postMaterialRef.current?.uniforms) return; // Check all required refs

        const sourceElement = currentSourceElement.current;
        const baseMaterial = basePlaneMeshRef.current.material; // MeshBasicMaterial
        const postUniforms = postMaterialRef.current.uniforms; // ShaderMaterial uniforms
        let sourceWidth = 0, sourceHeight = 0;
        let isVideo = sourceElement instanceof HTMLVideoElement;
        let isImage = sourceElement instanceof HTMLImageElement;

        // --- 1. Update Base Scene Texture ---
        let textureToAssign = null;
        if (isVideo && sourceElement.readyState >= 2) {
            sourceWidth = sourceElement.videoWidth; sourceHeight = sourceElement.videoHeight;
            if (videoTextureRef.current?.image !== sourceElement) { videoTextureRef.current?.dispose(); videoTextureRef.current = new THREE.VideoTexture(sourceElement); videoTextureRef.current.colorSpace = THREE.SRGBColorSpace; }
            textureToAssign = videoTextureRef.current;
        } else if (isImage && sourceElement.complete && sourceElement.naturalWidth > 0) {
             sourceWidth = sourceElement.naturalWidth; sourceHeight = sourceElement.naturalHeight;
             if (imageTextureRef.current?.image !== sourceElement) { imageTextureRef.current?.dispose(); imageTextureRef.current = new THREE.Texture(sourceElement); imageTextureRef.current.colorSpace = THREE.SRGBColorSpace; imageTextureRef.current.needsUpdate = true; } else { imageTextureRef.current.needsUpdate = true; }
             textureToAssign = imageTextureRef.current;
        } else { textureToAssign = null; if(videoTextureRef.current) { videoTextureRef.current.dispose(); videoTextureRef.current = null;} if(imageTextureRef.current) { imageTextureRef.current.dispose(); imageTextureRef.current = null;} }

        if (baseMaterial.map !== textureToAssign) { baseMaterial.map = textureToAssign; baseMaterial.needsUpdate = true; }

        // --- 2. Update Base Plane Scale & Mirroring ---
        if (baseMaterial.map && sourceWidth > 0 && sourceHeight > 0) { fitPlaneToCamera(sourceWidth, sourceHeight); basePlaneMeshRef.current.scale.x = Math.abs(basePlaneMeshRef.current.scale.x) * (isVideo ? -1 : 1); }
        else { if (basePlaneMeshRef.current.scale.x !== 0) { basePlaneMeshRef.current.scale.set(0,0,0); } }

        // --- 3. Render Base Scene to Render Target ---
        rendererInstanceRef.current.setRenderTarget(renderTargetRef.current);
        rendererInstanceRef.current.render(baseSceneRef.current, baseCameraRef.current);

        // --- 4. Update Post-Processing Uniforms ---
        postUniforms.uSceneTexture.value = renderTargetRef.current.texture; // Assign RT texture
        postUniforms.uIsStaticImage.value = isImage && sourceWidth > 0; // Update flag
        postUniforms.uBrightness.value = currentBrightness.current; // Update correction values
        postUniforms.uContrast.value = currentContrast.current;
        // Update other effect uniforms here based on currentMediaPipeResults.current

        // --- 5. Render Post-Processing Scene to Screen ---
        rendererInstanceRef.current.setRenderTarget(null); // Render to canvas
        rendererInstanceRef.current.render(postSceneRef.current, postCameraRef.current);

    }, [fitPlaneToCamera]); // Include dependency

    // --- Start Render Loop ---
    useEffect(() => { if (isInitialized.current) { cancelAnimationFrame(animationFrameHandle.current); animationFrameHandle.current = requestAnimationFrame(renderLoop); } }, [renderLoop]);

    // --- Expose Methods ---
    useImperativeHandle(ref, () => ({
        renderResults: (videoElement, results) => {
            currentSourceElement.current = videoElement;
            isStaticImage.current = false; // Update state ref
            // currentMediaPipeResults.current = results; // Store results later
        },
        renderStaticImageResults: (imageElement, results, brightness, contrast) => {
            console.log("Handle: renderStaticImageResults.");
            currentSourceElement.current = imageElement;
            isStaticImage.current = true; // Update state ref
            currentBrightness.current = brightness; // Update correction refs
            currentContrast.current = contrast;
            // currentMediaPipeResults.current = results; // Store results later
        },
        clearCanvas: () => {
             console.log("Handle: Clearing canvas source.");
             currentSourceElement.current = null;
             isStaticImage.current = false;
             // currentMediaPipeResults.current = null;
             // The render loop will clear the texture uniform
        }
    }));

    // --- JSX ---
    return ( <canvas ref={canvasRef} className={`renderer-canvas ${className || ''}`} style={{ display: 'block', width: '100%', height: '100%' }} /> );
});

TryOnRenderer.displayName = 'TryOnRenderer';
export default TryOnRenderer;