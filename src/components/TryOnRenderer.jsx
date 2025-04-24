// src/components/TryOnRenderer.jsx - Explicit Clear Color, Disable Alpha

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
    const postFragmentShader_DEBUG = `void main() { gl_FragColor = vec4(0.0, 0.8, 0.2, 1.0); }`; // Darker Green, Full Alpha

    // --- Handle Resizing ---
    const handleResize = useCallback(() => { /* ... as before ... */
        const canvas = canvasRef.current; if (!rendererInstanceRef.current || !baseCameraRef.current || !postCameraRef.current || !canvas || !renderTargetRef.current) return; const newWidth = canvas.clientWidth; const newHeight = canvas.clientHeight; if (newWidth === 0 || newHeight === 0) return; const currentSize = rendererInstanceRef.current.getSize(new THREE.Vector2()); if (currentSize.x === newWidth && currentSize.y === newHeight) return; /*console.log(`DEBUG: Resizing -> ${newWidth}x${newHeight}`);*/ rendererInstanceRef.current.setSize(newWidth, newHeight); renderTargetRef.current.setSize(newWidth, newHeight); baseCameraRef.current.left = -newWidth / 2; baseCameraRef.current.right = newWidth / 2; baseCameraRef.current.top = newHeight / 2; baseCameraRef.current.bottom = -newHeight / 2; baseCameraRef.current.updateProjectionMatrix();
    }, []);

    // --- Initialize Scene ---
    const initThreeScene = useCallback(() => {
        if (!canvasRef.current || isInitialized.current) return; console.log("DEBUG: initThreeScene START (Post Debug Shader)"); try { const canvas = canvasRef.current; const initialWidth = canvas.clientWidth || 640; const initialHeight = canvas.clientHeight || 480;
        // *** Initialize Renderer WITHOUT alpha ***
        rendererInstanceRef.current = new THREE.WebGLRenderer({ canvas: canvas, antialias: true, alpha: false }); // Alpha false
        // *** Set explicit clear color ***
        rendererInstanceRef.current.setClearColor(0x111111, 1); // Dark Gray, Opaque
        rendererInstanceRef.current.setSize(initialWidth, initialHeight); rendererInstanceRef.current.setPixelRatio(window.devicePixelRatio); rendererInstanceRef.current.outputColorSpace = THREE.SRGBColorSpace;
        renderTargetRef.current = new THREE.WebGLRenderTarget(initialWidth, initialHeight, { minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, format: THREE.RGBAFormat, type: THREE.UnsignedByteType, colorSpace: THREE.SRGBColorSpace });
        baseSceneRef.current = new THREE.Scene(); baseCameraRef.current = new THREE.OrthographicCamera(-initialWidth / 2, initialWidth / 2, initialHeight / 2, -initialHeight / 2, 0.1, 10); baseCameraRef.current.position.z = 1; const planeGeometry = new THREE.PlaneGeometry(1, 1); const planeMaterial = new THREE.MeshBasicMaterial({ map: null, side: THREE.DoubleSide, color: 0xffffff }); basePlaneMeshRef.current = new THREE.Mesh(planeGeometry, planeMaterial); basePlaneMeshRef.current.position.z = 0; basePlaneMeshRef.current.scale.set(1, 1, 1); baseSceneRef.current.add(basePlaneMeshRef.current); postSceneRef.current = new THREE.Scene(); postCameraRef.current = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1); const postPlaneGeometry = new THREE.PlaneGeometry(2, 2);
        postMaterialRef.current = new THREE.ShaderMaterial({ vertexShader: postVertexShader, fragmentShader: postFragmentShader_DEBUG, uniforms: { }, depthWrite: false, depthTest: false, transparent: false }); // Set transparent false
        const postPlaneMesh = new THREE.Mesh(postPlaneGeometry, postMaterialRef.current); postSceneRef.current.add(postPlaneMesh); isInitialized.current = true; console.log("DEBUG: Scene initialized with Post Debug Shader."); handleResize(); } catch (error) { console.error("DEBUG: initThreeScene ERROR:", error); }
    }, [handleResize, postVertexShader, postFragmentShader_DEBUG]);

    // --- Effect for Initial Setup / Resize Observer ---
    useEffect(() => { /* ... as before ... */ initThreeScene(); let rO; if (canvasRef.current) {rO = new ResizeObserver(handleResize); rO.observe(canvasRef.current);} return () => { console.log("DEBUG: Cleanup..."); rO?.disconnect(); cancelAnimationFrame(animationFrameHandle.current); /* ... full cleanup ... */ }; }, [initThreeScene, handleResize]);

    // --- Scale Base Plane ---
    const fitPlaneToCamera = useCallback((textureWidth, textureHeight) => { /* ... as before ... */ if (!baseCameraRef.current || !basePlaneMeshRef.current || !textureWidth || !textureHeight) return; const canvas = canvasRef.current; if (!canvas) return; const cameraWidth = canvas.clientWidth; const cameraHeight = canvas.clientHeight; if (cameraWidth === 0 || cameraHeight === 0) return; const cameraAspect = cameraWidth / cameraHeight; const textureAspect = textureWidth / textureHeight; let scaleX, scaleY; if (cameraAspect > textureAspect) { scaleY = cameraHeight; scaleX = scaleY * textureAspect; } else { scaleX = cameraWidth; scaleY = scaleX / textureAspect; } basePlaneMeshRef.current.scale.y = scaleY; basePlaneMeshRef.current.scale.x = scaleX; }, []);

    // --- Render Loop ---
    const renderLoop = useCallback(() => {
        animationFrameHandle.current = requestAnimationFrame(renderLoop);
        if (!isInitialized.current || !rendererInstanceRef.current || !baseSceneRef.current || !baseCameraRef.current || !postSceneRef.current || !postCameraRef.current || !basePlaneMeshRef.current || !renderTargetRef.current ) return;
        const sourceElement = currentSourceElement.current; const baseMaterial = basePlaneMeshRef.current.material; let sourceWidth = 0, sourceHeight = 0; let isVideo = sourceElement instanceof HTMLVideoElement; let textureToAssign = null;
        /* ... texture update logic ... */ if (isVideo && sourceElement.readyState >= 2) { sourceWidth = sourceElement.videoWidth; sourceHeight = sourceElement.videoHeight; if (videoTextureRef.current?.image !== sourceElement) { videoTextureRef.current?.dispose(); videoTextureRef.current = new THREE.VideoTexture(sourceElement); videoTextureRef.current.colorSpace = THREE.SRGBColorSpace; } textureToAssign = videoTextureRef.current; } else if (isImage && sourceElement.complete && sourceElement.naturalWidth > 0) { sourceWidth = sourceElement.naturalWidth; sourceHeight = sourceElement.naturalHeight; if (imageTextureRef.current?.image !== sourceElement) { imageTextureRef.current?.dispose(); imageTextureRef.current = new THREE.Texture(sourceElement); imageTextureRef.current.colorSpace = THREE.SRGBColorSpace; imageTextureRef.current.needsUpdate = true; } else { imageTextureRef.current.needsUpdate = true; } textureToAssign = imageTextureRef.current; } else { textureToAssign = null; if(videoTextureRef.current) { videoTextureRef.current.dispose(); videoTextureRef.current = null;} if(imageTextureRef.current) { imageTextureRef.current.dispose(); imageTextureRef.current = null;} } if (baseMaterial.map !== textureToAssign) { baseMaterial.map = textureToAssign; baseMaterial.needsUpdate = true; }
        /* ... scaling logic ... */ if (baseMaterial.map && sourceWidth > 0 && sourceHeight > 0) { fitPlaneToCamera(sourceWidth, sourceHeight); basePlaneMeshRef.current.scale.x = Math.abs(basePlaneMeshRef.current.scale.x) * (isVideo ? -1 : 1); } else { if (basePlaneMeshRef.current.scale.x !== 0) { basePlaneMeshRef.current.scale.set(0,0,0); } }

        // --- Conditional Rendering ---
        if (isStaticImage.current) { // USE POST-PROCESSING FOR STATIC
             if (basePlaneMeshRef.current.scale.x !== 0) { rendererInstanceRef.current.setRenderTarget(renderTargetRef.current); rendererInstanceRef.current.render(baseSceneRef.current, baseCameraRef.current); rendererInstanceRef.current.setRenderTarget(null); }
             else { rendererInstanceRef.current.setRenderTarget(renderTargetRef.current); rendererInstanceRef.current.clear(); rendererInstanceRef.current.setRenderTarget(null); }
             // Render Post Scene (Debug Shader)
             rendererInstanceRef.current.render(postSceneRef.current, postCameraRef.current);
        } else { // DIRECT RENDER FOR MIRROR/PREVIEW
             rendererInstanceRef.current.setRenderTarget(null);
             rendererInstanceRef.current.render(baseSceneRef.current, baseCameraRef.current);
        }
    }, [fitPlaneToCamera]);

    // --- Start Render Loop ---
    useEffect(() => { if (isInitialized.current) { cancelAnimationFrame(animationFrameHandle.current); animationFrameHandle.current = requestAnimationFrame(renderLoop); } }, [renderLoop]);

    // --- Expose Methods ---
    useImperativeHandle(ref, () => ({
        renderResults: (videoElement, results) => { currentSourceElement.current = videoElement; isStaticImage.current = false; },
        renderStaticImageResults: (imageElement, results, brightness, contrast) => { console.log("Handle: renderStaticImageResults (Post Debug Test)."); currentSourceElement.current = imageElement; isStaticImage.current = true; },
        clearCanvas: () => { console.log("Handle: Clearing canvas source."); currentSourceElement.current = null; isStaticImage.current = false; /* Render loop clears base map */ }
    }));

    // --- JSX ---
    return ( <canvas ref={canvasRef} className={`renderer-canvas ${className || ''}`} style={{ display: 'block', width: '100%', height: '100%' }} /> ); // Removed bg color
});

TryOnRenderer.displayName = 'TryOnRenderer';
export default TryOnRenderer;