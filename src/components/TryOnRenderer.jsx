// src/components/TryOnRenderer.jsx - Mask Effect DISABLED + Simplified Shader

import React, { useRef, forwardRef, useEffect, useCallback } from 'react';
import * as THREE from 'three';

const TryOnRenderer = forwardRef(({
    videoRefProp, imageElement, mediaPipeResults,
    segmentationResults, // Prop received but COMPLETELY IGNORED now
    isStatic, brightness, contrast, effectIntensity,
    className, style
 }, ref) => {

    // Core Refs / Internal State Refs
    const canvasRef = useRef(null); const rendererInstanceRef = useRef(null); const animationFrameHandle = useRef(null); const isInitialized = useRef(false);
    const baseSceneRef = useRef(null); const baseCameraRef = useRef(null); const basePlaneMeshRef = useRef(null); const videoTextureRef = useRef(null);
    const imageTextureRef = useRef(null); const postSceneRef = useRef(null); const postCameraRef = useRef(null); const postMaterialRef = useRef(null);
    const renderTargetRef = useRef(null);
    // Keep ref, but effect that uses it is disabled
    const segmentationTextureRef = useRef(null);
    const currentBrightness = useRef(1.0); const currentContrast = useRef(1.0);
    const renderLoopCounter = useRef(0); const lastMaskUpdateTime = useRef(0); // Unused now

    // Shaders (Simplified B/C Only)
    const postVertexShader = `varying vec2 vUv; void main() { vUv = uv; gl_Position = vec4(position, 1.0); }`;
    const postFragmentShader = `
        uniform sampler2D uSceneTexture; uniform float uBrightness; uniform float uContrast; varying vec2 vUv;
        vec3 applyBrightnessContrast(vec3 c, float b, float co){ c=c*b; c=(c-0.5)*co+0.5; return c; }
        void main() { vec4 b = texture2D(uSceneTexture, vUv); vec3 c = applyBrightnessContrast(b.rgb, uBrightness, uContrast); vec3 f = clamp(c, 0.0, 1.0); gl_FragColor = vec4(f, b.a); }`;

    // Prop Effects (Intensity is ignored, B/C used)
    useEffect(() => { currentBrightness.current = isStatic ? Math.max(0.01, brightness || 1.0) : 1.0; currentContrast.current = isStatic ? Math.max(0.01, contrast || 1.0) : 1.0; }, [isStatic, brightness, contrast]);
    // No useEffect needed for intensity as it's not used by shader

    // Video/Image Texture Effects (Crucial - Ensure these run correctly)
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

    useEffect(() => {
        if (isStatic && imageElement) {
             if (!imageTextureRef.current || imageTextureRef.current.image !== imageElement) {
                console.log("TryOnRenderer Effect: Creating/Updating Image Texture for:", imageElement);
                imageTextureRef.current?.dispose();
                imageTextureRef.current = new THREE.Texture(imageElement);
                imageTextureRef.current.colorSpace = THREE.SRGBColorSpace;
                imageTextureRef.current.needsUpdate = true; // Mark for upload
             } else if (imageTextureRef.current && imageTextureRef.current.image === imageElement) {
                 // If element is same but might have been reloaded/redrawn
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


    // --- ***** DISABLED Segmentation Mask Texture Effect ***** ---
    /*
    useEffect(() => {
        // --- THIS WHOLE BLOCK IS COMMENTED OUT ---
        // const results = segmentationResults;
        // const hasMaskDataArray = Array.isArray(results?.confidenceMasks) && results.confidenceMasks.length > 0;
        // console.log(`TryOnRenderer Mask EFFECT DISABLED Check: Would check prop: ${!!results}`);
        // if (hasMaskDataArray) {
        //    // ... logic to get maskData ...
        //     if (maskData instanceof Float32Array && maskWidth > 0 && maskHeight > 0) {
        //         // ... logic to throttle and create/update texture ...
        //         // segmentationTextureRef.current = new THREE.DataTexture(...)
        //     } else {
        //         // ... cleanup logic ...
        //     }
        // } else {
        //     // ... cleanup logic ...
        // }
        // --- END OF COMMENTED OUT BLOCK ---

        // Ensure texture ref is null if effect is disabled
        if (segmentationTextureRef.current) {
             console.warn("TryOnRenderer Mask EFFECT DISABLED: Disposing lingering mask texture.");
             segmentationTextureRef.current.dispose();
             segmentationTextureRef.current = null;
        }

    }, [segmentationResults, isStatic]); // Keep dependencies for potential re-enablement
    */
    // --- ************************************************** ---


    // Handle Resizing / Scale Plane (No changes)
    const handleResize = useCallback(() => { /* ... */ }, []);
    const fitPlaneToCamera = useCallback((textureWidth, textureHeight) => { /* ... */ }, []);

    // Render Loop (Simplified Uniform Update)
     const renderLoop = useCallback(() => {
        animationFrameHandle.current = requestAnimationFrame(renderLoop);
        if (!isInitialized.current || !rendererInstanceRef.current || !postMaterialRef.current ) { return; }

        try {
            const postUniforms = postMaterialRef.current.uniforms;
            if (!postUniforms?.uSceneTexture || !postUniforms?.uBrightness || !postUniforms?.uContrast ) { return; } // Check only needed uniforms

            // Steps 1, 2, 3 (Select Texture, Scale Plane, Render Base)
            const baseMaterial = basePlaneMeshRef.current?.material; let sourceWidth = 0, sourceHeight = 0; let textureToAssign = null; let isVideo = false;
            if (!isStatic && videoTextureRef.current) { textureToAssign = videoTextureRef.current; if (textureToAssign.image) { sourceWidth = textureToAssign.image.videoWidth; sourceHeight = textureToAssign.image.videoHeight; isVideo = true;} } else if (isStatic && imageTextureRef.current) { textureToAssign = imageTextureRef.current; if (textureToAssign.image) { sourceWidth = textureToAssign.image.naturalWidth; sourceHeight = textureToAssign.image.naturalHeight; } if (textureToAssign.needsUpdate) { textureToAssign.needsUpdate = true; } }

            // Ensure texture is assigned and updated if needed
            if(baseMaterial){
                 let needsMatUpdate = false;
                 if (baseMaterial.map !== textureToAssign) {
                     baseMaterial.map = textureToAssign;
                     needsMatUpdate = true;
                     console.log("RenderLoop: Assigned base texture.");
                 }
                 // Crucially, check needsUpdate flag on the TEXTURE
                 if (textureToAssign?.needsUpdate) {
                     textureToAssign.needsUpdate = false; // Reset flag after use
                     needsMatUpdate = true; // Material needs update if texture content changed
                     console.log("RenderLoop: Texture needsUpdate was true.");
                 }
                 // Update material if texture assigned or texture updated
                 if(needsMatUpdate) {
                      baseMaterial.needsUpdate = true;
                 }
            }

            const planeVisible = !!baseMaterial?.map && sourceWidth > 0 && sourceHeight > 0;
            if (planeVisible && basePlaneMeshRef.current) { // Check ref exists
                fitPlaneToCamera(sourceWidth, sourceHeight);
                const scaleX = Math.abs(basePlaneMeshRef.current.scale.x); const newScaleX = isVideo ? -scaleX : scaleX;
                if(basePlaneMeshRef.current.scale.x !== newScaleX) { basePlaneMeshRef.current.scale.x = newScaleX; }
            } else { if (basePlaneMeshRef.current?.scale.x !== 0 || basePlaneMeshRef.current?.scale.y !== 0) { basePlaneMeshRef.current?.scale.set(0, 0, 0); } }

            // Render base scene to target
            if (renderTargetRef.current && baseSceneRef.current && baseCameraRef.current) {
                rendererInstanceRef.current.setRenderTarget(renderTargetRef.current); rendererInstanceRef.current.setClearColor(0x000000, 0); rendererInstanceRef.current.clear();
                 if (planeVisible) {
                     // Check texture is ready before rendering
                     if(textureToAssign?.image && (isVideo ? textureToAssign.image.readyState >= 2 : textureToAssign.image.complete) ) {
                         rendererInstanceRef.current.render(baseSceneRef.current, baseCameraRef.current);
                     } else {
                          // console.log("RenderLoop: Skipping base render, texture not ready.");
                     }
                 }
                 rendererInstanceRef.current.setRenderTarget(null);
            }

            // Update Post-Processing Uniforms (ONLY B/C)
             postUniforms.uSceneTexture.value = renderTargetRef.current?.texture;
             postUniforms.uBrightness.value = currentBrightness.current;
             postUniforms.uContrast.value = currentContrast.current;

            // Render Post-Processing Scene to Screen
             if(postSceneRef.current && postCameraRef.current) {
                 rendererInstanceRef.current.render(postSceneRef.current, postCameraRef.current);
             }

        } catch (error) { console.error("Error in renderLoop:", error); }
    }, [fitPlaneToCamera, isStatic]); // Keep dependencies


    // Initialize Scene (Simplified Uniforms)
    const initThreeScene = useCallback(() => {
        if (!canvasRef.current || isInitialized.current) return;
        console.log("DEBUG: initThreeScene START (Mask Effect DISABLED, Simplified B/C Shader)");
        try {
            // ... (Renderer, RenderTarget, Base Scene setup - no changes) ...
            const canvas = canvasRef.current; const iw = canvas.clientWidth||640; const ih = canvas.clientHeight||480;
            rendererInstanceRef.current = new THREE.WebGLRenderer({ canvas: canvas, antialias: true }); rendererInstanceRef.current.setSize(iw, ih); rendererInstanceRef.current.setPixelRatio(window.devicePixelRatio); rendererInstanceRef.current.outputColorSpace = THREE.SRGBColorSpace;
            renderTargetRef.current = new THREE.WebGLRenderTarget(iw, ih, { minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, format: THREE.RGBAFormat, colorSpace: THREE.SRGBColorSpace });
            baseSceneRef.current = new THREE.Scene(); baseCameraRef.current = new THREE.OrthographicCamera(-iw/2, iw/2, ih/2, -ih/2, 0.1, 10); baseCameraRef.current.position.z = 1; const pg = new THREE.PlaneGeometry(1,1); const pm = new THREE.MeshBasicMaterial({map: null, side: THREE.DoubleSide, color: 0xffffff, transparent: true}); basePlaneMeshRef.current = new THREE.Mesh(pg, pm); baseSceneRef.current.add(basePlaneMeshRef.current);
            postSceneRef.current = new THREE.Scene(); postCameraRef.current = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1); const ppg = new THREE.PlaneGeometry(2, 2);

            // Initialize Material with ONLY B/C Uniforms
            postMaterialRef.current = new THREE.ShaderMaterial({
                vertexShader: postVertexShader, fragmentShader: postFragmentShader,
                uniforms: { uSceneTexture: { value: renderTargetRef.current.texture }, uBrightness: { value: 1.0 }, uContrast: { value: 1.0 }, },
                transparent: true, depthWrite: false, depthTest: false,
            });

            const postPlaneMesh = new THREE.Mesh(ppg, postMaterialRef.current); postSceneRef.current.add(postPlaneMesh);
            console.log("DEBUG: Post-processing scene created (Simplified B/C Shader).");

            isInitialized.current = true; handleResize(); cancelAnimationFrame(animationFrameHandle.current); animationFrameHandle.current = requestAnimationFrame(renderLoop);
        } catch (error) { console.error("DEBUG: initThreeScene ERROR:", error); isInitialized.current = false; }
    }, [handleResize, postVertexShader, postFragmentShader, renderLoop]);


    // Setup / Cleanup Effect (No changes)
    useEffect(() => { /* ... */ }, [initThreeScene, handleResize]);

    // JSX (No change)
    return ( <canvas ref={canvasRef} className={`renderer-canvas ${className || ''}`} style={{ display: 'block', width: '100%', height: '100%', ...(style || {}) }} /> );
});
TryOnRenderer.displayName = 'TryOnRenderer';
export default TryOnRenderer;