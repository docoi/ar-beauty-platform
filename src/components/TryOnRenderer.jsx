// src/components/TryOnRenderer.jsx - Restore Basic Post-Processing (Pass-Through Shader)

import React, { useRef, forwardRef, useEffect, useCallback } from 'react';
import * as THREE from 'three';

const TryOnRenderer = forwardRef(({
    videoRefProp, imageElement,
    mediaPipeResults, // Not used by shader yet
    segmentationResults, // <<< USE THIS for mask texture creation
    isStatic, brightness, contrast, effectIntensity, // B/C/I not used by shader yet
    className, style
 }, ref) => {

    // --- Core Refs --- (Restore Post-Processing Refs)
    const canvasRef = useRef(null); const rendererInstanceRef = useRef(null); const animationFrameHandle = useRef(null); const isInitialized = useRef(false);
    const baseSceneRef = useRef(null); const baseCameraRef = useRef(null); const basePlaneMeshRef = useRef(null); const videoTextureRef = useRef(null);
    const imageTextureRef = useRef(null);
    const postSceneRef = useRef(null); // << Add back
    const postCameraRef = useRef(null); // << Add back
    const postMaterialRef = useRef(null); // << Add back
    const renderTargetRef = useRef(null); // << Add back
    const segmentationTextureRef = useRef(null); // << Add back (effect creates it)

    // --- Internal State Refs --- (Restore B/C/I refs)
    const currentBrightness = useRef(1.0); const currentContrast = useRef(1.0); const currentIntensity = useRef(0.5);
    const renderLoopCounter = useRef(0); const lastMaskUpdateTime = useRef(0);

    // --- Shaders --- (Minimal Pass-Through Post-Processing Shader)
    const postVertexShader = `varying vec2 vUv; void main() { vUv = uv; gl_Position = vec4(position, 1.0); }`;
    const postFragmentShader = `
        uniform sampler2D uSceneTexture; // Input from the render target
        varying vec2 vUv;
        void main() {
            // Just display the texture from the render target
            gl_FragColor = texture2D(uSceneTexture, vUv);
        }
    `;

    // --- Prop Effects --- (Restore B/C/I updates)
    useEffect(() => { currentBrightness.current = isStatic ? Math.max(0.01, brightness || 1.0) : 1.0; currentContrast.current = isStatic ? Math.max(0.01, contrast || 1.0) : 1.0; }, [isStatic, brightness, contrast]);
    useEffect(() => { currentIntensity.current = effectIntensity; }, [effectIntensity]);

    // --- Video/Image Texture Effects --- (No changes needed)
    useEffect(() => { /* ... Video Texture Logic ... */ }, [isStatic, videoRefProp]);
    useEffect(() => { /* ... Image Texture Logic ... */ }, [isStatic, imageElement]);

    // --- Segmentation Mask Texture Effect --- (Keep this - it creates the texture even if unused)
    useEffect(() => {
        const results = segmentationResults;
        const hasMaskDataArray = Array.isArray(results?.confidenceMasks) && results.confidenceMasks.length > 0;
        if (hasMaskDataArray) {
            const confidenceMaskObject = results.confidenceMasks[0];
            const maskWidth = confidenceMaskObject?.width;
            const maskHeight = confidenceMaskObject?.height;
            let maskData = null;
            if (typeof confidenceMaskObject?.getAsFloat32Array === 'function') {
                try { maskData = confidenceMaskObject.getAsFloat32Array(); } catch (error) { maskData = null; }
            } else if(confidenceMaskObject?.data) { maskData = confidenceMaskObject.data;}
             if (maskData instanceof Float32Array && maskWidth > 0 && maskHeight > 0) {
                 const now = performance.now(); const timeSinceLastUpdate = now - lastMaskUpdateTime.current; const throttleThreshold = isStatic ? 0 : 66;
                 if (timeSinceLastUpdate > throttleThreshold) {
                    lastMaskUpdateTime.current = now;
                    try {
                        if (!segmentationTextureRef.current || segmentationTextureRef.current.image.width !== maskWidth || segmentationTextureRef.current.image.height !== maskHeight) {
                            // console.log(` -> Creating NEW DataTexture (${maskWidth}x${maskHeight}) - (Unused by shader)`);
                            segmentationTextureRef.current?.dispose();
                            segmentationTextureRef.current = new THREE.DataTexture(maskData, maskWidth, maskHeight, THREE.RedFormat, THREE.FloatType);
                            segmentationTextureRef.current.minFilter = THREE.LinearFilter; segmentationTextureRef.current.magFilter = THREE.LinearFilter;
                            segmentationTextureRef.current.needsUpdate = true;
                            // console.log(`TryOnRenderer Mask EFFECT Texture: New DataTexture CREATED (Unused).`);
                        } else {
                            segmentationTextureRef.current.image.data = maskData;
                            segmentationTextureRef.current.needsUpdate = true;
                        }
                    } catch (error) { console.error("Mask Texture Error:", error); segmentationTextureRef.current?.dispose(); segmentationTextureRef.current = null; }
                 }
             } else { if (segmentationTextureRef.current) { segmentationTextureRef.current.dispose(); segmentationTextureRef.current = null; } }
        } else { if (segmentationTextureRef.current) { segmentationTextureRef.current.dispose(); segmentationTextureRef.current = null; } }
    }, [segmentationResults, isStatic]);

    // --- Handle Resizing --- (Restore Render Target Resizing)
    const handleResize = useCallback(() => {
         const canvas = canvasRef.current;
         // Add checks for all relevant refs
         if (!rendererInstanceRef.current || !baseCameraRef.current || !postCameraRef.current || !canvas || !renderTargetRef.current) return;
         const newWidth = canvas.clientWidth; const newHeight = canvas.clientHeight;
         if (newWidth === 0 || newHeight === 0) return;
         const currentSize = rendererInstanceRef.current.getSize(new THREE.Vector2());
         if (currentSize.x === newWidth && currentSize.y === newHeight) return;
         console.log(`DEBUG: Resizing Renderer & Target -> ${newWidth}x${newHeight}`);
         try {
             rendererInstanceRef.current.setSize(newWidth, newHeight);
             // Resize Render Target
             renderTargetRef.current.setSize(newWidth, newHeight);
             // Update Base Camera
             baseCameraRef.current.left = -newWidth / 2; baseCameraRef.current.right = newWidth / 2;
             baseCameraRef.current.top = newHeight / 2; baseCameraRef.current.bottom = -newHeight / 2;
             baseCameraRef.current.updateProjectionMatrix();
             // Post Camera usually doesn't need resize unless view changes
         } catch(e) { console.error("Resize Error:", e);}
    }, []); // Empty deps array should be fine if it only accesses refs

    // --- Scale Base Plane --- (No changes needed)
    const fitPlaneToCamera = useCallback(/* ... */, []);

    // --- ***** Render Loop (Restore Post-Processing) ***** ---
     const renderLoop = useCallback(() => {
        animationFrameHandle.current = requestAnimationFrame(renderLoop);
        // Check essential refs for post-processing
        if (!isInitialized.current || !rendererInstanceRef.current || !baseSceneRef.current || !baseCameraRef.current || !postSceneRef.current || !postCameraRef.current || !basePlaneMeshRef.current || !postMaterialRef.current || !renderTargetRef.current) {
            return; // Skip frame if not ready
        }

        const currentCount = renderLoopCounter.current++;
        const logThisFrame = (currentCount % 150 === 0);

        try {
            const postUniforms = postMaterialRef.current.uniforms;
             // Check only for uSceneTexture used by pass-through shader
            if (!postUniforms?.uSceneTexture) {
                if(logThisFrame) console.warn("RenderLoop: uSceneTexture uniform not ready.");
                return;
            }

            // 1. Select Source Texture (same logic as before)
            const baseMaterial = basePlaneMeshRef.current.material; let sourceWidth = 0, sourceHeight = 0; let textureToAssign = null; let isVideo = false;
            if (!isStatic && videoTextureRef.current) { /*...*/ textureToAssign = videoTextureRef.current; isVideo = true; if(textureToAssign.image) {sourceWidth=textureToAssign.image.videoWidth; sourceHeight=textureToAssign.image.videoHeight;} } else if (isStatic && imageTextureRef.current) { /*...*/ textureToAssign = imageTextureRef.current; if(textureToAssign.image){sourceWidth=textureToAssign.image.naturalWidth; sourceHeight=textureToAssign.image.naturalHeight;} if(textureToAssign.needsUpdate){textureToAssign.needsUpdate=true;} }
            if(baseMaterial){ if (baseMaterial.map !== textureToAssign) { baseMaterial.map = textureToAssign; baseMaterial.needsUpdate = true; } else if (textureToAssign && textureToAssign.needsUpdate) { baseMaterial.needsUpdate = true; } }

            // 2. Update Plane Scale & Mirroring (same logic as before)
            const planeVisible = !!baseMaterial?.map && sourceWidth > 0 && sourceHeight > 0;
            if (planeVisible) { fitPlaneToCamera(sourceWidth, sourceHeight); const scaleX = Math.abs(basePlaneMeshRef.current.scale.x); const newScaleX = isVideo ? -scaleX : scaleX; if(basePlaneMeshRef.current.scale.x !== newScaleX) { basePlaneMeshRef.current.scale.x = newScaleX; } } else { if (basePlaneMeshRef.current?.scale.x !== 0 || basePlaneMeshRef.current?.scale.y !== 0) { basePlaneMeshRef.current?.scale.set(0, 0, 0); } }

            // 3. *** Render Base Scene to Target ***
            rendererInstanceRef.current.setRenderTarget(renderTargetRef.current);
            rendererInstanceRef.current.setClearColor(0x000000, 0); // Clear target transparently
            rendererInstanceRef.current.clear();
             if (planeVisible) {
                 rendererInstanceRef.current.render(baseSceneRef.current, baseCameraRef.current);
                 if (textureToAssign?.needsUpdate) { textureToAssign.needsUpdate = false; }
             }
             // else: Target is just cleared if plane not visible

            // 4. *** Update Post-Processing Uniforms (Minimal) ***
             rendererInstanceRef.current.setRenderTarget(null); // Switch back to canvas
             postUniforms.uSceneTexture.value = renderTargetRef.current.texture;
             // No other uniforms needed for pass-through shader

            // 5. *** Render Post-Processing Scene to Screen ***
             rendererInstanceRef.current.render(postSceneRef.current, postCameraRef.current);

        } catch (error) { console.error("Error in renderLoop:", error); }
    }, [fitPlaneToCamera, isStatic]); // Keep dependencies


    // --- ***** Initialize Scene (Restore Post-Processing) ***** ---
    const initThreeScene = useCallback(() => {
        if (!canvasRef.current || isInitialized.current) return;
        console.log("DEBUG: initThreeScene START (Restoring Basic Post-Processing)");
        try {
            const canvas = canvasRef.current; const initialWidth = canvas.clientWidth || 640; const initialHeight = canvas.clientHeight || 480;
            rendererInstanceRef.current = new THREE.WebGLRenderer({ canvas: canvas, antialias: true }); rendererInstanceRef.current.setSize(initialWidth, initialHeight); rendererInstanceRef.current.setPixelRatio(window.devicePixelRatio); rendererInstanceRef.current.outputColorSpace = THREE.SRGBColorSpace;

            // *** Create Render Target ***
            renderTargetRef.current = new THREE.WebGLRenderTarget(initialWidth, initialHeight, {
                minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter,
                format: THREE.RGBAFormat, colorSpace: THREE.SRGBColorSpace
            });
            console.log("DEBUG: RenderTarget created.");

            // Base Scene setup (same)
            baseSceneRef.current = new THREE.Scene(); baseCameraRef.current = new THREE.OrthographicCamera(-initialWidth / 2, initialWidth / 2, initialHeight / 2, -initialHeight / 2, 0.1, 10); baseCameraRef.current.position.z = 1; const planeGeometry = new THREE.PlaneGeometry(1, 1); const planeMaterial = new THREE.MeshBasicMaterial({ map: null, side: THREE.DoubleSide, color: 0xffffff, transparent: true }); basePlaneMeshRef.current = new THREE.Mesh(planeGeometry, planeMaterial); baseSceneRef.current.add(basePlaneMeshRef.current);
            console.log("DEBUG: Base scene created.");

            // *** Create Post-Processing Scene ***
            postSceneRef.current = new THREE.Scene();
            postCameraRef.current = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1); // Simple ortho camera for fullscreen quad
            const postPlaneGeometry = new THREE.PlaneGeometry(2, 2); // Fullscreen quad
            // *** Create Material with Pass-Through Shader ***
            postMaterialRef.current = new THREE.ShaderMaterial({
                vertexShader: postVertexShader,
                fragmentShader: postFragmentShader, // Minimal pass-through
                uniforms: {
                    // Only needs the texture from the render target
                    uSceneTexture: { value: renderTargetRef.current.texture },
                },
                transparent: true, depthWrite: false, depthTest: false,
            });
            const postPlaneMesh = new THREE.Mesh(postPlaneGeometry, postMaterialRef.current);
            postSceneRef.current.add(postPlaneMesh);
            console.log("DEBUG: Post-processing scene created (Pass-Through Shader).");

            isInitialized.current = true;
            console.log("DEBUG: Scene initialization complete (Basic Post-Processing).");
            handleResize();
            console.log("DEBUG: Requesting first render loop frame from Init.");
            cancelAnimationFrame(animationFrameHandle.current);
            animationFrameHandle.current = requestAnimationFrame(renderLoop);
        } catch (error) { console.error("DEBUG: initThreeScene ERROR:", error); isInitialized.current = false; }
    }, [handleResize, postVertexShader, postFragmentShader, renderLoop]); // Added shader vars dependency


    // --- Setup / Cleanup Effect --- (Restore Full Disposal)
    useEffect(() => {
        initThreeScene();
        let resizeObserver; const currentCanvas = canvasRef.current;
        if (currentCanvas) { resizeObserver = new ResizeObserver(() => { handleResize(); }); resizeObserver.observe(currentCanvas); }
        return () => {
             console.log("DEBUG: Cleanup running (TryOnRenderer Unmount)...");
             resizeObserver?.disconnect();
             cancelAnimationFrame(animationFrameHandle.current);
             isInitialized.current = false;
             console.log("DEBUG: Disposing Three.js resources (Full)...");
             // Dispose textures
             videoTextureRef.current?.dispose(); imageTextureRef.current?.dispose();
             segmentationTextureRef.current?.dispose(); // Dispose mask texture if created
             // Dispose render target
             renderTargetRef.current?.dispose();
             // Dispose base scene elements
             basePlaneMeshRef.current?.geometry?.dispose(); basePlaneMeshRef.current?.material?.map?.dispose(); basePlaneMeshRef.current?.material?.dispose();
             // Dispose post-processing material & uniforms
             postMaterialRef.current?.uniforms?.uSceneTexture?.value?.dispose();
             // Assuming mask uniform might exist even if unused by shader currently
             postMaterialRef.current?.uniforms?.uSegmentationMask?.value?.dispose();
             postMaterialRef.current?.dispose();
             // Dispose renderer
             rendererInstanceRef.current?.dispose();
             // Nullify refs
             videoTextureRef.current = null; imageTextureRef.current = null; segmentationTextureRef.current = null; renderTargetRef.current = null;
             basePlaneMeshRef.current = null; postMaterialRef.current = null; rendererInstanceRef.current = null; baseSceneRef.current = null;
             postSceneRef.current = null; baseCameraRef.current = null; postCameraRef.current = null;
             console.log("DEBUG: Three.js resources disposed.");
        };
     }, [initThreeScene, handleResize]); // Keep dependencies


    // --- JSX --- (No change)
    return ( <canvas ref={canvasRef} className={`renderer-canvas ${className || ''}`} style={{ display: 'block', width: '100%', height: '100%', ...(style || {}) }} /> );
});
TryOnRenderer.displayName = 'TryOnRenderer';
export default TryOnRenderer;