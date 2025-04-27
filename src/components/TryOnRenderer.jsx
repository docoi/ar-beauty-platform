// src/components/TryOnRenderer.jsx - ADDED Brightness/Contrast Shader Logic

import React, { useRef, forwardRef, useEffect, useCallback, useState, useMemo } from 'react';
import * as THREE from 'three';

console.log(`Using Three.js revision: ${THREE.REVISION}`);

const TryOnRenderer = forwardRef(({
    videoRefProp,     // Ref object for video element
    imageElement,     // Actual image element
    mediaPipeResults,
    isStatic,
    brightness, // Now used by the shader
    contrast,   // Now used by the shader
    effectIntensity, className,
    style // Accept style prop
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
    const segmentationTextureRef = useRef(null);
    const renderTargetRef = useRef(null);

    // --- Internal State Refs ---
    const currentResults = useRef(null);
    const currentBrightness = useRef(1.0); // Default brightness
    const currentContrast = useRef(1.0);   // Default contrast
    const currentIntensity = useRef(0.5);
    const renderLoopCounter = useRef(0);


    // --- Shaders --- (RESTORED Brightness/Contrast Logic)
    const postVertexShader = `
        varying vec2 vUv;
        void main() {
            vUv = uv;
            gl_Position = vec4(position, 1.0);
        }
    `;

    // *** UPDATED Fragment Shader ***
    const postFragmentShader = `
        uniform sampler2D uSceneTexture;
        uniform sampler2D uSegmentationMask; // Keep placeholder for future
        uniform float uBrightness;
        uniform float uContrast;
        uniform float uEffectIntensity; // Keep placeholder for future
        uniform bool uHasMask; // Keep placeholder for future

        varying vec2 vUv;

        // Function to apply brightness and contrast
        vec3 applyBrightnessContrast(vec3 color, float brightness, float contrast) {
            // Apply brightness
            color = color * brightness;
            // Apply contrast
            color = (color - 0.5) * contrast + 0.5;
            return color;
        }

        void main() {
            vec4 baseColor = texture2D(uSceneTexture, vUv);

            // Apply Brightness/Contrast Correction
            vec3 correctedColor = applyBrightnessContrast(baseColor.rgb, uBrightness, uContrast);

            // *** TODO: Apply Serum Effect Logic Here Later ***
            vec3 finalColor = correctedColor; // Start with corrected color

            // Clamp color values to prevent exceeding valid range
            finalColor = clamp(finalColor, 0.0, 1.0);

            gl_FragColor = vec4(finalColor, baseColor.a); // Keep original alpha
        }
    `;

    // --- Update internal refs based on props ---
    useEffect(() => { currentResults.current = mediaPipeResults; }, [mediaPipeResults]);
    // *** Update brightness/contrast refs based on props (using defaults if needed) ***
    useEffect(() => {
        // Use default 1.0 for mirror mode, use prop (or fixed value) for static
        currentBrightness.current = isStatic ? Math.max(0.01, brightness || 1.0) : 1.0;
        currentContrast.current = isStatic ? Math.max(0.01, contrast || 1.0) : 1.0;
        console.log(`TryOnRenderer Effect: Updated Brightness=${currentBrightness.current}, Contrast=${currentContrast.current} (isStatic=${isStatic})`);
    }, [isStatic, brightness, contrast]);
    useEffect(() => { currentIntensity.current = effectIntensity; }, [effectIntensity]);


    // --- Effect to manage Video Texture ---
    useEffect(() => {
        const videoElement = videoRefProp?.current;
        if (!isStatic && videoElement) {
             if (!videoTextureRef.current || videoTextureRef.current.image !== videoElement) {
                console.log("TryOnRenderer Effect: Creating/Updating Video Texture");
                videoTextureRef.current?.dispose();
                videoTextureRef.current = new THREE.VideoTexture(videoElement);
                videoTextureRef.current.colorSpace = THREE.SRGBColorSpace;
             }
        } else {
             if (videoTextureRef.current) {
                console.log("TryOnRenderer Effect: Disposing Video Texture");
                videoTextureRef.current.dispose();
                videoTextureRef.current = null;
             }
        }
    }, [isStatic, videoRefProp]);


     // --- Effect to manage Image Texture ---
    useEffect(() => {
        if (isStatic && imageElement) {
             if (!imageTextureRef.current || imageTextureRef.current.image !== imageElement) {
                console.log("TryOnRenderer Effect: Creating/Updating Image Texture for:", imageElement);
                imageTextureRef.current?.dispose();
                imageTextureRef.current = new THREE.Texture(imageElement);
                imageTextureRef.current.colorSpace = THREE.SRGBColorSpace;
                imageTextureRef.current.needsUpdate = true; // Mark for upload on creation
             } else if (imageTextureRef.current && imageTextureRef.current.image === imageElement) {
                 // If the element is the same but might have been reloaded/redrawn externally
                 imageTextureRef.current.needsUpdate = true;
                 console.log("TryOnRenderer Effect: Marking existing Image Texture needsUpdate=true");
             }
        } else {
             if (imageTextureRef.current) {
                 console.log("TryOnRenderer Effect: Disposing Image Texture");
                 imageTextureRef.current.dispose();
                 imageTextureRef.current = null;
             }
        }
    }, [isStatic, imageElement]);


    // --- Handle Resizing ---
    const handleResize = useCallback(() => {
         const canvas = canvasRef.current; if (!rendererInstanceRef.current || !baseCameraRef.current || !postCameraRef.current || !canvas || !renderTargetRef.current) return; const newWidth = canvas.clientWidth; const newHeight = canvas.clientHeight; if (newWidth === 0 || newHeight === 0) return; const currentSize = rendererInstanceRef.current.getSize(new THREE.Vector2()); if (currentSize.x === newWidth && currentSize.y === newHeight) return; console.log(`DEBUG: Resizing Renderer and Target -> ${newWidth}x${newHeight}`); try { rendererInstanceRef.current.setSize(newWidth, newHeight); renderTargetRef.current.setSize(newWidth, newHeight); baseCameraRef.current.left = -newWidth / 2; baseCameraRef.current.right = newWidth / 2; baseCameraRef.current.top = newHeight / 2; baseCameraRef.current.bottom = -newHeight / 2; baseCameraRef.current.updateProjectionMatrix(); } catch(e) { console.error("Resize Error:", e);}
    }, []);


    // --- Scale Base Plane ---
    const fitPlaneToCamera = useCallback((textureWidth, textureHeight) => {
        const canvas = canvasRef.current; if (!baseCameraRef.current || !basePlaneMeshRef.current || !textureWidth || !textureHeight || !canvas || canvas.clientWidth === 0 || canvas.clientHeight === 0) return; const viewWidth = canvas.clientWidth; const viewHeight = canvas.clientHeight; const viewAspect = viewWidth / viewHeight; const textureAspect = textureWidth / textureHeight; let scaleX, scaleY; if (viewAspect > textureAspect) { scaleX = viewWidth; scaleY = scaleX / textureAspect; } else { scaleY = viewHeight; scaleX = scaleY * textureAspect; } const currentScale = basePlaneMeshRef.current.scale; const currentSignX = Math.sign(currentScale.x) || 1; const newScaleXWithSign = scaleX * currentSignX; if (Math.abs(currentScale.y - scaleY) > 0.01 || Math.abs(currentScale.x - newScaleXWithSign) > 0.01) { currentScale.y = scaleY; currentScale.x = newScaleXWithSign; /*console.log(...)*/ }
     }, []);


    // --- Render Loop --- (Uses texture refs and B/C refs)
     const renderLoop = useCallback(() => {
        animationFrameHandle.current = requestAnimationFrame(renderLoop);
        if (!isInitialized.current || !rendererInstanceRef.current || !baseSceneRef.current || !baseCameraRef.current || !postSceneRef.current || !postCameraRef.current || !basePlaneMeshRef.current || !postMaterialRef.current || !renderTargetRef.current) { return; }

        const currentCount = renderLoopCounter.current++;
        const logThisFrame = (currentCount % 100 === 0);

        try {
            const postUniforms = postMaterialRef.current.uniforms;
            if (!postUniforms || !postUniforms.uBrightness || !postUniforms.uContrast) {
                if (logThisFrame) console.warn("RenderLoop: Post uniforms not ready.");
                return;
            }

            const results = currentResults.current; // Read results ref
            const baseMaterial = basePlaneMeshRef.current.material;
            let sourceWidth = 0, sourceHeight = 0;
            let textureToAssign = null;
            let isVideo = false;

            // 1. Select texture based on props and internal texture refs
            if (!isStatic && videoTextureRef.current) {
                 textureToAssign = videoTextureRef.current;
                 if (textureToAssign.image) { sourceWidth = textureToAssign.image.videoWidth; sourceHeight = textureToAssign.image.videoHeight; isVideo = true;}
            } else if (isStatic && imageTextureRef.current) {
                 textureToAssign = imageTextureRef.current;
                  if (textureToAssign.image) { sourceWidth = textureToAssign.image.naturalWidth; sourceHeight = textureToAssign.image.naturalHeight; }
                  // Ensure needsUpdate is set if it's the active texture and requires it
                  if (textureToAssign.needsUpdate) {
                       // No need to log every frame, just ensure it's true
                       textureToAssign.needsUpdate = true;
                  }
            }

            // Assign texture map to base plane if changed or requires update
             if (baseMaterial.map !== textureToAssign) {
                 baseMaterial.map = textureToAssign;
                 baseMaterial.needsUpdate = true;
                 console.log("DEBUG RenderLoop: Assigned base texture:", textureToAssign?.constructor?.name ?? 'null');
             } else if (textureToAssign && textureToAssign.needsUpdate) {
                 // If texture is the same but needsUpdate=true (e.g. static image loaded)
                 baseMaterial.needsUpdate = true; // Material needs update if texture content changed
                 if (logThisFrame) console.log("DEBUG RenderLoop: Triggering baseMaterial.needsUpdate because texture needed update.");
             }


            // 2. Update Plane Scale & Mirroring
            const planeVisible = !!baseMaterial.map && sourceWidth > 0 && sourceHeight > 0;
            if (planeVisible) {
                fitPlaneToCamera(sourceWidth, sourceHeight);
                const scaleX = Math.abs(basePlaneMeshRef.current.scale.x);
                const newScaleX = isVideo ? -scaleX : scaleX; // Mirror video, not static image
                if(basePlaneMeshRef.current.scale.x !== newScaleX) {
                    basePlaneMeshRef.current.scale.x = newScaleX;
                }
            } else {
                 // Hide plane if no texture or invalid dimensions
                 if (basePlaneMeshRef.current.scale.x !== 0 || basePlaneMeshRef.current.scale.y !== 0) {
                     basePlaneMeshRef.current.scale.set(0, 0, 0);
                     if (logThisFrame) console.log("DEBUG RenderLoop: Hiding base plane (no texture/dims).");
                 }
             }

            // 3. Render Base Scene to Target
             rendererInstanceRef.current.setRenderTarget(renderTargetRef.current);
             rendererInstanceRef.current.setClearColor(0x000000, 0); // Keep transparent background possibility
             rendererInstanceRef.current.clear();
             if (planeVisible) {
                 rendererInstanceRef.current.render(baseSceneRef.current, baseCameraRef.current);
                 if (logThisFrame) console.log(`DEBUG RenderLoop: Rendered base scene to target.`);
                 // Mark texture as updated *after* rendering it
                 if (textureToAssign?.needsUpdate) {
                    textureToAssign.needsUpdate = false;
                    if(logThisFrame) console.log("DEBUG RenderLoop: Set texture.needsUpdate = false");
                 }
             }
             else {
                if (logThisFrame) console.log(`DEBUG RenderLoop: Target cleared (plane hidden).`);
             }
             rendererInstanceRef.current.setRenderTarget(null);


            // 4. Update Post-Processing Uniforms
             postUniforms.uSceneTexture.value = renderTargetRef.current.texture;
             // *** UPDATE B/C UNIFORMS using internal refs ***
             postUniforms.uBrightness.value = currentBrightness.current;
             postUniforms.uContrast.value = currentContrast.current;
             // (Keep placeholders for future uniforms)
             // postUniforms.uEffectIntensity.value = currentIntensity.current;

             // Update Segmentation Mask Texture (if uniform exists on material)
             const segmentationMask = results?.segmentationMasks?.[0];
             const maskUniform = postUniforms.uSegmentationMask;
             // postUniforms.uHasMask.value = false; // Default to false
             if (maskUniform /* && segmentationMask?.mask */) { // Add mask logic later
                 /* ... update/assign mask texture ... */
                 // postUniforms.uHasMask.value = true;
             } else if (maskUniform && maskUniform.value !== null) {
                 maskUniform.value = null; // Ensure it's null if no mask
             }

            // 5. Render Post-Processing Scene to Screen
             rendererInstanceRef.current.render(postSceneRef.current, postCameraRef.current);


        } catch (error) { console.error("Error in renderLoop:", error); }
    // Include isStatic as it affects mirroring logic
    }, [fitPlaneToCamera, isStatic]);


    // --- Initialize Scene --- (Uses B/C Shader and Uniforms)
    const initThreeScene = useCallback(() => {
        if (!canvasRef.current || isInitialized.current) return;
        console.log("DEBUG: initThreeScene START (With B/C Shader)");
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

            // Base Scene (Plane with Source Texture)
            baseSceneRef.current = new THREE.Scene();
            baseCameraRef.current = new THREE.OrthographicCamera(-initialWidth / 2, initialWidth / 2, initialHeight / 2, -initialHeight / 2, 0.1, 10);
            baseCameraRef.current.position.z = 1;
            const planeGeometry = new THREE.PlaneGeometry(1, 1);
            const planeMaterial = new THREE.MeshBasicMaterial({ map: null, side: THREE.DoubleSide, color: 0xffffff, transparent: true }); // Ensure transparency is possible
            basePlaneMeshRef.current = new THREE.Mesh(planeGeometry, planeMaterial);
            basePlaneMeshRef.current.position.z = 0;
            basePlaneMeshRef.current.scale.set(1, 1, 1); // Start with non-zero scale
            baseSceneRef.current.add(basePlaneMeshRef.current);
            console.log("DEBUG: Base scene created.");

            // Post-Processing Scene (Full-Screen Quad with Shader)
            postSceneRef.current = new THREE.Scene();
            postCameraRef.current = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
            const postPlaneGeometry = new THREE.PlaneGeometry(2, 2);

            // *** Create ShaderMaterial with B/C Uniforms ***
            postMaterialRef.current = new THREE.ShaderMaterial({
                vertexShader: postVertexShader,
                fragmentShader: postFragmentShader,
                uniforms: {
                    uSceneTexture: { value: renderTargetRef.current.texture },
                    uBrightness: { value: 1.0 }, // Initial value
                    uContrast: { value: 1.0 },   // Initial value
                    // Placeholders for future uniforms:
                    // uSegmentationMask: { value: null },
                    // uEffectIntensity: { value: 0.5 },
                    // uHasMask: { value: false },
                },
                transparent: true, // Allow transparency from base texture/effects
                depthWrite: false,
                depthTest: false,
            });

            const postPlaneMesh = new THREE.Mesh(postPlaneGeometry, postMaterialRef.current);
            postSceneRef.current.add(postPlaneMesh);
            console.log("DEBUG: Post-processing scene created (With B/C Shader).");

            isInitialized.current = true;
            console.log("DEBUG: Scene initialization complete.");
            handleResize(); // Set initial size correctly
            console.log("DEBUG: Requesting first render loop frame from Init.");
            cancelAnimationFrame(animationFrameHandle.current);
            animationFrameHandle.current = requestAnimationFrame(renderLoop);

        } catch (error) {
            console.error("DEBUG: initThreeScene ERROR:", error);
            isInitialized.current = false; // Reset flag on error
        }
    // Added renderLoop as a dependency for init
    }, [handleResize, postVertexShader, postFragmentShader, renderLoop]);


    // --- Effect for Initial Setup / Resize Observer ---
    useEffect(() => {
         console.log("DEBUG: TryOnRenderer Mount/Init effect running.");
         initThreeScene(); // Initialize Three.js

         let resizeObserver;
         const currentCanvas = canvasRef.current;
         if (currentCanvas) {
             resizeObserver = new ResizeObserver(() => {
                 // Debounce or directly call handleResize
                 handleResize();
             });
             resizeObserver.observe(currentCanvas);
             console.log("DEBUG: Resize observer attached.");
         }

         // Cleanup function
         return () => {
             console.log("DEBUG: Cleanup running (TryOnRenderer Unmount)...");
             resizeObserver?.disconnect(); // Use disconnect() without arg if observing multiple elements, or pass element
             cancelAnimationFrame(animationFrameHandle.current);
             isInitialized.current = false;

             console.log("DEBUG: Disposing Three.js resources...");
             // Dispose textures managed by effects
             videoTextureRef.current?.dispose();
             imageTextureRef.current?.dispose();
             segmentationTextureRef.current?.dispose(); // If used later

             // Dispose render target
             renderTargetRef.current?.dispose();

             // Dispose geometries and materials
             basePlaneMeshRef.current?.geometry?.dispose();
             basePlaneMeshRef.current?.material?.map?.dispose(); // Dispose texture map if exists
             basePlaneMeshRef.current?.material?.dispose();
             postMaterialRef.current?.uniforms?.uSceneTexture?.value?.dispose(); // Dispose texture in uniform
             postMaterialRef.current?.uniforms?.uSegmentationMask?.value?.dispose(); // Dispose mask texture if exists
             postMaterialRef.current?.dispose(); // Dispose the shader material

             // Dispose renderer
             rendererInstanceRef.current?.dispose();

             // Nullify refs
             videoTextureRef.current = null;
             imageTextureRef.current = null;
             segmentationTextureRef.current = null;
             renderTargetRef.current = null;
             basePlaneMeshRef.current = null;
             postMaterialRef.current = null;
             rendererInstanceRef.current = null;
             baseSceneRef.current = null; // Also nullify scenes/cameras if needed
             postSceneRef.current = null;
             baseCameraRef.current = null;
             postCameraRef.current = null;

             console.log("DEBUG: Three.js resources disposed.");
        };
     // Dependencies for mount/unmount effect
     }, [initThreeScene, handleResize]);


    // --- JSX ---
    return (
        <canvas
            ref={canvasRef}
            className={`renderer-canvas ${className || ''}`}
            // Ensure style allows visibility and correct layout
            style={{ display: 'block', width: '100%', height: '100%', ...(style || {}) }}
        />
    );
});

TryOnRenderer.displayName = 'TryOnRenderer';
export default TryOnRenderer;