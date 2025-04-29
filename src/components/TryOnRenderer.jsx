// src/components/TryOnRenderer.jsx - EffectComposer + TUNE Saturation, Brightness & Contrast

import React, { useRef, forwardRef, useEffect, useCallback } from 'react';
import * as THREE from 'three';
// Import necessary EffectComposer passes
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
// Import UniformsUtils for cloning
import { UniformsUtils } from 'three';

// --- ***** TUNE THESE VALUES to match HTML Preview ***** ---
const TARGET_PREVIEW_SATURATION = 0.85; // Start value (<1 less saturated, >1 more)
const TARGET_PREVIEW_BRIGHTNESS = 1.0;  // Start value (=1 no change, >1 brighter, <1 darker)
const TARGET_PREVIEW_CONTRAST = 0.95; // Start value (=1 no change, >1 more contrast, <1 less)
// --- *************************************************** ---


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
    // Refs for adjustment values
    const currentSaturation = useRef(TARGET_PREVIEW_SATURATION);
    const currentBrightness = useRef(TARGET_PREVIEW_BRIGHTNESS);
    const currentContrast = useRef(TARGET_PREVIEW_CONTRAST);
    const currentIntensity = useRef(0.5);
    const renderLoopCounter = useRef(0); const lastMaskUpdateTime = useRef(0);


    // --- ***** Shaders (S/B/C Adjustment + Subtle Effect) ***** ---
    const customVertexShader = `varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 ); }`;
    const customFragmentShader = `
        uniform sampler2D tDiffuse;          // Texture from previous pass
        uniform sampler2D uSegmentationMask; // Our mask texture
        // Add S/B/C uniforms
        uniform float uSaturation;
        uniform float uBrightness;
        uniform float uContrast;
        uniform float uEffectIntensity;      // Slider value
        uniform bool uHasMask;               // Mask flag

        varying vec2 vUv;

        // --- RGB <-> HSL Functions (Condensed) ---
        vec3 rgb2hsl(vec3 c){float x=max(c.r,max(c.g,c.b));float n=min(c.r,min(c.g,c.b));float d=x-n;float H=0.;float S=0.;float L=(x+n)/2.;if(d>0.){S=(L<.5)?(d/(x+n)):(d/(2.-x-n));if(c.r==x)H=(c.g-c.b)/d;else if(c.g==x)H=2.+(c.b-c.r)/d;else H=4.+(c.r-c.g)/d;H/=6.;if(H<0.)H+=1.;}return vec3(H,S,L);}
        float h2r(float p,float q,float t){if(t<0.)t+=1.;if(t>1.)t-=1.;if(t<1./6.)return p+(q-p)*6.*t;if(t<1./2.)return q;if(t<2./3.)return p+(q-p)*(2./3.-t)*6.;return p;}
        vec3 hsl2rgb(vec3 hsl){float H=hsl.x;float S=hsl.y;float L=hsl.z;vec3 rgb=vec3(L);if(S>0.){float q=(L<.5)?(L*(1.+S)):(L+S-L*S);float p=2.*L-q;rgb.r=h2r(p,q,H+1./3.);rgb.g=h2r(p,q,H);rgb.b=h2r(p,q,H-1./3.);}return rgb;}

        // Function to apply brightness and contrast
        vec3 applyBrightnessContrast(vec3 color, float brightness, float contrast) {
            contrast = max(0.01, contrast); // Prevent issue if contrast is 0
            color = color * brightness;
            color = (color - 0.5) * contrast + 0.5;
            return color;
        }

        // Subtle "Hydration" effect function
        vec3 applyHydrationEffect(vec3 color) {
             vec3 hydratedLook = color * (1.0 + 0.1);
             return hydratedLook;
        }

        void main() {
            vec4 baseColor = texture2D(tDiffuse, vUv); // Sample previous pass

            // 1. Adjust Saturation
            vec3 hslColor = rgb2hsl(baseColor.rgb);
            hslColor.y *= uSaturation;
            vec3 satAdjustedColor = hsl2rgb(hslColor);

            // 2. Adjust Brightness & Contrast
            vec3 correctedColor = applyBrightnessContrast(satAdjustedColor, uBrightness, uContrast);

            vec3 finalColor = correctedColor; // Start effect from corrected color

            // 3. Apply Hydration Effect using Mask
            if (uHasMask && uEffectIntensity > 0.0) {
                float maskValue = texture2D(uSegmentationMask, vec2(vUv.x, 1.0 - vUv.y)).r; // Flip Y
                vec3 hydratedColor = applyHydrationEffect(finalColor);
                float blendAmount = smoothstep(0.3, 0.8, maskValue) * uEffectIntensity;
                finalColor = mix(finalColor, hydratedColor, blendAmount);
            }

            finalColor = clamp(finalColor, 0.0, 1.0);
            gl_FragColor = vec4(finalColor, baseColor.a);
        }
    `;

    // Define the shader object for ShaderPass including S/B/C uniforms
    const AdjustmentEffectShader = { // Renamed for clarity
        uniforms: {
            'tDiffuse': { value: null },
            'uSaturation': { value: TARGET_PREVIEW_SATURATION }, // <<< Initialize
            'uBrightness': { value: TARGET_PREVIEW_BRIGHTNESS }, // <<< Initialize
            'uContrast': { value: TARGET_PREVIEW_CONTRAST },     // <<< Initialize
            'uSegmentationMask': { value: null },
            'uEffectIntensity': { value: 0.5 }, // Initial intensity
            'uHasMask': { value: false }
        },
        vertexShader: customVertexShader,
        fragmentShader: customFragmentShader
    };
    // --- ******************************************************* ---


    // --- Prop Effects --- (Set S/B/C refs from constants, update intensity)
    useEffect(() => {
        // Set initial refs from constants
        currentSaturation.current = TARGET_PREVIEW_SATURATION;
        currentBrightness.current = TARGET_PREVIEW_BRIGHTNESS;
        currentContrast.current = TARGET_PREVIEW_CONTRAST;
        console.log(`TryOnRenderer Effect: Initial S/B/C targets set (${currentSaturation.current.toFixed(2)}, ${currentBrightness.current.toFixed(2)}, ${currentContrast.current.toFixed(2)})`);

        // Update uniforms if pass exists already (e.g., on hot reload)
         if (effectPassRef.current) {
            effectPassRef.current.uniforms.uSaturation.value = currentSaturation.current;
            effectPassRef.current.uniforms.uBrightness.value = currentBrightness.current;
            effectPassRef.current.uniforms.uContrast.value = currentContrast.current;
         }

    }, []); // Run only once on mount

    useEffect(() => {
        currentIntensity.current = effectIntensity;
        // Update intensity uniform directly
        if (effectPassRef.current) {
            effectPassRef.current.uniforms.uEffectIntensity.value = currentIntensity.current;
        }
     }, [effectIntensity]);


    // --- Video/Image Texture Effects / Mask Effect --- (No changes needed)
    useEffect(() => { /* ... Video Texture Logic ... */ }, [isStatic, videoRefProp]);
    useEffect(() => { /* ... Image Texture Logic ... */ }, [isStatic, imageElement]);
    useEffect(() => { /* ... Segmentation Mask Texture Logic ... */ }, [segmentationResults, isStatic]);

    // --- Handle Resizing / Scale Plane --- (No changes needed)
    const handleResize = useCallback(() => { /* ... */ }, []);
    const fitPlaneToCamera = useCallback((textureWidth, textureHeight) => { /* ... */ }, []);


    // --- Render Loop (Update S/B/C Uniforms) ---
     const renderLoop = useCallback(() => {
        animationFrameHandle.current = requestAnimationFrame(renderLoop);
        if (!isInitialized.current || !rendererInstanceRef.current || !composerRef.current || !basePlaneMeshRef.current || !effectPassRef.current) { return; }

        try {
            // 1 & 2: Select Texture & Update Plane (Condensed)
            /* ... */ const baseMaterial=basePlaneMeshRef.current.material; let sourceWidth=0,sourceHeight=0,textureToAssign=null,isVideo=false; if(!isStatic&&videoTextureRef.current){textureToAssign=videoTextureRef.current;isVideo=true;if(textureToAssign.image){sourceWidth=textureToAssign.image.videoWidth;sourceHeight=textureToAssign.image.videoHeight;}}else if(isStatic&&imageTextureRef.current){textureToAssign=imageTextureRef.current;if(textureToAssign.image){sourceWidth=textureToAssign.image.naturalWidth;sourceHeight=textureToAssign.image.naturalHeight;}if(textureToAssign.needsUpdate){textureToAssign.needsUpdate=true;}} if(baseMaterial){if(baseMaterial.map!==textureToAssign){baseMaterial.map=textureToAssign;baseMaterial.needsUpdate=true;}else if(textureToAssign&&textureToAssign.needsUpdate){baseMaterial.needsUpdate=true;}} const planeVisible=!!baseMaterial?.map&&sourceWidth>0&&sourceHeight>0; if(planeVisible){fitPlaneToCamera(sourceWidth,sourceHeight);const scaleX=Math.abs(basePlaneMeshRef.current.scale.x);const newScaleX=isVideo?-scaleX:scaleX;if(basePlaneMeshRef.current.scale.x!==newScaleX){basePlaneMeshRef.current.scale.x=newScaleX;}}else{if(basePlaneMeshRef.current?.scale.x!==0||basePlaneMeshRef.current?.scale.y!==0){basePlaneMeshRef.current?.scale.set(0,0,0);}} if(planeVisible&&textureToAssign?.needsUpdate){textureToAssign.needsUpdate=false;}

            // Update ShaderPass Uniforms (Including S/B/C from refs)
            const effectUniforms = effectPassRef.current.uniforms;
            effectUniforms.uSaturation.value = currentSaturation.current; // Set from ref
            effectUniforms.uBrightness.value = currentBrightness.current; // Set from ref
            effectUniforms.uContrast.value = currentContrast.current;     // Set from ref
            effectUniforms.uSegmentationMask.value = segmentationTextureRef.current;
            effectUniforms.uHasMask.value = !!segmentationTextureRef.current;
            // Intensity is updated via useEffect

            // Render using the Composer
            composerRef.current.render();

        } catch (error) { console.error("Error in renderLoop:", error); }
    }, [fitPlaneToCamera, isStatic]);


    // --- Initialize Scene (Add S/B/C to ShaderPass) ---
    const initThreeScene = useCallback(() => {
        if (!canvasRef.current || isInitialized.current) { return; }
        console.log("DEBUG: initThreeScene START (EffectComposer + S/B/C)");
        try {
            const canvas = canvasRef.current; const initialWidth = canvas.clientWidth || 640; const initialHeight = canvas.clientHeight || 480;
            rendererInstanceRef.current = new THREE.WebGLRenderer({ canvas: canvas, antialias: true }); rendererInstanceRef.current.setSize(initialWidth, initialHeight); rendererInstanceRef.current.setPixelRatio(window.devicePixelRatio); rendererInstanceRef.current.outputColorSpace = THREE.SRGBColorSpace;

            baseSceneRef.current = new THREE.Scene(); baseCameraRef.current = new THREE.OrthographicCamera(-initialWidth / 2, initialWidth / 2, initialHeight / 2, -initialHeight / 2, 0.1, 10); baseCameraRef.current.position.z = 1; const planeGeometry = new THREE.PlaneGeometry(1, 1); const planeMaterial = new THREE.MeshBasicMaterial({ map: null, side: THREE.DoubleSide, color: 0xffffff, transparent: true }); basePlaneMeshRef.current = new THREE.Mesh(planeGeometry, planeMaterial); baseSceneRef.current.add(basePlaneMeshRef.current);

            // Setup EffectComposer
            composerRef.current = new EffectComposer(rendererInstanceRef.current);
            // 1. RenderPass
            const renderPass = new RenderPass(baseSceneRef.current, baseCameraRef.current);
            composerRef.current.addPass(renderPass);
            // 2. ShaderPass for Adjustments & Effect
             // Use the shader definition that includes S/B/C uniforms
            const adjustmentShaderCopy = {
                 uniforms: THREE.UniformsUtils.clone(AdjustmentEffectShader.uniforms), // Use the correct shader object
                 vertexShader: AdjustmentEffectShader.vertexShader,
                 fragmentShader: AdjustmentEffectShader.fragmentShader
            };
            // Initialize uniforms from refs
            adjustmentShaderCopy.uniforms.uSaturation.value = currentSaturation.current;
            adjustmentShaderCopy.uniforms.uBrightness.value = currentBrightness.current;
            adjustmentShaderCopy.uniforms.uContrast.value = currentContrast.current;
            adjustmentShaderCopy.uniforms.uEffectIntensity.value = currentIntensity.current;

            effectPassRef.current = new ShaderPass(adjustmentShaderCopy);
            effectPassRef.current.renderToScreen = true; // Set on final pass
            composerRef.current.addPass(effectPassRef.current);
            console.log("DEBUG: EffectComposer setup complete (S/B/C + Effect Pass).");

            isInitialized.current = true; handleResize(); cancelAnimationFrame(animationFrameHandle.current); animationFrameHandle.current = requestAnimationFrame(renderLoop);
        } catch (error) { console.error("DEBUG: initThreeScene FAILED:", error); isInitialized.current = false; }
    // Add AdjustmentEffectShader definition to dependencies
    }, [handleResize, renderLoop, AdjustmentEffectShader]);


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