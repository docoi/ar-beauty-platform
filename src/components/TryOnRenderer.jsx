// src/components/TryOnRenderer.jsx - MULTI-PASS CPU Face Mask (Corrected Attempt)
// Implements ChatGPT's recommended approach for stability

import React, { useRef, forwardRef, useEffect, useCallback } from 'react';
import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { UniformsUtils } from 'three'; // Still useful for cloning if needed

// Define which landmarks form the outer face contour.
const FACE_OUTLINE_INDICES = [
    10,  338, 297, 332, 284, 251, 389, 356, 454, 323, 361, 288,
    397, 365, 379, 378, 400, 377, 152, 148, 176, 149, 150, 136,
    172, 58,  132, 93,  234, 127, 162, 21,  54,  103, 67,  109
];
// Removed MAX_FACE_POINTS as it's not needed for uniforms

const TryOnRenderer = forwardRef(({
    videoRefProp, imageElement,
    mediaPipeResults,     // <<< USED for landmarks (CPU processing)
    segmentationResults, // <<< USED for silhouette mask
    isStatic,
    effectIntensity,
    className, style
 }, ref) => {

    // --- Core Refs / Internal State Refs ---
    const canvasRef = useRef(null); const rendererInstanceRef = useRef(null); const animationFrameHandle = useRef(null); const isInitialized = useRef(false);
    const baseSceneRef = useRef(null); const baseCameraRef = useRef(null); const basePlaneMeshRef = useRef(null); const videoTextureRef = useRef(null);
    const imageTextureRef = useRef(null);
    const segmentationTextureRef = useRef(null); // For silhouette mask
    const faceMaskTextureRef = useRef(null);     // <<< Texture for CPU-generated face mask
    const faceMaskCanvasRef = useRef(null);      // <<< Offscreen canvas for drawing face mask
    const composerRef = useRef(null);
    // Refs for the different shader passes
    const silhouettePassRef = useRef(null);
    const faceMaskPassRef = useRef(null);
    const effectPassRef = useRef(null);

    const currentIntensity = useRef(0.5);
    const renderLoopCounter = useRef(0); const lastMaskUpdateTime = useRef(0);
    const lastLandmarkUpdateTime = useRef(0);


    // --- Shader Definitions ---
    // Define shaders as constants outside useCallback dependencies if they don't change
    const BASE_VERTEX_SHADER = `varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 ); }`;

    // Pass 2: Apply Silhouette Mask
    const SilhouetteMaskShader = useRef({
        uniforms: {
            'tDiffuse': { value: null }, // Input from RenderPass
            'uSegmentationMask': { value: null },
            'uHasMask': { value: false },
            'uFlipMaskX': { value: false }
        },
        vertexShader: BASE_VERTEX_SHADER,
        fragmentShader: `
            uniform sampler2D tDiffuse;
            uniform sampler2D uSegmentationMask;
            uniform bool uHasMask;
            uniform bool uFlipMaskX;
            varying vec2 vUv;
            void main() {
                vec4 color = texture2D(tDiffuse, vUv);
                float maskValue = 0.0;
                if (uHasMask) {
                    float maskCoordX = uFlipMaskX ? (1.0 - vUv.x) : vUv.x;
                    float maskCoordY = 1.0 - vUv.y;
                    maskValue = texture2D(uSegmentationMask, vec2(maskCoordX, maskCoordY)).r;
                }
                gl_FragColor = vec4(color.rgb * step(0.5, maskValue), color.a);
            }
        `
    }).current; // .current makes it stable for useCallback dependency

    // Pass 3: Apply CPU-Generated Face Mask
    const FaceMaskShader = useRef({
        uniforms: {
            'tDiffuse': { value: null }, // Input from Silhouette Pass
            'uFaceMask': { value: null }, // The texture generated on CPU
            'uHasFaceMask': { value: false },
            'uFlipMaskX': { value: false } // Controls sampling flip
        },
        vertexShader: BASE_VERTEX_SHADER,
        fragmentShader: `
            uniform sampler2D tDiffuse;
            uniform sampler2D uFaceMask;
            uniform bool uHasFaceMask;
            uniform bool uFlipMaskX;
            varying vec2 vUv;
            void main() {
                vec4 color = texture2D(tDiffuse, vUv);
                float faceMaskValue = 0.0;
                if (uHasFaceMask) {
                    float maskCoordX = uFlipMaskX ? (1.0 - vUv.x) : vUv.x;
                    float maskCoordY = 1.0 - vUv.y; // Always flip Y for screen vs texture coords
                    faceMaskValue = texture2D(uFaceMask, vec2(maskCoordX, maskCoordY)).r; // Use Red channel
                }
                gl_FragColor = vec4(color.rgb * step(0.5, faceMaskValue), color.a);
            }
        `
    }).current;

    // Pass 4: Apply Hydration Effect
    const HydrationEffectShader = useRef({
        uniforms: {
            'tDiffuse': { value: null }, // Input from Face Mask Pass
            'uEffectIntensity': { value: 0.5 }
        },
        vertexShader: BASE_VERTEX_SHADER,
        fragmentShader: `
            uniform sampler2D tDiffuse;
            uniform float uEffectIntensity;
            varying vec2 vUv;
            vec3 applyHydrationEffect(vec3 c){ vec3 h=c*(1.0+0.1*uEffectIntensity); h+=vec3(0.05*uEffectIntensity); return h; }
            void main() {
                vec4 color = texture2D(tDiffuse, vUv);
                vec3 finalColor = color.rgb;
                // Check if pixel has color (i.e., wasn't masked out in previous passes)
                if (uEffectIntensity > 0.01 && dot(color.rgb, vec3(0.333)) > 0.01) {
                     finalColor = applyHydrationEffect(color.rgb);
                }
                gl_FragColor = vec4(clamp(finalColor, 0.0, 1.0), color.a);
            }
        `
    }).current;


    // --- Prop Effects / Texture Effects ---
    useEffect(() => { currentIntensity.current = effectIntensity; if (effectPassRef.current) { effectPassRef.current.uniforms.uEffectIntensity.value = currentIntensity.current; } }, [effectIntensity]);
    useEffect(() => { /* Video Texture */ const videoElement = videoRefProp?.current; if (!isStatic && videoElement && videoElement.readyState >= videoElement.HAVE_METADATA) { if (!videoTextureRef.current || videoTextureRef.current.image !== videoElement) { videoTextureRef.current?.dispose(); videoTextureRef.current = new THREE.VideoTexture(videoElement); videoTextureRef.current.colorSpace = THREE.SRGBColorSpace; } } else if (!isStatic && videoTextureRef.current) { videoTextureRef.current.dispose(); videoTextureRef.current = null; } }, [isStatic, videoRefProp, videoRefProp?.current?.readyState]);
    useEffect(() => { /* Image Texture */ if (isStatic && imageElement && imageElement.complete && imageElement.naturalWidth > 0) { if (!imageTextureRef.current || imageTextureRef.current.image !== imageElement) { imageTextureRef.current?.dispose(); imageTextureRef.current = new THREE.Texture(imageElement); imageTextureRef.current.colorSpace = THREE.SRGBColorSpace; imageTextureRef.current.needsUpdate = true; } } else if (isStatic && imageTextureRef.current) { imageTextureRef.current.dispose(); imageTextureRef.current = null; } }, [isStatic, imageElement, imageElement?.complete]);
    useEffect(() => { /* Segmentation Mask Texture */ const results = segmentationResults; const hasMaskData = results?.confidenceMasks?.[0]; if (hasMaskData) { const confidenceMaskObject = results.confidenceMasks[0]; const maskWidth = confidenceMaskObject?.width; const maskHeight = confidenceMaskObject?.height; let maskData = null; try { if (typeof confidenceMaskObject?.getAsFloat32Array === 'function') { maskData = confidenceMaskObject.getAsFloat32Array(); } else if (confidenceMaskObject?.data instanceof Float32Array) { maskData = confidenceMaskObject.data; } } catch (error) { maskData = null; } if (maskData instanceof Float32Array && maskWidth > 0 && maskHeight > 0) { const now = performance.now(); const timeSinceLastUpdate = now - lastMaskUpdateTime.current; const throttleThreshold = isStatic ? 0 : 66; if (timeSinceLastUpdate > throttleThreshold) { lastMaskUpdateTime.current = now; try { let texture = segmentationTextureRef.current; if (!texture || texture.image.width !== maskWidth || texture.image.height !== maskHeight) { texture?.dispose(); texture = new THREE.DataTexture(maskData, maskWidth, maskHeight, THREE.RedFormat, THREE.FloatType); texture.minFilter = THREE.NearestFilter; texture.magFilter = THREE.NearestFilter; texture.generateMipmaps = false; texture.needsUpdate = true; segmentationTextureRef.current = texture; } else { texture.image.data = maskData; texture.needsUpdate = true; } if (silhouettePassRef.current) { silhouettePassRef.current.uniforms.uSegmentationMask.value = segmentationTextureRef.current; silhouettePassRef.current.uniforms.uHasMask.value = true; } } catch (error) { console.error("Error processing mask texture:", error); segmentationTextureRef.current?.dispose(); segmentationTextureRef.current = null; if (silhouettePassRef.current) { silhouettePassRef.current.uniforms.uSegmentationMask.value = null; silhouettePassRef.current.uniforms.uHasMask.value = false; } } } else { if (silhouettePassRef.current && silhouettePassRef.current.uniforms.uSegmentationMask.value !== segmentationTextureRef.current) { silhouettePassRef.current.uniforms.uSegmentationMask.value = segmentationTextureRef.current; silhouettePassRef.current.uniforms.uHasMask.value = !!segmentationTextureRef.current; } } } else { if (segmentationTextureRef.current) { segmentationTextureRef.current.dispose(); segmentationTextureRef.current = null; } if (silhouettePassRef.current) { silhouettePassRef.current.uniforms.uSegmentationMask.value = null; silhouettePassRef.current.uniforms.uHasMask.value = false; } } } else { if (segmentationTextureRef.current) { segmentationTextureRef.current.dispose(); segmentationTextureRef.current = null; } if (silhouettePassRef.current) { silhouettePassRef.current.uniforms.uSegmentationMask.value = null; silhouettePassRef.current.uniforms.uHasMask.value = false; } } }, [segmentationResults, isStatic]);

    // --- CPU FACE MASK GENERATION EFFECT ---
    useEffect(() => {
        const landmarks = mediaPipeResults?.faceLandmarks?.[0];
        const targetWidth = segmentationTextureRef.current?.image?.width || videoTextureRef.current?.image?.videoWidth || imageTextureRef.current?.image?.naturalWidth || 256;
        const targetHeight = segmentationTextureRef.current?.image?.height || videoTextureRef.current?.image?.videoHeight || imageTextureRef.current?.image?.naturalHeight || 256;
        let needsTextureUpdate = false; let hasValidLandmarks = false;

        if (landmarks && landmarks.length >= Math.max(...FACE_OUTLINE_INDICES) && targetWidth > 0 && targetHeight > 0) { // Check highest index
             const now = performance.now(); const timeSinceLastUpdate = now - lastLandmarkUpdateTime.current; const throttleThreshold = isStatic ? 0 : 40;
             if (timeSinceLastUpdate > throttleThreshold) {
                 lastLandmarkUpdateTime.current = now; hasValidLandmarks = true; needsTextureUpdate = true;
                 try {
                     if (!faceMaskCanvasRef.current) { faceMaskCanvasRef.current = document.createElement('canvas'); }
                     const canvas = faceMaskCanvasRef.current; if (canvas.width !== targetWidth || canvas.height !== targetHeight) { canvas.width = targetWidth; canvas.height = targetHeight; }
                     const ctx = canvas.getContext('2d', { willReadFrequently: true }); // Add hint for performance if needed
                     if (!ctx) throw new Error("Could not get 2D context");
                     ctx.clearRect(0, 0, canvas.width, canvas.height); ctx.fillStyle = 'white'; ctx.beginPath();
                     FACE_OUTLINE_INDICES.forEach((index, i) => { const point = landmarks[index]; const x = point.x * canvas.width; const y = point.y * canvas.height; if (i === 0) { ctx.moveTo(x, y); } else { ctx.lineTo(x, y); } });
                     ctx.closePath(); ctx.fill();
                     const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height); let texture = faceMaskTextureRef.current;
                     if (!texture || texture.image.width !== canvas.width || texture.image.height !== canvas.height) {
                         texture?.dispose(); texture = new THREE.DataTexture(imageData.data, canvas.width, canvas.height, THREE.RGBAFormat, THREE.UnsignedByteType);
                         texture.minFilter = THREE.NearestFilter; texture.magFilter = THREE.NearestFilter; texture.generateMipmaps = false; texture.needsUpdate = true; faceMaskTextureRef.current = texture;
                     } else { texture.image.data = imageData.data; texture.image.width = canvas.width; texture.image.height = canvas.height; texture.needsUpdate = true; }
                 } catch (error) { console.error("Error generating face mask texture:", error); faceMaskTextureRef.current?.dispose(); faceMaskTextureRef.current = null; hasValidLandmarks = false; needsTextureUpdate = false; }
             } else { hasValidLandmarks = faceMaskPassRef.current ? faceMaskPassRef.current.uniforms.uHasFaceMask.value : false; }
        } else { hasValidLandmarks = false; needsTextureUpdate = faceMaskTextureRef.current !== null; if (faceMaskTextureRef.current) { faceMaskTextureRef.current.dispose(); faceMaskTextureRef.current = null; } }
        if (faceMaskPassRef.current && needsTextureUpdate) { faceMaskPassRef.current.uniforms.uHasFaceMask.value = hasValidLandmarks; faceMaskPassRef.current.uniforms.uFaceMask.value = faceMaskTextureRef.current; }
    }, [mediaPipeResults, isStatic, segmentationTextureRef.current]);


    // --- Handle Resizing (No changes) ---
    const handleResize = useCallback(() => { /* ... */ }, []);
    // --- Scale Base Plane (No changes) ---
    const fitPlaneToCamera = useCallback((textureWidth, textureHeight) => { /* ... */ }, []);


    // --- Render Loop (Updates uniforms for relevant passes) ---
     const renderLoop = useCallback(() => {
        animationFrameHandle.current = requestAnimationFrame(renderLoop); renderLoopCounter.current++; if (!isInitialized.current || !rendererInstanceRef.current || !composerRef.current || !basePlaneMeshRef.current || !silhouettePassRef.current || !faceMaskPassRef.current || !effectPassRef.current) { return; }
        try {
            // 1 & 2: Select Texture, Assign Map, Update Plane Scale/Mirroring
            const baseMaterial = basePlaneMeshRef.current.material; let sourceWidth = 0, sourceHeight = 0; let textureToAssign = null; let isVideo = !isStatic; let needsTextureUpdate = false; if (isVideo && videoTextureRef.current) { textureToAssign = videoTextureRef.current; const video = textureToAssign.image; if(video && video.readyState >= video.HAVE_CURRENT_DATA) { sourceWidth = video.videoWidth; sourceHeight = video.videoHeight; needsTextureUpdate = (baseMaterial.map !== textureToAssign); } else { textureToAssign = null; } } else if (isStatic && imageTextureRef.current) { textureToAssign = imageTextureRef.current; const image = textureToAssign.image; if(image && image.complete && image.naturalWidth > 0) { sourceWidth = image.naturalWidth; sourceHeight = image.naturalHeight; needsTextureUpdate = (baseMaterial.map !== textureToAssign) || textureToAssign.needsUpdate; } else { textureToAssign = null; } } if (baseMaterial && needsTextureUpdate) { baseMaterial.map = textureToAssign; baseMaterial.needsUpdate = true; } else if (baseMaterial && baseMaterial.map !== textureToAssign && !textureToAssign) { baseMaterial.map = null; baseMaterial.needsUpdate = true; } const planeVisible = !!baseMaterial?.map && sourceWidth > 0 && sourceHeight > 0; if (planeVisible) { fitPlaneToCamera(sourceWidth, sourceHeight); const scaleX = Math.abs(basePlaneMeshRef.current.scale.x); const newScaleX = isVideo ? -scaleX : scaleX; if(basePlaneMeshRef.current.scale.x !== newScaleX) { basePlaneMeshRef.current.scale.x = newScaleX; } } else { if (basePlaneMeshRef.current.scale.x !== 0 || basePlaneMeshRef.current.scale.y !== 0) { basePlaneMeshRef.current.scale.set(0, 0, 0); } } if (planeVisible && textureToAssign && textureToAssign.needsUpdate) { textureToAssign.needsUpdate = false; }
            // 3. Update ShaderPass Uniforms
             if (silhouettePassRef.current) { const uniforms = silhouettePassRef.current.uniforms; if (uniforms.uSegmentationMask.value !== segmentationTextureRef.current) { uniforms.uSegmentationMask.value = segmentationTextureRef.current; uniforms.uHasMask.value = !!segmentationTextureRef.current; } uniforms.uFlipMaskX.value = isVideo; }
             if (faceMaskPassRef.current) { faceMaskPassRef.current.uniforms.uFlipMaskX.value = isVideo; } // Face Mask texture also needs flipping if video is flipped
            // Effect intensity and Face Mask texture/flag are updated in useEffects
            // 4. Render using the Composer
            composerRef.current.render();
        } catch (error) { console.error("TryOnRenderer: Error in renderLoop:", error); }
    }, [fitPlaneToCamera, isStatic]);


    // --- Initialize Scene (Sets up multi-pass composer) ---
    const initThreeScene = useCallback(() => {
        if (!canvasRef.current || isInitialized.current) { return; } console.log("DEBUG: initThreeScene START (Multi-Pass CPU Face Mask - Corrected)"); let tempRenderTarget = null;
        try {
            console.log("DEBUG: Initializing renderer..."); const canvas = canvasRef.current; const initialWidth = Math.max(1, canvas.clientWidth || 640); const initialHeight = Math.max(1, canvas.clientHeight || 480); const renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true }); renderer.setSize(initialWidth, initialHeight); renderer.setPixelRatio(window.devicePixelRatio); renderer.outputColorSpace = THREE.SRGBColorSpace; rendererInstanceRef.current = renderer; console.log("DEBUG: Renderer initialized.");
            console.log("DEBUG: Checking capabilities and creating render target..."); const capabilities = renderer.capabilities; if (!capabilities) { throw new Error("Renderer capabilities object not found."); } let targetType = THREE.UnsignedByteType; let canUseHalfFloat = false; if (capabilities.isWebGL2) { canUseHalfFloat = true; } else { const halfFloatExt = capabilities.getExtension('OES_texture_half_float'); const colorBufferFloatExt = capabilities.getExtension('WEBGL_color_buffer_float'); if (halfFloatExt && colorBufferFloatExt) { canUseHalfFloat = true; } } if (canUseHalfFloat) { targetType = THREE.HalfFloatType; } const renderTargetOptions = { minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, format: THREE.RGBAFormat, type: targetType, depthBuffer: false, stencilBuffer: false }; tempRenderTarget = new THREE.WebGLRenderTarget(initialWidth, initialHeight, renderTargetOptions); tempRenderTarget.texture.generateMipmaps = false; console.log(`DEBUG: Created WebGLRenderTarget (${initialWidth}x${initialHeight}) with type: ${targetType === THREE.HalfFloatType ? 'HalfFloatType' : 'UnsignedByteType'}.`);
            console.log("DEBUG: Setting up base scene..."); baseSceneRef.current = new THREE.Scene(); baseCameraRef.current = new THREE.OrthographicCamera(-initialWidth / 2, initialWidth / 2, initialHeight / 2, -initialHeight / 2, 0.1, 10); baseCameraRef.current.position.z = 1; const planeGeometry = new THREE.PlaneGeometry(1, 1); const planeMaterial = new THREE.MeshBasicMaterial({ map: null, side: THREE.DoubleSide, color: 0xffffff, transparent: false }); basePlaneMeshRef.current = new THREE.Mesh(planeGeometry, planeMaterial); baseSceneRef.current.add(basePlaneMeshRef.current); console.log("DEBUG: Base scene setup complete.");
            console.log("DEBUG: Setting up EffectComposer..."); composerRef.current = new EffectComposer(renderer, tempRenderTarget);
            // Pass 1: Render Scene
            const renderPass = new RenderPass(baseSceneRef.current, baseCameraRef.current); composerRef.current.addPass(renderPass); console.log("DEBUG: Added RenderPass.");
            // Pass 2: Apply Silhouette Mask
            console.log("DEBUG: Setting up SilhouetteMask Pass..."); if (!SilhouetteMaskShader || !SilhouetteMaskShader.uniforms) { throw new Error("SilhouetteMaskShader invalid"); } const silhouettePass = new ShaderPass(SilhouetteMaskShader); // Pass shader object directly
             silhouettePassRef.current = silhouettePass; composerRef.current.addPass(silhouettePass); console.log("DEBUG: Added SilhouetteMask Pass.");
             // Pass 3: Apply Face Mask
             console.log("DEBUG: Setting up FaceMask Pass..."); if (!FaceMaskShader || !FaceMaskShader.uniforms) { throw new Error("FaceMaskShader invalid"); } const faceMaskPass = new ShaderPass(FaceMaskShader); faceMaskPassRef.current = faceMaskPass; composerRef.current.addPass(faceMaskPass); console.log("DEBUG: Added FaceMask Pass.");
             // Pass 4: Apply Effect
             console.log("DEBUG: Setting up Effect Pass..."); if (!HydrationEffectShader || !HydrationEffectShader.uniforms) { throw new Error("HydrationEffectShader invalid"); } const effectPass = new ShaderPass(HydrationEffectShader); effectPass.uniforms.uEffectIntensity.value = currentIntensity.current; effectPass.renderToScreen = true; effectPassRef.current = effectPass; composerRef.current.addPass(effectPass); console.log("DEBUG: Added Hydration Effect Pass.");
             // Finish initialization
             isInitialized.current = true; handleResize(); cancelAnimationFrame(animationFrameHandle.current); animationFrameHandle.current = requestAnimationFrame(renderLoop); console.log("DEBUG: initThreeScene SUCCESSFUL. Starting render loop.");
        } catch (error) { console.error("DEBUG: initThreeScene FAILED:", error); tempRenderTarget?.dispose(); composerRef.current = null; effectPassRef.current = null; faceMaskPassRef.current = null; silhouettePassRef.current = null; basePlaneMeshRef.current?.geometry?.dispose(); basePlaneMeshRef.current?.material?.dispose(); rendererInstanceRef.current?.dispose(); rendererInstanceRef.current = null; isInitialized.current = false; }
    }, [handleResize, renderLoop]); // Removed shader refs from deps


    // --- Setup / Cleanup Effect ---
    useEffect(() => {
        initThreeScene();
        let resizeObserver; const currentCanvas = canvasRef.current;
        if (currentCanvas) { resizeObserver = new ResizeObserver(() => { handleResize(); }); resizeObserver.observe(currentCanvas); }
        return () => {
            resizeObserver?.disconnect(); cancelAnimationFrame(animationFrameHandle.current); isInitialized.current = false;
            videoTextureRef.current?.dispose(); videoTextureRef.current = null;
            imageTextureRef.current?.dispose(); imageTextureRef.current = null;
            segmentationTextureRef.current?.dispose(); segmentationTextureRef.current = null;
            faceMaskTextureRef.current?.dispose(); faceMaskTextureRef.current = null; // <<< Dispose face mask texture
            faceMaskCanvasRef.current = null; // Clear canvas ref
            silhouettePassRef.current?.material?.dispose(); faceMaskPassRef.current?.material?.dispose(); effectPassRef.current?.material?.dispose();
            if (composerRef.current) { composerRef.current.renderTarget?.dispose(); }
            composerRef.current = null; effectPassRef.current = null; faceMaskPassRef.current = null; silhouettePassRef.current = null;
            basePlaneMeshRef.current?.geometry?.dispose(); basePlaneMeshRef.current?.material?.map?.dispose(); basePlaneMeshRef.current?.material?.dispose(); basePlaneMeshRef.current = null;
            baseSceneRef.current = null; baseCameraRef.current = null;
            rendererInstanceRef.current?.dispose(); rendererInstanceRef.current = null;
        };
     }, [initThreeScene, handleResize]);


    // --- JSX --- (No change)
    return ( <canvas ref={canvasRef} className={`renderer-canvas ${className || ''}`} style={{ display: 'block', width: '100%', height: '100%', ...(style || {}) }} /> );

});
TryOnRenderer.displayName = 'TryOnRenderer';
export default TryOnRenderer;