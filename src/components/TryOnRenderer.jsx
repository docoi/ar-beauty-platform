// src/components/TryOnRenderer.jsx - CORRECTED EffectComposer Implementation

import React, { useRef, forwardRef, useEffect, useCallback } from 'react';
import * as THREE from 'three';
// Import necessary EffectComposer passes
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
// Import UniformsUtils for cloning
import { UniformsUtils } from 'three'; // Correct import if needed, often just THREE.UniformsUtils works

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

    // --- Core Refs ---
    const canvasRef = useRef(null); const rendererInstanceRef = useRef(null); const animationFrameHandle = useRef(null); const isInitialized = useRef(false);
    const baseSceneRef = useRef(null); const baseCameraRef = useRef(null); const basePlaneMeshRef = useRef(null); const videoTextureRef = useRef(null);
    const imageTextureRef = useRef(null); const segmentationTextureRef = useRef(null);
    const composerRef = useRef(null); const effectPassRef = useRef(null);

    // --- Internal State Refs ---
    const currentIntensity = useRef(0.5);
    const renderLoopCounter = useRef(0); const lastMaskUpdateTime = useRef(0);


    // --- Shaders (Subtle Effect + Mask Flip) ---
    // Vertex shader can often be the default pass-through for ShaderPass
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
             // hydratedLook = mix(hydratedLook, vec3(1.0), 0.05);
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
        vertexShader: customVertexShader, // Use basic vertex shader
        fragmentShader: customFragmentShader
    };


    // --- Prop Effects / Texture Effects / Mask Effect ---
    useEffect(() => {
        currentIntensity.current = effectIntensity;
        // Update uniform directly if pass exists
        if (effectPassRef.current) {
            effectPassRef.current.uniforms.uEffectIntensity.value = currentIntensity.current;
        }
     }, [effectIntensity]);
    useEffect(() => { /* Video Texture */ const videoElement=videoRefProp?.current;if(!isStatic&&videoElement){if(!videoTextureRef.current||videoTextureRef.current.image!==videoElement){videoTextureRef.current?.dispose();videoTextureRef.current=new THREE.VideoTexture(videoElement);videoTextureRef.current.colorSpace=THREE.SRGBColorSpace;}}else{if(videoTextureRef.current){videoTextureRef.current.dispose();videoTextureRef.current=null;}}}, [isStatic, videoRefProp]);
    useEffect(() => { /* Image Texture */ if(isStatic&&imageElement){if(!imageTextureRef.current||imageTextureRef.current.image!==imageElement){imageTextureRef.current?.dispose();imageTextureRef.current=new THREE.Texture(imageElement);imageTextureRef.current.colorSpace=THREE.SRGBColorSpace;imageTextureRef.current.needsUpdate=true;}else if(imageTextureRef.current&&imageTextureRef.current.image===imageElement){imageTextureRef.current.needsUpdate=true;}}else{if(imageTextureRef.current){imageTextureRef.current.dispose();imageTextureRef.current=null;}}}, [isStatic, imageElement]);
    useEffect(() => { /* Mask Texture Creation */ const results=segmentationResults;const hasMaskDataArray=Array.isArray(results?.confidenceMasks)&&results.confidenceMasks.length>0;if(hasMaskDataArray){const confidenceMaskObject=results.confidenceMasks[0];const maskWidth=confidenceMaskObject?.width;const maskHeight=confidenceMaskObject?.height;let maskData=null;if(typeof confidenceMaskObject?.getAsFloat32Array==='function'){try{maskData=confidenceMaskObject.getAsFloat32Array();}catch(error){maskData=null;}}else if(confidenceMaskObject?.data){maskData=confidenceMaskObject.data;}if(maskData instanceof Float32Array&&maskWidth>0&&maskHeight>0){const now=performance.now();const timeSinceLastUpdate=now-lastMaskUpdateTime.current;const throttleThreshold=isStatic?0:66;if(timeSinceLastUpdate>throttleThreshold){lastMaskUpdateTime.current=now;try{if(!segmentationTextureRef.current||segmentationTextureRef.current.image.width!==maskWidth||segmentationTextureRef.current.image.height!==maskHeight){segmentationTextureRef.current?.dispose();segmentationTextureRef.current=new THREE.DataTexture(maskData,maskWidth,maskHeight,THREE.RedFormat,THREE.FloatType);segmentationTextureRef.current.minFilter=THREE.LinearFilter;segmentationTextureRef.current.magFilter=THREE.LinearFilter;segmentationTextureRef.current.needsUpdate=true;}else{segmentationTextureRef.current.image.data=maskData;segmentationTextureRef.current.needsUpdate=true;}}catch(error){console.error("Mask Texture Error:",error);segmentationTextureRef.current?.dispose();segmentationTextureRef.current=null;}}}else{if(segmentationTextureRef.current){segmentationTextureRef.current.dispose();segmentationTextureRef.current=null;}}}else{if(segmentationTextureRef.current){segmentationTextureRef.current.dispose();segmentationTextureRef.current=null;}}}, [segmentationResults, isStatic]);


    // --- Handle Resizing / Scale Plane ---
    const handleResize = useCallback(() => { const canvas = canvasRef.current; if (!rendererInstanceRef.current || !baseCameraRef.current || !composerRef.current || !canvas) return; const newWidth = canvas.clientWidth; const newHeight = canvas.clientHeight; if (newWidth === 0 || newHeight === 0) return; const currentSize = rendererInstanceRef.current.getSize(new THREE.Vector2()); if (currentSize.x === newWidth && currentSize.y === newHeight) return; try { rendererInstanceRef.current.setSize(newWidth, newHeight); composerRef.current.setSize(newWidth, newHeight); baseCameraRef.current.left = -newWidth / 2; baseCameraRef.current.right = newWidth / 2; baseCameraRef.current.top = newHeight / 2; baseCameraRef.current.bottom = -newHeight / 2; baseCameraRef.current.updateProjectionMatrix(); } catch(e) { console.error("Resize Error:", e);} }, []);
    const fitPlaneToCamera = useCallback((textureWidth, textureHeight) => { const canvas = canvasRef.current; if (!baseCameraRef.current || !basePlaneMeshRef.current || !textureWidth || !textureHeight || !canvas || canvas.clientWidth === 0 || canvas.clientHeight === 0) return; const viewWidth = canvas.clientWidth; const viewHeight = canvas.clientHeight; const viewAspect = viewWidth / viewHeight; const textureAspect = textureWidth / textureHeight; let scaleX, scaleY; if (viewAspect > textureAspect) { scaleY = viewHeight; scaleX = scaleY * textureAspect; } else { scaleX = viewWidth; scaleY = scaleX / textureAspect; } const currentScale = basePlaneMeshRef.current.scale; const signX = Math.sign(currentScale.x) || 1; const newScaleXWithSign = scaleX * signX; if (Math.abs(currentScale.y - scaleY) > 0.01 || Math.abs(currentScale.x - newScaleXWithSign) > 0.01) { currentScale.set(newScaleXWithSign, scaleY, 1); } }, []);

    // --- Render Loop (Use EffectComposer) ---
     const renderLoop = useCallback(() => {
        animationFrameHandle.current = requestAnimationFrame(renderLoop);
        if (!isInitialized.current || !rendererInstanceRef.current || !composerRef.current || !basePlaneMeshRef.current || !effectPassRef.current) { return; } // Check init flag and refs

        try {
            // 1 & 2: Select Texture & Update Plane
            const baseMaterial = basePlaneMeshRef.current.material; let sourceWidth = 0, sourceHeight = 0; let textureToAssign = null; let isVideo = false;
            if (!isStatic && videoTextureRef.current) { textureToAssign = videoTextureRef.current; isVideo = true; if(textureToAssign.image) {sourceWidth=textureToAssign.image.videoWidth; sourceHeight=textureToAssign.image.videoHeight;} } else if (isStatic && imageTextureRef.current) { textureToAssign = imageTextureRef.current; if(textureToAssign.image){sourceWidth=textureToAssign.image.naturalWidth; sourceHeight=textureToAssign.image.naturalHeight;} if(textureToAssign.needsUpdate){textureToAssign.needsUpdate=true;} }
            if(baseMaterial){ if (baseMaterial.map !== textureToAssign) { baseMaterial.map = textureToAssign; baseMaterial.needsUpdate = true; } else if (textureToAssign && textureToAssign.needsUpdate) { baseMaterial.needsUpdate = true; } }
            const planeVisible = !!baseMaterial?.map && sourceWidth > 0 && sourceHeight > 0;
             if (planeVisible) { fitPlaneToCamera(sourceWidth, sourceHeight); const scaleX = Math.abs(basePlaneMeshRef.current.scale.x); const newScaleX = isVideo ? -scaleX : scaleX; if(basePlaneMeshRef.current.scale.x !== newScaleX) { basePlaneMeshRef.current.scale.x = newScaleX; } } else { if (basePlaneMeshRef.current?.scale.x !== 0 || basePlaneMeshRef.current?.scale.y !== 0) { basePlaneMeshRef.current?.scale.set(0, 0, 0); } }
             if (planeVisible && textureToAssign?.needsUpdate) { textureToAssign.needsUpdate = false; }

            // Update ShaderPass Uniforms
            const effectUniforms = effectPassRef.current.uniforms;
            effectUniforms.uSegmentationMask.value = segmentationTextureRef.current; // Assign the mask texture
            effectUniforms.uHasMask.value = !!segmentationTextureRef.current; // Set the flag
            // Intensity is updated via useEffect

            // Render using the Composer
            composerRef.current.render();

        } catch (error) { console.error("Error in renderLoop:", error); }
    }, [fitPlaneToCamera, isStatic]); // Keep dependencies


    // --- Initialize Scene (Use EffectComposer) ---
    const initThreeScene = useCallback(() => {
        if (!canvasRef.current || isInitialized.current) { return; }
        console.log("DEBUG: initThreeScene START (Using EffectComposer - Corrected)");
        try {
            const canvas = canvasRef.current; const initialWidth = canvas.clientWidth || 640; const initialHeight = canvas.clientHeight || 480;
            rendererInstanceRef.current = new THREE.WebGLRenderer({ canvas: canvas, antialias: true }); rendererInstanceRef.current.setSize(initialWidth, initialHeight); rendererInstanceRef.current.setPixelRatio(window.devicePixelRatio); rendererInstanceRef.current.outputColorSpace = THREE.SRGBColorSpace;

            // Base Scene setup
            baseSceneRef.current = new THREE.Scene(); baseCameraRef.current = new THREE.OrthographicCamera(-initialWidth / 2, initialWidth / 2, initialHeight / 2, -initialHeight / 2, 0.1, 10); baseCameraRef.current.position.z = 1; const planeGeometry = new THREE.PlaneGeometry(1, 1); const planeMaterial = new THREE.MeshBasicMaterial({ map: null, side: THREE.DoubleSide, color: 0xffffff, transparent: true }); basePlaneMeshRef.current = new THREE.Mesh(planeGeometry, planeMaterial); baseSceneRef.current.add(basePlaneMeshRef.current);

            // Setup EffectComposer
            composerRef.current = new EffectComposer(rendererInstanceRef.current);
            // 1. RenderPass
            const renderPass = new RenderPass(baseSceneRef.current, baseCameraRef.current);
            composerRef.current.addPass(renderPass);
            // 2. ShaderPass for Hydration Effect
            const hydrationShaderCopy = { // Use a defined object
                 uniforms: THREE.UniformsUtils.clone(HydrationShader.uniforms),
                 vertexShader: HydrationShader.vertexShader,
                 fragmentShader: HydrationShader.fragmentShader
            };
            hydrationShaderCopy.uniforms.uEffectIntensity.value = currentIntensity.current; // Set initial intensity

            effectPassRef.current = new ShaderPass(hydrationShaderCopy); // Pass the shader definition object
            // *** Set renderToScreen = true on the FINAL pass ***
            effectPassRef.current.renderToScreen = true;
            // **************************************************
            composerRef.current.addPass(effectPassRef.current);
            console.log("DEBUG: EffectComposer setup complete.");

            isInitialized.current = true; handleResize(); cancelAnimationFrame(animationFrameHandle.current); animationFrameHandle.current = requestAnimationFrame(renderLoop);
        } catch (error) { console.error("DEBUG: initThreeScene FAILED:", error); isInitialized.current = false; }
    // Add HydrationShader to dependency array as it's used directly now
    }, [handleResize, renderLoop, HydrationShader]);


    // --- Setup / Cleanup Effect ---
    useEffect(() => {
        initThreeScene();
        let resizeObserver; const currentCanvas = canvasRef.current;
        if (currentCanvas) { resizeObserver = new ResizeObserver(() => { handleResize(); }); resizeObserver.observe(currentCanvas); }
        return () => { /* ... Full cleanup logic ... */ };
     }, [initThreeScene, handleResize]);


    // --- JSX --- (No change)
    return ( <canvas ref={canvasRef} className={`renderer-canvas ${className || ''}`} style={{ display: 'block', width: '100%', height: '100%', ...(style || {}) }} /> );

});
TryOnRenderer.displayName = 'TryOnRenderer';
export default TryOnRenderer;