// src/components/TryOnRenderer.jsx - Add RenderLoop Logging + Correct DataTexture Filters

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
    const imageTextureRef = useRef(null); const segmentationTextureRef = useRef(null);
    const composerRef = useRef(null); const effectPassRef = useRef(null);
    const currentIntensity = useRef(0.5);
    const renderLoopCounter = useRef(0); const lastMaskUpdateTime = useRef(0);


    // --- Shaders (Subtle Effect + Mask Flip) ---
    const customVertexShader = `varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 ); }`;
    const customFragmentShader = `
        uniform sampler2D tDiffuse; uniform sampler2D uSegmentationMask; uniform float uEffectIntensity; uniform bool uHasMask; varying vec2 vUv;
        vec3 applyHydrationEffect(vec3 c){ vec3 h=c*(1.0+0.1); return h; }
        void main() { vec4 bC=texture2D(tDiffuse,vUv); vec3 fC=bC.rgb; if(uHasMask&&uEffectIntensity>0.0){ float mV=texture2D(uSegmentationMask,vec2(vUv.x,1.0-vUv.y)).r; vec3 hC=applyHydrationEffect(fC); float bA=smoothstep(0.3,0.8,mV)*uEffectIntensity; fC=mix(fC,hC,bA); } fC=clamp(fC,0.0,1.0); gl_FragColor=vec4(fC,bC.a); }`;

    const HydrationShader = {
        uniforms: { 'tDiffuse': { value: null }, 'uSegmentationMask': { value: null }, 'uEffectIntensity': { value: 0.5 }, 'uHasMask': { value: false } },
        vertexShader: customVertexShader, fragmentShader: customFragmentShader
    };

    // --- Prop Effects / Texture Effects / Mask Effect ---
    useEffect(() => { currentIntensity.current = effectIntensity; if (effectPassRef.current) { effectPassRef.current.uniforms.uEffectIntensity.value = currentIntensity.current; } }, [effectIntensity]);
    useEffect(() => { /* Video Texture */ const videoElement=videoRefProp?.current;if(!isStatic&&videoElement){if(!videoTextureRef.current||videoTextureRef.current.image!==videoElement){videoTextureRef.current?.dispose();videoTextureRef.current=new THREE.VideoTexture(videoElement);videoTextureRef.current.colorSpace=THREE.SRGBColorSpace;}}else{if(videoTextureRef.current){videoTextureRef.current.dispose();videoTextureRef.current=null;}}}, [isStatic, videoRefProp]);
    useEffect(() => { /* Image Texture */ if(isStatic&&imageElement){if(!imageTextureRef.current||imageTextureRef.current.image!==imageElement){imageTextureRef.current?.dispose();imageTextureRef.current=new THREE.Texture(imageElement);imageTextureRef.current.colorSpace=THREE.SRGBColorSpace;imageTextureRef.current.needsUpdate=true;}else if(imageTextureRef.current&&imageTextureRef.current.image===imageElement){imageTextureRef.current.needsUpdate=true;}}else{if(imageTextureRef.current){imageTextureRef.current.dispose();imageTextureRef.current=null;}}}, [isStatic, imageElement]);
    useEffect(() => { /* Mask Texture Creation */ const results=segmentationResults;const hasMaskDataArray=Array.isArray(results?.confidenceMasks)&&results.confidenceMasks.length>0;if(hasMaskDataArray){const confidenceMaskObject=results.confidenceMasks[0];const maskWidth=confidenceMaskObject?.width;const maskHeight=confidenceMaskObject?.height;let maskData=null;if(typeof confidenceMaskObject?.getAsFloat32Array==='function'){try{maskData=confidenceMaskObject.getAsFloat32Array();}catch(error){maskData=null;}}else if(confidenceMaskObject?.data){maskData=confidenceMaskObject.data;}if(maskData instanceof Float32Array&&maskWidth>0&&maskHeight>0){const now=performance.now();const timeSinceLastUpdate=now-lastMaskUpdateTime.current;const throttleThreshold=isStatic?0:66;if(timeSinceLastUpdate>throttleThreshold){lastMaskUpdateTime.current=now;try{let texture=segmentationTextureRef.current;if(!texture||texture.image.width!==maskWidth||texture.image.height!==maskHeight){texture?.dispose();console.log(`Mask Texture: Creating NEW DataTexture (${maskWidth}x${maskHeight}) with NearestFilter.`);texture=new THREE.DataTexture(maskData,maskWidth,maskHeight,THREE.RedFormat,THREE.FloatType);texture.minFilter=THREE.NearestFilter;texture.magFilter=THREE.NearestFilter;texture.generateMipmaps=false;texture.needsUpdate=true;segmentationTextureRef.current=texture;console.log(`Mask Texture: New DataTexture CREATED.`);}else{texture.image.data=maskData;texture.needsUpdate=true;}}catch(error){console.error("Mask Texture Error:",error);segmentationTextureRef.current?.dispose();segmentationTextureRef.current=null;}}}}else{if(segmentationTextureRef.current){segmentationTextureRef.current.dispose();segmentationTextureRef.current=null;}}}else{if(segmentationTextureRef.current){segmentationTextureRef.current.dispose();segmentationTextureRef.current=null;}}}, [segmentationResults, isStatic]);


    // --- Handle Resizing / Scale Plane ---
    const handleResize = useCallback(() => { const canvas = canvasRef.current; if (!rendererInstanceRef.current || !baseCameraRef.current || !composerRef.current || !canvas) return; const newWidth = canvas.clientWidth; const newHeight = canvas.clientHeight; if (newWidth === 0 || newHeight === 0) return; const currentSize = rendererInstanceRef.current.getSize(new THREE.Vector2()); if (currentSize.x === newWidth && currentSize.y === newHeight) return; try { rendererInstanceRef.current.setSize(newWidth, newHeight); composerRef.current.setSize(newWidth, newHeight); baseCameraRef.current.left = -newWidth / 2; baseCameraRef.current.right = newWidth / 2; baseCameraRef.current.top = newHeight / 2; baseCameraRef.current.bottom = -newHeight / 2; baseCameraRef.current.updateProjectionMatrix(); } catch(e) { console.error("Resize Error:", e);} }, []);
    const fitPlaneToCamera = useCallback((textureWidth, textureHeight) => { const canvas = canvasRef.current; if (!baseCameraRef.current || !basePlaneMeshRef.current || !textureWidth || !textureHeight || !canvas || canvas.clientWidth === 0 || canvas.clientHeight === 0) return; const viewWidth = canvas.clientWidth; const viewHeight = canvas.clientHeight; const viewAspect = viewWidth / viewHeight; const textureAspect = textureWidth / textureHeight; let scaleX, scaleY; if (viewAspect > textureAspect) { scaleY = viewHeight; scaleX = scaleY * textureAspect; } else { scaleX = viewWidth; scaleY = scaleX / textureAspect; } const currentScale = basePlaneMeshRef.current.scale; const signX = Math.sign(currentScale.x) || 1; const newScaleXWithSign = scaleX * signX; if (Math.abs(currentScale.y - scaleY) > 0.01 || Math.abs(currentScale.x - newScaleXWithSign) > 0.01) { currentScale.set(newScaleXWithSign, scaleY, 1); } }, []);


    // --- ***** Render Loop (Add Logging) ***** ---
     const renderLoop = useCallback(() => {
        animationFrameHandle.current = requestAnimationFrame(renderLoop);

        // Log entry point
        renderLoopCounter.current++;
        const logThisFrame = (renderLoopCounter.current === 1 || renderLoopCounter.current % 150 === 0); // Log first frame + periodically
        if (logThisFrame) console.log(`RenderLoop Frame ${renderLoopCounter.current}, isInitialized=${isInitialized.current}`);


        if (!isInitialized.current || !rendererInstanceRef.current || !composerRef.current || !basePlaneMeshRef.current || !effectPassRef.current) {
            if(logThisFrame) console.log(" -> RenderLoop skipping: Not initialized or refs missing.");
             return; // Wait for init
        }

        // Log before main try block
         if (logThisFrame) console.log(" -> RenderLoop: Refs OK, entering main logic...");


        try {
            // 1 & 2: Select Texture & Update Plane
            const baseMaterial = basePlaneMeshRef.current.material;
            let sourceWidth = 0, sourceHeight = 0;
            let textureToAssign = null;
            let isVideo = false;

            if (!isStatic && videoTextureRef.current) {
                 textureToAssign = videoTextureRef.current;
                 isVideo = true;
                 if(textureToAssign.image) {
                      sourceWidth=textureToAssign.image.videoWidth;
                      sourceHeight=textureToAssign.image.videoHeight;
                 }
            } else if (isStatic && imageTextureRef.current) {
                 textureToAssign = imageTextureRef.current;
                 if(textureToAssign.image){
                      sourceWidth=textureToAssign.image.naturalWidth;
                      sourceHeight=textureToAssign.image.naturalHeight;
                 }
                 if(textureToAssign.needsUpdate){textureToAssign.needsUpdate=true;}
            }

            // Log texture selection
            if(logThisFrame) console.log(` -> RenderLoop: Texture to assign: ${textureToAssign?.constructor?.name ?? 'null'}, Size: ${sourceWidth}x${sourceHeight}`);


            if(baseMaterial){
                 if (baseMaterial.map !== textureToAssign) {
                      if(logThisFrame) console.log(" -> RenderLoop: Assigning new texture to baseMaterial.");
                      baseMaterial.map = textureToAssign;
                      baseMaterial.needsUpdate = true;
                 } else if (textureToAssign && textureToAssign.needsUpdate) {
                      if(logThisFrame) console.log(" -> RenderLoop: Marking baseMaterial needsUpdate (texture updated).");
                      baseMaterial.needsUpdate = true; // Important if texture content changes!
                 }
            } else {
                 if(logThisFrame) console.warn(" -> RenderLoop: baseMaterial is null!");
            }

            const planeVisible = !!baseMaterial?.map && sourceWidth > 0 && sourceHeight > 0;
             if (planeVisible) {
                 fitPlaneToCamera(sourceWidth, sourceHeight);
                 const scaleX = Math.abs(basePlaneMeshRef.current.scale.x);
                 const newScaleX = isVideo ? -scaleX : scaleX;
                 if(basePlaneMeshRef.current.scale.x !== newScaleX) { basePlaneMeshRef.current.scale.x = newScaleX; }
             } else {
                 if (basePlaneMeshRef.current?.scale.x !== 0 || basePlaneMeshRef.current?.scale.y !== 0) { basePlaneMeshRef.current?.scale.set(0, 0, 0); }
             }
             // Texture update flag reset should happen *after* it's used in render
             // if (planeVisible && textureToAssign?.needsUpdate) { textureToAssign.needsUpdate = false; }


            // Update ShaderPass Uniforms
            const effectUniforms = effectPassRef.current.uniforms;
            effectUniforms.uSegmentationMask.value = segmentationTextureRef.current;
            const hasMask = !!segmentationTextureRef.current;
            effectUniforms.uHasMask.value = hasMask;
            // Intensity is updated via useEffect

             if(logThisFrame) console.log(` -> RenderLoop: Uniforms updated. uHasMask=${hasMask}, Mask Texture ID=${segmentationTextureRef.current?.id ?? 'null'}`);


            // Render using the Composer
            if(logThisFrame) console.log(" -> RenderLoop: Calling composer.render()...");
            composerRef.current.render();
            if(logThisFrame) console.log(" -> RenderLoop: composer.render() finished.");

             // Reset texture update flag AFTER composer might have used it
            if (planeVisible && textureToAssign?.needsUpdate) {
                 if(logThisFrame) console.log(" -> RenderLoop: Setting texture needsUpdate = false");
                 textureToAssign.needsUpdate = false;
             }


        } catch (error) {
             console.error("Error in renderLoop:", error);
             // Optionally stop loop on error:
             // cancelAnimationFrame(animationFrameHandle.current);
        }
    }, [fitPlaneToCamera, isStatic]); // Keep dependencies


    // --- Initialize Scene (Use EffectComposer) ---
    const initThreeScene = useCallback(() => {
        if (!canvasRef.current || isInitialized.current) { return; }
        console.log("DEBUG: initThreeScene START (Corrected EffectComposer Impl)"); // Changed log message
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
    }, [handleResize, renderLoop, HydrationShader]); // Added HydrationShader


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