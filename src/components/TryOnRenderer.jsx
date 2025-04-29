// src/components/TryOnRenderer.jsx - EffectComposer + CORRECT DataTexture Filtering + Subtle Effect

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
    mediaPipeResults, // Unused
    segmentationResults, // <<< Used for mask texture
    isStatic,
    // Unused props:
    brightness, contrast,
    effectIntensity, // <<< Used for effect strength
    className, style
 }, ref) => {

    // --- Core Refs / Internal State Refs ---
    const canvasRef = useRef(null); const rendererInstanceRef = useRef(null); const animationFrameHandle = useRef(null); const isInitialized = useRef(false);
    const baseSceneRef = useRef(null); const baseCameraRef = useRef(null); const basePlaneMeshRef = useRef(null); const videoTextureRef = useRef(null);
    const imageTextureRef = useRef(null); const segmentationTextureRef = useRef(null); // Ref for the mask DataTexture
    const composerRef = useRef(null); const effectPassRef = useRef(null); // Refs for EffectComposer setup
    const currentIntensity = useRef(0.5);
    const renderLoopCounter = useRef(0); const lastMaskUpdateTime = useRef(0);


    // --- Shaders (Subtle Effect + Mask Flip) ---
    const customVertexShader = `varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 ); }`;
    const customFragmentShader = `
        uniform sampler2D tDiffuse;          // Texture from previous pass
        uniform sampler2D uSegmentationMask; // Our mask texture
        uniform float uEffectIntensity;      // Slider value
        uniform bool uHasMask;               // Mask flag

        varying vec2 vUv;

        // Subtle "Hydration" effect function
        vec3 applyHydrationEffect(vec3 color) {
             vec3 hydratedLook = color * (1.0 + 0.1); // 10% brighter base for effect
             // hydratedLook = mix(hydratedLook, vec3(1.0), 0.05); // Optional
             return hydratedLook;
        }

        void main() {
            vec4 baseColor = texture2D(tDiffuse, vUv); // Sample previous pass
            vec3 finalColor = baseColor.rgb;

            if (uHasMask && uEffectIntensity > 0.0) {
                // Flip the Y coordinate for mask sampling
                float maskValue = texture2D(uSegmentationMask, vec2(vUv.x, 1.0 - vUv.y)).r;
                vec3 hydratedColor = applyHydrationEffect(finalColor);
                float blendAmount = smoothstep(0.3, 0.8, maskValue) * uEffectIntensity;
                finalColor = mix(finalColor, hydratedColor, blendAmount);
            }

            finalColor = clamp(finalColor, 0.0, 1.0);
            gl_FragColor = vec4(finalColor, baseColor.a);
        }
    `;

    // Define the shader object for ShaderPass
    const HydrationShader = {
        uniforms: {
            'tDiffuse': { value: null }, // Provided by composer
            'uSegmentationMask': { value: null },
            'uEffectIntensity': { value: 0.5 }, // Initial value
            'uHasMask': { value: false }
        },
        vertexShader: customVertexShader,
        fragmentShader: customFragmentShader
    };


    // --- Prop Effects / Texture Effects ---
    useEffect(() => { currentIntensity.current = effectIntensity; if (effectPassRef.current) { effectPassRef.current.uniforms.uEffectIntensity.value = currentIntensity.current; } }, [effectIntensity]);
    useEffect(() => { /* Video Texture */ }, [isStatic, videoRefProp]);
    useEffect(() => { /* Image Texture */ }, [isStatic, imageElement]);

    // --- ***** Segmentation Mask Texture Effect (Correct Filtering) ***** ---
    useEffect(() => {
        const results = segmentationResults;
        const hasMaskDataArray = Array.isArray(results?.confidenceMasks) && results.confidenceMasks.length > 0;
        if (hasMaskDataArray) {
            const confidenceMaskObject = results.confidenceMasks[0];
            const maskWidth = confidenceMaskObject?.width;
            const maskHeight = confidenceMaskObject?.height;
            let maskData = null;
            if (typeof confidenceMaskObject?.getAsFloat32Array === 'function') { try { maskData = confidenceMaskObject.getAsFloat32Array(); } catch (error) { maskData = null; } }
             else if(confidenceMaskObject?.data) { maskData = confidenceMaskObject.data;}

             if (maskData instanceof Float32Array && maskWidth > 0 && maskHeight > 0) {
                 const now = performance.now(); const timeSinceLastUpdate = now - lastMaskUpdateTime.current; const throttleThreshold = isStatic ? 0 : 66;
                 if (timeSinceLastUpdate > throttleThreshold) {
                    lastMaskUpdateTime.current = now;
                    try {
                        let texture = segmentationTextureRef.current;
                        if (!texture || texture.image.width !== maskWidth || texture.image.height !== maskHeight) {
                            texture?.dispose();
                            // console.log(`Mask Texture: Creating NEW DataTexture (${maskWidth}x${maskHeight}) with NearestFilter.`);
                            texture = new THREE.DataTexture(maskData, maskWidth, maskHeight, THREE.RedFormat, THREE.FloatType);
                            // ***** APPLY CORRECT FILTERING *****
                            texture.minFilter = THREE.NearestFilter;
                            texture.magFilter = THREE.NearestFilter;
                            texture.generateMipmaps = false; // Explicitly false
                            // ***********************************
                            texture.needsUpdate = true;
                            segmentationTextureRef.current = texture;
                            // console.log(`Mask Texture: New DataTexture CREATED.`);
                        } else {
                            texture.image.data = maskData;
                            texture.needsUpdate = true;
                        }
                    } catch (error) { console.error("Mask Texture Error:", error); segmentationTextureRef.current?.dispose(); segmentationTextureRef.current = null; }
                 }
             } else { if (segmentationTextureRef.current) { segmentationTextureRef.current.dispose(); segmentationTextureRef.current = null; } }
        } else { if (segmentationTextureRef.current) { segmentationTextureRef.current.dispose(); segmentationTextureRef.current = null; } }
    }, [segmentationResults, isStatic]);


    // --- Handle Resizing / Scale Plane ---
    const handleResize = useCallback(() => { const canvas = canvasRef.current; if (!rendererInstanceRef.current || !baseCameraRef.current || !composerRef.current || !canvas) return; const newWidth = canvas.clientWidth; const newHeight = canvas.clientHeight; if (newWidth === 0 || newHeight === 0) return; const currentSize = rendererInstanceRef.current.getSize(new THREE.Vector2()); if (currentSize.x === newWidth && currentSize.y === newHeight) return; try { rendererInstanceRef.current.setSize(newWidth, newHeight); composerRef.current.setSize(newWidth, newHeight); baseCameraRef.current.left = -newWidth / 2; baseCameraRef.current.right = newWidth / 2; baseCameraRef.current.top = newHeight / 2; baseCameraRef.current.bottom = -newHeight / 2; baseCameraRef.current.updateProjectionMatrix(); } catch(e) { console.error("Resize Error:", e);} }, []);
    const fitPlaneToCamera = useCallback((textureWidth, textureHeight) => { const canvas = canvasRef.current; if (!baseCameraRef.current || !basePlaneMeshRef.current || !textureWidth || !textureHeight || !canvas || canvas.clientWidth === 0 || canvas.clientHeight === 0) return; const viewWidth = canvas.clientWidth; const viewHeight = canvas.clientHeight; const viewAspect = viewWidth / viewHeight; const textureAspect = textureWidth / textureHeight; let scaleX, scaleY; if (viewAspect > textureAspect) { scaleY = viewHeight; scaleX = scaleY * textureAspect; } else { scaleX = viewWidth; scaleY = scaleX / textureAspect; } const currentScale = basePlaneMeshRef.current.scale; const signX = Math.sign(currentScale.x) || 1; const newScaleXWithSign = scaleX * signX; if (Math.abs(currentScale.y - scaleY) > 0.01 || Math.abs(currentScale.x - newScaleXWithSign) > 0.01) { currentScale.set(newScaleXWithSign, scaleY, 1); } }, []);


    // --- Render Loop (Use EffectComposer) ---
     const renderLoop = useCallback(() => {
        animationFrameHandle.current = requestAnimationFrame(renderLoop);
        if (!isInitialized.current || !rendererInstanceRef.current || !composerRef.current || !basePlaneMeshRef.current || !effectPassRef.current) { return; }

        try {
            // 1 & 2: Select Texture & Update Plane
             const baseMaterial = basePlaneMeshRef.current.material; let sourceWidth = 0, sourceHeight = 0; let textureToAssign = null; let isVideo = false; if (!isStatic && videoTextureRef.current) { textureToAssign = videoTextureRef.current; isVideo = true; if(textureToAssign.image) {sourceWidth=textureToAssign.image.videoWidth; sourceHeight=textureToAssign.image.videoHeight;} } else if (isStatic && imageTextureRef.current) { textureToAssign = imageTextureRef.current; if(textureToAssign.image){sourceWidth=textureToAssign.image.naturalWidth; sourceHeight=textureToAssign.image.naturalHeight;} if(textureToAssign.needsUpdate){textureToAssign.needsUpdate=true;} } if(baseMaterial){ if (baseMaterial.map !== textureToAssign) { baseMaterial.map = textureToAssign; baseMaterial.needsUpdate = true; } else if (textureToAssign && textureToAssign.needsUpdate) { baseMaterial.needsUpdate = true; } } const planeVisible = !!baseMaterial?.map && sourceWidth > 0 && sourceHeight > 0; if (planeVisible) { fitPlaneToCamera(sourceWidth, sourceHeight); const scaleX = Math.abs(basePlaneMeshRef.current.scale.x); const newScaleX = isVideo ? -scaleX : scaleX; if(basePlaneMeshRef.current.scale.x !== newScaleX) { basePlaneMeshRef.current.scale.x = newScaleX; } } else { if (basePlaneMeshRef.current?.scale.x !== 0 || basePlaneMeshRef.current?.scale.y !== 0) { basePlaneMeshRef.current?.scale.set(0, 0, 0); } } if (planeVisible && textureToAssign?.needsUpdate) { textureToAssign.needsUpdate = false; }


            // Update ShaderPass Uniforms
            const effectUniforms = effectPassRef.current.uniforms;
            effectUniforms.uSegmentationMask.value = segmentationTextureRef.current;
            effectUniforms.uHasMask.value = !!segmentationTextureRef.current;
            // Intensity updated via useEffect

            // Render using the Composer
            composerRef.current.render();

        } catch (error) { console.error("Error in renderLoop:", error); }
    }, [fitPlaneToCamera, isStatic]);


    // --- Initialize Scene (Use EffectComposer) ---
    const initThreeScene = useCallback(() => {
        if (!canvasRef.current || isInitialized.current) { return; }
        console.log("DEBUG: initThreeScene START (EffectComposer + Correct Mask Filter)");
        try {
            const canvas = canvasRef.current; const initialWidth = canvas.clientWidth || 640; const initialHeight = canvas.clientHeight || 480;
            rendererInstanceRef.current = new THREE.WebGLRenderer({ canvas: canvas, antialias: true }); rendererInstanceRef.current.setSize(initialWidth, initialHeight); rendererInstanceRef.current.setPixelRatio(window.devicePixelRatio); rendererInstanceRef.current.outputColorSpace = THREE.SRGBColorSpace;
            baseSceneRef.current = new THREE.Scene(); baseCameraRef.current = new THREE.OrthographicCamera(-initialWidth / 2, initialWidth / 2, initialHeight / 2, -initialHeight / 2, 0.1, 10); baseCameraRef.current.position.z = 1; const planeGeometry = new THREE.PlaneGeometry(1, 1); const planeMaterial = new THREE.MeshBasicMaterial({ map: null, side: THREE.DoubleSide, color: 0xffffff, transparent: true }); basePlaneMeshRef.current = new THREE.Mesh(planeGeometry, planeMaterial); baseSceneRef.current.add(basePlaneMeshRef.current);

            composerRef.current = new EffectComposer(rendererInstanceRef.current);
            const renderPass = new RenderPass(baseSceneRef.current, baseCameraRef.current);
            composerRef.current.addPass(renderPass);

            const hydrationShaderCopy = { uniforms: UniformsUtils.clone(HydrationShader.uniforms), vertexShader: HydrationShader.vertexShader, fragmentShader: HydrationShader.fragmentShader };
            hydrationShaderCopy.uniforms.uEffectIntensity.value = currentIntensity.current;
            effectPassRef.current = new ShaderPass(hydrationShaderCopy);
            effectPassRef.current.renderToScreen = true; // Set on final pass
            composerRef.current.addPass(effectPassRef.current);
            console.log("DEBUG: EffectComposer setup complete.");

            isInitialized.current = true; handleResize(); cancelAnimationFrame(animationFrameHandle.current); animationFrameHandle.current = requestAnimationFrame(renderLoop);
        } catch (error) { console.error("DEBUG: initThreeScene FAILED:", error); isInitialized.current = false; }
    }, [handleResize, renderLoop, HydrationShader]);


    // --- Setup / Cleanup Effect ---
    useEffect(() => { initThreeScene(); let resizeObserver; const currentCanvas = canvasRef.current; if (currentCanvas) { resizeObserver = new ResizeObserver(() => { handleResize(); }); resizeObserver.observe(currentCanvas); } return () => { /* ... Full cleanup logic ... */ }; }, [initThreeScene, handleResize]);


    // --- JSX ---
    return ( <canvas ref={canvasRef} className={`renderer-canvas ${className || ''}`} style={{ display: 'block', width: '100%', height: '100%', ...(style || {}) }} /> );

});
TryOnRenderer.displayName = 'TryOnRenderer';
export default TryOnRenderer;