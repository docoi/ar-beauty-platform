// src/components/TryOnRenderer.jsx - Handle Canvas Source

import React, { useRef, forwardRef, useEffect, useCallback, useState, useMemo } from 'react';
import * as THREE from 'three';

// ... (Keep console.log THREE revision, forwardRef, props definition) ...
const TryOnRenderer = forwardRef(({ videoElement, imageElement, /* etc... */ }, ref) => {
    // ... (Keep refs) ...

    // --- Shaders --- (Keep Bare Minimum)
    const postVertexShader = `...`;
    const postFragmentShader = `...`;

    // --- Update internal refs when props change ---
    useEffect(() => {
        console.log("TryOnRenderer Effect: Props changed", { videoElement, imageElement, isStatic });
        // *** CHANGED: Source can be video OR image (canvas) element ***
        if (isStatic && imageElement) { // Static selfie uses imageElement
            currentSource.current = imageElement;
        } else if (!isStatic && imageElement) { // Mirror mode uses imageElement (the intermediate canvas)
             currentSource.current = imageElement;
        } else if (!isStatic && videoElement) { // Fallback? Could potentially use video directly if canvas fails
             console.warn("Using videoElement directly, expected imageElement (canvas)");
             currentSource.current = videoElement;
        }
         else {
            currentSource.current = null;
        }
        // *** END CHANGED ***
        currentIsStatic.current = isStatic; // isStatic prop controls B/C shader logic
    }, [videoElement, imageElement, isStatic]);
    // ... (Keep other useEffect hooks for results, B/C, intensity) ...


    // --- Handle Resizing ---
    const handleResize = useCallback(() => { /* ... */ }, []);
    // --- Scale Base Plane ---
    const fitPlaneToCamera = useCallback((textureWidth, textureHeight) => { /* ... */ }, []);


    // --- Render Loop --- (Handle Canvas Texture)
     const renderLoop = useCallback(() => {
        animationFrameHandle.current = requestAnimationFrame(renderLoop);
        if (!isInitialized.current /* ... etc ... */) return;

        try {
            // ... (Get internal refs: sourceElement, results, isStatic, etc.) ...

            const baseMaterial = basePlaneMeshRef.current.material;
            // ... (postUniforms) ...
            let sourceWidth = 0, sourceHeight = 0;
            let isVideo = sourceElement instanceof HTMLVideoElement;
             // *** Treat HTMLCanvasElement like HTMLImageElement for texture purposes ***
            let isImage = sourceElement instanceof HTMLImageElement || sourceElement instanceof HTMLCanvasElement;
             // *** ------------------------------------------------------------ ***
            let textureToAssign = null;

            // 1. Update Base Texture
            if (isVideo && sourceElement.readyState >= 2 && sourceElement.videoWidth > 0) { /* ... video texture logic ... */ }
            // *** CHANGED: Handle Image OR Canvas ***
            else if (isImage && sourceElement.width > 0 && sourceElement.height > 0) { // Check width/height for canvas/image
                sourceWidth = sourceElement.width; sourceHeight = sourceElement.height;
                // Use imageTextureRef for both Image and Canvas sources
                if (imageTextureRef.current?.image !== sourceElement) { // If source element changed
                    imageTextureRef.current?.dispose();
                    imageTextureRef.current = new THREE.Texture(sourceElement); // Create Texture from image/canvas
                    imageTextureRef.current.colorSpace = THREE.SRGBColorSpace;
                    imageTextureRef.current.needsUpdate = true; // Update needed on creation
                    console.log(`DEBUG RenderLoop: Created/Replaced Image/Canvas Texture`);
                } else {
                    // Source is the same (likely canvas being updated), mark texture for update
                    imageTextureRef.current.needsUpdate = true;
                }
                textureToAssign = imageTextureRef.current;
            // *** END CHANGED ***
            }
            else { /* ... handle null source ... */ }

            const textureChanged = baseMaterial.map !== textureToAssign;
            if (textureChanged) { baseMaterial.map = textureToAssign; baseMaterial.needsUpdate = true; /* ... log ... */ }
            // *** REMOVED redundant needsUpdate setting here - handled above ***
            // if (textureToAssign && textureToAssign.needsUpdate && !(textureToAssign instanceof THREE.VideoTexture)) { textureToAssign.needsUpdate = true; }


            // 2. Update Plane Scale & Mirroring
            const planeVisible = baseMaterial.map && sourceWidth > 0 && sourceHeight > 0;
            if (planeVisible) {
                fitPlaneToCamera(sourceWidth, sourceHeight);
                 // *** Mirroring: Mirror mode needs flipping, static selfie doesn't ***
                 // We passed isStatic=false for Mirror mode, even though source is canvas now
                 const scaleX = Math.abs(basePlaneMeshRef.current.scale.x);
                 const newScaleX = !isStatic ? -scaleX : scaleX; // Flip if NOT static (Mirror mode)
                 // *** ------------------------------------------------------------ ***
                if(basePlaneMeshRef.current.scale.x !== newScaleX) { basePlaneMeshRef.current.scale.x = newScaleX; }
            } else { /* ... hide plane ... */ }

            // 3. Render Base Scene to Target
            // ... render to target logic ...

            // 4. Update Post-Processing Uniforms
            // ... update uniforms ...

            // 5. Render Post-Processing Scene to Screen
            // ... render post scene ...

        } catch (error) { console.error("Error in renderLoop:", error); }
    }, [fitPlaneToCamera]);


    // --- Initialize Scene --- (Keep Bare Minimum Shader & Uniforms)
    const initThreeScene = useCallback(() => { /* ... */ }, [handleResize, postVertexShader, postFragmentShader, renderLoop]);
    // --- Effect for Initial Setup / Resize Observer ---
    useEffect(() => { /* ... */ }, [initThreeScene, handleResize]);
    // --- REMOVED useImperativeHandle ---
    // --- JSX ---
    return ( <canvas ref={canvasRef} className={`renderer-canvas ${className || ''}`} style={{ display: 'block', width: '100%', height: '100%' }} /> );
});

TryOnRenderer.displayName = 'TryOnRenderer';
export default TryOnRenderer;