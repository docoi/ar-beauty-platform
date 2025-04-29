// src/components/TryOnRenderer.jsx - Separate S/B/C and Effect Shader Passes

import React, { useRef, forwardRef, useEffect, useCallback } from 'react';
import * as THREE from 'three';
// Import necessary EffectComposer passes
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
// Import UniformsUtils for cloning
import { UniformsUtils } from 'three';

// --- ***** TUNE THESE VALUES to match HTML Preview ***** ---
const TARGET_PREVIEW_SATURATION = 0.85;
const TARGET_PREVIEW_BRIGHTNESS = 1.0;
const TARGET_PREVIEW_CONTRAST = 0.95;
// --- *************************************************** ---


const TryOnRenderer = forwardRef(({
    videoRefProp, imageElement,
    mediaPipeResults, segmentationResults, isStatic, brightness, contrast, effectIntensity,
    className, style
 }, ref) => {

    // --- Core Refs / Internal State Refs ---
    const canvasRef = useRef(null); const rendererInstanceRef = useRef(null); const animationFrameHandle = useRef(null); const isInitialized = useRef(false);
    const baseSceneRef = useRef(null); const baseCameraRef = useRef(null); const basePlaneMeshRef = useRef(null); const videoTextureRef = useRef(null);
    const imageTextureRef = useRef(null); const segmentationTextureRef = useRef(null);
    const composerRef = useRef(null);
    // Refs for BOTH shader passes
    const sbcPassRef = useRef(null); // For S/B/C pass
    const effectPassRef = useRef(null); // For Masked Effect pass
    // Refs for adjustment values
    const currentSaturation = useRef(TARGET_PREVIEW_SATURATION);
    const currentBrightness = useRef(TARGET_PREVIEW_BRIGHTNESS);
    const currentContrast = useRef(TARGET_PREVIEW_CONTRAST);
    const currentIntensity = useRef(0.5);
    const renderLoopCounter = useRef(0); const lastMaskUpdateTime = useRef(0);


    // --- ***** Shaders Definitions ***** ---

    // Basic Vertex Shader (used by both passes)
    const postVertexShader = `varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 ); }`;

    // 1. S/B/C Adjustment Shader
    const SBCFragmentShader = `
        uniform sampler2D tDiffuse; // Input from RenderPass
        uniform float uSaturation;
        uniform float uBrightness;
        uniform float uContrast;
        varying vec2 vUv;

        // HSL Functions (Condensed)
        vec3 r2h(vec3 c){float x=max(c.r,max(c.g,c.b));float n=min(c.r,min(c.g,c.b));float d=x-n;float H=0.;float S=0.;float L=(x+n)/2.;if(d>0.){S=(L<.5)?(d/(x+n)):(d/(2.-x-n));if(c.r==x)H=(c.g-c.b)/d;else if(c.g==x)H=2.+(c.b-c.r)/d;else H=4.+(c.r-c.g)/d;H/=6.;if(H<0.)H+=1.;}return vec3(H,S,L);}
        float h2r(float p,float q,float t){if(t<0.)t+=1.;if(t>1.)t-=1.;if(t<1./6.)return p+(q-p)*6.*t;if(t<1./2.)return q;if(t<2./3.)return p+(q-p)*(2./3.-t)*6.;return p;}
        vec3 h2r(vec3 hsl){float H=hsl.x;float S=hsl.y;float L=hsl.z;vec3 rgb=vec3(L);if(S>0.){float q=(L<.5)?(L*(1.+S)):(L+S-L*S);float p=2.*L-q;rgb.r=h2r(p,q,H+1./3.);rgb.g=h2r(p,q,H);rgb.b=h2r(p,q,H-1./3.);}return rgb;}
        // BC Function
        vec3 applyBC(vec3 c, float b, float co){co=max(0.01,co);c=c*b;c=(c-0.5)*co+0.5;return c;}

        void main() {
            vec4 base = texture2D(tDiffuse, vUv);
            vec3 hsl = r2h(base.rgb);
            hsl.y *= uSaturation; // Adjust Saturation
            vec3 sat = h2r(hsl);
            vec3 final = applyBC(sat, uBrightness, uContrast); // Adjust B/C
            gl_FragColor = vec4(clamp(final, 0.0, 1.0), base.a);
        }
    `;

    // 2. Masked Hydration Effect Shader
    const EffectFragmentShader = `
        uniform sampler2D tDiffuse; // Input from SBC Pass
        uniform sampler2D uSegmentationMask;
        uniform float uEffectIntensity;
        uniform bool uHasMask;
        varying vec2 vUv;

        vec3 applyHydration(vec3 c){ return c * (1.0 + 0.1); } // Subtle effect

        void main() {
            vec4 base = texture2D(tDiffuse, vUv); // Base is already S/B/C adjusted
            vec3 final = base.rgb;
            if (uHasMask && uEffectIntensity > 0.0) {
                float mask = texture2D(uSegmentationMask, vec2(vUv.x, 1.0 - vUv.y)).r; // Flip Y
                vec3 effect = applyHydration(final);
                float blend = smoothstep(0.3, 0.8, mask) * uEffectIntensity;
                final = mix(final, effect, blend);
            }
            gl_FragColor = vec4(clamp(final, 0.0, 1.0), base.a);
        }
    `;

    // Define Shader Objects for ShaderPass
    const SBCShader = {
        uniforms: { 'tDiffuse': { value: null }, 'uSaturation': { value: TARGET_PREVIEW_SATURATION }, 'uBrightness': { value: TARGET_PREVIEW_BRIGHTNESS }, 'uContrast': { value: TARGET_PREVIEW_CONTRAST } },
        vertexShader: postVertexShader, fragmentShader: SBCFragmentShader
    };
    const EffectShader = {
        uniforms: { 'tDiffuse': { value: null }, 'uSegmentationMask': { value: null }, 'uEffectIntensity': { value: 0.5 }, 'uHasMask': { value: false } },
        vertexShader: postVertexShader, fragmentShader: EffectFragmentShader
    };
    // --- *********************************** ---


    // --- Prop Effects --- (Set initial adjustment refs, update intensity ref)
    useEffect(() => {
        currentSaturation.current = TARGET_PREVIEW_SATURATION; currentBrightness.current = TARGET_PREVIEW_BRIGHTNESS; currentContrast.current = TARGET_PREVIEW_CONTRAST;
        console.log(`TryOnRenderer Effect: Initial S/B/C targets set`);
        if (sbcPassRef.current) { /* Update uniforms if pass exists */ sbcPassRef.current.uniforms.uSaturation.value=currentSaturation.current; sbcPassRef.current.uniforms.uBrightness.value=currentBrightness.current; sbcPassRef.current.uniforms.uContrast.value=currentContrast.current;}
    }, []);
    useEffect(() => {
        currentIntensity.current = effectIntensity;
        if (effectPassRef.current) { effectPassRef.current.uniforms.uEffectIntensity.value = currentIntensity.current; }
     }, [effectIntensity]);


    // --- Video/Image Texture Effects / Mask Effect --- (No changes needed)
    useEffect(() => { /* Video */ }, [isStatic, videoRefProp]);
    useEffect(() => { /* Image */ }, [isStatic, imageElement]);
    useEffect(() => { /* Mask */ }, [segmentationResults, isStatic]);

    // --- Handle Resizing / Scale Plane --- (No changes needed)
    const handleResize = useCallback(() => { /* ... */ }, []);
    const fitPlaneToCamera = useCallback((textureWidth, textureHeight) => { /* ... */ }, []);


    // --- Render Loop (Update uniforms for both passes) ---
     const renderLoop = useCallback(() => {
        animationFrameHandle.current = requestAnimationFrame(renderLoop);
        if (!isInitialized.current || !rendererInstanceRef.current || !composerRef.current || !basePlaneMeshRef.current || !sbcPassRef.current || !effectPassRef.current) { return; } // Check all refs

        try {
            // 1 & 2: Select Texture & Update Plane (Condensed)
            /* ... */ const baseMaterial=basePlaneMeshRef.current.material; let sourceWidth=0,sourceHeight=0,textureToAssign=null,isVideo=false; if(!isStatic&&videoTextureRef.current){/*...*/}else if(isStatic&&imageTextureRef.current){/*...*/} if(baseMaterial){/*...*/} const planeVisible=!!baseMaterial?.map&&sourceWidth>0&&sourceHeight>0; if(planeVisible){fitPlaneToCamera(sourceWidth,sourceHeight);const scaleX=Math.abs(basePlaneMeshRef.current.scale.x);const newScaleX=isVideo?-scaleX:scaleX;if(basePlaneMeshRef.current.scale.x!==newScaleX){basePlaneMeshRef.current.scale.x=newScaleX;}}else{if(basePlaneMeshRef.current?.scale.x!==0||basePlaneMeshRef.current?.scale.y!==0){basePlaneMeshRef.current?.scale.set(0,0,0);}} if(planeVisible&&textureToAssign?.needsUpdate){textureToAssign.needsUpdate=false;}

            // Update ShaderPass Uniforms
            // Pass 1 (SBC)
            sbcPassRef.current.uniforms.uSaturation.value = currentSaturation.current;
            sbcPassRef.current.uniforms.uBrightness.value = currentBrightness.current;
            sbcPassRef.current.uniforms.uContrast.value = currentContrast.current;
            // Pass 2 (Effect)
            effectPassRef.current.uniforms.uSegmentationMask.value = segmentationTextureRef.current;
            effectPassRef.current.uniforms.uHasMask.value = !!segmentationTextureRef.current;
            // Intensity is updated via useEffect

            // Render using the Composer
            composerRef.current.render();

        } catch (error) { console.error("Error in renderLoop:", error); }
    }, [fitPlaneToCamera, isStatic]);


    // --- Initialize Scene (Setup TWO ShaderPasses) ---
    const initThreeScene = useCallback(() => {
        if (!canvasRef.current || isInitialized.current) { return; }
        console.log("DEBUG: initThreeScene START (EffectComposer - Separate Passes)");
        try {
            const canvas = canvasRef.current; const initialWidth = canvas.clientWidth || 640; const initialHeight = canvas.clientHeight || 480;
            rendererInstanceRef.current = new THREE.WebGLRenderer({ canvas: canvas, antialias: true }); rendererInstanceRef.current.setSize(initialWidth, initialHeight); rendererInstanceRef.current.setPixelRatio(window.devicePixelRatio); rendererInstanceRef.current.outputColorSpace = THREE.SRGBColorSpace;
            baseSceneRef.current = new THREE.Scene(); baseCameraRef.current = new THREE.OrthographicCamera(-initialWidth / 2, initialWidth / 2, initialHeight / 2, -initialHeight / 2, 0.1, 10); baseCameraRef.current.position.z = 1; const planeGeometry = new THREE.PlaneGeometry(1, 1); const planeMaterial = new THREE.MeshBasicMaterial({ map: null, side: THREE.DoubleSide, color: 0xffffff, transparent: true }); basePlaneMeshRef.current = new THREE.Mesh(planeGeometry, planeMaterial); baseSceneRef.current.add(basePlaneMeshRef.current);

            // Setup EffectComposer
            composerRef.current = new EffectComposer(rendererInstanceRef.current);
            // 1. RenderPass (renders base scene to internal buffer)
            const renderPass = new RenderPass(baseSceneRef.current, baseCameraRef.current);
            composerRef.current.addPass(renderPass);

            // 2. S/B/C Adjustment Pass
            const sbcShaderCopy = { uniforms: UniformsUtils.clone(SBCShader.uniforms), vertexShader: SBCShader.vertexShader, fragmentShader: SBCShader.fragmentShader };
            sbcShaderCopy.uniforms.uSaturation.value = currentSaturation.current; sbcShaderCopy.uniforms.uBrightness.value = currentBrightness.current; sbcShaderCopy.uniforms.uContrast.value = currentContrast.current;
            sbcPassRef.current = new ShaderPass(sbcShaderCopy);
            // sbcPassRef.current.renderToScreen = false; // Default - Pass output to next pass
            composerRef.current.addPass(sbcPassRef.current);
            console.log("DEBUG: SBC Pass ADDED.");

            // 3. Masked Effect Pass
            const effectShaderCopy = { uniforms: UniformsUtils.clone(EffectShader.uniforms), vertexShader: EffectShader.vertexShader, fragmentShader: EffectShader.fragmentShader };
            effectShaderCopy.uniforms.uEffectIntensity.value = currentIntensity.current;
            effectPassRef.current = new ShaderPass(effectShaderCopy);
            effectPassRef.current.renderToScreen = true; // <<< FINAL pass renders to screen
            composerRef.current.addPass(effectPassRef.current);
            console.log("DEBUG: Effect Pass ADDED.");

            console.log("DEBUG: EffectComposer setup complete (Separate Passes).");

            isInitialized.current = true; handleResize(); cancelAnimationFrame(animationFrameHandle.current); animationFrameHandle.current = requestAnimationFrame(renderLoop);
        } catch (error) { console.error("DEBUG: initThreeScene FAILED:", error); isInitialized.current = false; }
    // Add shader definitions to dependencies
    }, [handleResize, renderLoop, SBCShader, EffectShader]);


    // --- Setup / Cleanup Effect ---
    useEffect(() => { initThreeScene(); let resizeObserver; const currentCanvas = canvasRef.current; if (currentCanvas) { resizeObserver = new ResizeObserver(() => { handleResize(); }); resizeObserver.observe(currentCanvas); } return () => { /* ... Full cleanup ... */ }; }, [initThreeScene, handleResize]);


    // --- JSX --- (No change)
    return ( <canvas ref={canvasRef} className={`renderer-canvas ${className || ''}`} style={{ display: 'block', width: '100%', height: '100%', ...(style || {}) }} /> );

});
TryOnRenderer.displayName = 'TryOnRenderer';
export default TryOnRenderer;