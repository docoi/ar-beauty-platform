// src/components/TryOnRenderer.jsx - Reads Silhouette Mask from ImageSegmenter results
// Includes HalfFloatType Render Target Fix

import React, { useRef, forwardRef, useEffect, useCallback } from 'react';
import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { UniformsUtils } from 'three';

const TryOnRenderer = forwardRef(({
    videoRefProp, imageElement,
    mediaPipeResults, // <<< Passed but NOT USED for mask in this version
    segmentationResults, // <<< USED for silhouette mask from ImageSegmenter
    isStatic,
    effectIntensity,
    className, style
 }, ref) => {

    // --- Core Refs / Internal State Refs ---
    const canvasRef = useRef(null); const rendererInstanceRef = useRef(null); const animationFrameHandle = useRef(null); const isInitialized = useRef(false);
    const baseSceneRef = useRef(null); const baseCameraRef = useRef(null); const basePlaneMeshRef = useRef(null); const videoTextureRef = useRef(null);
    const imageTextureRef = useRef(null); const segmentationTextureRef = useRef(null); // For the silhouette mask
    const composerRef = useRef(null); const effectPassRef = useRef(null);
    const currentIntensity = useRef(0.5);
    const renderLoopCounter = useRef(0); const lastMaskUpdateTime = useRef(0);


    // --- Shaders (Includes uFlipMaskX uniform placeholder) ---
    const customVertexShader = `varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 ); }`;
    // !! Shader updated to include uFlipMaskX !!
    const customFragmentShader = `
        uniform sampler2D tDiffuse;
        uniform sampler2D uSegmentationMask;
        uniform float uEffectIntensity;
        uniform bool uHasMask;
        uniform bool uFlipMaskX; // <<< ADDED uniform for X flip

        varying vec2 vUv;

        vec3 applyHydrationEffect(vec3 c){ vec3 h=c*(1.0+0.1*uEffectIntensity); h+=vec3(0.05*uEffectIntensity); return h; }

        void main() {
            vec4 bC=texture2D(tDiffuse,vUv);
            vec3 fC=bC.rgb;

            if(uHasMask && uEffectIntensity > 0.01) {
                // <<< APPLY CONDITIONAL X FLIP for mask sampling >>>
                float maskCoordX = uFlipMaskX ? (1.0 - vUv.x) : vUv.x;
                float maskCoordY = 1.0 - vUv.y; // Always flip Y
                float mV = texture2D(uSegmentationMask, vec2(maskCoordX, maskCoordY)).r;

                vec3 hC=applyHydrationEffect(fC);
                float bA=smoothstep(0.3, 0.8, mV) * uEffectIntensity;
                fC=mix(fC, hC, bA);
            }
            fC=clamp(fC, 0.0, 1.0);
            gl_FragColor=vec4(fC, bC.a);
        }
    `;

    const HydrationShader = useRef({
        uniforms: {
            'tDiffuse': { value: null },
            'uSegmentationMask': { value: null },
            'uEffectIntensity': { value: 0.5 },
            'uHasMask': { value: false },
            'uFlipMaskX': { value: false } // <<< ADDED uniform default
        },
        vertexShader: customVertexShader,
        fragmentShader: customFragmentShader
    }).current;


    // --- Prop Effects / Texture Effects ---
    useEffect(() => { currentIntensity.current = effectIntensity; if (effectPassRef.current) { effectPassRef.current.uniforms.uEffectIntensity.value = currentIntensity.current; } }, [effectIntensity]);
    useEffect(() => { /* Video Texture - No change */
        const videoElement = videoRefProp?.current; if (!isStatic && videoElement && videoElement.readyState >= videoElement.HAVE_METADATA) { if (!videoTextureRef.current || videoTextureRef.current.image !== videoElement) { /* console.log("TryOnRenderer: Creating/Updating Video Texture"); */ videoTextureRef.current?.dispose(); videoTextureRef.current = new THREE.VideoTexture(videoElement); videoTextureRef.current.colorSpace = THREE.SRGBColorSpace; } } else if (!isStatic && videoTextureRef.current) { /* console.log("TryOnRenderer: Disposing Video Texture (No longer static or video not ready)"); */ videoTextureRef.current.dispose(); videoTextureRef.current = null; }
    }, [isStatic, videoRefProp, videoRefProp?.current?.readyState]);
    useEffect(() => { /* Image Texture - No change */
        if (isStatic && imageElement && imageElement.complete && imageElement.naturalWidth > 0) { if (!imageTextureRef.current || imageTextureRef.current.image !== imageElement) { /* console.log("TryOnRenderer: Creating/Updating Image Texture"); */ imageTextureRef.current?.dispose(); imageTextureRef.current = new THREE.Texture(imageElement); imageTextureRef.current.colorSpace = THREE.SRGBColorSpace; imageTextureRef.current.needsUpdate = true; } } else if (isStatic && imageTextureRef.current) { /* console.log("TryOnRenderer: Disposing Image Texture (No longer static or image not ready)"); */ imageTextureRef.current.dispose(); imageTextureRef.current = null; }
    }, [isStatic, imageElement, imageElement?.complete]);


    // --- ***** Segmentation Mask Texture Effect (READ FROM segmentationResults.confidenceMasks) ***** ---
    useEffect(() => {
        // *** Read from segmentationResults (from ImageSegmenter) ***
        const results = segmentationResults;
        // *** Access confidenceMasks array ***
        const hasMaskData = results?.confidenceMasks?.[0];

        if (hasMaskData) {
            // *** Get the mask object from confidenceMasks ***
            const confidenceMaskObject = results.confidenceMasks[0];
            const maskWidth = confidenceMaskObject?.width;
            const maskHeight = confidenceMaskObject?.height;
            let maskData = null;

            // Robustly get the mask data
            try {
                if (typeof confidenceMaskObject?.getAsFloat32Array === 'function') {
                    maskData = confidenceMaskObject.getAsFloat32Array();
                 } else if (confidenceMaskObject?.data instanceof Float32Array) {
                     maskData = confidenceMaskObject.data;
                 } else {
                     console.warn("TryOnRenderer: confidenceMasks[0] data format not recognized.");
                 }
            } catch (error) {
                 console.error("TryOnRenderer: Error getting mask data from confidenceMasks:", error);
                 maskData = null;
            }

            if (maskData instanceof Float32Array && maskWidth > 0 && maskHeight > 0) {
                const now = performance.now();
                const timeSinceLastUpdate = now - lastMaskUpdateTime.current;
                const throttleThreshold = isStatic ? 0 : 66; // Throttle video

                if (timeSinceLastUpdate > throttleThreshold) {
                    lastMaskUpdateTime.current = now;
                    try {
                        let texture = segmentationTextureRef.current;
                        if (!texture || texture.image.width !== maskWidth || texture.image.height !== maskHeight) {
                            texture?.dispose();
                            // console.log(`TryOnRenderer Mask Texture: Creating NEW DataTexture from ImageSegmenter (${maskWidth}x${maskHeight})`);
                            texture = new THREE.DataTexture(maskData, maskWidth, maskHeight, THREE.RedFormat, THREE.FloatType);
                            texture.minFilter = THREE.NearestFilter; texture.magFilter = THREE.NearestFilter; texture.generateMipmaps = false;
                            texture.needsUpdate = true;
                            segmentationTextureRef.current = texture;
                        } else {
                            // console.log(`TryOnRenderer Mask Texture: Updating existing DataTexture from ImageSegmenter.`);
                            texture.image.data = maskData;
                            texture.needsUpdate = true;
                        }
                        if (effectPassRef.current) {
                             effectPassRef.current.uniforms.uSegmentationMask.value = segmentationTextureRef.current;
                             effectPassRef.current.uniforms.uHasMask.value = true;
                        }
                    } catch (error) {
                        console.error("TryOnRenderer: Error processing mask texture from ImageSegmenter:", error);
                        segmentationTextureRef.current?.dispose(); segmentationTextureRef.current = null;
                         if (effectPassRef.current) { effectPassRef.current.uniforms.uSegmentationMask.value = null; effectPassRef.current.uniforms.uHasMask.value = false; }
                    }
                } else {
                     if (effectPassRef.current && effectPassRef.current.uniforms.uSegmentationMask.value !== segmentationTextureRef.current) {
                         effectPassRef.current.uniforms.uSegmentationMask.value = segmentationTextureRef.current;
                         effectPassRef.current.uniforms.uHasMask.value = !!segmentationTextureRef.current;
                     }
                }
            } else {
                 if (segmentationTextureRef.current) { segmentationTextureRef.current.dispose(); segmentationTextureRef.current = null; }
                 if (effectPassRef.current) { effectPassRef.current.uniforms.uSegmentationMask.value = null; effectPassRef.current.uniforms.uHasMask.value = false; }
            }
        } else {
            if (segmentationTextureRef.current) { segmentationTextureRef.current.dispose(); segmentationTextureRef.current = null; }
             if (effectPassRef.current) { effectPassRef.current.uniforms.uSegmentationMask.value = null; effectPassRef.current.uniforms.uHasMask.value = false; }
        }
        // *** Update dependency array ***
    }, [segmentationResults, isStatic]);


    // --- Handle Resizing - No change needed ---
    const handleResize = useCallback(() => {
        const canvas = canvasRef.current; if (!rendererInstanceRef.current || !baseCameraRef.current || !composerRef.current || !composerRef.current.renderTarget || !canvas) return; const newWidth = canvas.clientWidth; const newHeight = canvas.clientHeight; if (newWidth === 0 || newHeight === 0) return; const currentSize = rendererInstanceRef.current.getSize(new THREE.Vector2()); if (currentSize.x === newWidth && currentSize.y === newHeight) return; try { /* console.log(`TryOnRenderer: Resizing to ${newWidth}x${newHeight}`); */ rendererInstanceRef.current.setSize(newWidth, newHeight); composerRef.current.renderTarget.setSize(newWidth, newHeight); composerRef.current.setSize(newWidth, newHeight); baseCameraRef.current.left = -newWidth / 2; baseCameraRef.current.right = newWidth / 2; baseCameraRef.current.top = newHeight / 2; baseCameraRef.current.bottom = -newHeight / 2; baseCameraRef.current.updateProjectionMatrix(); /* console.log("TryOnRenderer: Resize successful."); */ } catch (e) { console.error("TryOnRenderer: Resize Error:", e); }
    }, []);


    // --- Scale Base Plane - No change needed ---
    const fitPlaneToCamera = useCallback((textureWidth, textureHeight) => {
        const canvas = canvasRef.current; if (!baseCameraRef.current || !basePlaneMeshRef.current || !textureWidth || !textureHeight || !canvas) return; const viewWidth = canvas.clientWidth; const viewHeight = canvas.clientHeight; if (viewWidth === 0 || viewHeight === 0) return; const viewAspect = viewWidth / viewHeight; const textureAspect = textureWidth / textureHeight; let scaleX, scaleY; if (viewAspect > textureAspect) { scaleX = viewWidth; scaleY = viewWidth / textureAspect; } else { scaleY = viewHeight; scaleX = viewHeight * textureAspect; } const currentScale = basePlaneMeshRef.current.scale; const signX = Math.sign(currentScale.x) || 1; const newScaleXWithSign = scaleX * signX; if (Math.abs(currentScale.y - scaleY) > 0.01 || Math.abs(currentScale.x - newScaleXWithSign) > 0.01) { currentScale.set(newScaleXWithSign, scaleY, 1); }
     }, []);


    // --- Render Loop (Updates uFlipMaskX uniform) ---
     const renderLoop = useCallback(() => {
        animationFrameHandle.current = requestAnimationFrame(renderLoop);
        renderLoopCounter.current++;
        const log = renderLoopCounter.current < 5 || renderLoopCounter.current % 150 === 0;

        if (!isInitialized.current || !rendererInstanceRef.current || !composerRef.current || !basePlaneMeshRef.current || !effectPassRef.current) { return; }

        try {
            // 1. Select Source Texture & Check Readiness
            const baseMaterial = basePlaneMeshRef.current.material;
            let sourceWidth = 0, sourceHeight = 0;
            let textureToAssign = null;
            let isVideo = !isStatic; // Directly use isStatic prop
            let needsTextureUpdate = false;

            if (isVideo && videoTextureRef.current) {
                 textureToAssign = videoTextureRef.current;
                 const video = textureToAssign.image;
                 if(video && video.readyState >= video.HAVE_CURRENT_DATA) { sourceWidth = video.videoWidth; sourceHeight = video.videoHeight; needsTextureUpdate = (baseMaterial.map !== textureToAssign); } else { textureToAssign = null; }
            } else if (isStatic && imageTextureRef.current) {
                 textureToAssign = imageTextureRef.current;
                 const image = textureToAssign.image;
                 if(image && image.complete && image.naturalWidth > 0) { sourceWidth = image.naturalWidth; sourceHeight = image.naturalHeight; needsTextureUpdate = (baseMaterial.map !== textureToAssign) || textureToAssign.needsUpdate; } else { textureToAssign = null; }
            }

            // Assign/Clear Texture
            if (baseMaterial && needsTextureUpdate) { baseMaterial.map = textureToAssign; baseMaterial.needsUpdate = true; }
            else if (baseMaterial && baseMaterial.map !== textureToAssign && !textureToAssign) { baseMaterial.map = null; baseMaterial.needsUpdate = true; }

            // 2. Update Plane Scale & Mirroring
            const planeVisible = !!baseMaterial?.map && sourceWidth > 0 && sourceHeight > 0;
            if (planeVisible) {
                fitPlaneToCamera(sourceWidth, sourceHeight);
                const scaleX = Math.abs(basePlaneMeshRef.current.scale.x);
                const newScaleX = isVideo ? -scaleX : scaleX; // Mirror if video
                if(basePlaneMeshRef.current.scale.x !== newScaleX) { basePlaneMeshRef.current.scale.x = newScaleX; }
            } else {
                if (basePlaneMeshRef.current.scale.x !== 0 || basePlaneMeshRef.current.scale.y !== 0) { basePlaneMeshRef.current.scale.set(0, 0, 0); }
            }
            if (planeVisible && textureToAssign && textureToAssign.needsUpdate) { textureToAssign.needsUpdate = false; }

            // 3. Update ShaderPass Uniforms (Including Flip Flag)
             if (effectPassRef.current) {
                 const currentUniformValue = effectPassRef.current.uniforms.uSegmentationMask.value;
                 const actualTexture = segmentationTextureRef.current;
                 // Ensure mask texture uniform is correct
                 if (currentUniformValue !== actualTexture) {
                      effectPassRef.current.uniforms.uSegmentationMask.value = actualTexture;
                      effectPassRef.current.uniforms.uHasMask.value = !!actualTexture;
                 }
                 // <<< SET FLIP UNIFORM based on isStatic (isVideo) >>>
                 effectPassRef.current.uniforms.uFlipMaskX.value = isVideo; // Flip X only for video/mirror mode
             }

            // 4. Render using the Composer
            composerRef.current.render();

        } catch (error) {
            console.error("TryOnRenderer: Error in renderLoop:", error);
        }
    }, [fitPlaneToCamera, isStatic]); // isStatic is now a key dependency


    // --- Initialize Scene - No change needed from previous working version ---
    const initThreeScene = useCallback(() => {
        if (!canvasRef.current || isInitialized.current) { return; } console.log("DEBUG: initThreeScene START (Reverted State + HalfFloatType RT)"); let tempRenderTarget = null; try { const canvas = canvasRef.current; const initialWidth = Math.max(1, canvas.clientWidth || 640); const initialHeight = Math.max(1, canvas.clientHeight || 480); const renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true }); renderer.setSize(initialWidth, initialHeight); renderer.setPixelRatio(window.devicePixelRatio); renderer.outputColorSpace = THREE.SRGBColorSpace; rendererInstanceRef.current = renderer; const capabilities = renderer.capabilities; if (!capabilities) { throw new Error("Renderer capabilities object not found."); } let targetType = THREE.UnsignedByteType; let canUseHalfFloat = false; if (capabilities.isWebGL2) { canUseHalfFloat = true; /* console.log("DEBUG: WebGL2 detected. Assuming HalfFloat rendering is supported."); */ } else { const halfFloatExt = capabilities.getExtension('OES_texture_half_float'); const colorBufferFloatExt = capabilities.getExtension('WEBGL_color_buffer_float'); if (halfFloatExt && colorBufferFloatExt) { canUseHalfFloat = true; /* console.log("DEBUG: Using HalfFloatType for render target (WebGL1 + Required Extensions)."); */ } else { /* console.warn("DEBUG: Required extensions for HalfFloat rendering not available in WebGL1. Falling back to UnsignedByteType."); */ } } if (canUseHalfFloat) { targetType = THREE.HalfFloatType; } const renderTargetOptions = { minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, format: THREE.RGBAFormat, type: targetType, depthBuffer: false, stencilBuffer: false }; tempRenderTarget = new THREE.WebGLRenderTarget(initialWidth, initialHeight, renderTargetOptions); tempRenderTarget.texture.generateMipmaps = false; console.log(`DEBUG: Created WebGLRenderTarget (${initialWidth}x${initialHeight}) with type: ${targetType === THREE.HalfFloatType ? 'HalfFloatType' : 'UnsignedByteType'}.`); baseSceneRef.current = new THREE.Scene(); baseCameraRef.current = new THREE.OrthographicCamera(-initialWidth / 2, initialWidth / 2, initialHeight / 2, -initialHeight / 2, 0.1, 10); baseCameraRef.current.position.z = 1; const planeGeometry = new THREE.PlaneGeometry(1, 1); const planeMaterial = new THREE.MeshBasicMaterial({ map: null, side: THREE.DoubleSide, color: 0xffffff, transparent: false }); basePlaneMeshRef.current = new THREE.Mesh(planeGeometry, planeMaterial); baseSceneRef.current.add(basePlaneMeshRef.current); composerRef.current = new EffectComposer(renderer, tempRenderTarget); /* console.log("DEBUG: Initialized EffectComposer with custom render target."); */ const renderPass = new RenderPass(baseSceneRef.current, baseCameraRef.current); composerRef.current.addPass(renderPass); /* console.log("DEBUG: Added RenderPass."); */ const hydrationShaderPassUniforms = UniformsUtils.clone(HydrationShader.uniforms); hydrationShaderPassUniforms.uEffectIntensity.value = currentIntensity.current; effectPassRef.current = new ShaderPass({ uniforms: hydrationShaderPassUniforms, vertexShader: HydrationShader.vertexShader, fragmentShader: HydrationShader.fragmentShader }, "tDiffuse"); effectPassRef.current.renderToScreen = true; composerRef.current.addPass(effectPassRef.current); /* console.log("DEBUG: Added ShaderPass (Hydration Effect)."); */ isInitialized.current = true; handleResize(); cancelAnimationFrame(animationFrameHandle.current); animationFrameHandle.current = requestAnimationFrame(renderLoop); console.log("DEBUG: initThreeScene SUCCESSFUL. Starting render loop."); } catch (error) { console.error("DEBUG: initThreeScene FAILED:", error); tempRenderTarget?.dispose(); composerRef.current = null; effectPassRef.current = null; basePlaneMeshRef.current?.geometry?.dispose(); basePlaneMeshRef.current?.material?.dispose(); rendererInstanceRef.current?.dispose(); rendererInstanceRef.current = null; isInitialized.current = false; }
    }, [handleResize, renderLoop, HydrationShader]);


    // --- Setup / Cleanup Effect - No change needed ---
    useEffect(() => { initThreeScene(); let resizeObserver; const currentCanvas = canvasRef.current; if (currentCanvas) { resizeObserver = new ResizeObserver(() => { handleResize(); }); resizeObserver.observe(currentCanvas); } return () => { /* console.log("DEBUG: Cleanup running (TryOnRenderer Unmount)..."); */ resizeObserver?.disconnect(); cancelAnimationFrame(animationFrameHandle.current); isInitialized.current = false; /* console.log("DEBUG: Disposing Three.js resources (Composer + Custom Target)..."); */ videoTextureRef.current?.dispose(); videoTextureRef.current = null; imageTextureRef.current?.dispose(); imageTextureRef.current = null; segmentationTextureRef.current?.dispose(); segmentationTextureRef.current = null; if (composerRef.current) { composerRef.current.renderTarget?.dispose(); /* console.log("Disposed composer's render target."); */ effectPassRef.current?.material?.dispose(); } composerRef.current = null; effectPassRef.current = null; basePlaneMeshRef.current?.geometry?.dispose(); basePlaneMeshRef.current?.material?.map?.dispose(); basePlaneMeshRef.current?.material?.dispose(); basePlaneMeshRef.current = null; baseSceneRef.current = null; baseCameraRef.current = null; rendererInstanceRef.current?.dispose(); rendererInstanceRef.current = null; /* console.log("DEBUG: Three.js resources disposed and refs cleared."); */ }; }, [initThreeScene, handleResize]);


    // --- JSX --- (No change)
    return ( <canvas ref={canvasRef} className={`renderer-canvas ${className || ''}`} style={{ display: 'block', width: '100%', height: '100%', ...(style || {}) }} /> );

});
TryOnRenderer.displayName = 'TryOnRenderer';
export default TryOnRenderer;