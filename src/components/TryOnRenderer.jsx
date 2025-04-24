// src/components/TryOnRenderer.jsx - ABSOLUTE MINIMAL Texture Logic in Loop

import React, { useRef, useImperativeHandle, forwardRef, useEffect, useCallback } from 'react';
import * as THREE from 'three';

console.log(`Using Three.js revision: ${THREE.REVISION}`);

const TryOnRenderer = forwardRef(({ videoWidth, videoHeight, className }, ref) => {
    const canvasRef = useRef(null);
    const rendererInstanceRef = useRef(null);
    const sceneRef = useRef(null);
    const cameraRef = useRef(null);
    const planeMeshRef = useRef(null);
    const currentSourceElement = useRef(null); // Stores the CURRENT source (video OR image)
    const isInitialized = useRef(false);
    const animationFrameHandle = useRef(null);
    const currentTexture = useRef(null); // Ref to hold the single active texture

    // --- Minimal Shaders ---
    const vertexShader = `varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;
    const fragmentShader = `uniform sampler2D uTexture; varying vec2 vUv; void main() { gl_FragColor = texture2D(uTexture, vUv); }`;

    // --- Handle Resizing ---
    const handleResize = useCallback(() => {
        const canvas = canvasRef.current; if (!rendererInstanceRef.current || !cameraRef.current || !canvas) return; const newWidth = canvas.clientWidth; const newHeight = canvas.clientHeight; if (newWidth === 0 || newHeight === 0) return; const currentSize = rendererInstanceRef.current.getSize(new THREE.Vector2()); if (currentSize.x === newWidth && currentSize.y === newHeight) return; rendererInstanceRef.current.setSize(newWidth, newHeight); cameraRef.current.left = -newWidth / 2; cameraRef.current.right = newWidth / 2; cameraRef.current.top = newHeight / 2; cameraRef.current.bottom = -newHeight / 2; cameraRef.current.updateProjectionMatrix();
    }, []);

    // --- Initialize Scene ---
    const initThreeScene = useCallback(() => {
        if (!canvasRef.current || isInitialized.current) return; console.log("Minimal Renderer: initThreeScene START"); try { const canvas = canvasRef.current; const initialWidth = canvas.clientWidth || 640; const initialHeight = canvas.clientHeight || 480; sceneRef.current = new THREE.Scene(); cameraRef.current = new THREE.OrthographicCamera(-initialWidth / 2, initialWidth / 2, initialHeight / 2, -initialHeight / 2, 0.1, 10); cameraRef.current.position.z = 1; sceneRef.current.add(cameraRef.current); rendererInstanceRef.current = new THREE.WebGLRenderer({ canvas: canvas, antialias: true }); rendererInstanceRef.current.setSize(initialWidth, initialHeight); rendererInstanceRef.current.setPixelRatio(window.devicePixelRatio); rendererInstanceRef.current.outputColorSpace = THREE.SRGBColorSpace; const planeGeometry = new THREE.PlaneGeometry(1, 1);
        // Use MeshBasicMaterial only
        const planeMaterial = new THREE.MeshBasicMaterial({ map: null, side: THREE.DoubleSide, color: 0xffffff }); // White base
        planeMeshRef.current = new THREE.Mesh(planeGeometry, planeMaterial); planeMeshRef.current.position.z = 0; planeMeshRef.current.scale.set(1, 1, 1); sceneRef.current.add(planeMeshRef.current); isInitialized.current = true; console.log("Minimal Renderer: Scene initialized."); handleResize(); } catch (error) { console.error("Minimal Renderer: initThreeScene ERROR:", error); }
    }, [handleResize]); // Removed shader dependencies

    // --- Effect for Initial Setup / Resize Observer ---
    useEffect(() => {
        initThreeScene(); let resizeObserver; if (canvasRef.current) { resizeObserver = new ResizeObserver(() => { handleResize(); }); resizeObserver.observe(canvasRef.current); }
        return () => { console.log("Minimal Renderer: Cleanup running..."); resizeObserver?.disconnect(); cancelAnimationFrame(animationFrameHandle.current); isInitialized.current = false; currentTexture.current?.dispose(); planeMeshRef.current?.geometry?.dispose(); planeMeshRef.current?.material?.map?.dispose(); planeMeshRef.current?.material?.dispose(); rendererInstanceRef.current?.dispose(); /* Clear refs */ };
    }, [initThreeScene, handleResize]);

    // --- Scale Plane ---
    const fitPlaneToCamera = useCallback((textureWidth, textureHeight) => {
        if (!cameraRef.current || !planeMeshRef.current || !textureWidth || !textureHeight) return; const canvas = canvasRef.current; if (!canvas) return; const cameraWidth = canvas.clientWidth; const cameraHeight = canvas.clientHeight; if (cameraWidth === 0 || cameraHeight === 0) return; const cameraAspect = cameraWidth / cameraHeight; const textureAspect = textureWidth / textureHeight; let scaleX, scaleY; if (cameraAspect > textureAspect) { scaleY = cameraHeight; scaleX = scaleY * textureAspect; } else { scaleX = cameraWidth; scaleY = scaleX / textureAspect; } planeMeshRef.current.scale.y = scaleY; planeMeshRef.current.scale.x = scaleX;
    }, []);

    // --- Render Loop (Minimal Texture Logic) ---
    const renderLoop = useCallback(() => {
        animationFrameHandle.current = requestAnimationFrame(renderLoop);
        if (!isInitialized.current || !rendererInstanceRef.current || !sceneRef.current || !cameraRef.current || !planeMeshRef.current || !planeMeshRef.current.material ) return; // Check material exists

        const sourceElement = currentSourceElement.current;
        const material = planeMeshRef.current.material;
        let sourceWidth = 0, sourceHeight = 0;
        let isVideo = sourceElement instanceof HTMLVideoElement;
        let isImage = sourceElement instanceof HTMLImageElement;
        let newTexture = null; // Texture to assign

        // 1. Determine Source & Create/Update Texture Ref
        if (isVideo && sourceElement.readyState >= 2) {
            sourceWidth = sourceElement.videoWidth; sourceHeight = sourceElement.videoHeight;
            if (currentTexture.current?.image !== sourceElement) {
                currentTexture.current?.dispose();
                currentTexture.current = new THREE.VideoTexture(sourceElement);
                currentTexture.current.colorSpace = THREE.SRGBColorSpace;
                 console.log("Minimal Loop: Set Video Texture Ref");
            }
            newTexture = currentTexture.current; // Use video texture
        } else if (isImage && sourceElement.complete && sourceElement.naturalWidth > 0) {
             sourceWidth = sourceElement.naturalWidth; sourceHeight = sourceElement.naturalHeight;
             if (currentTexture.current?.image !== sourceElement) {
                 currentTexture.current?.dispose();
                 currentTexture.current = new THREE.Texture(sourceElement);
                 currentTexture.current.colorSpace = THREE.SRGBColorSpace;
                 currentTexture.current.needsUpdate = true; // Image needs update flag
                 console.log("Minimal Loop: Set Image Texture Ref");
             }
             newTexture = currentTexture.current; // Use image texture
        } else {
            // No valid source, ensure texture is cleared
            if (currentTexture.current) {
                 currentTexture.current.dispose();
                 currentTexture.current = null;
                 console.log("Minimal Loop: Cleared Texture Ref");
            }
            newTexture = null;
        }

        // 2. Update Material Map
        if (material.map !== newTexture) {
             material.map = newTexture; // Assign determined texture (or null)
             material.needsUpdate = true;
             console.log("Minimal Loop: Updated material.map");
        } else if (isImage && newTexture) {
            // If it's the same image texture, ensure needsUpdate is set
            newTexture.needsUpdate = true;
        }


        // 3. Update Plane Scale & Mirroring
        if (material.map && sourceWidth > 0 && sourceHeight > 0) { fitPlaneToCamera(sourceWidth, sourceHeight); planeMeshRef.current.scale.x = Math.abs(planeMeshRef.current.scale.x) * (isVideo ? -1 : 1); }
        else { if (planeMeshRef.current.scale.x !== 0) { planeMeshRef.current.scale.set(0,0,0); } } // Hide plane if no texture

        // 4. Render Scene
        rendererInstanceRef.current.render(sceneRef.current, cameraRef.current);

    }, [fitPlaneToCamera]); // Include dependency

    // --- Start Render Loop ---
    useEffect(() => { if (isInitialized.current) { cancelAnimationFrame(animationFrameHandle.current); animationFrameHandle.current = requestAnimationFrame(renderLoop); } }, [renderLoop]);

    // --- Expose Methods (Simplified - just store source/results) ---
    useImperativeHandle(ref, () => ({
        renderResults: (videoElement, results) => { currentSourceElement.current = videoElement; /* Store results if needed */ },
        renderStaticImageResults: (imageElement, results) => { currentSourceElement.current = imageElement; /* Store results if needed */ },
        clearCanvas: () => { currentSourceElement.current = null; /* Store results if needed */ }
    }));

    // --- JSX ---
    return ( <canvas ref={canvasRef} className={`renderer-canvas ${className || ''}`} style={{ display: 'block', width: '100%', height: '100%' }} /> );
});

TryOnRenderer.displayName = 'TryOnRenderer';
export default TryOnRenderer;