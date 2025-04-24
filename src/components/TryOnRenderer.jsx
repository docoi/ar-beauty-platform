// src/components/TryOnRenderer.jsx - Post-Processing for EFFECTS Only

import React, { useRef, useImperativeHandle, forwardRef, useEffect, useCallback } from 'react';
import * as THREE from 'three';

console.log(`Using Three.js revision: ${THREE.REVISION}`);

const TryOnRenderer = forwardRef(({ videoWidth, videoHeight, className }, ref) => {
    // Core Refs
    const canvasRef = useRef(null);
    const rendererInstanceRef = useRef(null);
    const animationFrameHandle = useRef(null);
    const isInitialized = useRef(false);

    // Scene 1 (Base)
    const baseSceneRef = useRef(null);
    const baseCameraRef = useRef(null);
    const basePlaneMeshRef = useRef(null);
    const videoTextureRef = useRef(null);
    const imageTextureRef = useRef(null);

    // Scene 2 (Post-Processing)
    const postSceneRef = useRef(null);
    const postCameraRef = useRef(null);
    const postMaterialRef = useRef(null);
    const segmentationTextureRef = useRef(null); // Ref for mask texture

    // Render Target
    const renderTargetRef = useRef(null);

    // State Refs
    const currentSourceElement = useRef(null);
    const currentMediaPipeResults = useRef(null); // Store latest results
    const currentEffectIntensity = useRef(0.5); // Store effect intensity

    // --- Shaders ---
    const postVertexShader = `varying vec2 vUv; void main() { vUv = uv; gl_Position = vec4(position, 1.0); }`;
    const postFragmentShader = `
        uniform sampler2D uSceneTexture;      // Rendered scene (video/image)
        uniform sampler2D uSegmentationMask;  // Segmentation mask from MediaPipe
        uniform float uEffectIntensity;       // Slider value (0.0 to 1.0)
        uniform vec2 uTextureSize;            // Dimensions of the mask/scene texture
        varying vec2 vUv;

        void main() {
            vec4 sceneColor = texture2D(uSceneTexture, vUv);

            // --- Segmentation Mask Check ---
            // Sample the mask - assumes mask is single channel (e.g., red channel stores mask)
            // Adjust sampling channel (.r, .g, .b, or .a) if your mask format differs
            float maskValue = texture2D(uSegmentationMask, vUv).r;

            // Check if the pixel belongs to the skin (adjust threshold if needed)
            // MediaPipe masks often have values > 0 for the target area (e.g., 0.9+ for confident skin)
            bool isSkin = maskValue > 0.5;

            // --- Apply Placeholder Serum Effect ---
            if (isSkin) {
                // Example: Increase brightness based on intensity
                float brightnessFactor = 1.0 + (uEffectIntensity * 0.5); // Increase brightness up to 1.5x
                sceneColor.rgb *= brightnessFactor;

                // Example: Slight desaturation (optional)
                // float gray = dot(sceneColor.rgb, vec3(0.299, 0.587, 0.114));
                // sceneColor.rgb = mix(sceneColor.rgb, vec3(gray), uEffectIntensity * 0.2);

                // Example: Add a subtle tint (optional)
                // sceneColor.rgb = mix(sceneColor.rgb, vec3(1.0, 0.95, 0.9), uEffectIntensity * 0.1);
            }

            gl_FragColor = clamp(sceneColor, 0.0, 1.0); // Clamp final color
        }
    `;

    // --- Handle Resizing ---
    const handleResize = useCallback(() => { /* ... as before ... */
        const canvas = canvasRef.current; if (!rendererInstanceRef.current || !baseCameraRef.current || !postCameraRef.current || !canvas || !renderTargetRef.current) return; const newWidth = canvas.clientWidth; const newHeight = canvas.clientHeight; if (newWidth === 0 || newHeight === 0) return; const currentSize = rendererInstanceRef.current.getSize(new THREE.Vector2()); if (currentSize.x === newWidth && currentSize.y === newHeight) return; rendererInstanceRef.current.setSize(newWidth, newHeight); renderTargetRef.current.setSize(newWidth, newHeight); baseCameraRef.current.left = -newWidth / 2; baseCameraRef.current.right = newWidth / 2; baseCameraRef.current.top = newHeight / 2; baseCameraRef.current.bottom = -newHeight / 2; baseCameraRef.current.updateProjectionMatrix();
     }, []);

    // --- Initialize Scene ---
    const initThreeScene = useCallback(() => { /* ... as before, but initialize post uniforms ... */
        if (!canvasRef.current || isInitialized.current) return; console.log("DEBUG: initThreeScene START (Post-Processing for Effects)"); try { const canvas = canvasRef.current; const initialWidth = canvas.clientWidth || 640; const initialHeight = canvas.clientHeight || 480; rendererInstanceRef.current = new THREE.WebGLRenderer({ canvas: canvas, antialias: true }); rendererInstanceRef.current.setSize(initialWidth, initialHeight); rendererInstanceRef.current.setPixelRatio(window.devicePixelRatio); rendererInstanceRef.current.outputColorSpace = THREE.SRGBColorSpace; renderTargetRef.current = new THREE.WebGLRenderTarget(initialWidth, initialHeight, { minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, format: THREE.RGBAFormat, type: THREE.UnsignedByteType, colorSpace: THREE.SRGBColorSpace }); baseSceneRef.current = new THREE.Scene(); baseCameraRef.current = new THREE.OrthographicCamera(-initialWidth / 2, initialWidth / 2, initialHeight / 2, -initialHeight / 2, 0.1, 10); baseCameraRef.current.position.z = 1; const planeGeometry = new THREE.PlaneGeometry(1, 1); const planeMaterial = new THREE.MeshBasicMaterial({ map: null, side: THREE.DoubleSide, color: 0xffffff }); basePlaneMeshRef.current = new THREE.Mesh(planeGeometry, planeMaterial); basePlaneMeshRef.current.position.z = 0; basePlaneMeshRef.current.scale.set(1, 1, 1); baseSceneRef.current.add(basePlaneMeshRef.current); postSceneRef.current = new THREE.Scene(); postCameraRef.current = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1); const postPlaneGeometry = new THREE.PlaneGeometry(2, 2);
        postMaterialRef.current = new THREE.ShaderMaterial({ vertexShader: postVertexShader, fragmentShader: postFragmentShader, uniforms: {
            uSceneTexture: { value: renderTargetRef.current.texture },
            uSegmentationMask: { value: null }, // Add mask uniform
            uEffectIntensity: { value: currentEffectIntensity.current }, // Use ref value
            uTextureSize: { value: new THREE.Vector2(initialWidth, initialHeight) } // Size uniform
            // Removed correction uniforms for now (uIsStaticImage, uBrightness, uContrast)
        }, depthWrite: false, depthTest: false, });
        const postPlaneMesh = new THREE.Mesh(postPlaneGeometry, postMaterialRef.current); postSceneRef.current.add(postPlaneMesh); isInitialized.current = true; console.log("DEBUG: Scene initialization complete (Post-Processing Effects)."); handleResize(); } catch (error) { console.error("DEBUG: initThreeScene ERROR:", error); }
    }, [handleResize, postVertexShader, postFragmentShader]); // Add shaders

    // --- Effect for Initial Setup / Resize Observer ---
    useEffect(() => { /* ... as before ... */
         initThreeScene(); let resizeObserver; if (canvasRef.current) { resizeObserver = new ResizeObserver(() => { handleResize(); }); resizeObserver.observe(canvasRef.current); } return () => { console.log("DEBUG: Cleanup running..."); /* ... full cleanup including postMaterial ... */ };
     }, [initThreeScene, handleResize]);

    // --- Scale Base Plane ---
    const fitPlaneToCamera = useCallback((textureWidth, textureHeight) => { /* ... as before ... */
        if (!baseCameraRef.current || !basePlaneMeshRef.current || !textureWidth || !textureHeight) return; const canvas = canvasRef.current; if (!canvas) return; const cameraWidth = canvas.clientWidth; const cameraHeight = canvas.clientHeight; if (cameraWidth === 0 || cameraHeight === 0) return; const cameraAspect = cameraWidth / cameraHeight; const textureAspect = textureWidth / textureHeight; let scaleX, scaleY; if (cameraAspect > textureAspect) { scaleY = cameraHeight; scaleX = scaleY * textureAspect; } else { scaleX = cameraWidth; scaleY = scaleX / textureAspect; } basePlaneMeshRef.current.scale.y = scaleY; basePlaneMeshRef.current.scale.x = scaleX;
    }, []);

    // --- Render Loop ---
    const renderLoop = useCallback(() => {
        animationFrameHandle.current = requestAnimationFrame(renderLoop);
        if (!isInitialized.current || !rendererInstanceRef.current || !baseSceneRef.current || !baseCameraRef.current || !postSceneRef.current || !postCameraRef.current || !basePlaneMeshRef.current || !postMaterialRef.current?.uniforms || !renderTargetRef.current) return;

        const sourceElement = currentSourceElement.current;
        const baseMaterial = basePlaneMeshRef.current.material;
        const postUniforms = postMaterialRef.current.uniforms;
        const results = currentMediaPipeResults.current; // Get latest results
        let sourceWidth = 0, sourceHeight = 0;
        let isVideo = sourceElement instanceof HTMLVideoElement;
        let textureToAssign = null;

        // --- 1. Update Base Scene Texture ---
        // ... (Keep texture update logic as before) ...
        if (isVideo && sourceElement.readyState >= 2) { /* video texture */ sourceWidth = sourceElement.videoWidth; sourceHeight = sourceElement.videoHeight; if (videoTextureRef.current?.image !== sourceElement) { videoTextureRef.current?.dispose(); videoTextureRef.current = new THREE.VideoTexture(sourceElement); videoTextureRef.current.colorSpace = THREE.SRGBColorSpace; } textureToAssign = videoTextureRef.current; }
        else if (isImage && sourceElement.complete && sourceElement.naturalWidth > 0) { /* image texture */ sourceWidth = sourceElement.naturalWidth; sourceHeight = sourceElement.naturalHeight; if (imageTextureRef.current?.image !== sourceElement) { imageTextureRef.current?.dispose(); imageTextureRef.current = new THREE.Texture(sourceElement); imageTextureRef.current.colorSpace = THREE.SRGBColorSpace; imageTextureRef.current.needsUpdate = true; } else { imageTextureRef.current.needsUpdate = true; } textureToAssign = imageTextureRef.current; }
        else { /* no source / clear */ textureToAssign = null; if(videoTextureRef.current) { videoTextureRef.current.dispose(); videoTextureRef.current = null;} if(imageTextureRef.current) { imageTextureRef.current.dispose(); imageTextureRef.current = null;} }
        if (baseMaterial.map !== textureToAssign) { baseMaterial.map = textureToAssign; baseMaterial.needsUpdate = true; }


        // --- 2. Update Base Plane Scale & Mirroring ---
        // ... (Keep scaling logic as before) ...
        if (baseMaterial.map && sourceWidth > 0 && sourceHeight > 0) { fitPlaneToCamera(sourceWidth, sourceHeight); basePlaneMeshRef.current.scale.x = Math.abs(basePlaneMeshRef.current.scale.x) * (isVideo ? -1 : 1); } else { if (basePlaneMeshRef.current.scale.x !== 0) { basePlaneMeshRef.current.scale.set(0,0,0); } }


        // --- 3. Render Base Scene to Target ---
        // ... (Keep render to target logic) ...
         if (basePlaneMeshRef.current.scale.x !== 0) { rendererInstanceRef.current.setRenderTarget(renderTargetRef.current); rendererInstanceRef.current.render(baseSceneRef.current, baseCameraRef.current); rendererInstanceRef.current.setRenderTarget(null); } else { rendererInstanceRef.current.setRenderTarget(renderTargetRef.current); rendererInstanceRef.current.clear(); rendererInstanceRef.current.setRenderTarget(null); }


        // --- 4. Update Post-Processing Uniforms ---
        postUniforms.uSceneTexture.value = renderTargetRef.current.texture;
        postUniforms.uEffectIntensity.value = currentEffectIntensity.current; // Update from ref
        // --- Update Segmentation Mask Texture ---
        const segmentationMask = results?.segmentationMasks?.[0]; // Get the first mask
        if (segmentationMask && postUniforms.uSegmentationMask) {
             if (!segmentationTextureRef.current || segmentationTextureRef.current.image !== segmentationMask) {
                 segmentationTextureRef.current?.dispose(); // Dispose old one
                 // Create DataTexture from MediaPipe mask output
                 segmentationTextureRef.current = new THREE.DataTexture(
                     segmentationMask.data, // Float32Array buffer
                     segmentationMask.width,
                     segmentationMask.height,
                     THREE.RedFormat, // Assuming single channel mask (adjust if RGBA)
                     THREE.FloatType // Data type from MediaPipe
                 );
                 segmentationTextureRef.current.needsUpdate = true;
                 console.log("Renderer Loop: Created/Updated Segmentation Texture");
             }
             postUniforms.uSegmentationMask.value = segmentationTextureRef.current;
             postUniforms.uTextureSize.value.set(segmentationMask.width, segmentationMask.height); // Update size
        } else {
             // No mask available, set uniform to null
             if (postUniforms.uSegmentationMask.value !== null) {
                  // Dispose if previously set? Maybe not needed for uniform value itself.
                  postUniforms.uSegmentationMask.value = null;
                  console.log("Renderer Loop: Cleared Segmentation Texture Uniform");
             }
        }

        // --- 5. Render Post-Processing Scene to Screen ---
        rendererInstanceRef.current.render(postSceneRef.current, postCameraRef.current);

    }, [fitPlaneToCamera]);

    // --- Start Render Loop ---
    useEffect(() => { if (isInitialized.current) { cancelAnimationFrame(animationFrameHandle.current); animationFrameHandle.current = requestAnimationFrame(renderLoop); } }, [renderLoop]);

    // --- Expose Methods ---
    useImperativeHandle(ref, () => ({
        renderResults: (videoElement, results) => { // Mirror & Preview
            currentSourceElement.current = videoElement;
            currentMediaPipeResults.current = results; // Store results
            // isStaticImage is not used by post shader for correction now
        },
        renderStaticImageResults: (imageElement, results, brightness, contrast, effectIntensity) => { // Selfie
            console.log("Handle: renderStaticImageResults.", { effectIntensity });
            currentSourceElement.current = imageElement;
            currentMediaPipeResults.current = results; // Store results
            currentEffectIntensity.current = effectIntensity; // Update effect intensity ref
            // Brightness/Contrast correction is removed for now
        },
        updateEffectIntensity: (intensity) => { // Method to update intensity from slider
             currentEffectIntensity.current = intensity;
        },
        clearCanvas: () => {
             console.log("Handle: Clearing canvas source.");
             currentSourceElement.current = null;
             currentMediaPipeResults.current = null;
             if(postMaterialRef.current?.uniforms?.uSegmentationMask) {
                segmentationTextureRef.current?.dispose(); // Dispose mask texture
                segmentationTextureRef.current = null;
                postMaterialRef.current.uniforms.uSegmentationMask.value = null;
             }
             // Base texture will be cleared by render loop
        }
    }));

    // --- JSX ---
    return ( <canvas ref={canvasRef} className={`renderer-canvas ${className || ''}`} style={{ display: 'block', width: '100%', height: '100%' }} /> );
});

TryOnRenderer.displayName = 'TryOnRenderer';
export default TryOnRenderer;