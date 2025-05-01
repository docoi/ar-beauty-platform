// src/components/TryOnRenderer.jsx - ABSOLUTE BASELINE: Direct Rendering Only

import React, { useRef, forwardRef, useEffect, useCallback } from 'react';
import * as THREE from 'three';

const TryOnRenderer = forwardRef(({
    videoRefProp, // For live video
    imageElement, // For static image
    isStatic,     // To switch between video/image
    className, style // Basic styling props
    // REMOVED: mediaPipeResults, segmentationResults, effectIntensity etc.
 }, ref) => {

    // --- Core Refs ---
    const canvasRef = useRef(null);
    const rendererInstanceRef = useRef(null);
    const animationFrameHandle = useRef(null);
    const isInitialized = useRef(false);
    const sceneRef = useRef(null); // Simple Scene
    const cameraRef = useRef(null); // Simple Orthographic Camera
    const planeMeshRef = useRef(null); // The plane showing video/image
    const videoTextureRef = useRef(null); // Texture for video
    const imageTextureRef = useRef(null); // Texture for image

    // --- Texture Management ---
    useEffect(() => {
        // Video Texture Effect
        const videoElement = videoRefProp?.current;
        if (!isStatic && videoElement && videoElement.readyState >= videoElement.HAVE_METADATA) {
            if (!videoTextureRef.current || videoTextureRef.current.image !== videoElement) {
                console.log("TryOnRenderer Baseline: Creating/Updating Video Texture");
                videoTextureRef.current?.dispose();
                videoTextureRef.current = new THREE.VideoTexture(videoElement);
                videoTextureRef.current.colorSpace = THREE.SRGBColorSpace;
                // Assign to material if it exists
                if (planeMeshRef.current?.material) {
                    planeMeshRef.current.material.map = videoTextureRef.current;
                    planeMeshRef.current.material.needsUpdate = true;
                }
            }
        } else if (!isStatic && videoTextureRef.current) {
             console.log("TryOnRenderer Baseline: Disposing Video Texture");
             if (planeMeshRef.current?.material?.map === videoTextureRef.current) {
                 planeMeshRef.current.material.map = null;
                 planeMeshRef.current.material.needsUpdate = true;
             }
             videoTextureRef.current.dispose();
             videoTextureRef.current = null;
        }
    }, [isStatic, videoRefProp, videoRefProp?.current?.readyState]);

    useEffect(() => {
        // Image Texture Effect
        if (isStatic && imageElement && imageElement.complete && imageElement.naturalWidth > 0) {
             if (!imageTextureRef.current || imageTextureRef.current.image !== imageElement) {
                 console.log("TryOnRenderer Baseline: Creating/Updating Image Texture");
                 imageTextureRef.current?.dispose();
                 imageTextureRef.current = new THREE.Texture(imageElement);
                 imageTextureRef.current.colorSpace = THREE.SRGBColorSpace;
                 imageTextureRef.current.needsUpdate = true; // Trigger update
                 // Assign to material if it exists
                 if (planeMeshRef.current?.material) {
                     planeMeshRef.current.material.map = imageTextureRef.current;
                     planeMeshRef.current.material.needsUpdate = true;
                 }
             } else if (imageTextureRef.current?.image === imageElement && !imageTextureRef.current.needsUpdate){
                  // If the image element is the same, force needsUpdate just in case content changed internally
                  // imageTextureRef.current.needsUpdate = true; // This might be excessive
             }
        } else if (isStatic && imageTextureRef.current) {
             console.log("TryOnRenderer Baseline: Disposing Image Texture");
              if (planeMeshRef.current?.material?.map === imageTextureRef.current) {
                 planeMeshRef.current.material.map = null;
                 planeMeshRef.current.material.needsUpdate = true;
             }
             imageTextureRef.current.dispose();
             imageTextureRef.current = null;
        }
    }, [isStatic, imageElement, imageElement?.complete]);


    // --- Resizing Logic ---
    const handleResize = useCallback(() => {
         const canvas = canvasRef.current;
         const renderer = rendererInstanceRef.current;
         const camera = cameraRef.current;
         if (!renderer || !camera || !canvas) return;

         const newWidth = canvas.clientWidth;
         const newHeight = canvas.clientHeight;
         if (newWidth === 0 || newHeight === 0) return;

         const currentSize = renderer.getSize(new THREE.Vector2());
         if (currentSize.x === newWidth && currentSize.y === newHeight) return;

         console.log(`TryOnRenderer Baseline: Resizing Renderer to ${newWidth}x${newHeight}`);
         try {
             renderer.setSize(newWidth, newHeight);
             camera.left = -newWidth / 2; camera.right = newWidth / 2;
             camera.top = newHeight / 2; camera.bottom = -newHeight / 2;
             camera.updateProjectionMatrix();
         } catch(e) { console.error("Resize Error:", e);}
    }, []);


    // --- Plane Scaling Logic ---
    const fitPlaneToCamera = useCallback((textureWidth, textureHeight) => {
        const canvas = canvasRef.current;
        const camera = cameraRef.current;
        const mesh = planeMeshRef.current;
        if (!camera || !mesh || !textureWidth || !textureHeight || !canvas) return;

        const viewWidth = canvas.clientWidth;
        const viewHeight = canvas.clientHeight;
        if (viewWidth === 0 || viewHeight === 0) return;

        const viewAspect = viewWidth / viewHeight;
        const textureAspect = textureWidth / textureHeight;
        let scaleX, scaleY;

        if (viewAspect > textureAspect) { scaleY = viewHeight; scaleX = scaleY * textureAspect; }
        else { scaleX = viewWidth; scaleY = scaleX / textureAspect; }

        const currentScale = mesh.scale;
        const signX = Math.sign(currentScale.x) || 1; // Preserve mirroring if set
        const newScaleXWithSign = scaleX * signX;

        if (Math.abs(currentScale.y - scaleY) > 0.01 || Math.abs(currentScale.x - newScaleXWithSign) > 0.01) {
            currentScale.set(newScaleXWithSign, scaleY, 1);
        }
     }, []);


    // --- Render Loop ---
     const renderLoop = useCallback(() => {
        animationFrameHandle.current = requestAnimationFrame(renderLoop);
        if (!isInitialized.current || !rendererInstanceRef.current || !sceneRef.current || !cameraRef.current || !planeMeshRef.current?.material) {
             return;
        }

        try {
            const mesh = planeMeshRef.current;
            const material = mesh.material;
            let sourceWidth = 0, sourceHeight = 0;
            let currentTexture = null;
            const isVideo = !isStatic;

            // Determine current texture and dimensions
            if (isVideo && videoTextureRef.current) {
                currentTexture = videoTextureRef.current;
                const video = currentTexture.image;
                if (video && video.readyState >= video.HAVE_CURRENT_DATA) {
                    sourceWidth = video.videoWidth; sourceHeight = video.videoHeight;
                }
            } else if (isStatic && imageTextureRef.current) {
                currentTexture = imageTextureRef.current;
                 const image = currentTexture.image;
                 if(image && image.complete && image.naturalWidth > 0) {
                     sourceWidth = image.naturalWidth; sourceHeight = image.naturalHeight;
                 }
            }

            // Update material map if necessary
            if (material.map !== currentTexture) {
                 console.log("TryOnRenderer Baseline: Assigning map in render loop");
                 material.map = currentTexture;
                 material.needsUpdate = true;
            } else if (currentTexture?.needsUpdate) {
                 // If texture needs update (e.g., static image loaded)
                 material.needsUpdate = true; // Material also needs update if map content changes
            }

             // Update Plane Scale & Mirroring
            const planeVisible = !!material.map && sourceWidth > 0 && sourceHeight > 0;
            if (planeVisible) {
                fitPlaneToCamera(sourceWidth, sourceHeight);
                const scaleX = Math.abs(mesh.scale.x);
                const newScaleX = isVideo ? -scaleX : scaleX; // Mirror if video
                if(mesh.scale.x !== newScaleX) { mesh.scale.x = newScaleX; }
            } else {
                if (mesh.scale.x !== 0 || mesh.scale.y !== 0) { mesh.scale.set(0, 0, 0); }
            }

            // Render the scene directly
            rendererInstanceRef.current.render(sceneRef.current, cameraRef.current);

            // Reset needsUpdate flag on texture if it was set
            if (currentTexture?.needsUpdate) {
                currentTexture.needsUpdate = false;
            }

        } catch (error) {
            console.error("TryOnRenderer Baseline: Error in renderLoop:", error);
            cancelAnimationFrame(animationFrameHandle.current); // Stop loop on error
            isInitialized.current = false;
        }
    }, [fitPlaneToCamera, isStatic]); // isStatic is a key dependency


    // --- Initialization ---
    const initThreeScene = useCallback(() => {
        if (!canvasRef.current || isInitialized.current) return;
        console.log("DEBUG: initThreeScene START (Baseline Direct Render)");
        try {
            const canvas = canvasRef.current;
            const initialWidth = canvas.clientWidth || 640;
            const initialHeight = canvas.clientHeight || 480;

            // 1. Renderer
            const renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true });
            renderer.setSize(initialWidth, initialHeight);
            renderer.setPixelRatio(window.devicePixelRatio);
            renderer.outputColorSpace = THREE.SRGBColorSpace;
            rendererInstanceRef.current = renderer;
            console.log("DEBUG Baseline: Renderer initialized.");

            // 2. Scene
            sceneRef.current = new THREE.Scene();
            console.log("DEBUG Baseline: Scene created.");

            // 3. Camera
            cameraRef.current = new THREE.OrthographicCamera(-initialWidth / 2, initialWidth / 2, initialHeight / 2, -initialHeight / 2, 0.1, 10);
            cameraRef.current.position.z = 1;
            console.log("DEBUG Baseline: Camera created.");

            // 4. Geometry and Material
            const planeGeometry = new THREE.PlaneGeometry(1, 1);
            const planeMaterial = new THREE.MeshBasicMaterial({
                map: null, // Start with no texture
                side: THREE.DoubleSide,
                color: 0x808080 // Grey color if no texture loads
            });
             console.log("DEBUG Baseline: Geometry & Material created.");

            // 5. Mesh
            planeMeshRef.current = new THREE.Mesh(planeGeometry, planeMaterial);
            sceneRef.current.add(planeMeshRef.current);
            console.log("DEBUG Baseline: Plane mesh added to scene.");

            // 6. Finalize
            isInitialized.current = true;
            handleResize(); // Set initial size
            cancelAnimationFrame(animationFrameHandle.current); // Clear any previous loop
            animationFrameHandle.current = requestAnimationFrame(renderLoop); // Start loop
            console.log("DEBUG Baseline: initThreeScene SUCCESSFUL.");

        } catch (error) {
            console.error("DEBUG Baseline: initThreeScene FAILED:", error);
            isInitialized.current = false;
            // Clean up potentially partially created objects? (Optional here)
        }
    }, [handleResize, renderLoop]); // Dependencies


    // --- Setup / Cleanup Effect ---
    useEffect(() => {
        console.log("TryOnRenderer Baseline: Mounting, calling initThreeScene.");
        initThreeScene();
        let resizeObserver;
        const currentCanvas = canvasRef.current;
        if (currentCanvas) {
            resizeObserver = new ResizeObserver(() => {
                // console.log("TryOnRenderer Baseline: ResizeObserver triggered.");
                handleResize();
            });
            resizeObserver.observe(currentCanvas);
        }

        return () => {
            console.log("TryOnRenderer Baseline: Unmounting, cleaning up...");
            resizeObserver?.disconnect();
            cancelAnimationFrame(animationFrameHandle.current);
            isInitialized.current = false;

            // Dispose textures
            videoTextureRef.current?.dispose(); videoTextureRef.current = null;
            imageTextureRef.current?.dispose(); imageTextureRef.current = null;

             // Dispose mesh, geometry, material
            planeMeshRef.current?.geometry?.dispose();
            planeMeshRef.current?.material?.map?.dispose(); // Dispose map if necessary
            planeMeshRef.current?.material?.dispose();
            planeMeshRef.current = null;

            // Dispose renderer
            rendererInstanceRef.current?.dispose(); rendererInstanceRef.current = null;

            sceneRef.current = null;
            cameraRef.current = null;
            console.log("TryOnRenderer Baseline: Cleanup complete.");
        };
     }, [initThreeScene, handleResize]); // initThreeScene and handleResize are dependencies


    // --- JSX ---
    return (
        <canvas
            ref={canvasRef}
            className={`renderer-canvas ${className || ''}`}
            style={{ display: 'block', width: '100%', height: '100%', ...(style || {}) }}
        />
    );

});
TryOnRenderer.displayName = 'TryOnRenderer';
export default TryOnRenderer;