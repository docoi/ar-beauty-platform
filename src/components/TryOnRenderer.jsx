// src/components/TryOnRenderer.jsx - MULTI-PASS with CPU Face Mask Generation
// Implements ChatGPT's recommended approach for stability

import React, { useRef, forwardRef, useEffect, useCallback } from 'react';
import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { UniformsUtils } from 'three';

// Define which landmarks form the outer face contour.
const FACE_OUTLINE_INDICES = [
    10,  338, 297, 332, 284, 251, 389, 356, 454, 323, 361, 288,
    397, 365, 379, 378, 400, 377, 152, 148, 176, 149, 150, 136,
    172, 58,  132, 93,  234, 127, 162, 21,  54,  103, 67,  109
];
// Note: MAX_FACE_POINTS is no longer needed for shader uniforms

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

    // Pass 2: Apply Silhouette Mask
    const SilhouetteMaskShader = {
        uniforms: {
            'tDiffuse': { value: null }, // Input from RenderPass
            'uSegmentationMask': { value: null },
            'uHasMask': { value: false },
            'uFlipMaskX': { value: false }
        },
        vertexShader: `varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 ); }`,
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
                // Apply mask (step allows sharp edges)
                // Use smoothstep for softer edges: smoothstep(0.4, 0.6, maskValue)
                gl_FragColor = vec4(color.rgb * step(0.5, maskValue), color.a);
            }
        `
    };

    // Pass 3: Apply CPU-Generated Face Mask
    const FaceMaskShader = {
        uniforms: {
            'tDiffuse': { value: null }, // Input from Silhouette Pass
            'uFaceMask': { value: null }, // The texture generated on CPU
            'uHasFaceMask': { value: false },
            'uFlipMaskX': { value: false } // Needed if face mask needs flipping (it shouldn't if drawn correctly)
        },
        vertexShader: `varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 ); }`,
        fragmentShader: `
            uniform sampler2D tDiffuse;
            uniform sampler2D uFaceMask;
            uniform bool uHasFaceMask;
            uniform bool uFlipMaskX; // Usually false for face mask if drawn matching landmarks
            varying vec2 vUv;

            void main() {
                vec4 color = texture2D(tDiffuse, vUv);
                float faceMaskValue = 0.0;
                if (uHasFaceMask) {
                    // Face mask is drawn based on landmarks (Y=0 top), screen UV is Y=0 bottom
                    float maskCoordX = uFlipMaskX ? (1.0 - vUv.x) : vUv.x; // Apply flip if needed
                    float maskCoordY = 1.0 - vUv.y; // Always flip Y to match screen UVs to texture UVs
                    faceMaskValue = texture2D(uFaceMask, vec2(maskCoordX, maskCoordY)).r; // Use Red channel (canvas is white on black)
                }
                 // Apply mask (use step for binary mask from canvas)
                gl_FragColor = vec4(color.rgb * step(0.5, faceMaskValue), color.a);
            }
        `
    };

    // Pass 4: Apply Hydration Effect (Simpler - only needs intensity)
    const HydrationEffectShader = {
        uniforms: {
            'tDiffuse': { value: null }, // Input from Face Mask Pass
            'uEffectIntensity': { value: 0.5 }
        },
        vertexShader: `varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 ); }`,
        fragmentShader: `
            uniform sampler2D tDiffuse;
            uniform float uEffectIntensity;
            varying vec2 vUv;

            vec3 applyHydrationEffect(vec3 c){
                 vec3 h=c*(1.0+0.1*uEffectIntensity);
                 h+=vec3(0.05*uEffectIntensity);
                 return h;
            }

            void main() {
                vec4 color = texture2D(tDiffuse, vUv);
                vec3 finalColor = color.rgb;

                // Apply effect if intensity is high enough and pixel isn't black (masked out)
                if (uEffectIntensity > 0.01 && (color.r > 0.01 || color.g > 0.01 || color.b > 0.01)) {
                     finalColor = applyHydrationEffect(color.rgb);
                }

                gl_FragColor = vec4(clamp(finalColor, 0.0, 1.0), color.a);
            }
        `
    };


    // --- Prop Effects / Texture Effects ---
    useEffect(() => { currentIntensity.current = effectIntensity; if (effectPassRef.current) { effectPassRef.current.uniforms.uEffectIntensity.value = currentIntensity.current; } }, [effectIntensity]);
    useEffect(() => { /* Video Texture - No Change */ }, [isStatic, videoRefProp, videoRefProp?.current?.readyState]);
    useEffect(() => { /* Image Texture - No Change */ }, [isStatic, imageElement, imageElement?.complete]);
    useEffect(() => { /* Segmentation Mask Texture - No Change */ }, [segmentationResults, isStatic]);

    // --- ***** CPU FACE MASK GENERATION EFFECT ***** ---
    useEffect(() => {
        const landmarks = mediaPipeResults?.faceLandmarks?.[0];

        // Determine the target dimensions for the face mask canvas
        // Match the segmentation mask if available, otherwise use a default or video size
        const targetWidth = segmentationTextureRef.current?.image?.width || videoTextureRef.current?.image?.videoWidth || imageTextureRef.current?.image?.naturalWidth || 256;
        const targetHeight = segmentationTextureRef.current?.image?.height || videoTextureRef.current?.image?.videoHeight || imageTextureRef.current?.image?.naturalHeight || 256;

        let needsTextureUpdate = false;
        let hasValidLandmarks = false;

        if (landmarks && landmarks.length > 0 && targetWidth > 0 && targetHeight > 0) {
             const now = performance.now();
             const timeSinceLastUpdate = now - lastLandmarkUpdateTime.current;
             const throttleThreshold = isStatic ? 0 : 40; // Throttle CPU drawing (~25fps)

             if (timeSinceLastUpdate > throttleThreshold) {
                 lastLandmarkUpdateTime.current = now;
                 hasValidLandmarks = true; // Assume valid if we process
                 needsTextureUpdate = true; // Mark for texture update

                 try {
                     // Get or create the offscreen canvas
                     if (!faceMaskCanvasRef.current) {
                         faceMaskCanvasRef.current = document.createElement('canvas');
                         console.log("TryOnRenderer: Created offscreen canvas for face mask.");
                     }
                     const canvas = faceMaskCanvasRef.current;
                     if (canvas.width !== targetWidth || canvas.height !== targetHeight) {
                         canvas.width = targetWidth;
                         canvas.height = targetHeight;
                         console.log(`TryOnRenderer: Resized face mask canvas to ${targetWidth}x${targetHeight}`);
                     }
                     const ctx = canvas.getContext('2d');
                     if (!ctx) throw new Error("Could not get 2D context");

                     // --- Draw the face polygon ---
                     ctx.clearRect(0, 0, canvas.width, canvas.height); // Clear previous frame (black)
                     ctx.fillStyle = 'white';                          // Set fill to white
                     ctx.beginPath();

                     FACE_OUTLINE_INDICES.forEach((index, i) => {
                         if (index < landmarks.length) {
                             // Landmarks coords are 0-1, scale to canvas size
                             // Canvas Y=0 is top, Landmark Y=0 is top - direct mapping works
                             const point = landmarks[index];
                             const x = point.x * canvas.width;
                             const y = point.y * canvas.height;
                             if (i === 0) {
                                 ctx.moveTo(x, y);
                             } else {
                                 ctx.lineTo(x, y);
                             }
                         }
                     });
                     ctx.closePath();
                     ctx.fill(); // Fill the polygon white

                     // --- Update the THREE.js Texture ---
                     const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
                     let texture = faceMaskTextureRef.current;

                     if (!texture || texture.image.width !== canvas.width || texture.image.height !== canvas.height) {
                         texture?.dispose();
                         console.log(`TryOnRenderer Face Mask Texture: Creating NEW (${canvas.width}x${canvas.height})`);
                         texture = new THREE.DataTexture(imageData.data, canvas.width, canvas.height, THREE.RGBAFormat, THREE.UnsignedByteType); // Use RGBA/Byte from canvas
                         texture.minFilter = THREE.NearestFilter; // Use nearest for sharp mask edges
                         texture.magFilter = THREE.NearestFilter;
                         texture.generateMipmaps = false;
                         texture.needsUpdate = true;
                         faceMaskTextureRef.current = texture;
                     } else {
                         // console.log(`TryOnRenderer Face Mask Texture: Updating existing`);
                         texture.image.data = imageData.data; // Update data content
                         texture.image.width = canvas.width;  // Ensure dimensions match
                         texture.image.height = canvas.height;
                         texture.needsUpdate = true;
                     }
                 } catch (error) {
                     console.error("TryOnRenderer: Error generating face mask texture:", error);
                     faceMaskTextureRef.current?.dispose(); faceMaskTextureRef.current = null; // Dispose on error
                     hasValidLandmarks = false;
                     needsTextureUpdate = false; // Don't try to update uniforms if error occurred
                 }
             } else {
                  // Throttled - get previous landmark state
                  hasValidLandmarks = faceMaskPassRef.current ? faceMaskPassRef.current.uniforms.uHasFaceMask.value : false;
             }
        } else {
            // No landmarks found
            hasValidLandmarks = false;
            needsTextureUpdate = faceMaskTextureRef.current !== null; // Need update if texture exists but shouldn't
            if (faceMaskTextureRef.current) {
                faceMaskTextureRef.current.dispose();
                faceMaskTextureRef.current = null;
            }
        }

        // Update the FaceMaskShader uniform if needed
        if (faceMaskPassRef.current && needsTextureUpdate) {
            faceMaskPassRef.current.uniforms.uHasFaceMask.value = hasValidLandmarks;
            faceMaskPassRef.current.uniforms.uFaceMask.value = faceMaskTextureRef.current; // Assign texture or null
        }
    }, [mediaPipeResults, isStatic, segmentationTextureRef.current]); // Depend also on segmentation mask potentially determining size


    // --- Handle Resizing (No changes) ---
    const handleResize = useCallback(() => { /* ... */ }, []);
    // --- Scale Base Plane (No changes) ---
    const fitPlaneToCamera = useCallback((textureWidth, textureHeight) => { /* ... */ }, []);


    // --- Render Loop (Updates uniforms for relevant passes) ---
     const renderLoop = useCallback(() => {
        animationFrameHandle.current = requestAnimationFrame(renderLoop);
        renderLoopCounter.current++;
        if (!isInitialized.current || !rendererInstanceRef.current || !composerRef.current || !basePlaneMeshRef.current || !silhouettePassRef.current || !faceMaskPassRef.current || !effectPassRef.current) { return; }

        try {
            // 1 & 2: Select Texture, Assign Map, Update Plane Scale/Mirroring
            const baseMaterial = basePlaneMeshRef.current.material; let sourceWidth = 0, sourceHeight = 0; let textureToAssign = null; let isVideo = !isStatic; let needsTextureUpdate = false; if (isVideo && videoTextureRef.current) { textureToAssign = videoTextureRef.current; const video = textureToAssign.image; if(video && video.readyState >= video.HAVE_CURRENT_DATA) { sourceWidth = video.videoWidth; sourceHeight = video.videoHeight; needsTextureUpdate = (baseMaterial.map !== textureToAssign); } else { textureToAssign = null; } } else if (isStatic && imageTextureRef.current) { textureToAssign = imageTextureRef.current; const image = textureToAssign.image; if(image && image.complete && image.naturalWidth > 0) { sourceWidth = image.naturalWidth; sourceHeight = image.naturalHeight; needsTextureUpdate = (baseMaterial.map !== textureToAssign) || textureToAssign.needsUpdate; } else { textureToAssign = null; } } if (baseMaterial && needsTextureUpdate) { baseMaterial.map = textureToAssign; baseMaterial.needsUpdate = true; } else if (baseMaterial && baseMaterial.map !== textureToAssign && !textureToAssign) { baseMaterial.map = null; baseMaterial.needsUpdate = true; } const planeVisible = !!baseMaterial?.map && sourceWidth > 0 && sourceHeight > 0; if (planeVisible) { fitPlaneToCamera(sourceWidth, sourceHeight); const scaleX = Math.abs(basePlaneMeshRef.current.scale.x); const newScaleX = isVideo ? -scaleX : scaleX; if(basePlaneMeshRef.current.scale.x !== newScaleX) { basePlaneMeshRef.current.scale.x = newScaleX; } } else { if (basePlaneMeshRef.current.scale.x !== 0 || basePlaneMeshRef.current.scale.y !== 0) { basePlaneMeshRef.current.scale.set(0, 0, 0); } } if (planeVisible && textureToAssign && textureToAssign.needsUpdate) { textureToAssign.needsUpdate = false; }

            // 3. Update ShaderPass Uniforms
             // Pass 2: Silhouette Mask
             if (silhouettePassRef.current) {
                 const uniforms = silhouettePassRef.current.uniforms;
                 if (uniforms.uSegmentationMask.value !== segmentationTextureRef.current) {
                    uniforms.uSegmentationMask.value = segmentationTextureRef.current;
                    uniforms.uHasMask.value = !!segmentationTextureRef.current;
                 }
                 uniforms.uFlipMaskX.value = isVideo;
             }
             // Pass 3: Face Mask (Texture/Flag updated in useEffect)
              if (faceMaskPassRef.current) {
                  const uniforms = faceMaskPassRef.current.uniforms;
                  // Face mask alignment should generally match landmark data (Y=0 top),
                  // screen UVs have Y=0 bottom. So, mask Y needs flipping (1.0 - vUv.y).
                  // If video is mirrored (isVideo=true), and we *didn't* mirror the landmarks when drawing
                  // the mask, then the face mask texture itself needs flipping horizontally when sampled.
                  uniforms.uFlipMaskX.value = isVideo; // Apply same flip logic as silhouette
              }
             // Pass 4: Effect Intensity (updated in useEffect)


            // 4. Render using the Composer
            composerRef.current.render();

        } catch (error) {
            console.error("TryOnRenderer: Error in renderLoop:", error);
        }
    }, [fitPlaneToCamera, isStatic]);


    // --- Initialize Scene (Sets up multi-pass composer) ---
    const initThreeScene = useCallback(() => {
        if (!canvasRef.current || isInitialized.current) { return; }
        console.log("DEBUG: initThreeScene START (Multi-Pass CPU Face Mask)");
        let tempRenderTarget = null;
        try {
            // --- Renderer, Capabilities, Render Target (No changes) ---
            console.log("DEBUG: Initializing renderer...");
            const canvas = canvasRef.current; const initialWidth = Math.max(1, canvas.clientWidth || 640); const initialHeight = Math.max(1, canvas.clientHeight || 480);
            const renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true });
            renderer.setSize(initialWidth, initialHeight); renderer.setPixelRatio(window.devicePixelRatio); renderer.outputColorSpace = THREE.SRGBColorSpace;
            rendererInstanceRef.current = renderer;
            console.log("DEBUG: Renderer initialized.");
            console.log("DEBUG: Checking capabilities and creating render target...");
            const capabilities = renderer.capabilities; if (!capabilities) { throw new Error("Renderer capabilities object not found."); } let targetType = THREE.UnsignedByteType; let canUseHalfFloat = false; if (capabilities.isWebGL2) { canUseHalfFloat = true; } else { const halfFloatExt = capabilities.getExtension('OES_texture_half_float'); const colorBufferFloatExt = capabilities.getExtension('WEBGL_color_buffer_float'); if (halfFloatExt && colorBufferFloatExt) { canUseHalfFloat = true; } } if (canUseHalfFloat) { targetType = THREE.HalfFloatType; } const renderTargetOptions = { minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, format: THREE.RGBAFormat, type: targetType, depthBuffer: false, stencilBuffer: false }; tempRenderTarget = new THREE.WebGLRenderTarget(initialWidth, initialHeight, renderTargetOptions); tempRenderTarget.texture.generateMipmaps = false;
            console.log(`DEBUG: Created WebGLRenderTarget (${initialWidth}x${initialHeight}) with type: ${targetType === THREE.HalfFloatType ? 'HalfFloatType' : 'UnsignedByteType'}.`);

            // --- Base Scene Setup (No changes) ---
            console.log("DEBUG: Setting up base scene...");
            baseSceneRef.current = new THREE.Scene(); baseCameraRef.current = new THREE.OrthographicCamera(-initialWidth / 2, initialWidth / 2, initialHeight / 2, -initialHeight / 2, 0.1, 10); baseCameraRef.current.position.z = 1; const planeGeometry = new THREE.PlaneGeometry(1, 1); const planeMaterial = new THREE.MeshBasicMaterial({ map: null, side: THREE.DoubleSide, color: 0xffffff, transparent: false }); basePlaneMeshRef.current = new THREE.Mesh(planeGeometry, planeMaterial); baseSceneRef.current.add(basePlaneMeshRef.current);
            console.log("DEBUG: Base scene setup complete.");

            // --- Setup EffectComposer (Multi-Pass) ---
            console.log("DEBUG: Setting up EffectComposer...");
            composerRef.current = new EffectComposer(renderer, tempRenderTarget);

            // Pass 1: Render Scene
            const renderPass = new RenderPass(baseSceneRef.current, baseCameraRef.current);
            composerRef.current.addPass(renderPass);
            console.log("DEBUG: Added RenderPass.");

            // Pass 2: Apply Silhouette Mask
            if (!SilhouetteMaskShader || !SilhouetteMaskShader.uniforms) { throw new Error("SilhouetteMaskShader invalid"); }
            const silhouettePass = new ShaderPass(UniformsUtils.clone(SilhouetteMaskShader), "tDiffuse");
            silhouettePassRef.current = silhouettePass; // Store ref
            composerRef.current.addPass(silhouettePass);
            console.log("DEBUG: Added SilhouetteMask Pass.");

            // Pass 3: Apply Face Mask
             if (!FaceMaskShader || !FaceMaskShader.uniforms) { throw new Error("FaceMaskShader invalid"); }
            const faceMaskPass = new ShaderPass(UniformsUtils.clone(FaceMaskShader), "tDiffuse");
            faceMaskPassRef.current = faceMaskPass; // Store ref
            composerRef.current.addPass(faceMaskPass);
            console.log("DEBUG: Added FaceMask Pass.");

            // Pass 4: Apply Effect
            if (!HydrationEffectShader || !HydrationEffectShader.uniforms) { throw new Error("HydrationEffectShader invalid"); }
            const effectPass = new ShaderPass(UniformsUtils.clone(HydrationEffectShader), "tDiffuse");
            effectPass.uniforms.uEffectIntensity.value = currentIntensity.current; // Set initial intensity
            effectPass.renderToScreen = true; // <<< Final pass renders to screen
            effectPassRef.current = effectPass; // Store ref
            composerRef.current.addPass(effectPass);
            console.log("DEBUG: Added Hydration Effect Pass.");

            // Finish initialization
            isInitialized.current = true; handleResize(); cancelAnimationFrame(animationFrameHandle.current); animationFrameHandle.current = requestAnimationFrame(renderLoop);
            console.log("DEBUG: initThreeScene SUCCESSFUL. Starting render loop.");

        } catch (error) {
            console.error("DEBUG: initThreeScene FAILED:", error); tempRenderTarget?.dispose(); composerRef.current = null; effectPassRef.current = null; faceMaskPassRef.current = null; silhouettePassRef.current = null; basePlaneMeshRef.current?.geometry?.dispose(); basePlaneMeshRef.current?.material?.dispose(); rendererInstanceRef.current?.dispose(); rendererInstanceRef.current = null; isInitialized.current = false;
        }
    }, [handleResize, renderLoop]); // Removed shader refs dependency as they are defined outside


    // --- Setup / Cleanup Effect (Dispose new textures/passes) ---
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
            // Dispose materials from shader passes
            silhouettePassRef.current?.material?.dispose();
            faceMaskPassRef.current?.material?.dispose();
            effectPassRef.current?.material?.dispose();
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