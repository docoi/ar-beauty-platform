// src/components/TryOnRenderer.jsx - MINIMAL Shader (B/C only) for Debugging Display

import React, { useRef, forwardRef, useEffect, useCallback } from 'react';
import * as THREE from 'three';

const TryOnRenderer = forwardRef(({
    videoRefProp, imageElement, mediaPipeResults,
    segmentationResults, // Prop is received but NOT used by this simplified shader
    isStatic, brightness, contrast, effectIntensity,
    className, style
 }, ref) => {

    // --- Core Refs / Internal State Refs --- (No changes)
    const canvasRef = useRef(null); const rendererInstanceRef = useRef(null); const animationFrameHandle = useRef(null); const isInitialized = useRef(false);
    const baseSceneRef = useRef(null); const baseCameraRef = useRef(null); const basePlaneMeshRef = useRef(null); const videoTextureRef = useRef(null);
    const imageTextureRef = useRef(null); const postSceneRef = useRef(null); const postCameraRef = useRef(null); const postMaterialRef = useRef(null);
    const renderTargetRef = useRef(null); const segmentationTextureRef = useRef(null); // Keep ref, effect will still populate it
    const currentBrightness = useRef(1.0); const currentContrast = useRef(1.0); const currentIntensity = useRef(0.5);
    const renderLoopCounter = useRef(0); const lastMaskUpdateTime = useRef(0);

    // --- ***** SIMPLIFIED Fragment Shader (B/C Correction Only) ***** ---
    const postVertexShader = `varying vec2 vUv; void main() { vUv = uv; gl_Position = vec4(position, 1.0); }`;
    const postFragmentShader = `
        uniform sampler2D uSceneTexture; // Base image from render target
        uniform float uBrightness;
        uniform float uContrast;
        // Removed: uSegmentationMask, uEffectIntensity, uHasMask

        varying vec2 vUv;

        // Function to apply brightness and contrast
        vec3 applyBrightnessContrast(vec3 color, float brightness, float contrast) {
            color = color * brightness;
            color = (color - 0.5) * contrast + 0.5;
            return color;
        }

        void main() {
            vec4 baseColor = texture2D(uSceneTexture, vUv);

            // Apply Brightness/Contrast Correction ONLY
            vec3 correctedColor = applyBrightnessContrast(baseColor.rgb, uBrightness, uContrast);

            // Output the corrected color directly
            vec3 finalColor = clamp(correctedColor, 0.0, 1.0);
            gl_FragColor = vec4(finalColor, baseColor.a);
        }
    `;
    // --- ********************************************************** ---

    // --- Prop Effects (Intensity, Brightness/Contrast) --- (No changes)
    useEffect(() => { currentBrightness.current = isStatic ? Math.max(0.01, brightness || 1.0) : 1.0; currentContrast.current = isStatic ? Math.max(0.01, contrast || 1.0) : 1.0; }, [isStatic, brightness, contrast]);
    useEffect(() => { currentIntensity.current = effectIntensity; }, [effectIntensity]); // Intensity prop no longer used by shader

    // --- Video/Image Texture Effects --- (No changes)
    useEffect(() => { /* ... Video Texture Logic ... */ }, [isStatic, videoRefProp]);
    useEffect(() => { /* ... Image Texture Logic ... */ }, [isStatic, imageElement]);


    // --- Segmentation Mask Texture Effect (Keep this logic - it creates the texture) ---
    useEffect(() => {
        const results = segmentationResults;
        const hasMaskDataArray = Array.isArray(results?.confidenceMasks) && results.confidenceMasks.length > 0;
        if (hasMaskDataArray) {
            const confidenceMaskObject = results.confidenceMasks[0];
            const maskWidth = confidenceMaskObject?.width;
            const maskHeight = confidenceMaskObject?.height;
            let maskData = null;
            if (typeof confidenceMaskObject?.getAsFloat32Array === 'function') {
                try { maskData = confidenceMaskObject.getAsFloat32Array(); } catch (error) { console.error("Error calling getAsFloat32Array():", error); maskData = null; }
            } else if(confidenceMaskObject?.data) { maskData = confidenceMaskObject.data;}

             if (maskData instanceof Float32Array && maskWidth > 0 && maskHeight > 0) {
                 const now = performance.now(); const timeSinceLastUpdate = now - lastMaskUpdateTime.current; const throttleThreshold = isStatic ? 0 : 66;
                 if (timeSinceLastUpdate > throttleThreshold) {
                    lastMaskUpdateTime.current = now;
                    try {
                        if (!segmentationTextureRef.current || segmentationTextureRef.current.image.width !== maskWidth || segmentationTextureRef.current.image.height !== maskHeight) {
                            // console.log(` -> Creating NEW DataTexture (${maskWidth}x${maskHeight}) - (Shader won't use it yet)`); // Adjusted log
                            segmentationTextureRef.current?.dispose();
                            segmentationTextureRef.current = new THREE.DataTexture(maskData, maskWidth, maskHeight, THREE.RedFormat, THREE.FloatType);
                            segmentationTextureRef.current.minFilter = THREE.LinearFilter; segmentationTextureRef.current.magFilter = THREE.LinearFilter;
                            segmentationTextureRef.current.needsUpdate = true;
                            // console.log(`TryOnRenderer Mask EFFECT Texture: New DataTexture CREATED (but unused by current shader).`); // Adjusted log
                        } else {
                            segmentationTextureRef.current.image.data = maskData;
                            segmentationTextureRef.current.needsUpdate = true;
                        }
                    } catch (error) { console.error("TryOnRenderer Mask Texture: Error creating/updating DataTexture:", error); segmentationTextureRef.current?.dispose(); segmentationTextureRef.current = null; }
                 }
             } else { if (segmentationTextureRef.current) { segmentationTextureRef.current.dispose(); segmentationTextureRef.current = null; } }
        } else { if (segmentationTextureRef.current) { segmentationTextureRef.current.dispose(); segmentationTextureRef.current = null; } }
    }, [segmentationResults, isStatic]);


    // --- Handle Resizing / Scale Plane --- (No changes needed)
    const handleResize = useCallback(() => { /* ... */ }, []);
    const fitPlaneToCamera = useCallback((textureWidth, textureHeight) => { /* ... */ }, []);

    // --- Render Loop --- (Simplified Uniform Update)
     const renderLoop = useCallback(() => {
        animationFrameHandle.current = requestAnimationFrame(renderLoop);
        if (!isInitialized.current || !rendererInstanceRef.current || !postMaterialRef.current ) { return; }

        try {
            const postUniforms = postMaterialRef.current.uniforms;
            // Check only for uniforms used by the simplified shader
            if (!postUniforms?.uSceneTexture || !postUniforms?.uBrightness || !postUniforms?.uContrast ) {
                 console.warn("RenderLoop: B/C uniforms not ready.");
                 return; // Skip frame if uniforms aren't ready
            }

            // Steps 1, 2, 3 (Select Texture, Scale Plane, Render Base) - Condensed
            const baseMaterial = basePlaneMeshRef.current?.material; let sourceWidth = 0, sourceHeight = 0; let textureToAssign = null; let isVideo = false;
            if (!isStatic && videoTextureRef.current) { textureToAssign = videoTextureRef.current; if (textureToAssign.image) { sourceWidth = textureToAssign.image.videoWidth; sourceHeight = textureToAssign.image.videoHeight; isVideo = true;} } else if (isStatic && imageTextureRef.current) { textureToAssign = imageTextureRef.current; if (textureToAssign.image) { sourceWidth = textureToAssign.image.naturalWidth; sourceHeight = textureToAssign.image.naturalHeight; } if (textureToAssign.needsUpdate) { textureToAssign.needsUpdate = true; } }
            if(baseMaterial){ if (baseMaterial.map !== textureToAssign) { baseMaterial.map = textureToAssign; baseMaterial.needsUpdate = true; } else if (textureToAssign && textureToAssign.needsUpdate) { baseMaterial.needsUpdate = true; } }
            const planeVisible = !!baseMaterial?.map && sourceWidth > 0 && sourceHeight > 0;
            if (planeVisible) { fitPlaneToCamera(sourceWidth, sourceHeight); const scaleX = Math.abs(basePlaneMeshRef.current.scale.x); const newScaleX = isVideo ? -scaleX : scaleX; if(basePlaneMeshRef.current.scale.x !== newScaleX) { basePlaneMeshRef.current.scale.x = newScaleX; } } else { if (basePlaneMeshRef.current?.scale.x !== 0 || basePlaneMeshRef.current?.scale.y !== 0) { basePlaneMeshRef.current?.scale.set(0, 0, 0); } }
            if (renderTargetRef.current && baseSceneRef.current && baseCameraRef.current) { // Check refs before use
                rendererInstanceRef.current.setRenderTarget(renderTargetRef.current); rendererInstanceRef.current.setClearColor(0x000000, 0); rendererInstanceRef.current.clear();
                 if (planeVisible) { rendererInstanceRef.current.render(baseSceneRef.current, baseCameraRef.current); if (textureToAssign?.needsUpdate) { textureToAssign.needsUpdate = false; } }
                 rendererInstanceRef.current.setRenderTarget(null);
            }


            // 4. Update Post-Processing Uniforms (ONLY B/C)
             postUniforms.uSceneTexture.value = renderTargetRef.current?.texture;
             postUniforms.uBrightness.value = currentBrightness.current;
             postUniforms.uContrast.value = currentContrast.current;
             // No need to update mask/intensity uniforms as they aren't used

            // 5. Render Post-Processing Scene to Screen
             if(postSceneRef.current && postCameraRef.current) {
                 rendererInstanceRef.current.render(postSceneRef.current, postCameraRef.current);
             }

        } catch (error) { console.error("Error in renderLoop:", error); }
    }, [fitPlaneToCamera, isStatic]);


    // --- Initialize Scene --- (Remove Unused Uniforms)
    const initThreeScene = useCallback(() => {
        if (!canvasRef.current || isInitialized.current) return;
        console.log("DEBUG: initThreeScene START (Simplified B/C Shader)");
        try {
            const canvas = canvasRef.current; const initialWidth = canvas.clientWidth || 640; const initialHeight = canvas.clientHeight || 480;
            rendererInstanceRef.current = new THREE.WebGLRenderer({ canvas: canvas, antialias: true }); rendererInstanceRef.current.setSize(initialWidth, initialHeight); rendererInstanceRef.current.setPixelRatio(window.devicePixelRatio); rendererInstanceRef.current.outputColorSpace = THREE.SRGBColorSpace;
            renderTargetRef.current = new THREE.WebGLRenderTarget(initialWidth, initialHeight, { minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, format: THREE.RGBAFormat, colorSpace: THREE.SRGBColorSpace });
            baseSceneRef.current = new THREE.Scene(); baseCameraRef.current = new THREE.OrthographicCamera(-initialWidth / 2, initialWidth / 2, initialHeight / 2, -initialHeight / 2, 0.1, 10); baseCameraRef.current.position.z = 1; const planeGeometry = new THREE.PlaneGeometry(1, 1); const planeMaterial = new THREE.MeshBasicMaterial({ map: null, side: THREE.DoubleSide, color: 0xffffff, transparent: true }); basePlaneMeshRef.current = new THREE.Mesh(planeGeometry, planeMaterial); baseSceneRef.current.add(basePlaneMeshRef.current);
            postSceneRef.current = new THREE.Scene(); postCameraRef.current = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1); const postPlaneGeometry = new THREE.PlaneGeometry(2, 2);

            // *** Initialize Material with ONLY B/C Uniforms ***
            postMaterialRef.current = new THREE.ShaderMaterial({
                vertexShader: postVertexShader,
                fragmentShader: postFragmentShader, // Use the simplified shader
                uniforms: {
                    uSceneTexture: { value: renderTargetRef.current.texture },
                    uBrightness: { value: 1.0 },
                    uContrast: { value: 1.0 },
                    // REMOVED: uSegmentationMask, uEffectIntensity, uHasMask
                },
                transparent: true, depthWrite: false, depthTest: false,
            });

            const postPlaneMesh = new THREE.Mesh(postPlaneGeometry, postMaterialRef.current);
            postSceneRef.current.add(postPlaneMesh);
            console.log("DEBUG: Post-processing scene created (Simplified B/C Shader).");

            isInitialized.current = true; handleResize(); cancelAnimationFrame(animationFrameHandle.current); animationFrameHandle.current = requestAnimationFrame(renderLoop);
        } catch (error) { console.error("DEBUG: initThreeScene ERROR:", error); isInitialized.current = false; }
    // Update dependencies if needed, renderLoop is used
    }, [handleResize, postVertexShader, postFragmentShader, renderLoop]);


    // --- Setup / Cleanup Effect --- (No changes needed, disposal handles null refs)
    useEffect(() => { initThreeScene(); let resizeObserver; const currentCanvas = canvasRef.current; if (currentCanvas) { resizeObserver = new ResizeObserver(() => { handleResize(); }); resizeObserver.observe(currentCanvas); } return () => { resizeObserver?.disconnect(); cancelAnimationFrame(animationFrameHandle.current); isInitialized.current = false; /* ... dispose all resources ... */ videoTextureRef.current?.dispose(); imageTextureRef.current?.dispose(); segmentationTextureRef.current?.dispose(); renderTargetRef.current?.dispose(); basePlaneMeshRef.current?.geometry?.dispose(); basePlaneMeshRef.current?.material?.map?.dispose(); basePlaneMeshRef.current?.material?.dispose(); postMaterialRef.current?.dispose(); rendererInstanceRef.current?.dispose(); /* ... nullify refs ... */ videoTextureRef.current = null; imageTextureRef.current = null; segmentationTextureRef.current = null; renderTargetRef.current = null; basePlaneMeshRef.current = null; postMaterialRef.current = null; rendererInstanceRef.current = null; baseSceneRef.current = null; postSceneRef.current = null; baseCameraRef.current = null; postCameraRef.current = null; }; }, [initThreeScene, handleResize]);


    // --- JSX --- (No change)
    return ( <canvas ref={canvasRef} className={`renderer-canvas ${className || ''}`} style={{ display: 'block', width: '100%', height: '100%', ...(style || {}) }} /> );
});
TryOnRenderer.displayName = 'TryOnRenderer';
export default TryOnRenderer;