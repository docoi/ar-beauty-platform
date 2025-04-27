// src/components/TryOnRenderer.jsx - ADDED Segmentation Mask and Serum Effect

import React, { useRef, forwardRef, useEffect, useCallback, useState, useMemo } from 'react';
import * as THREE from 'three';

console.log(`Using Three.js revision: ${THREE.REVISION}`);

const TryOnRenderer = forwardRef(({
    videoRefProp,
    imageElement,
    mediaPipeResults, // Now used for segmentation mask
    isStatic,
    brightness,
    contrast,
    effectIntensity, // Now used for serum effect
    className,
    style
 }, ref) => {

    // --- Core Refs ---
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
    // *** ADDED Ref for Segmentation Mask Texture ***
    const segmentationTextureRef = useRef(null);

    // --- Internal State Refs ---
    const currentResults = useRef(null);
    const currentBrightness = useRef(1.0);
    const currentContrast = useRef(1.0);
    // *** Store current intensity from prop ***
    const currentIntensity = useRef(0.5); // Default, will be updated by prop
    const renderLoopCounter = useRef(0);


    // --- Shaders --- (ADDED Masking and Serum Effect)
    const postVertexShader = `
        varying vec2 vUv;
        void main() {
            vUv = uv;
            gl_Position = vec4(position, 1.0);
        }
    `;

    // *** UPDATED Fragment Shader with Masking and Effect ***
    const postFragmentShader = `
        uniform sampler2D uSceneTexture;
        uniform sampler2D uSegmentationMask; // Texture for the face mask
        uniform float uBrightness;
        uniform float uContrast;
        uniform float uEffectIntensity; // Slider value (0.0 to 1.0)
        uniform bool uHasMask;          // Flag indicating if a mask is available

        varying vec2 vUv;

        // Function to apply brightness and contrast
        vec3 applyBrightnessContrast(vec3 color, float brightness, float contrast) {
            color = color * brightness; // Apply brightness
            color = (color - 0.5) * contrast + 0.5; // Apply contrast
            return color;
        }

        // Simple "Hydration" effect function (brighter, slightly smoother/desaturated)
        vec3 applyHydrationEffect(vec3 color) {
            // Increase brightness slightly for a 'glow'
            vec3 hydrated = color * (1.0 + 0.15); // e.g., 15% brighter base for effect
            // Optional: Slightly desaturate/shift towards white for a 'plump' look
            hydrated = mix(hydrated, vec3(1.0), 0.05);
            return hydrated;
        }

        void main() {
            vec4 baseColor = texture2D(uSceneTexture, vUv);

            // 1. Apply Base Corrections (Brightness/Contrast)
            vec3 correctedColor = applyBrightnessContrast(baseColor.rgb, uBrightness, uContrast);
            vec3 finalColor = correctedColor; // Default to corrected color

            // 2. Apply Serum Effect based on Mask and Intensity
            if (uHasMask && uEffectIntensity > 0.0) {
                // Sample the segmentation mask (assuming Red channel holds the mask)
                float maskValue = texture2D(uSegmentationMask, vUv).r;

                // Calculate the 'hydrated' look
                vec3 hydratedColor = applyHydrationEffect(correctedColor);

                // Blend between original corrected color and hydrated color
                // using the mask value and the effect intensity slider
                finalColor = mix(correctedColor, hydratedColor, maskValue * uEffectIntensity);
            }

            // Clamp final color values
            finalColor = clamp(finalColor, 0.0, 1.0);

            gl_FragColor = vec4(finalColor, baseColor.a); // Preserve original alpha
        }
    `;

    // --- Update internal refs based on props ---
    useEffect(() => {
        // Store the latest MediaPipe results
        currentResults.current = mediaPipeResults;
        // Log if results contain a mask (for debugging)
        // if (mediaPipeResults?.segmentationMasks?.[0]) {
        //     console.log("TryOnRenderer Effect: Received results WITH segmentation mask.");
        // }
    }, [mediaPipeResults]);

    useEffect(() => {
        currentBrightness.current = isStatic ? Math.max(0.01, brightness || 1.0) : 1.0;
        currentContrast.current = isStatic ? Math.max(0.01, contrast || 1.0) : 1.0;
        // console.log(`TryOnRenderer Effect: Updated Brightness=${currentBrightness.current}, Contrast=${currentContrast.current} (isStatic=${isStatic})`);
    }, [isStatic, brightness, contrast]);

    useEffect(() => {
        // Update internal intensity ref when prop changes
        currentIntensity.current = effectIntensity;
        // console.log(`TryOnRenderer Effect: Updated effectIntensity=${currentIntensity.current}`);
    }, [effectIntensity]);


    // --- Effect to manage Video Texture --- (No changes needed)
    useEffect(() => {
        const videoElement = videoRefProp?.current;
        if (!isStatic && videoElement) { if (!videoTextureRef.current || videoTextureRef.current.image !== videoElement) { console.log("TryOnRenderer Effect: Creating/Updating Video Texture"); videoTextureRef.current?.dispose(); videoTextureRef.current = new THREE.VideoTexture(videoElement); videoTextureRef.current.colorSpace = THREE.SRGBColorSpace; } } else { if (videoTextureRef.current) { console.log("TryOnRenderer Effect: Disposing Video Texture"); videoTextureRef.current.dispose(); videoTextureRef.current = null; } }
    }, [isStatic, videoRefProp]);


    // --- Effect to manage Image Texture --- (No changes needed)
    useEffect(() => {
        if (isStatic && imageElement) { if (!imageTextureRef.current || imageTextureRef.current.image !== imageElement) { console.log("TryOnRenderer Effect: Creating/Updating Image Texture for:", imageElement); imageTextureRef.current?.dispose(); imageTextureRef.current = new THREE.Texture(imageElement); imageTextureRef.current.colorSpace = THREE.SRGBColorSpace; imageTextureRef.current.needsUpdate = true; } else if (imageTextureRef.current && imageTextureRef.current.image === imageElement) { imageTextureRef.current.needsUpdate = true; /*console.log("TryOnRenderer Effect: Marking existing Image Texture needsUpdate=true");*/ } } else { if (imageTextureRef.current) { console.log("TryOnRenderer Effect: Disposing Image Texture"); imageTextureRef.current.dispose(); imageTextureRef.current = null; } }
    }, [isStatic, imageElement]);


    // *** Effect to manage Segmentation Mask Texture ***
    useEffect(() => {
        const results = currentResults.current;
        const segmentationMask = results?.segmentationMasks?.[0];

        if (segmentationMask?.mask) {
            const mask = segmentationMask.mask; // This is the MediaPipe Mask object
            const maskData = segmentationMask.maskData; // Float32Array containing the mask values
            const maskWidth = mask.width;
            const maskHeight = mask.height;

            // console.log(`TryOnRenderer Mask Effect: Found mask ${maskWidth}x${maskHeight}`);

            if (!segmentationTextureRef.current || segmentationTextureRef.current.image.width !== maskWidth || segmentationTextureRef.current.image.height !== maskHeight) {
                // Create new texture if it doesn't exist or dimensions mismatch
                console.log(`TryOnRenderer Mask Effect: Creating new mask texture (${maskWidth}x${maskHeight})`);
                segmentationTextureRef.current?.dispose(); // Dispose old one if exists
                segmentationTextureRef.current = new THREE.DataTexture(
                    maskData,
                    maskWidth,
                    maskHeight,
                    THREE.RedFormat, // MediaPipe segmentation mask is typically single channel
                    THREE.FloatType  // Data is Float32Array
                );
                segmentationTextureRef.current.needsUpdate = true;
            } else {
                // Update existing texture data
                // console.log(`TryOnRenderer Mask Effect: Updating existing mask texture data`);
                segmentationTextureRef.current.image.data = maskData;
                segmentationTextureRef.current.needsUpdate = true;
            }
        } else {
            // No mask data in results, ensure texture is nullified and disposed
            if (segmentationTextureRef.current) {
                console.log("TryOnRenderer Mask Effect: No mask found in results, disposing existing texture.");
                segmentationTextureRef.current.dispose();
                segmentationTextureRef.current = null;
            }
        }
    // Depend only on the results ref content (indirectly via mediaPipeResults prop)
    }, [mediaPipeResults]); // Re-run when mediaPipeResults prop changes


    // --- Handle Resizing --- (No changes needed)
    const handleResize = useCallback(() => {
         const canvas = canvasRef.current; if (!rendererInstanceRef.current || !baseCameraRef.current || !postCameraRef.current || !canvas || !renderTargetRef.current) return; const newWidth = canvas.clientWidth; const newHeight = canvas.clientHeight; if (newWidth === 0 || newHeight === 0) return; const currentSize = rendererInstanceRef.current.getSize(new THREE.Vector2()); if (currentSize.x === newWidth && currentSize.y === newHeight) return; console.log(`DEBUG: Resizing Renderer and Target -> ${newWidth}x${newHeight}`); try { rendererInstanceRef.current.setSize(newWidth, newHeight); renderTargetRef.current.setSize(newWidth, newHeight); baseCameraRef.current.left = -newWidth / 2; baseCameraRef.current.right = newWidth / 2; baseCameraRef.current.top = newHeight / 2; baseCameraRef.current.bottom = -newHeight / 2; baseCameraRef.current.updateProjectionMatrix(); } catch(e) { console.error("Resize Error:", e);}
    }, []);


    // --- Scale Base Plane --- (No changes needed)
    const fitPlaneToCamera = useCallback((textureWidth, textureHeight) => {
        const canvas = canvasRef.current; if (!baseCameraRef.current || !basePlaneMeshRef.current || !textureWidth || !textureHeight || !canvas || canvas.clientWidth === 0 || canvas.clientHeight === 0) return; const viewWidth = canvas.clientWidth; const viewHeight = canvas.clientHeight; const viewAspect = viewWidth / viewHeight; const textureAspect = textureWidth / textureHeight; let scaleX, scaleY; if (viewAspect > textureAspect) { scaleX = viewWidth; scaleY = scaleX / textureAspect; } else { scaleY = viewHeight; scaleX = scaleY * textureAspect; } const currentScale = basePlaneMeshRef.current.scale; const currentSignX = Math.sign(currentScale.x) || 1; const newScaleXWithSign = scaleX * currentSignX; if (Math.abs(currentScale.y - scaleY) > 0.01 || Math.abs(currentScale.x - newScaleXWithSign) > 0.01) { currentScale.y = scaleY; currentScale.x = newScaleXWithSign; }
     }, []);


    // --- Render Loop --- (UPDATE Uniforms)
     const renderLoop = useCallback(() => {
        animationFrameHandle.current = requestAnimationFrame(renderLoop);
        if (!isInitialized.current || !rendererInstanceRef.current || !baseSceneRef.current || !baseCameraRef.current || !postSceneRef.current || !postCameraRef.current || !basePlaneMeshRef.current || !postMaterialRef.current || !renderTargetRef.current) { return; }

        const currentCount = renderLoopCounter.current++;
        const logThisFrame = (currentCount % 100 === 0);

        try {
            const postUniforms = postMaterialRef.current.uniforms;
            // Check if all necessary uniforms are present
            if (!postUniforms || !postUniforms.uBrightness || !postUniforms.uContrast || !postUniforms.uEffectIntensity || !postUniforms.uSegmentationMask || !postUniforms.uHasMask) {
                if (logThisFrame) console.warn("RenderLoop: Post uniforms not fully ready.");
                return;
            }

            // 1. Select Source Texture (Video or Image)
            const baseMaterial = basePlaneMeshRef.current.material;
            let sourceWidth = 0, sourceHeight = 0;
            let textureToAssign = null;
            let isVideo = false;

            if (!isStatic && videoTextureRef.current) {
                 textureToAssign = videoTextureRef.current;
                 if (textureToAssign.image) { sourceWidth = textureToAssign.image.videoWidth; sourceHeight = textureToAssign.image.videoHeight; isVideo = true;}
            } else if (isStatic && imageTextureRef.current) {
                 textureToAssign = imageTextureRef.current;
                  if (textureToAssign.image) { sourceWidth = textureToAssign.image.naturalWidth; sourceHeight = textureToAssign.image.naturalHeight; }
                  if (textureToAssign.needsUpdate) { textureToAssign.needsUpdate = true; }
            }

             if (baseMaterial.map !== textureToAssign) {
                 baseMaterial.map = textureToAssign;
                 baseMaterial.needsUpdate = true;
                 // console.log("DEBUG RenderLoop: Assigned base texture:", textureToAssign?.constructor?.name ?? 'null');
             } else if (textureToAssign && textureToAssign.needsUpdate) {
                 baseMaterial.needsUpdate = true;
             }

            // 2. Update Plane Scale & Mirroring
            const planeVisible = !!baseMaterial.map && sourceWidth > 0 && sourceHeight > 0;
            if (planeVisible) {
                fitPlaneToCamera(sourceWidth, sourceHeight);
                const scaleX = Math.abs(basePlaneMeshRef.current.scale.x);
                const newScaleX = isVideo ? -scaleX : scaleX; // Mirror video
                if(basePlaneMeshRef.current.scale.x !== newScaleX) { basePlaneMeshRef.current.scale.x = newScaleX; }
            } else {
                 if (basePlaneMeshRef.current.scale.x !== 0 || basePlaneMeshRef.current.scale.y !== 0) { basePlaneMeshRef.current.scale.set(0, 0, 0); }
             }

            // 3. Render Base Scene to Target
             rendererInstanceRef.current.setRenderTarget(renderTargetRef.current);
             rendererInstanceRef.current.setClearColor(0x000000, 0);
             rendererInstanceRef.current.clear();
             if (planeVisible) {
                 rendererInstanceRef.current.render(baseSceneRef.current, baseCameraRef.current);
                 // Mark texture as updated *after* rendering it
                 if (textureToAssign?.needsUpdate) { textureToAssign.needsUpdate = false; }
             }
             rendererInstanceRef.current.setRenderTarget(null);


            // 4. Update Post-Processing Uniforms
             postUniforms.uSceneTexture.value = renderTargetRef.current.texture;
             postUniforms.uBrightness.value = currentBrightness.current;
             postUniforms.uContrast.value = currentContrast.current;
             // *** UPDATE EFFECT UNIFORMS ***
             postUniforms.uEffectIntensity.value = currentIntensity.current; // Use internal ref updated by prop
             postUniforms.uSegmentationMask.value = segmentationTextureRef.current; // Assign mask texture
             postUniforms.uHasMask.value = !!segmentationTextureRef.current; // Set boolean flag


            // 5. Render Post-Processing Scene to Screen
             rendererInstanceRef.current.render(postSceneRef.current, postCameraRef.current);


        } catch (error) { console.error("Error in renderLoop:", error); }
    }, [fitPlaneToCamera, isStatic]); // Include isStatic as it affects mirroring


    // --- Initialize Scene --- (ADD Mask Uniforms)
    const initThreeScene = useCallback(() => {
        if (!canvasRef.current || isInitialized.current) return;
        console.log("DEBUG: initThreeScene START (With B/C + Effect Shader)");
        try {
            const canvas = canvasRef.current;
            const initialWidth = canvas.clientWidth || 640;
            const initialHeight = canvas.clientHeight || 480;

            rendererInstanceRef.current = new THREE.WebGLRenderer({ canvas: canvas, antialias: true });
            rendererInstanceRef.current.setSize(initialWidth, initialHeight);
            rendererInstanceRef.current.setPixelRatio(window.devicePixelRatio);
            rendererInstanceRef.current.outputColorSpace = THREE.SRGBColorSpace;

            renderTargetRef.current = new THREE.WebGLRenderTarget(initialWidth, initialHeight, {
                minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter,
                format: THREE.RGBAFormat, colorSpace: THREE.SRGBColorSpace
            });
            console.log("DEBUG: RenderTarget created.");

            // Base Scene
            baseSceneRef.current = new THREE.Scene();
            baseCameraRef.current = new THREE.OrthographicCamera(-initialWidth / 2, initialWidth / 2, initialHeight / 2, -initialHeight / 2, 0.1, 10);
            baseCameraRef.current.position.z = 1;
            const planeGeometry = new THREE.PlaneGeometry(1, 1);
            const planeMaterial = new THREE.MeshBasicMaterial({ map: null, side: THREE.DoubleSide, color: 0xffffff, transparent: true });
            basePlaneMeshRef.current = new THREE.Mesh(planeGeometry, planeMaterial);
            baseSceneRef.current.add(basePlaneMeshRef.current);
            console.log("DEBUG: Base scene created.");

            // Post-Processing Scene
            postSceneRef.current = new THREE.Scene();
            postCameraRef.current = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
            const postPlaneGeometry = new THREE.PlaneGeometry(2, 2);

            // *** Create ShaderMaterial with ALL Uniforms ***
            postMaterialRef.current = new THREE.ShaderMaterial({
                vertexShader: postVertexShader,
                fragmentShader: postFragmentShader,
                uniforms: {
                    uSceneTexture: { value: renderTargetRef.current.texture },
                    uBrightness: { value: 1.0 }, // Initial value
                    uContrast: { value: 1.0 },   // Initial value
                    // *** ADD EFFECT UNIFORMS ***
                    uSegmentationMask: { value: null }, // Initialize mask texture as null
                    uEffectIntensity: { value: currentIntensity.current }, // Initial slider value
                    uHasMask: { value: false }, // Initialize boolean flag
                },
                transparent: true,
                depthWrite: false,
                depthTest: false,
            });

            const postPlaneMesh = new THREE.Mesh(postPlaneGeometry, postMaterialRef.current);
            postSceneRef.current.add(postPlaneMesh);
            console.log("DEBUG: Post-processing scene created (With Effect Shader).");

            isInitialized.current = true;
            console.log("DEBUG: Scene initialization complete.");
            handleResize();
            console.log("DEBUG: Requesting first render loop frame from Init.");
            cancelAnimationFrame(animationFrameHandle.current);
            animationFrameHandle.current = requestAnimationFrame(renderLoop);

        } catch (error) {
            console.error("DEBUG: initThreeScene ERROR:", error);
            isInitialized.current = false;
        }
    }, [handleResize, postVertexShader, postFragmentShader, renderLoop]); // Added renderLoop dependency


    // --- Effect for Initial Setup / Resize Observer / Cleanup ---
    useEffect(() => {
         console.log("DEBUG: TryOnRenderer Mount/Init effect running.");
         initThreeScene(); // Initialize Three.js

         let resizeObserver; const currentCanvas = canvasRef.current; if (currentCanvas) { resizeObserver = new ResizeObserver(() => { handleResize(); }); resizeObserver.observe(currentCanvas); console.log("DEBUG: Resize observer attached."); }

         // Cleanup function
         return () => {
             console.log("DEBUG: Cleanup running (TryOnRenderer Unmount)...");
             resizeObserver?.disconnect();
             cancelAnimationFrame(animationFrameHandle.current);
             isInitialized.current = false;

             console.log("DEBUG: Disposing Three.js resources...");
             videoTextureRef.current?.dispose();
             imageTextureRef.current?.dispose();
             // *** DISPOSE Mask Texture ***
             segmentationTextureRef.current?.dispose();

             renderTargetRef.current?.dispose();

             basePlaneMeshRef.current?.geometry?.dispose();
             basePlaneMeshRef.current?.material?.map?.dispose();
             basePlaneMeshRef.current?.material?.dispose();
             postMaterialRef.current?.uniforms?.uSceneTexture?.value?.dispose();
             // *** DISPOSE Mask Uniform Texture ***
             postMaterialRef.current?.uniforms?.uSegmentationMask?.value?.dispose();
             postMaterialRef.current?.dispose(); // Dispose the shader material

             rendererInstanceRef.current?.dispose();

             videoTextureRef.current = null;
             imageTextureRef.current = null;
             segmentationTextureRef.current = null; // Nullify mask ref
             renderTargetRef.current = null;
             basePlaneMeshRef.current = null;
             postMaterialRef.current = null;
             rendererInstanceRef.current = null;
             baseSceneRef.current = null;
             postSceneRef.current = null;
             baseCameraRef.current = null;
             postCameraRef.current = null;

             console.log("DEBUG: Three.js resources disposed.");
        };
     }, [initThreeScene, handleResize]); // Keep dependencies


    // --- JSX --- (No changes needed)
    return ( <canvas ref={canvasRef} className={`renderer-canvas ${className || ''}`} style={{ display: 'block', width: '100%', height: '100%', ...(style || {}) }} /> );
});

TryOnRenderer.displayName = 'TryOnRenderer';
export default TryOnRenderer;