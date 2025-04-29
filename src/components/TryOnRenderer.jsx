// src/components/TryOnRenderer.jsx - TUNE Saturation, Brightness & Contrast

import React, { useRef, forwardRef, useEffect, useCallback } from 'react';
import * as THREE from 'three';

// --- ***** TUNE THESE VALUES to match HTML Preview ***** ---
const TARGET_PREVIEW_SATURATION = 0.85; // Start value (<1 less saturated, >1 more)
const TARGET_PREVIEW_BRIGHTNESS = 1.0;  // Start value (=1 no change, >1 brighter, <1 darker)
const TARGET_PREVIEW_CONTRAST = 0.95; // Start value (=1 no change, >1 more contrast, <1 less)
// --- *************************************************** ---

const TryOnRenderer = forwardRef(({
    videoRefProp, imageElement,
    // Unused props:
    mediaPipeResults, segmentationResults, isStatic, brightness, contrast, effectIntensity,
    className, style
 }, ref) => {

    // --- Core Refs / Internal State Refs ---
    const canvasRef = useRef(null); const rendererInstanceRef = useRef(null); const animationFrameHandle = useRef(null); const isInitialized = useRef(false);
    const baseSceneRef = useRef(null); const baseCameraRef = useRef(null); const basePlaneMeshRef = useRef(null); const videoTextureRef = useRef(null);
    const imageTextureRef = useRef(null); const postSceneRef = useRef(null); const postCameraRef = useRef(null); const postMaterialRef = useRef(null);
    const renderTargetRef = useRef(null); const segmentationTextureRef = useRef(null);
    // Refs for adjustment values
    const currentSaturation = useRef(TARGET_PREVIEW_SATURATION);
    const currentBrightness = useRef(TARGET_PREVIEW_BRIGHTNESS);
    const currentContrast = useRef(TARGET_PREVIEW_CONTRAST);
    const currentIntensity = useRef(0.5); // Keep ref for intensity prop
    const renderLoopCounter = useRef(0); const lastMaskUpdateTime = useRef(0);


    // --- Shaders (Saturation + Brightness + Contrast) ---
    const postVertexShader = `varying vec2 vUv; void main() { vUv = uv; gl_Position = vec4(position, 1.0); }`;
    const postFragmentShader = `
        uniform sampler2D uSceneTexture;
        // Add all adjustment uniforms
        uniform float uSaturation;
        uniform float uBrightness;
        uniform float uContrast;
        // Keep effect uniforms defined but unused by this shader logic
        uniform sampler2D uSegmentationMask;
        uniform float uEffectIntensity;
        uniform bool uHasMask;

        varying vec2 vUv;

        // --- RGB <-> HSL Functions --- (Condensed)
        vec3 rgb2hsl(vec3 c){float x=max(c.r,max(c.g,c.b));float n=min(c.r,min(c.g,c.b));float d=x-n;float H=0.;float S=0.;float L=(x+n)/2.;if(d>0.){S=(L<.5)?(d/(x+n)):(d/(2.-x-n));if(c.r==x)H=(c.g-c.b)/d;else if(c.g==x)H=2.+(c.b-c.r)/d;else H=4.+(c.r-c.g)/d;H/=6.;if(H<0.)H+=1.;}return vec3(H,S,L);}
        float h2r(float p,float q,float t){if(t<0.)t+=1.;if(t>1.)t-=1.;if(t<1./6.)return p+(q-p)*6.*t;if(t<1./2.)return q;if(t<2./3.)return p+(q-p)*(2./3.-t)*6.;return p;}
        vec3 hsl2rgb(vec3 hsl){float H=hsl.x;float S=hsl.y;float L=hsl.z;vec3 rgb=vec3(L);if(S>0.){float q=(L<.5)?(L*(1.+S)):(L+S-L*S);float p=2.*L-q;rgb.r=h2r(p,q,H+1./3.);rgb.g=h2r(p,q,H);rgb.b=h2r(p,q,H-1./3.);}return rgb;}

        // Function to apply brightness and contrast
        vec3 applyBrightnessContrast(vec3 color, float brightness, float contrast) {
            color = color * brightness;
            color = (color - 0.5) * contrast + 0.5;
            return color;
        }

        // Effect function (defined but not called)
        vec3 applyHydrationEffect(vec3 color) { return color * (1.0 + 0.1); }

        void main() {
            vec4 baseColor = texture2D(uSceneTexture, vUv);

            // 1. Adjust Saturation
            vec3 hslColor = rgb2hsl(baseColor.rgb);
            hslColor.y *= uSaturation;
            vec3 satAdjustedColor = hsl2rgb(hslColor);

            // 2. Adjust Brightness & Contrast
            vec3 finalColor = applyBrightnessContrast(satAdjustedColor, uBrightness, uContrast);

            // --- Hydration Effect Logic (Still Disabled) ---
            /*
            if (uHasMask && uEffectIntensity > 0.0) { ... }
            */

            finalColor = clamp(finalColor, 0.0, 1.0);
            gl_FragColor = vec4(finalColor, baseColor.a);
        }
    `;


    // --- Prop Effects --- (Set all three adjustment refs)
    useEffect(() => {
        // Set current refs from constants
        currentSaturation.current = TARGET_PREVIEW_SATURATION;
        currentBrightness.current = TARGET_PREVIEW_BRIGHTNESS;
        currentContrast.current = TARGET_PREVIEW_CONTRAST;
        console.log(`TryOnRenderer Effect: Set S/B/C targets (${currentSaturation.current.toFixed(2)}, ${currentBrightness.current.toFixed(2)}, ${currentContrast.current.toFixed(2)})`);
    }, []); // Run once

    useEffect(() => { currentIntensity.current = effectIntensity; }, [effectIntensity]);


    // --- Video/Image Texture Effects / Mask Effect --- (No changes needed)
    useEffect(() => { /* ... Video Texture Logic ... */ }, [isStatic, videoRefProp]);
    useEffect(() => { /* ... Image Texture Logic ... */ }, [isStatic, imageElement]);
    useEffect(() => { /* ... Segmentation Mask Texture Logic ... */ }, [segmentationResults, isStatic]);

    // --- Handle Resizing / Scale Plane --- (No changes needed)
    const handleResize = useCallback(() => { /* ... (Includes RT resize) ... */ const canvas=canvasRef.current;if(!rendererInstanceRef.current||!baseCameraRef.current||!postCameraRef.current||!canvas||!renderTargetRef.current)return;const w=canvas.clientWidth,h=canvas.clientHeight;if(w===0||h===0)return;const s=rendererInstanceRef.current.getSize(new THREE.Vector2());if(s.x===w&&s.y===h)return;try{rendererInstanceRef.current.setSize(w,h);renderTargetRef.current.setSize(w,h);baseCameraRef.current.left=-w/2;baseCameraRef.current.right=w/2;baseCameraRef.current.top=h/2;baseCameraRef.current.bottom=-h/2;baseCameraRef.current.updateProjectionMatrix();}catch(e){console.error("Resize Error:",e);}}, []);
    const fitPlaneToCamera = useCallback((textureWidth, textureHeight) => { /* ... (same as before) ... */ const canvas=canvasRef.current;if(!baseCameraRef.current||!basePlaneMeshRef.current||!textureWidth||!textureHeight||!canvas||canvas.clientWidth===0||canvas.clientHeight===0)return;const viewWidth=canvas.clientWidth;const viewHeight=canvas.clientHeight;const viewAspect=viewWidth/viewHeight;const textureAspect=textureWidth/textureHeight;let scaleX,scaleY;if(viewAspect>textureAspect){scaleY=viewHeight;scaleX=scaleY*textureAspect;}else{scaleX=viewWidth;scaleY=scaleX/textureAspect;}const currentScale=basePlaneMeshRef.current.scale;const signX=Math.sign(currentScale.x)||1;const newScaleXWithSign=scaleX*signX;if(Math.abs(currentScale.y-scaleY)>0.01||Math.abs(currentScale.x-newScaleXWithSign)>0.01){currentScale.set(newScaleXWithSign,scaleY,1);}}, []);


    // --- Render Loop --- (Update All Adjustment Uniforms)
     const renderLoop = useCallback(() => {
        animationFrameHandle.current = requestAnimationFrame(renderLoop);
        if (!isInitialized.current || !rendererInstanceRef.current /* ... etc ... */ || !postMaterialRef.current) { return; }

        try {
            const postUniforms = postMaterialRef.current.uniforms;
            // Check all uniforms needed by this shader version
            if (!postUniforms?.uSceneTexture || !postUniforms?.uSaturation || !postUniforms?.uBrightness || !postUniforms?.uContrast) { return; } // Check S/B/C

            // 1 & 2: Select Texture & Update Plane (Condensed)
            /* ... */ const baseMaterial=basePlaneMeshRef.current.material; let sourceWidth=0,sourceHeight=0,textureToAssign=null,isVideo=false; if(!isStatic&&videoTextureRef.current){textureToAssign=videoTextureRef.current;isVideo=true;if(textureToAssign.image){sourceWidth=textureToAssign.image.videoWidth;sourceHeight=textureToAssign.image.videoHeight;}}else if(isStatic&&imageTextureRef.current){textureToAssign=imageTextureRef.current;if(textureToAssign.image){sourceWidth=textureToAssign.image.naturalWidth;sourceHeight=textureToAssign.image.naturalHeight;}if(textureToAssign.needsUpdate){textureToAssign.needsUpdate=true;}} if(baseMaterial){if(baseMaterial.map!==textureToAssign){baseMaterial.map=textureToAssign;baseMaterial.needsUpdate=true;}else if(textureToAssign&&textureToAssign.needsUpdate){baseMaterial.needsUpdate=true;}} const planeVisible=!!baseMaterial?.map&&sourceWidth>0&&sourceHeight>0; if(planeVisible){fitPlaneToCamera(sourceWidth,sourceHeight);const scaleX=Math.abs(basePlaneMeshRef.current.scale.x);const newScaleX=isVideo?-scaleX:scaleX;if(basePlaneMeshRef.current.scale.x!==newScaleX){basePlaneMeshRef.current.scale.x=newScaleX;}}else{if(basePlaneMeshRef.current?.scale.x!==0||basePlaneMeshRef.current?.scale.y!==0){basePlaneMeshRef.current?.scale.set(0,0,0);}}

            // 3. Render Base Scene to Target
            rendererInstanceRef.current.setRenderTarget(renderTargetRef.current);
            rendererInstanceRef.current.setClearColor(0x000000, 0); rendererInstanceRef.current.clear();
             if (planeVisible && baseSceneRef.current && baseCameraRef.current) { rendererInstanceRef.current.render(baseSceneRef.current, baseCameraRef.current); if (textureToAssign?.needsUpdate) { textureToAssign.needsUpdate = false; } }

            // 4. Unbind Render Target
             rendererInstanceRef.current.setRenderTarget(null);

            // 5. Update Post-Processing Uniforms (SceneTexture + S/B/C + Mask/Effect)
             postUniforms.uSceneTexture.value = renderTargetRef.current.texture;
             postUniforms.uSaturation.value = currentSaturation.current;
             postUniforms.uBrightness.value = currentBrightness.current;
             postUniforms.uContrast.value = currentContrast.current;
             // Keep updating others even if effect is commented out in shader
             postUniforms.uSegmentationMask.value = segmentationTextureRef.current;
             postUniforms.uHasMask.value = !!segmentationTextureRef.current;
             postUniforms.uEffectIntensity.value = currentIntensity.current;

            // 6. Render Post-Processing Scene to Screen
             if(postSceneRef.current && postCameraRef.current) {
                 rendererInstanceRef.current.render(postSceneRef.current, postCameraRef.current);
             }

        } catch (error) { console.error("Error in renderLoop:", error); }
    }, [fitPlaneToCamera, isStatic]);


    // --- Initialize Scene --- (Add S/B/C Uniforms)
    const initThreeScene = useCallback(() => {
        if (!canvasRef.current || isInitialized.current) return;
        console.log("DEBUG: initThreeScene START (S/B/C Adjustment)");
        try {
            // Renderer, Render Target, Base Scene, Post Scene setup
             const canvas = canvasRef.current; const initialWidth = canvas.clientWidth || 640; const initialHeight = canvas.clientHeight || 480;
            rendererInstanceRef.current = new THREE.WebGLRenderer({ canvas: canvas, antialias: true }); rendererInstanceRef.current.setSize(initialWidth, initialHeight); rendererInstanceRef.current.setPixelRatio(window.devicePixelRatio); rendererInstanceRef.current.outputColorSpace = THREE.SRGBColorSpace;
            renderTargetRef.current = new THREE.WebGLRenderTarget(initialWidth, initialHeight, { minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, format: THREE.RGBAFormat, colorSpace: THREE.SRGBColorSpace, depthBuffer: true, stencilBuffer: true });
            renderTargetRef.current.texture.generateMipmaps = false; renderTargetRef.current.texture.minFilter = THREE.LinearFilter; renderTargetRef.current.texture.magFilter = THREE.LinearFilter;
            baseSceneRef.current = new THREE.Scene(); baseCameraRef.current = new THREE.OrthographicCamera(-initialWidth / 2, initialWidth / 2, initialHeight / 2, -initialHeight / 2, 0.1, 10); baseCameraRef.current.position.z = 1; const planeGeometry = new THREE.PlaneGeometry(1, 1); const planeMaterial = new THREE.MeshBasicMaterial({ map: null, side: THREE.DoubleSide, color: 0xffffff, transparent: true }); basePlaneMeshRef.current = new THREE.Mesh(planeGeometry, planeMaterial); baseSceneRef.current.add(basePlaneMeshRef.current);
            postSceneRef.current = new THREE.Scene(); postCameraRef.current = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1); const postPlaneGeometry = new THREE.PlaneGeometry(2, 2);

            // Initialize Material with S/B/C Uniforms
            postMaterialRef.current = new THREE.ShaderMaterial({
                vertexShader: postVertexShader,
                fragmentShader: postFragmentShader, // Use S/B/C shader
                uniforms: {
                    uSceneTexture: { value: renderTargetRef.current.texture },
                    uSaturation: { value: currentSaturation.current }, // <<< Add Saturation
                    uBrightness: { value: currentBrightness.current }, // <<< Add Brightness
                    uContrast: { value: currentContrast.current },     // <<< Add Contrast
                    // Define effect uniforms
                    uSegmentationMask: { value: null },
                    uEffectIntensity: { value: currentIntensity.current },
                    uHasMask: { value: false },
                },
                transparent: true, depthWrite: false, depthTest: false,
            });
            const postPlaneMesh = new THREE.Mesh(postPlaneGeometry, postMaterialRef.current); postSceneRef.current.add(postPlaneMesh);

            isInitialized.current = true; handleResize(); cancelAnimationFrame(animationFrameHandle.current); animationFrameHandle.current = requestAnimationFrame(renderLoop);
        } catch (error) { console.error("DEBUG: initThreeScene ERROR:", error); isInitialized.current = false; }
    // Update dependencies
    }, [handleResize, postVertexShader, postFragmentShader, renderLoop]); // Add renderLoop


    // --- Setup / Cleanup Effect --- (Full cleanup)
    useEffect(() => {
        initThreeScene();
        let resizeObserver; const currentCanvas = canvasRef.current;
        if (currentCanvas) { resizeObserver = new ResizeObserver(() => { handleResize(); }); resizeObserver.observe(currentCanvas); }
        return () => { /* ... Full cleanup logic ... */ console.log("DEBUG: Cleanup running (TryOnRenderer Unmount)..."); resizeObserver?.disconnect(); cancelAnimationFrame(animationFrameHandle.current); isInitialized.current = false; console.log("DEBUG: Disposing Three.js resources (Full)..."); videoTextureRef.current?.dispose(); imageTextureRef.current?.dispose(); segmentationTextureRef.current?.dispose(); renderTargetRef.current?.dispose(); basePlaneMeshRef.current?.geometry?.dispose(); basePlaneMeshRef.current?.material?.map?.dispose(); basePlaneMeshRef.current?.material?.dispose(); if(postMaterialRef.current) { postMaterialRef.current.uniforms?.uSceneTexture?.value?.dispose(); postMaterialRef.current.uniforms?.uSegmentationMask?.value?.dispose(); postMaterialRef.current.dispose(); } rendererInstanceRef.current?.dispose(); videoTextureRef.current = null; imageTextureRef.current = null; segmentationTextureRef.current = null; renderTargetRef.current = null; basePlaneMeshRef.current = null; postMaterialRef.current = null; rendererInstanceRef.current = null; baseSceneRef.current = null; postSceneRef.current = null; baseCameraRef.current = null; postCameraRef.current = null; console.log("DEBUG: Three.js resources disposed."); };
     }, [initThreeScene, handleResize]);


    // --- JSX --- (No change)
    return ( <canvas ref={canvasRef} className={`renderer-canvas ${className || ''}`} style={{ display: 'block', width: '100%', height: '100%', ...(style || {}) }} /> );

});
TryOnRenderer.displayName = 'TryOnRenderer';
export default TryOnRenderer;