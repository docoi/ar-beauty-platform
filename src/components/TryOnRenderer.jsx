// src/components/TryOnRenderer.jsx - Robust Init & Loop Start

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
    const postSceneRef = useRef(null);
    const postCameraRef = useRef(null);
    const postMaterialRef = useRef(null);
    const renderTargetRef = useRef(null);
    const currentSourceElement = useRef(null);
    const isStaticImage = useRef(false);

    // --- Shaders ---
    const postVertexShader = `varying vec2 vUv; void main() { vUv = uv; gl_Position = vec4(position, 1.0); }`;
    const postFragmentShader_DEBUG = `void main() { gl_FragColor = vec4(0.0, 0.8, 0.2, 1.0); }`; // Darker Green

    // --- Handle Resizing ---
    const handleResize = useCallback(() => {
        const canvas = canvasRef.current; if (!rendererInstanceRef.current || !baseCameraRef.current || !postCameraRef.current || !canvas || !renderTargetRef.current) return; const newWidth = canvas.clientWidth; const newHeight = canvas.clientHeight; if (newWidth === 0 || newHeight === 0) return; const currentSize = rendererInstanceRef.current.getSize(new THREE.Vector2()); if (currentSize.x === newWidth && currentSize.y === newHeight) return; console.log(`DEBUG: Resizing -> ${newWidth}x${newHeight}`); try {rendererInstanceRef.current.setSize(newWidth, newHeight); renderTargetRef.current.setSize(newWidth, newHeight); baseCameraRef.current.left = -newWidth / 2; baseCameraRef.current.right = newWidth / 2; baseCameraRef.current.top = newHeight / 2; baseCameraRef.current.bottom = -newHeight / 2; baseCameraRef.current.updateProjectionMatrix(); } catch(e) { console.error("Resize Error:", e); }
    }, []);

    // --- Render Loop ---
    const renderLoop = useCallback(() => {
        animationFrameHandle.current = requestAnimationFrame(renderLoop); // Schedule next frame first

        // Strict check for initialization AND required objects
        if (!isInitialized.current || !rendererInstanceRef.current || !baseSceneRef.current || !baseCameraRef.current || !postSceneRef.current || !postCameraRef.current || !basePlaneMeshRef.current || !renderTargetRef.current ) {
             // console.log("RenderLoop waiting for init..."); // Reduce noise
             return;
        }

        try { // Wrap entire loop body
            const sourceElement = currentSourceElement.current;
            const baseMaterial = basePlaneMeshRef.current.material;
            const postMaterial = postMaterialRef.current; // Use postMaterialRef here
            let sourceWidth = 0, sourceHeight = 0;
            let isVideo = sourceElement instanceof HTMLVideoElement;
            let textureToAssign = null;

            // --- 1. Update Base Scene Texture ---
            if (isVideo && sourceElement.readyState >= 2) { /* video texture */ sourceWidth = sourceElement.videoWidth; sourceHeight = sourceElement.videoHeight; if (videoTextureRef.current?.image !== sourceElement) { videoTextureRef.current?.dispose(); videoTextureRef.current = new THREE.VideoTexture(sourceElement); videoTextureRef.current.colorSpace = THREE.SRGBColorSpace; } textureToAssign = videoTextureRef.current; }
            else if (isImage && sourceElement.complete && sourceElement.naturalWidth > 0) { /* image texture */ sourceWidth = sourceElement.naturalWidth; sourceHeight = sourceElement.naturalHeight; if (imageTextureRef.current?.image !== sourceElement) { imageTextureRef.current?.dispose(); imageTextureRef.current = new THREE.Texture(sourceElement); imageTextureRef.current.colorSpace = THREE.SRGBColorSpace; imageTextureRef.current.needsUpdate = true; } else { imageTextureRef.current.needsUpdate = true; } textureToAssign = imageTextureRef.current; }
            else { /* no source / clear */ textureToAssign = null; if(videoTextureRef.current) { videoTextureRef.current.dispose(); videoTextureRef.current = null;} if(imageTextureRef.current) { imageTextureRef.current.dispose(); imageTextureRef.current = null;} }
            if (baseMaterial && baseMaterial.map !== textureToAssign) { baseMaterial.map = textureToAssign; baseMaterial.needsUpdate = true; }

            // --- 2. Update Base Plane Scale & Mirroring ---
             if (baseMaterial?.map && sourceWidth > 0 && sourceHeight > 0) { fitPlaneToCamera(sourceWidth, sourceHeight); basePlaneMeshRef.current.scale.x = Math.abs(basePlaneMeshRef.current.scale.x) * (isVideo ? -1 : 1); }
             else { if (basePlaneMeshRef.current?.scale.x !== 0) { basePlaneMeshRef.current.scale.set(0,0,0); } }

            // --- 3/4/5. Conditional Final Render ---
            if (isStaticImage.current) { // Use Post-Processing path for Static Image
                 // Render Base Scene to Target
                 if (basePlaneMeshRef.current.scale.x !== 0) { rendererInstanceRef.current.setRenderTarget(renderTargetRef.current); rendererInstanceRef.current.render(baseSceneRef.current, baseCameraRef.current); rendererInstanceRef.current.setRenderTarget(null); }
                 else { rendererInstanceRef.current.setRenderTarget(renderTargetRef.current); rendererInstanceRef.current.clear(); rendererInstanceRef.current.setRenderTarget(null); }

                 // Check post material exists before accessing uniforms
                 if (postMaterial && postMaterial.uniforms && renderTargetRef.current) {
                     postMaterial.uniforms.uSceneTexture.value = renderTargetRef.current.texture;
                 } else {
                      console.error("Post material or uniforms missing!");
                 }

                 // Render Post-Processing Scene (with debug shader) to Screen
                 rendererInstanceRef.current.render(postSceneRef.current, postCameraRef.current);
            } else { // DIRECT RENDER FOR MIRROR/PREVIEW
                 rendererInstanceRef.current.setRenderTarget(null);
                 rendererInstanceRef.current.render(baseSceneRef.current, baseCameraRef.current);
            }
        } catch (loopError) {
             console.error("!!! RENDER LOOP ERROR:", loopError);
             cancelAnimationFrame(animationFrameHandle.current); // Stop loop on error
        }

    }, [fitPlaneToCamera]);


    // --- Initialize Scene ---
    const initThreeScene = useCallback(() => {
        if (!canvasRef.current || isInitialized.current) {
             console.log(`DEBUG: Skipping init (Canvas: ${!!canvasRef.current}, Initialized: ${isInitialized.current})`);
             return;
        }
        console.log("DEBUG: initThreeScene START (Post Debug Shader)");
        try {
            const canvas = canvasRef.current; const initialWidth = canvas.clientWidth || 640; const initialHeight = canvas.clientHeight || 480;
            rendererInstanceRef.current = new THREE.WebGLRenderer({ canvas: canvas, antialias: true, alpha: false }); rendererInstanceRef.current.setClearColor(0x111111, 1); rendererInstanceRef.current.setSize(initialWidth, initialHeight); rendererInstanceRef.current.setPixelRatio(window.devicePixelRatio); rendererInstanceRef.current.outputColorSpace = THREE.SRGBColorSpace;
            renderTargetRef.current = new THREE.WebGLRenderTarget(initialWidth, initialHeight, { minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, format: THREE.RGBAFormat, type: THREE.UnsignedByteType, colorSpace: THREE.SRGBColorSpace });
            baseSceneRef.current = new THREE.Scene(); baseCameraRef.current = new THREE.OrthographicCamera(-initialWidth / 2, initialWidth / 2, initialHeight / 2, -initialHeight / 2, 0.1, 10); baseCameraRef.current.position.z = 1; const planeGeometry = new THREE.PlaneGeometry(1, 1); const planeMaterial = new THREE.MeshBasicMaterial({ map: null, side: THREE.DoubleSide, color: 0xffffff }); basePlaneMeshRef.current = new THREE.Mesh(planeGeometry, planeMaterial); basePlaneMeshRef.current.position.z = 0; basePlaneMeshRef.current.scale.set(1, 1, 1); baseSceneRef.current.add(basePlaneMeshRef.current); postSceneRef.current = new THREE.Scene(); postCameraRef.current = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1); const postPlaneGeometry = new THREE.PlaneGeometry(2, 2);
            postMaterialRef.current = new THREE.ShaderMaterial({ vertexShader: postVertexShader, fragmentShader: postFragmentShader_DEBUG, uniforms: { uSceneTexture: { value: renderTargetRef.current.texture } }, depthWrite: false, depthTest: false, transparent: false }); // Only texture uniform needed for debug shader
            const postPlaneMesh = new THREE.Mesh(postPlaneGeometry, postMaterialRef.current); postSceneRef.current.add(postPlaneMesh);

            isInitialized.current = true; // Set flag only AFTER all objects are created
            console.log("DEBUG: Scene initialization COMPLETE.");
            handleResize(); // Initial resize

            // *** Start render loop AFTER successful initialization ***
            console.log("DEBUG: Requesting first render loop frame.");
            cancelAnimationFrame(animationFrameHandle.current); // Clear any previous handle
            animationFrameHandle.current = requestAnimationFrame(renderLoop);

        } catch (error) { console.error("DEBUG: initThreeScene ERROR:", error); }
    }, [handleResize, postVertexShader, postFragmentShader_DEBUG, renderLoop]); // Add renderLoop dependency


    // --- Effect for Initial Setup / Resize Observer ---
    useEffect(() => {
         console.log("DEBUG: Mount/Init effect running.");
         initThreeScene(); // Attempt initialization

         let resizeObserver;
         const currentCanvas = canvasRef.current; // Capture ref value for cleanup
         if (currentCanvas) {
             resizeObserver = new ResizeObserver(() => { handleResize(); });
             resizeObserver.observe(currentCanvas);
             console.log("DEBUG: ResizeObserver attached.");
         }

         return () => {
             console.log("DEBUG: Cleanup running...");
             resizeObserver?.disconnect(currentCanvas); // Use captured value
             cancelAnimationFrame(animationFrameHandle.current);
             isInitialized.current = false;
             // ... full cleanup of Three resources ...
             videoTextureRef.current?.dispose(); imageTextureRef.current?.dispose(); renderTargetRef.current?.dispose(); basePlaneMeshRef.current?.geometry?.dispose(); basePlaneMeshRef.current?.material?.map?.dispose(); basePlaneMeshRef.current?.material?.dispose(); postMaterialRef.current?.uniforms?.uSceneTexture?.value?.dispose(); postMaterialRef.current?.dispose(); rendererInstanceRef.current?.dispose();
             videoTextureRef.current = null; imageTextureRef.current = null; renderTargetRef.current = null; basePlaneMeshRef.current = null; postMaterialRef.current = null; baseSceneRef.current = null; baseCameraRef.current = null; postSceneRef.current = null; postCameraRef.current = null; rendererInstanceRef.current = null; currentSourceElement.current = null;
             console.log("DEBUG: Cleanup finished.");
        };
    // initThreeScene is memoized with useCallback
    }, [initThreeScene, handleResize]); // Dependencies for setup


    // --- Scale Base Plane ---
    const fitPlaneToCamera = useCallback((textureWidth, textureHeight) => { /* ... as before ... */ if (!baseCameraRef.current || !basePlaneMeshRef.current || !textureWidth || !textureHeight) return; const canvas = canvasRef.current; if (!canvas) return; const cameraWidth = canvas.clientWidth; const cameraHeight = canvas.clientHeight; if (cameraWidth === 0 || cameraHeight === 0) return; const cameraAspect = cameraWidth / cameraHeight; const textureAspect = textureWidth / textureHeight; let scaleX, scaleY; if (cameraAspect > textureAspect) { scaleY = cameraHeight; scaleX = scaleY * textureAspect; } else { scaleX = cameraWidth; scaleY = scaleX / textureAspect; } basePlaneMeshRef.current.scale.y = scaleY; basePlaneMeshRef.current.scale.x = scaleX; }, []);


    // --- Expose Methods ---
    useImperativeHandle(ref, () => ({
        renderResults: (videoElement, results) => { currentSourceElement.current = videoElement; isStaticImage.current = false; },
        renderStaticImageResults: (imageElement, results, brightness, contrast) => { console.log("Handle: renderStaticImageResults (Post Debug Test)."); currentSourceElement.current = imageElement; isStaticImage.current = true; },
        clearCanvas: () => { console.log("Handle: Clearing canvas source."); currentSourceElement.current = null; isStaticImage.current = false; }
    }));

    // --- JSX ---
    return ( <canvas ref={canvasRef} className={`renderer-canvas ${className || ''}`} style={{ display: 'block', width: '100%', height: '100%' }} /> );
});

TryOnRenderer.displayName = 'TryOnRenderer';
export default TryOnRenderer;