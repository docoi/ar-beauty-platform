// src/components/TryOnRenderer.jsx - CORRECTED BOUNDING BOX DEBUG VERSION
// Reads Silhouette Mask, Adds Landmark Texture & BBox Check Shader

import React, { useRef, forwardRef, useEffect, useCallback } from 'react';
import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { UniformsUtils } from 'three';

// Define max landmarks we expect (FaceLandmarker has 478) + some buffer
const MAX_LANDMARKS = 512; // Use a power-of-two size for potential compatibility/perf

const TryOnRenderer = forwardRef(({
    videoRefProp, imageElement,
    mediaPipeResults,     // <<< USED for landmarks
    segmentationResults, // <<< USED for silhouette mask (but ignored by debug shader)
    isStatic,
    effectIntensity,      // <<< Ignored by debug shader
    className, style
 }, ref) => {

    // --- Core Refs / Internal State Refs ---
    const canvasRef = useRef(null); const rendererInstanceRef = useRef(null); const animationFrameHandle = useRef(null); const isInitialized = useRef(false);
    const baseSceneRef = useRef(null); const baseCameraRef = useRef(null); const basePlaneMeshRef = useRef(null); const videoTextureRef = useRef(null);
    const imageTextureRef = useRef(null);
    const segmentationTextureRef = useRef(null); // For silhouette mask
    const landmarkTextureRef = useRef(null);     // For landmarks
    const landmarkDataArray = useRef(null);      // Buffer for landmarks
    const composerRef = useRef(null); const effectPassRef = useRef(null);
    const currentIntensity = useRef(0.5);
    const renderLoopCounter = useRef(0); const lastMaskUpdateTime = useRef(0);
    const lastLandmarkUpdateTime = useRef(0);


    // --- Shaders (DEBUG VERSION - Visualizes Bounding Box) ---
    const customVertexShader = `varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 ); }`;
    // !! DEBUG Fragment Shader !!
    const customFragmentShader = `
        uniform sampler2D tDiffuse;
        // uniform sampler2D uSegmentationMask; // Unused in debug
        uniform sampler2D uLandmarkData;
        // uniform float uEffectIntensity; // Unused in debug
        // uniform bool uHasMask; // Unused in debug
        uniform bool uHasLandmarks;
        // uniform bool uFlipMaskX; // Unused in debug logic

        varying vec2 vUv;

        // Helper to get landmark data (XY) from RG Float texture
        vec2 getLandmark(int index) {
            float uvx = (float(index) + 0.5) / 512.0; // MAX_LANDMARKS = 512
            return texture2D(uLandmarkData, vec2(uvx, 0.5)).rg;
        }

        // Basic Bounding Box check using a few key landmarks
        bool isInsideFaceBBox(vec2 pointUV) {
            vec2 p = vec2(pointUV.x, 1.0 - pointUV.y); // Flip point Y for comparison

            // Indices for approximate bounding box (adjust as needed)
            // These are examples, refer to MediaPipe face mesh diagram!
            vec2 forehead = getLandmark(10);  // Top center
            vec2 chin     = getLandmark(152); // Bottom center
            vec2 leftCheek = getLandmark(234); // Left extreme
            vec2 rightCheek= getLandmark(454); // Right extreme

            // --- Let's try NO padding first ---
            float minX = min(leftCheek.x, rightCheek.x);
            float maxX = max(leftCheek.x, rightCheek.x);
            // Remember landmark Y increases downwards, screen UV Y increases upwards
            float minY = forehead.y;
            float maxY = chin.y;

            // Check if point 'p' is within the raw box
            return p.x > minX && p.x < maxX && p.y > minY && p.y < maxY;
        }

        void main() {
            vec4 bC = texture2D(tDiffuse,vUv);
            vec3 fC = bC.rgb; // Base color
            vec3 debugColor = vec3(0.0, 0.0, 0.0); // Default Black

            if(uHasLandmarks) {
                if (isInsideFaceBBox(vUv)) {
                    debugColor = vec3(0.0, 1.0, 0.0); // GREEN = Inside BBox
                } else {
                    debugColor = vec3(1.0, 0.0, 0.0); // RED = Outside BBox
                }
            } else {
               debugColor = vec3(0.0, 0.0, 1.0); // BLUE = No Landmarks detected
            }

            // Mix the debug color with the base color to see both
            gl_FragColor = vec4(mix(fC, debugColor, 0.7), bC.a);
        }
    `;

    // Define the DEBUG shader structure for ShaderPass
    // Use a stable ref to prevent re-creation triggering effect updates
    const DebugShader = useRef({
        uniforms: {
            'tDiffuse': { value: null },
            // Include other uniforms even if unused by this specific shader version,
            // ShaderPass might expect them based on cloning from a base definition.
            'uSegmentationMask': { value: null },
            'uLandmarkData': { value: null },
            'uEffectIntensity': { value: 0.5 },
            'uHasMask': { value: false },
            'uHasLandmarks': { value: false },
            'uFlipMaskX': { value: false }
        },
        vertexShader: customVertexShader,
        fragmentShader: customFragmentShader // Reference the DEBUG shader string
    }).current;


    // --- Prop Effects / Texture Effects ---
    // Intensity (Not needed for debug, but keep hook structure)
    useEffect(() => { currentIntensity.current = effectIntensity; }, [effectIntensity]);

    // Video Texture (Identical to working version)
    useEffect(() => {
        const videoElement = videoRefProp?.current; if (!isStatic && videoElement && videoElement.readyState >= videoElement.HAVE_METADATA) { if (!videoTextureRef.current || videoTextureRef.current.image !== videoElement) { /* console.log("TryOnRenderer: Creating/Updating Video Texture"); */ videoTextureRef.current?.dispose(); videoTextureRef.current = new THREE.VideoTexture(videoElement); videoTextureRef.current.colorSpace = THREE.SRGBColorSpace; } } else if (!isStatic && videoTextureRef.current) { /* console.log("TryOnRenderer: Disposing Video Texture (No longer static or video not ready)"); */ videoTextureRef.current.dispose(); videoTextureRef.current = null; }
    }, [isStatic, videoRefProp, videoRefProp?.current?.readyState]);

    // Image Texture (Identical to working version)
    useEffect(() => {
        if (isStatic && imageElement && imageElement.complete && imageElement.naturalWidth > 0) { if (!imageTextureRef.current || imageTextureRef.current.image !== imageElement) { /* console.log("TryOnRenderer: Creating/Updating Image Texture"); */ imageTextureRef.current?.dispose(); imageTextureRef.current = new THREE.Texture(imageElement); imageTextureRef.current.colorSpace = THREE.SRGBColorSpace; imageTextureRef.current.needsUpdate = true; } } else if (isStatic && imageTextureRef.current) { /* console.log("TryOnRenderer: Disposing Image Texture (No longer static or image not ready)"); */ imageTextureRef.current.dispose(); imageTextureRef.current = null; }
    }, [isStatic, imageElement, imageElement?.complete]);

    // Segmentation Mask Texture (Identical to working version - reads from segmentationResults)
    useEffect(() => {
        const results = segmentationResults; const hasMaskData = results?.confidenceMasks?.[0]; if (hasMaskData) { const confidenceMaskObject = results.confidenceMasks[0]; const maskWidth = confidenceMaskObject?.width; const maskHeight = confidenceMaskObject?.height; let maskData = null; try { if (typeof confidenceMaskObject?.getAsFloat32Array === 'function') { maskData = confidenceMaskObject.getAsFloat32Array(); } else if (confidenceMaskObject?.data instanceof Float32Array) { maskData = confidenceMaskObject.data; } else { console.warn("TryOnRenderer: confidenceMasks[0] data format not recognized."); } } catch (error) { console.error("TryOnRenderer: Error getting mask data from confidenceMasks:", error); maskData = null; } if (maskData instanceof Float32Array && maskWidth > 0 && maskHeight > 0) { const now = performance.now(); const timeSinceLastUpdate = now - lastMaskUpdateTime.current; const throttleThreshold = isStatic ? 0 : 66; if (timeSinceLastUpdate > throttleThreshold) { lastMaskUpdateTime.current = now; try { let texture = segmentationTextureRef.current; if (!texture || texture.image.width !== maskWidth || texture.image.height !== maskHeight) { texture?.dispose(); texture = new THREE.DataTexture(maskData, maskWidth, maskHeight, THREE.RedFormat, THREE.FloatType); texture.minFilter = THREE.NearestFilter; texture.magFilter = THREE.NearestFilter; texture.generateMipmaps = false; texture.needsUpdate = true; segmentationTextureRef.current = texture; } else { texture.image.data = maskData; texture.needsUpdate = true; } if (effectPassRef.current) { effectPassRef.current.uniforms.uSegmentationMask.value = segmentationTextureRef.current; effectPassRef.current.uniforms.uHasMask.value = true; } } catch (error) { console.error("TryOnRenderer: Error processing mask texture from ImageSegmenter:", error); segmentationTextureRef.current?.dispose(); segmentationTextureRef.current = null; if (effectPassRef.current) { effectPassRef.current.uniforms.uSegmentationMask.value = null; effectPassRef.current.uniforms.uHasMask.value = false; } } } else { if (effectPassRef.current && effectPassRef.current.uniforms.uSegmentationMask.value !== segmentationTextureRef.current) { effectPassRef.current.uniforms.uSegmentationMask.value = segmentationTextureRef.current; effectPassRef.current.uniforms.uHasMask.value = !!segmentationTextureRef.current; } } } else { if (segmentationTextureRef.current) { segmentationTextureRef.current.dispose(); segmentationTextureRef.current = null; } if (effectPassRef.current) { effectPassRef.current.uniforms.uSegmentationMask.value = null; effectPassRef.current.uniforms.uHasMask.value = false; } } } else { if (segmentationTextureRef.current) { segmentationTextureRef.current.dispose(); segmentationTextureRef.current = null; } if (effectPassRef.current) { effectPassRef.current.uniforms.uSegmentationMask.value = null; effectPassRef.current.uniforms.uHasMask.value = false; } }
    }, [segmentationResults, isStatic]);

    // Landmark Texture Effect (Identical to previous version)
    useEffect(() => {
        const landmarks = mediaPipeResults?.faceLandmarks?.[0]; if (landmarks && landmarks.length > 0) { const now = performance.now(); const timeSinceLastUpdate = now - lastLandmarkUpdateTime.current; const throttleThreshold = isStatic ? 0 : 33; if (timeSinceLastUpdate > throttleThreshold) { lastLandmarkUpdateTime.current = now; try { if (!landmarkDataArray.current || landmarkDataArray.current.length < MAX_LANDMARKS * 2) { landmarkDataArray.current = new Float32Array(MAX_LANDMARKS * 2); console.log(`TryOnRenderer: Created landmark Float32Array buffer (size: ${MAX_LANDMARKS * 2})`); } const buffer = landmarkDataArray.current; buffer.fill(0); for (let i = 0; i < landmarks.length && i < MAX_LANDMARKS; i++) { buffer[i * 2] = landmarks[i].x; buffer[i * 2 + 1] = landmarks[i].y; } let texture = landmarkTextureRef.current; if (!texture) { texture = new THREE.DataTexture(buffer, MAX_LANDMARKS, 1, THREE.RGFormat, THREE.FloatType); texture.minFilter = THREE.NearestFilter; texture.magFilter = THREE.NearestFilter; texture.generateMipmaps = false; texture.needsUpdate = true; landmarkTextureRef.current = texture; } else { texture.image.data = buffer; texture.needsUpdate = true; } if (effectPassRef.current) { effectPassRef.current.uniforms.uHasLandmarks.value = true; } } catch (error) { console.error("TryOnRenderer: Error processing landmark texture:", error); landmarkTextureRef.current?.dispose(); landmarkTextureRef.current = null; landmarkDataArray.current = null; if (effectPassRef.current) { effectPassRef.current.uniforms.uHasLandmarks.value = false; } } } else if (effectPassRef.current && effectPassRef.current.uniforms.uHasLandmarks.value !== !!landmarkTextureRef.current) { effectPassRef.current.uniforms.uHasLandmarks.value = !!landmarkTextureRef.current; } } else { if (landmarkTextureRef.current) { landmarkTextureRef.current.dispose(); landmarkTextureRef.current = null; } if (effectPassRef.current) { effectPassRef.current.uniforms.uHasLandmarks.value = false; } }
    }, [mediaPipeResults, isStatic]);


    // --- Handle Resizing (Identical to working version) ---
    const handleResize = useCallback(() => {
        const canvas = canvasRef.current; if (!rendererInstanceRef.current || !baseCameraRef.current || !composerRef.current || !composerRef.current.renderTarget || !canvas) return; const newWidth = canvas.clientWidth; const newHeight = canvas.clientHeight; if (newWidth === 0 || newHeight === 0) return; const currentSize = rendererInstanceRef.current.getSize(new THREE.Vector2()); if (currentSize.x === newWidth && currentSize.y === newHeight) return; try { /* console.log(`TryOnRenderer: Resizing to ${newWidth}x${newHeight}`); */ rendererInstanceRef.current.setSize(newWidth, newHeight); composerRef.current.renderTarget.setSize(newWidth, newHeight); composerRef.current.setSize(newWidth, newHeight); baseCameraRef.current.left = -newWidth / 2; baseCameraRef.current.right = newWidth / 2; baseCameraRef.current.top = newHeight / 2; baseCameraRef.current.bottom = -newHeight / 2; baseCameraRef.current.updateProjectionMatrix(); /* console.log("TryOnRenderer: Resize successful."); */ } catch (e) { console.error("TryOnRenderer: Resize Error:", e); }
    }, []);

    // --- Scale Base Plane (Identical to working version) ---
    const fitPlaneToCamera = useCallback((textureWidth, textureHeight) => {
        const canvas = canvasRef.current; if (!baseCameraRef.current || !basePlaneMeshRef.current || !textureWidth || !textureHeight || !canvas) return; const viewWidth = canvas.clientWidth; const viewHeight = canvas.clientHeight; if (viewWidth === 0 || viewHeight === 0) return; const viewAspect = viewWidth / viewHeight; const textureAspect = textureWidth / textureHeight; let scaleX, scaleY; if (viewAspect > textureAspect) { scaleX = viewWidth; scaleY = viewWidth / textureAspect; } else { scaleY = viewHeight; scaleX = viewHeight * textureAspect; } const currentScale = basePlaneMeshRef.current.scale; const signX = Math.sign(currentScale.x) || 1; const newScaleXWithSign = scaleX * signX; if (Math.abs(currentScale.y - scaleY) > 0.01 || Math.abs(currentScale.x - newScaleXWithSign) > 0.01) { currentScale.set(newScaleXWithSign, scaleY, 1); }
     }, []);


    // --- Render Loop (Updates landmark uniform) ---
     const renderLoop = useCallback(() => {
        animationFrameHandle.current = requestAnimationFrame(renderLoop);
        renderLoopCounter.current++;
        if (!isInitialized.current || !rendererInstanceRef.current || !composerRef.current || !basePlaneMeshRef.current || !effectPassRef.current) { return; }

        try {
            // 1 & 2: Select Texture, Assign Map, Update Plane Scale/Mirroring (Identical to working version)
            const baseMaterial = basePlaneMeshRef.current.material; let sourceWidth = 0, sourceHeight = 0; let textureToAssign = null; let isVideo = !isStatic; let needsTextureUpdate = false; if (isVideo && videoTextureRef.current) { textureToAssign = videoTextureRef.current; const video = textureToAssign.image; if(video && video.readyState >= video.HAVE_CURRENT_DATA) { sourceWidth = video.videoWidth; sourceHeight = video.videoHeight; needsTextureUpdate = (baseMaterial.map !== textureToAssign); } else { textureToAssign = null; } } else if (isStatic && imageTextureRef.current) { textureToAssign = imageTextureRef.current; const image = textureToAssign.image; if(image && image.complete && image.naturalWidth > 0) { sourceWidth = image.naturalWidth; sourceHeight = image.naturalHeight; needsTextureUpdate = (baseMaterial.map !== textureToAssign) || textureToAssign.needsUpdate; } else { textureToAssign = null; } } if (baseMaterial && needsTextureUpdate) { baseMaterial.map = textureToAssign; baseMaterial.needsUpdate = true; } else if (baseMaterial && baseMaterial.map !== textureToAssign && !textureToAssign) { baseMaterial.map = null; baseMaterial.needsUpdate = true; } const planeVisible = !!baseMaterial?.map && sourceWidth > 0 && sourceHeight > 0; if (planeVisible) { fitPlaneToCamera(sourceWidth, sourceHeight); const scaleX = Math.abs(basePlaneMeshRef.current.scale.x); const newScaleX = isVideo ? -scaleX : scaleX; if(basePlaneMeshRef.current.scale.x !== newScaleX) { basePlaneMeshRef.current.scale.x = newScaleX; } } else { if (basePlaneMeshRef.current.scale.x !== 0 || basePlaneMeshRef.current.scale.y !== 0) { basePlaneMeshRef.current.scale.set(0, 0, 0); } } if (planeVisible && textureToAssign && textureToAssign.needsUpdate) { textureToAssign.needsUpdate = false; }

            // 3. Update ShaderPass Uniforms (Only Landmark ones relevant to debug shader)
             if (effectPassRef.current) {
                 const uniforms = effectPassRef.current.uniforms;
                 // Update Landmark Data Texture if changed
                 if (uniforms.uLandmarkData.value !== landmarkTextureRef.current) {
                    uniforms.uLandmarkData.value = landmarkTextureRef.current;
                    // Update flag as well, ensuring consistency
                    uniforms.uHasLandmarks.value = !!landmarkTextureRef.current;
                 }
                 // Other uniforms like uFlipMaskX, uSegmentationMask are present but not used by debug shader
                 // We don't need to explicitly update them here for the debug visualization to work.
             }

            // 4. Render using the Composer
            composerRef.current.render();

        } catch (error) {
            console.error("TryOnRenderer: Error in renderLoop:", error);
        }
    }, [fitPlaneToCamera, isStatic]);


    // --- Initialize Scene (Uses DebugShader definition for ShaderPass) ---
    const initThreeScene = useCallback(() => {
        if (!canvasRef.current || isInitialized.current) { return; }
        console.log("DEBUG: initThreeScene START (Bounding Box DEBUG - Corrected)"); // Updated log
        let tempRenderTarget = null;
        try {
            // Add logging before critical steps
            console.log("DEBUG: Initializing renderer...");
            const canvas = canvasRef.current; const initialWidth = Math.max(1, canvas.clientWidth || 640); const initialHeight = Math.max(1, canvas.clientHeight || 480);
            const renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true });
            renderer.setSize(initialWidth, initialHeight); renderer.setPixelRatio(window.devicePixelRatio); renderer.outputColorSpace = THREE.SRGBColorSpace;
            rendererInstanceRef.current = renderer;
            console.log("DEBUG: Renderer initialized.");

            console.log("DEBUG: Checking capabilities and creating render target...");
            const capabilities = renderer.capabilities; if (!capabilities) { throw new Error("Renderer capabilities object not found."); }
            let targetType = THREE.UnsignedByteType; let canUseHalfFloat = false;
            if (capabilities.isWebGL2) { canUseHalfFloat = true; } else { const halfFloatExt = capabilities.getExtension('OES_texture_half_float'); const colorBufferFloatExt = capabilities.getExtension('WEBGL_color_buffer_float'); if (halfFloatExt && colorBufferFloatExt) { canUseHalfFloat = true; } }
            if (canUseHalfFloat) { targetType = THREE.HalfFloatType; }
            const renderTargetOptions = { minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, format: THREE.RGBAFormat, type: targetType, depthBuffer: false, stencilBuffer: false };
            tempRenderTarget = new THREE.WebGLRenderTarget(initialWidth, initialHeight, renderTargetOptions); tempRenderTarget.texture.generateMipmaps = false;
            console.log(`DEBUG: Created WebGLRenderTarget (${initialWidth}x${initialHeight}) with type: ${targetType === THREE.HalfFloatType ? 'HalfFloatType' : 'UnsignedByteType'}.`);

            console.log("DEBUG: Setting up base scene...");
            baseSceneRef.current = new THREE.Scene(); baseCameraRef.current = new THREE.OrthographicCamera(-initialWidth / 2, initialWidth / 2, initialHeight / 2, -initialHeight / 2, 0.1, 10); baseCameraRef.current.position.z = 1; const planeGeometry = new THREE.PlaneGeometry(1, 1); const planeMaterial = new THREE.MeshBasicMaterial({ map: null, side: THREE.DoubleSide, color: 0xffffff, transparent: false }); basePlaneMeshRef.current = new THREE.Mesh(planeGeometry, planeMaterial); baseSceneRef.current.add(basePlaneMeshRef.current);
            console.log("DEBUG: Base scene setup complete.");

            console.log("DEBUG: Setting up EffectComposer...");
            composerRef.current = new EffectComposer(renderer, tempRenderTarget);
            const renderPass = new RenderPass(baseSceneRef.current, baseCameraRef.current);
            composerRef.current.addPass(renderPass);
            console.log("DEBUG: Added RenderPass.");

            // <<< Add ShaderPass using the DEBUG SHADER definition >>>
            // Ensure DebugShader object is valid before cloning
            if (!DebugShader || !DebugShader.uniforms) {
                 throw new Error("DebugShader object is invalid.");
            }
            const debugShaderPassUniforms = UniformsUtils.clone(DebugShader.uniforms);
            effectPassRef.current = new ShaderPass({
                uniforms: debugShaderPassUniforms,
                vertexShader: DebugShader.vertexShader,
                fragmentShader: DebugShader.fragmentShader
            }, "tDiffuse"); // Specify input texture name
            if (!effectPassRef.current) {
                 throw new Error("Failed to create ShaderPass.");
            }
            effectPassRef.current.renderToScreen = true;
            composerRef.current.addPass(effectPassRef.current);
            console.log("DEBUG: Added ShaderPass (Bounding Box DEBUG).");

            // Finish initialization
            isInitialized.current = true; // Set flag *before* starting loop
            handleResize(); // Call resize AFTER initialization
            cancelAnimationFrame(animationFrameHandle.current); // Ensure no duplicate loops
            animationFrameHandle.current = requestAnimationFrame(renderLoop); // Start loop *only on success*
            console.log("DEBUG: initThreeScene SUCCESSFUL. Starting render loop.");

        } catch (error) {
            // Log the specific error that occurred
            console.error("DEBUG: initThreeScene FAILED:", error);
            tempRenderTarget?.dispose(); composerRef.current = null; effectPassRef.current = null; basePlaneMeshRef.current?.geometry?.dispose(); basePlaneMeshRef.current?.material?.dispose(); rendererInstanceRef.current?.dispose(); rendererInstanceRef.current = null; isInitialized.current = false;
            // Optionally re-throw or handle the error further
        }
    }, [handleResize, renderLoop, DebugShader]); // Depend on DebugShader ref now


    // --- Setup / Cleanup Effect (Identical to previous version) ---
    useEffect(() => {
        initThreeScene();
        let resizeObserver; const currentCanvas = canvasRef.current;
        if (currentCanvas) { resizeObserver = new ResizeObserver(() => { handleResize(); }); resizeObserver.observe(currentCanvas); }
        return () => { /* console.log("DEBUG: Cleanup running (TryOnRenderer Unmount)..."); */ resizeObserver?.disconnect(); cancelAnimationFrame(animationFrameHandle.current); isInitialized.current = false; /* console.log("DEBUG: Disposing Three.js resources..."); */ videoTextureRef.current?.dispose(); videoTextureRef.current = null; imageTextureRef.current?.dispose(); imageTextureRef.current = null; segmentationTextureRef.current?.dispose(); segmentationTextureRef.current = null; landmarkTextureRef.current?.dispose(); landmarkTextureRef.current = null; landmarkDataArray.current = null; if (composerRef.current) { composerRef.current.renderTarget?.dispose(); effectPassRef.current?.material?.dispose(); } composerRef.current = null; effectPassRef.current = null; basePlaneMeshRef.current?.geometry?.dispose(); basePlaneMeshRef.current?.material?.map?.dispose(); basePlaneMeshRef.current?.material?.dispose(); basePlaneMeshRef.current = null; baseSceneRef.current = null; baseCameraRef.current = null; rendererInstanceRef.current?.dispose(); rendererInstanceRef.current = null; /* console.log("DEBUG: Three.js resources disposed and refs cleared."); */ };
     }, [initThreeScene, handleResize]);


    // --- JSX --- (No change)
    return ( <canvas ref={canvasRef} className={`renderer-canvas ${className || ''}`} style={{ display: 'block', width: '100%', height: '100%', ...(style || {}) }} /> );

});
TryOnRenderer.displayName = 'TryOnRenderer';
export default TryOnRenderer;