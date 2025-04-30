// src/components/TryOnRenderer.jsx - EffectComposer + ACTUAL HalfFloatType Fix

import React, { useRef, forwardRef, useEffect, useCallback } from 'react';
import * as THREE from 'three';
// Import necessary EffectComposer passes
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
// Import UniformsUtils for cloning
import { UniformsUtils } from 'three';

const TryOnRenderer = forwardRef(({
    videoRefProp, imageElement,
    mediaPipeResults, // Unused in this version's shader, but could be passed if needed
    segmentationResults, // <<< Used for mask texture
    isStatic,
    // Unused props:
    // brightness, contrast, // Can be added back to shader if needed
    effectIntensity, // <<< Used for effect strength
    className, style
 }, ref) => {

    // --- Core Refs / Internal State Refs ---
    const canvasRef = useRef(null); const rendererInstanceRef = useRef(null); const animationFrameHandle = useRef(null); const isInitialized = useRef(false);
    const baseSceneRef = useRef(null); const baseCameraRef = useRef(null); const basePlaneMeshRef = useRef(null); const videoTextureRef = useRef(null);
    const imageTextureRef = useRef(null); const segmentationTextureRef = useRef(null);
    const composerRef = useRef(null); const effectPassRef = useRef(null);
    const currentIntensity = useRef(0.5); // Use the prop's initial value? Effect handles updates.
    const renderLoopCounter = useRef(0); const lastMaskUpdateTime = useRef(0);


    // --- Shaders (Subtle Effect + Mask Flip) ---
    const customVertexShader = `varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 ); }`;
    const customFragmentShader = `
        uniform sampler2D tDiffuse;          // Texture from previous pass (EffectComposer provides this)
        uniform sampler2D uSegmentationMask; // Our mask texture
        uniform float uEffectIntensity;      // Slider value
        uniform bool uHasMask;               // Mask flag

        varying vec2 vUv;

        // Subtle "Hydration" effect function
        vec3 applyHydrationEffect(vec3 color) {
             // Make slightly brighter/shinier - adjust as needed
             vec3 hydratedLook = color * (1.0 + 0.1 * uEffectIntensity); // Intensity affects base brightness boost
             hydratedLook += vec3(0.05 * uEffectIntensity); // Add a slight white highlight, scaled by intensity
             return hydratedLook;
        }

        void main() {
            vec4 baseColor = texture2D(tDiffuse, vUv); // Sample previous pass
            vec3 finalColor = baseColor.rgb;

            if (uHasMask && uEffectIntensity > 0.01) { // Check intensity threshold
                // Flip the Y coordinate for mask sampling because WebGL's 0,0 is bottom-left
                // while MediaPipe's mask data likely assumes 0,0 is top-left.
                float maskValue = texture2D(uSegmentationMask, vec2(vUv.x, 1.0 - vUv.y)).r; // Sample the RED channel

                vec3 hydratedColor = applyHydrationEffect(finalColor);

                // Smoothstep provides a nicer transition than a hard edge
                // Adjust the 0.3 and 0.8 values to control the feathering of the mask edge
                float blendAmount = smoothstep(0.3, 0.8, maskValue) * uEffectIntensity;

                finalColor = mix(finalColor, hydratedColor, blendAmount); // Blend based on mask and intensity
            }

            // Ensure color values stay within the valid range
            finalColor = clamp(finalColor, 0.0, 1.0);

            // Output the final color with the original alpha
            gl_FragColor = vec4(finalColor, baseColor.a);
        }
    `;

    // Define the shader object for ShaderPass
    // Use a stable reference for useCallback dependency
    const HydrationShader = useRef({
        uniforms: {
            'tDiffuse': { value: null }, // Provided by composer automatically
            'uSegmentationMask': { value: null }, // We update this
            'uEffectIntensity': { value: 0.5 },   // We update this based on prop
            'uHasMask': { value: false }          // We update this based on mask availability
        },
        vertexShader: customVertexShader,
        fragmentShader: customFragmentShader
    }).current; // .current makes it stable


    // --- Prop Effects / Texture Effects ---
    // Update effect intensity uniform when prop changes
    useEffect(() => {
        currentIntensity.current = effectIntensity;
        if (effectPassRef.current) {
            // console.log("Updating intensity uniform:", currentIntensity.current);
            effectPassRef.current.uniforms.uEffectIntensity.value = currentIntensity.current;
        }
     }, [effectIntensity]);

     // Video Texture Effect
    useEffect(() => {
        const videoElement = videoRefProp?.current;
        if (!isStatic && videoElement && videoElement.readyState >= videoElement.HAVE_METADATA) {
            if (!videoTextureRef.current || videoTextureRef.current.image !== videoElement) {
                console.log("TryOnRenderer: Creating/Updating Video Texture");
                videoTextureRef.current?.dispose();
                videoTextureRef.current = new THREE.VideoTexture(videoElement);
                videoTextureRef.current.colorSpace = THREE.SRGBColorSpace;
            }
        } else if (!isStatic && videoTextureRef.current) {
            // If switching away from video or video not ready, clear the ref
            console.log("TryOnRenderer: Disposing Video Texture (No longer static or video not ready)");
            videoTextureRef.current.dispose();
            videoTextureRef.current = null;
        }
    }, [isStatic, videoRefProp, videoRefProp?.current?.readyState]); // Add readyState dependency

    // Image Texture Effect
    useEffect(() => {
        if (isStatic && imageElement && imageElement.complete && imageElement.naturalWidth > 0) {
             if (!imageTextureRef.current || imageTextureRef.current.image !== imageElement) {
                console.log("TryOnRenderer: Creating/Updating Image Texture");
                imageTextureRef.current?.dispose();
                imageTextureRef.current = new THREE.Texture(imageElement);
                imageTextureRef.current.colorSpace = THREE.SRGBColorSpace;
                imageTextureRef.current.needsUpdate = true; // Crucial for initial load
            } else if (imageTextureRef.current && imageTextureRef.current.image === imageElement && !imageTextureRef.current.needsUpdate) {
                // If image element is the same but might have changed (e.g., re-upload), mark for update
                // This might be redundant if imageElement ref changes on new upload
                // console.log("TryOnRenderer: Marking existing Image Texture for update");
                // imageTextureRef.current.needsUpdate = true;
            }
        } else if (isStatic && imageTextureRef.current) {
             console.log("TryOnRenderer: Disposing Image Texture (No longer static or image not ready)");
             imageTextureRef.current.dispose();
             imageTextureRef.current = null;
        }
    }, [isStatic, imageElement, imageElement?.complete]); // Add complete dependency


    // --- Segmentation Mask Texture Effect (Correct Filtering + Throttling) ---
    useEffect(() => {
        const results = segmentationResults;
        const hasMaskData = results?.confidenceMasks?.[0]; // Check if the first mask exists

        if (hasMaskData) {
            const confidenceMaskObject = results.confidenceMasks[0];
            const maskWidth = confidenceMaskObject?.width;
            const maskHeight = confidenceMaskObject?.height;
            let maskData = null;

            // Robustly get the mask data
            try {
                if (typeof confidenceMaskObject?.getAsFloat32Array === 'function') {
                    maskData = confidenceMaskObject.getAsFloat32Array();
                 } else if (confidenceMaskObject?.data instanceof Float32Array) { // Handle potential direct data access if API changes
                     maskData = confidenceMaskObject.data;
                 }
            } catch (error) {
                 console.error("Error getting mask data:", error);
                 maskData = null;
            }

            if (maskData instanceof Float32Array && maskWidth > 0 && maskHeight > 0) {
                const now = performance.now();
                const timeSinceLastUpdate = now - lastMaskUpdateTime.current;
                // Throttle updates for video mode (e.g., ~15fps), no throttle for static
                const throttleThreshold = isStatic ? 0 : 66; // ms (1000ms / 15fps ≈ 66ms)

                if (timeSinceLastUpdate > throttleThreshold) {
                    lastMaskUpdateTime.current = now;
                    try {
                        let texture = segmentationTextureRef.current;
                        // Check if texture needs creation or resizing
                        if (!texture || texture.image.width !== maskWidth || texture.image.height !== maskHeight) {
                            texture?.dispose(); // Dispose old one if dimensions change
                            // console.log(`TryOnRenderer Mask Texture: Creating NEW DataTexture (${maskWidth}x${maskHeight})`);
                            texture = new THREE.DataTexture(maskData, maskWidth, maskHeight, THREE.RedFormat, THREE.FloatType);
                            texture.minFilter = THREE.NearestFilter; // No interpolation needed/wanted for masks
                            texture.magFilter = THREE.NearestFilter;
                            texture.generateMipmaps = false;         // Mipmaps not needed
                            texture.needsUpdate = true;               // Required after creation/data change
                            segmentationTextureRef.current = texture; // Assign NEW texture to ref
                        } else {
                            // Update existing texture data
                            // console.log(`TryOnRenderer Mask Texture: Updating existing DataTexture data.`);
                            texture.image.data = maskData; // Update the data pointer
                            texture.needsUpdate = true;      // Required after data change
                        }
                        // Ensure the uniform points to the potentially new texture object
                        if (effectPassRef.current) {
                             effectPassRef.current.uniforms.uSegmentationMask.value = segmentationTextureRef.current;
                             effectPassRef.current.uniforms.uHasMask.value = true;
                        }

                    } catch (error) {
                        console.error("TryOnRenderer: Error processing mask texture:", error);
                        segmentationTextureRef.current?.dispose(); // Clean up ref if error occurs
                        segmentationTextureRef.current = null;
                         if (effectPassRef.current) {
                             effectPassRef.current.uniforms.uSegmentationMask.value = null;
                             effectPassRef.current.uniforms.uHasMask.value = false;
                         }
                    }
                } else {
                    // Throttled out, ensure uniform still has the *current* texture instance
                     if (effectPassRef.current && effectPassRef.current.uniforms.uSegmentationMask.value !== segmentationTextureRef.current) {
                         effectPassRef.current.uniforms.uSegmentationMask.value = segmentationTextureRef.current;
                         effectPassRef.current.uniforms.uHasMask.value = !!segmentationTextureRef.current;
                     }
                }
            } else {
                // Invalid mask data received
                // console.warn("TryOnRenderer: Invalid mask data received.");
                if (segmentationTextureRef.current) {
                    // console.log("TryOnRenderer: Disposing existing mask texture due to invalid data.");
                    segmentationTextureRef.current.dispose();
                    segmentationTextureRef.current = null;
                }
                 if (effectPassRef.current) {
                    effectPassRef.current.uniforms.uSegmentationMask.value = null;
                    effectPassRef.current.uniforms.uHasMask.value = false;
                 }
            }
        } else {
            // No mask data in results object
            if (segmentationTextureRef.current) {
                // console.log("TryOnRenderer: Disposing existing mask texture (no mask in results).");
                segmentationTextureRef.current.dispose();
                segmentationTextureRef.current = null;
            }
             if (effectPassRef.current) {
                effectPassRef.current.uniforms.uSegmentationMask.value = null;
                effectPassRef.current.uniforms.uHasMask.value = false;
             }
        }
    }, [segmentationResults, isStatic]); // Dependencies: results object and mode


    // --- Handle Resizing (Including Composer's Render Target) ---
    const handleResize = useCallback(() => {
         const canvas = canvasRef.current;
         // Ensure composer exists AND has a renderTarget property before accessing it
         if (!rendererInstanceRef.current || !baseCameraRef.current || !composerRef.current || !composerRef.current.renderTarget || !canvas) {
              // console.log("Resize skipped: Missing refs or canvas.");
              return;
         }

         const newWidth = canvas.clientWidth;
         const newHeight = canvas.clientHeight;
         if (newWidth === 0 || newHeight === 0) {
              // console.log("Resize skipped: Zero dimensions.");
              return; // Avoid resizing to zero
         }

         const currentSize = rendererInstanceRef.current.getSize(new THREE.Vector2());
         if (currentSize.x === newWidth && currentSize.y === newHeight) {
             // console.log("Resize skipped: Size already correct.");
             return; // No change needed
         }

         try {
             console.log(`TryOnRenderer: Resizing to ${newWidth}x${newHeight}`);
             rendererInstanceRef.current.setSize(newWidth, newHeight); // Resize renderer drawing buffer

             // *** Resize the Composer's custom render target ***
             composerRef.current.renderTarget.setSize(newWidth, newHeight);

             // *** Resize the composer itself (adjusts internal viewport, might affect passes) ***
             composerRef.current.setSize(newWidth, newHeight);

             // Update camera projection for the base scene
             baseCameraRef.current.left = -newWidth / 2;
             baseCameraRef.current.right = newWidth / 2;
             baseCameraRef.current.top = newHeight / 2;
             baseCameraRef.current.bottom = -newHeight / 2;
             baseCameraRef.current.updateProjectionMatrix();
             console.log("TryOnRenderer: Resize successful.");
         } catch(e) {
             console.error("TryOnRenderer: Resize Error:", e);
         }
    }, []); // No dependencies needed as it reads refs


    // --- Scale Base Plane to Fit Viewport ---
    const fitPlaneToCamera = useCallback((textureWidth, textureHeight) => {
        const canvas = canvasRef.current;
        if (!baseCameraRef.current || !basePlaneMeshRef.current || !textureWidth || !textureHeight || !canvas) return;

        const viewWidth = canvas.clientWidth;
        const viewHeight = canvas.clientHeight;
        if (viewWidth === 0 || viewHeight === 0) return; // Avoid division by zero

        const viewAspect = viewWidth / viewHeight;
        const textureAspect = textureWidth / textureHeight;

        let scaleX, scaleY;
        // Determine scaling based on aspect ratio to cover the viewport
        if (viewAspect > textureAspect) {
            // Viewport is wider than texture: Match viewport width
            scaleX = viewWidth;
            scaleY = viewWidth / textureAspect;
        } else {
            // Viewport is taller than or same aspect as texture: Match viewport height
            scaleY = viewHeight;
            scaleX = viewHeight * textureAspect;
        }

        const currentScale = basePlaneMeshRef.current.scale;
        // Preserve the sign of X for mirroring, default to 1 if it's 0
        const signX = Math.sign(currentScale.x) || 1;
        const newScaleXWithSign = scaleX * signX; // Apply mirroring sign

        // Only update if scale changes significantly to avoid unnecessary updates
        if (Math.abs(currentScale.y - scaleY) > 0.01 || Math.abs(currentScale.x - newScaleXWithSign) > 0.01) {
            // console.log(`FitPlane: Updating scale to ${newScaleXWithSign.toFixed(2)}, ${scaleY.toFixed(2)}`);
            currentScale.set(newScaleXWithSign, scaleY, 1);
        }
     }, []); // No dependencies, reads refs


    // --- Render Loop (Use EffectComposer) ---
     const renderLoop = useCallback(() => {
        animationFrameHandle.current = requestAnimationFrame(renderLoop);
        renderLoopCounter.current++;
        const log = renderLoopCounter.current < 5 || renderLoopCounter.current % 150 === 0; // Log occasionally

        if (!isInitialized.current || !rendererInstanceRef.current || !composerRef.current || !basePlaneMeshRef.current || !effectPassRef.current) {
             // if (log) console.log("RenderLoop: Skipped - Not initialized or refs missing.");
             return;
        }

        try {
            // 1. Select Source Texture for Base Plane
            const baseMaterial = basePlaneMeshRef.current.material; // Should be MeshBasicMaterial
            let sourceWidth = 0, sourceHeight = 0;
            let textureToAssign = null;
            let isVideo = false;
            let needsTextureUpdate = false;

            // Determine which texture (video or image) should be on the plane
            if (!isStatic && videoTextureRef.current) {
                 textureToAssign = videoTextureRef.current;
                 isVideo = true;
                 const video = textureToAssign.image;
                 if(video && video.readyState >= video.HAVE_CURRENT_DATA) {
                     sourceWidth = video.videoWidth;
                     sourceHeight = video.videoHeight;
                     // VideoTexture updates automatically, but check if map needs assigning
                     needsTextureUpdate = (baseMaterial.map !== textureToAssign);
                 } else { textureToAssign = null; } // Video not ready
            } else if (isStatic && imageTextureRef.current) {
                 textureToAssign = imageTextureRef.current;
                 const image = textureToAssign.image;
                 if(image && image.complete && image.naturalWidth > 0) {
                     sourceWidth = image.naturalWidth;
                     sourceHeight = image.naturalHeight;
                     needsTextureUpdate = (baseMaterial.map !== textureToAssign) || textureToAssign.needsUpdate;
                 } else { textureToAssign = null; } // Image not ready
            }

            // Assign texture to the base plane's material
            if (baseMaterial && needsTextureUpdate) {
                 if(log && textureToAssign) console.log(`RenderLoop: Assigning ${isVideo ? 'Video' : 'Image'} Texture to base plane map.`);
                 baseMaterial.map = textureToAssign;
                 baseMaterial.needsUpdate = true; // Material needs update when map changes
            } else if (baseMaterial && baseMaterial.map !== textureToAssign && !textureToAssign) {
                 // If we should have no texture (e.g., switching modes), clear the map
                 if (log) console.log("RenderLoop: Clearing base plane map.");
                 baseMaterial.map = null;
                 baseMaterial.needsUpdate = true;
            }

            // 2. Update Plane Scale & Mirroring
            const planeVisible = !!baseMaterial?.map && sourceWidth > 0 && sourceHeight > 0;
            if (planeVisible) {
                fitPlaneToCamera(sourceWidth, sourceHeight);
                // Apply mirroring for video feed
                const scaleX = Math.abs(basePlaneMeshRef.current.scale.x);
                const newScaleX = isVideo ? -scaleX : scaleX; // Flip X if video
                if(basePlaneMeshRef.current.scale.x !== newScaleX) {
                    basePlaneMeshRef.current.scale.x = newScaleX;
                }
            } else {
                // Hide plane if no texture or dimensions are zero
                if (basePlaneMeshRef.current.scale.x !== 0 || basePlaneMeshRef.current.scale.y !== 0) {
                     if (log) console.log("RenderLoop: Hiding base plane (scale 0).");
                     basePlaneMeshRef.current.scale.set(0, 0, 0); // Set scale to 0 to hide
                }
            }

            // Mark image texture as updated if necessary
            if (planeVisible && textureToAssign && textureToAssign.needsUpdate) {
                textureToAssign.needsUpdate = false;
            }

            // 3. Update ShaderPass Uniforms (already done in useEffect for mask/intensity)
            // Make sure uHasMask and uSegmentationMask are up-to-date (they should be from the useEffect)
             if (effectPassRef.current) {
                 const currentUniformValue = effectPassRef.current.uniforms.uSegmentationMask.value;
                 const actualTexture = segmentationTextureRef.current;
                 if (currentUniformValue !== actualTexture) {
                      // This check might be redundant if useEffect logic is perfect, but safer
                      // console.warn("RenderLoop: Correcting mask uniform reference.");
                      effectPassRef.current.uniforms.uSegmentationMask.value = actualTexture;
                      effectPassRef.current.uniforms.uHasMask.value = !!actualTexture;
                 }
             } else if (log) {
                 console.warn("RenderLoop: EffectPassRef not ready for uniform update.");
             }


            // 4. Render using the Composer
            // The composer handles rendering the RenderPass (base scene to its internal buffer)
            // and then the ShaderPass (processing the buffer and rendering to screen)
            if (log && !planeVisible) console.log("RenderLoop: Plane not visible, rendering composer (likely clear screen).");
            composerRef.current.render();

        } catch (error) {
            console.error("TryOnRenderer: Error in renderLoop:", error);
            // Consider stopping the loop if errors persist
            // cancelAnimationFrame(animationFrameHandle.current);
        }
    }, [fitPlaneToCamera, isStatic]); // Dependencies


    // --- Initialize Scene (Use EffectComposer + HalfFloatType RenderTarget) ---
    const initThreeScene = useCallback(() => {
        if (!canvasRef.current || isInitialized.current) {
            console.log("initThreeScene skipped: Canvas not ready or already initialized.");
            return;
        }
        console.log("DEBUG: initThreeScene START (EffectComposer + ACTUAL HalfFloatType RT)");
        let tempRenderTarget = null; // Keep track for cleanup on error

        try {
            const canvas = canvasRef.current;
            const initialWidth = Math.max(1, canvas.clientWidth || 640); // Ensure non-zero
            const initialHeight = Math.max(1, canvas.clientHeight || 480);

            rendererInstanceRef.current = new THREE.WebGLRenderer({ canvas: canvas, antialias: true });
            rendererInstanceRef.current.setSize(initialWidth, initialHeight);
            rendererInstanceRef.current.setPixelRatio(window.devicePixelRatio);
            rendererInstanceRef.current.outputColorSpace = THREE.SRGBColorSpace; // Correct output colorspace

            // Check for HalfFloat support more robustly
            const capabilities = rendererInstanceRef.current.capabilities;
            let targetType = THREE.UnsignedByteType; // Default fallback
            if (capabilities.isWebGL2) {
                 // WebGL2 natively supports Float/HalfFloat rendering
                 // Check if the specific EXT_color_buffer_float is available (usually is in WebGL2)
                 if (capabilities.getExtension('EXT_color_buffer_float')) {
                     targetType = THREE.HalfFloatType;
                     console.log("DEBUG: Using HalfFloatType for render target (WebGL2 + EXT_color_buffer_float).");
                 } else {
                      console.warn("DEBUG: WebGL2 supported, but EXT_color_buffer_float missing. Falling back to UnsignedByteType.");
                 }
            } else {
                 // WebGL1 requires extensions for float textures AND rendering to them
                 const halfFloatExt = capabilities.getExtension('OES_texture_half_float');
                 const halfFloatLinearExt = capabilities.getExtension('OES_texture_half_float_linear'); // Needed for linear filtering
                 const colorBufferFloatExt = capabilities.getExtension('WEBGL_color_buffer_float'); // NEEDED TO RENDER TO FLOAT
                 if (halfFloatExt && colorBufferFloatExt) {
                     targetType = THREE.HalfFloatType;
                     console.log("DEBUG: Using HalfFloatType for render target (WebGL1 + OES_texture_half_float + WEBGL_color_buffer_float).");
                     if (!halfFloatLinearExt) {
                          console.warn("DEBUG: OES_texture_half_float_linear not supported. Linear filtering on HalfFloat target may not work.");
                     }
                 } else {
                     console.warn("DEBUG: Required extensions for HalfFloat rendering not available in WebGL1 (Need OES_texture_half_float AND WEBGL_color_buffer_float). Falling back to UnsignedByteType.");
                 }
            }

             // If you absolutely need FloatType (more precision, less performance/compatibility)
             // You would check similarly using OES_texture_float, OES_texture_float_linear, and WEBGL_color_buffer_float/EXT_color_buffer_float


            // --- Create the WebGLRenderTarget with the determined type ---
            const renderTargetOptions = {
                minFilter: THREE.LinearFilter,
                magFilter: THREE.LinearFilter, // Use Linear for smoother results unless pixelation is desired
                format: THREE.RGBAFormat,      // Standard RGBA
                type: targetType,              // *** USE THE DETERMINED TYPE ***
                // colorSpace: THREE.SRGBColorSpace, // Output colorspace is handled by renderer, RT usually linear
                depthBuffer: false,            // Not usually needed for 2D post-processing
                stencilBuffer: false           // Not usually needed for 2D post-processing
            };
            tempRenderTarget = new THREE.WebGLRenderTarget(initialWidth, initialHeight, renderTargetOptions);
            tempRenderTarget.texture.generateMipmaps = false; // No mipmaps for render targets
            console.log(`DEBUG: Created WebGLRenderTarget (${initialWidth}x${initialHeight}) with type: ${targetType === THREE.HalfFloatType ? 'HalfFloatType' : 'UnsignedByteType'}.`);


            // --- Base Scene Setup ---
            baseSceneRef.current = new THREE.Scene();
            baseCameraRef.current = new THREE.OrthographicCamera(-initialWidth / 2, initialWidth / 2, initialHeight / 2, -initialHeight / 2, 0.1, 10);
            baseCameraRef.current.position.z = 1;
            const planeGeometry = new THREE.PlaneGeometry(1, 1);
            // Use MeshBasicMaterial for the plane, as lighting isn't needed for video/image display
            const planeMaterial = new THREE.MeshBasicMaterial({
                map: null, // Start with no map
                side: THREE.DoubleSide, // Render both sides (useful if mirroring flips orientation)
                color: 0xffffff,        // White base color (texture usually overrides)
                transparent: false      // Base image is opaque
            });
            basePlaneMeshRef.current = new THREE.Mesh(planeGeometry, planeMaterial);
            baseSceneRef.current.add(basePlaneMeshRef.current);


            // --- Setup EffectComposer ---
            // *** Pass the CUSTOM render target to the constructor ***
            composerRef.current = new EffectComposer(rendererInstanceRef.current, tempRenderTarget);
            console.log("DEBUG: Initialized EffectComposer with custom render target.");

            // 1. RenderPass: Renders the base scene into the composer's read buffer.
            const renderPass = new RenderPass(baseSceneRef.current, baseCameraRef.current);
            composerRef.current.addPass(renderPass);
            console.log("DEBUG: Added RenderPass.");

            // 2. ShaderPass: Applies the custom hydration effect.
            // Clone uniforms to avoid modifying the original shader object
            const hydrationShaderPassUniforms = UniformsUtils.clone(HydrationShader.uniforms);
            hydrationShaderPassUniforms.uEffectIntensity.value = currentIntensity.current; // Set initial intensity

            // Create the ShaderPass using the cloned uniforms and shader code
            effectPassRef.current = new ShaderPass({
                uniforms: hydrationShaderPassUniforms,
                vertexShader: HydrationShader.vertexShader,
                fragmentShader: HydrationShader.fragmentShader
            }, "tDiffuse"); // Specify the input texture uniform name (usually tDiffuse)

            effectPassRef.current.renderToScreen = true; // Ensure this pass renders to the canvas
            composerRef.current.addPass(effectPassRef.current);
            console.log("DEBUG: Added ShaderPass (Hydration Effect).");


            isInitialized.current = true;
            handleResize(); // Call resize AFTER initialization to set correct sizes everywhere
            cancelAnimationFrame(animationFrameHandle.current);
            animationFrameHandle.current = requestAnimationFrame(renderLoop);
            console.log("DEBUG: initThreeScene SUCCESSFUL. Starting render loop.");

        } catch (error) {
            console.error("DEBUG: initThreeScene FAILED:", error);
            // Cleanup resources created during the failed attempt
            tempRenderTarget?.dispose();
            composerRef.current = null; // Clear refs that might be partially set
            effectPassRef.current = null;
            basePlaneMeshRef.current?.geometry?.dispose();
            basePlaneMeshRef.current?.material?.dispose();
            rendererInstanceRef.current?.dispose(); // Dispose renderer if created
            isInitialized.current = false; // Mark as not initialized
        }
    }, [handleResize, renderLoop, HydrationShader]); // Dependencies


    // --- Setup / Cleanup Effect ---
    useEffect(() => {
        initThreeScene(); // Attempt initialization

        // Setup resize observer
        let resizeObserver;
        const currentCanvas = canvasRef.current;
        if (currentCanvas) {
            resizeObserver = new ResizeObserver(() => {
                // console.log("ResizeObserver triggered.");
                handleResize(); // Call the memoized resize handler
            });
            resizeObserver.observe(currentCanvas);
            // console.log("ResizeObserver attached.");
        } else {
            console.warn("Canvas ref not available for ResizeObserver.");
        }

        // Cleanup function
        return () => {
            console.log("DEBUG: Cleanup running (TryOnRenderer Unmount)...");
            resizeObserver?.disconnect(); // Disconnect observer
            // console.log("ResizeObserver disconnected.");
            cancelAnimationFrame(animationFrameHandle.current); // Stop render loop
            isInitialized.current = false; // Mark as not initialized
            console.log("DEBUG: Disposing Three.js resources (Composer + Custom Target)...");

            // Dispose Textures
            videoTextureRef.current?.dispose(); videoTextureRef.current = null;
            imageTextureRef.current?.dispose(); imageTextureRef.current = null;
            segmentationTextureRef.current?.dispose(); segmentationTextureRef.current = null;
            // console.log("Textures disposed.");

            // Dispose EffectComposer and its Render Target
            // The composer holds the reference to the target we passed it.
            if (composerRef.current) {
                // Dispose the custom render target stored within the composer
                composerRef.current.renderTarget?.dispose();
                console.log("Disposed composer's render target.");
                // Optional: Dispose passes if they hold disposable resources (ShaderPass material)
                 effectPassRef.current?.material?.dispose(); // Dispose the ShaderPass material
                 // console.log("Disposed ShaderPass material.");
            }
             composerRef.current = null; // Clear composer ref
             effectPassRef.current = null; // Clear effect pass ref

            // Dispose Scene Objects
            basePlaneMeshRef.current?.geometry?.dispose();
            basePlaneMeshRef.current?.material?.map?.dispose(); // Dispose map texture if attached
            basePlaneMeshRef.current?.material?.dispose();
            basePlaneMeshRef.current = null; // Clear mesh ref
            // console.log("Base plane disposed.");

            // Dispose Scene and Camera (if needed, often scenes aren't explicitly disposed)
            baseSceneRef.current = null; baseCameraRef.current = null;

            // Dispose Renderer
            rendererInstanceRef.current?.dispose(); rendererInstanceRef.current = null;
            console.log("Renderer disposed.");

            console.log("DEBUG: Three.js resources disposed and refs cleared.");
        };
     }, [initThreeScene, handleResize]); // Effect dependencies


    // --- JSX --- (No change from previous)
    return (
        <canvas
            ref={canvasRef}
            className={`renderer-canvas ${className || ''}`}
            style={{ display: 'block', width: '100%', height: '100%', ...(style || {}) }}
        />
    );

});
TryOnRenderer.displayName = 'TryOnRenderer';
export default TryOnRenderer;