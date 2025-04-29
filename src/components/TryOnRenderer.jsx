// src/components/TryOnRenderer.jsx - Saturation, Brightness & Contrast Adjustment

import React, { useRef, forwardRef, useEffect, useCallback } from 'react';
import * as THREE from 'three';

// --- Target values for adjustments - TWEAK THESE VALUES ---
const TARGET_PREVIEW_SATURATION = 0.85; // e.g., 0.85 = 85% saturation
const TARGET_PREVIEW_BRIGHTNESS = 1.0;  // e.g., 1.0 = no change, >1 brighter, <1 darker
const TARGET_PREVIEW_CONTRAST = 0.95; // e.g., 1.0 = no change, >1 more contrast, <1 less contrast
// ----------------------------------------------------------

const TryOnRenderer = forwardRef(({
    videoRefProp, imageElement,
    // Unused props in this specific step:
    mediaPipeResults, segmentationResults, isStatic,
    // B/C props are received but OVERRIDDEN by hardcoded values below
    brightness, contrast,
    effectIntensity, // Still received, effect logic is commented out in shader
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


    // --- ***** Shaders (Saturation + Brightness + Contrast) ***** ---
    const postVertexShader = `varying vec2 vUv; void main() { vUv = uv; gl_Position = vec4(position, 1.0); }`;
    const postFragmentShader = `
        uniform sampler2D uSceneTexture;
        // Add all adjustment uniforms
        uniform float uSaturation;
        uniform float uBrightness;
        uniform float uContrast;
        // Keep effect uniforms defined even if effect is commented out
        uniform sampler2D uSegmentationMask;
        uniform float uEffectIntensity;
        uniform bool uHasMask;

        varying vec2 vUv;

        // --- RGB <-> HSL Functions ---
        vec3 rgb2hsl(vec3 c){float maxC=max(c.r,max(c.g,c.b));float minC=min(c.r,min(c.g,c.b));float d=maxC-minC;float H=0.0;float S=0.0;float L=(maxC+minC)/2.0;if(d>0.0){S=(L<0.5)?(d/(maxC+minC)):(d/(2.0-maxC-minC));if(c.r==maxC)H=(c.g-c.b)/d;else if(c.g==maxC)H=2.0+(c.b-c.r)/d;else H=4.0+(c.r-c.g)/d;H/=6.0;if(H<0.0)H+=1.0;}return vec3(H,S,L);}
        float hue2rgb(float p,float q,float t){if(t<0.0)t+=1.0;if(t>1.0)t-=1.0;if(t<1.0/6.0)return p+(q-p)*6.0*t;if(t<1.0/2.0)return q;if(t<2.0/3.0)return p+(q-p)*(2.0/3.0-t)*6.0;return p;}
        vec3 hsl2rgb(vec3 hsl){float H=hsl.x;float S=hsl.y;float L=hsl.z;vec3 rgb=vec3(L);if(S>0.0){float q=(L<0.5)?(L*(1.0+S)):(L+S-L*S);float p=2.0*L-q;rgb.r=hue2rgb(p,q,H+1.0/3.0);rgb.g=hue2rgb(p,q,H);rgb.b=hue2rgb(p,q,H-1.0/3.0);}return rgb;}
        // --- End HSL Functions ---

        // Function to apply brightness and contrast
        vec3 applyBrightnessContrast(vec3 color, float brightness, float contrast) {
            color = color * brightness;
            color = (color - 0.5) * contrast + 0.5;
            return color;
        }

        // Effect function (still defined but not actively called in main logic below)
        vec3 applyHydrationEffect(vec3 color) {
             vec3 hydratedLook = color * (1.0 + 0.1);
             return hydratedLook;
        }

        void main() {
            vec4 baseColor = texture2D(uSceneTexture, vUv);

            // 1. Adjust Saturation
            vec3 hslColor = rgb2hsl(baseColor.rgb);
            hslColor.y *= uSaturation; // Adjust Saturation
            vec3 satAdjustedColor = hsl2rgb(hslColor);

            // 2. Adjust Brightness & Contrast on the saturation-adjusted color
            vec3 finalColor = applyBrightnessContrast(satAdjustedColor, uBrightness, uContrast);


            // --- Hydration Effect Logic (Currently Disabled for Adjustment Phase) ---
            /*
            if (uHasMask && uEffectIntensity > 0.0) {
                float maskValue = texture2D(uSegmentationMask, vec2(vUv.x, 1.0 - vUv.y)).r; // Flip Y
                vec3 hydratedColor = applyHydrationEffect(finalColor); // Apply effect AFTER B/C/S adjustments
                float blendAmount = smoothstep(0.3, 0.8, maskValue) * uEffectIntensity;
                finalColor = mix(finalColor, hydratedColor, blendAmount);
            }
            */
            // --- End Effect Logic ---


            finalColor = clamp(finalColor, 0.0, 1.0);
            gl_FragColor = vec4(finalColor, baseColor.a);
        }
    `;
    // --- ********************************************************** ---

    // --- Prop Effects --- (Set all three adjustment refs)
    useEffect(() => {
        // Set current refs to the target values for matching preview
        currentSaturation.current = TARGET_PREVIEW_SATURATION;
        currentBrightness.current = TARGET_PREVIEW_BRIGHTNESS;
        currentContrast.current = TARGET_PREVIEW_CONTRAST;
        console.log(`TryOnRenderer Effect: Set S/B/C targets (${currentSaturation.current.toFixed(2)}, ${currentBrightness.current.toFixed(2)}, ${currentContrast.current.toFixed(2)})`);
    // Run once on mount, or potentially depend on props if they were used later
    }, []); // Run once to set initial targets

    useEffect(() => { currentIntensity.current = effectIntensity; }, [effectIntensity]);


    // --- Video/Image Texture Effects / Mask Effect --- (No changes needed)
    useEffect(() => { /* ... Video Texture Logic ... */ }, [isStatic, videoRefProp]);
    useEffect(() => { /* ... Image Texture Logic ... */ }, [isStatic, imageElement]);
    useEffect(() => { /* ... Segmentation Mask Texture Logic ... */ }, [segmentationResults, isStatic]);

    // --- Handle Resizing / Scale Plane --- (No changes needed)
    const handleResize = useCallback(() => { /* ... */ }, []);
    const fitPlaneToCamera = useCallback((textureWidth, textureHeight) => { /* ... */ }, []);

    // --- Render Loop --- (Update All Adjustment Uniforms)
     const renderLoop = useCallback(() => {
        animationFrameHandle.current = requestAnimationFrame(renderLoop);
        if (!isInitialized.current || !rendererInstanceRef.current /* ... etc ... */ || !postMaterialRef.current) { return; }

        try {
            const postUniforms = postMaterialRef.current.uniforms;
            // Check all uniforms needed by this shader (even if effect part is commented out)
            if (!postUniforms?.uSceneTexture || !postUniforms?.uSaturation || !postUniforms?.uBrightness || !postUniforms?.uContrast || !postUniforms?.uSegmentationMask || !postUniforms?.uHasMask || !postUniforms?.uEffectIntensity) { return; }

            // 1 & 2: Select Texture & Update Plane (Condensed)
            const baseMaterial = basePlaneMeshRef.current.material; /* ... */ let sourceWidth=0, sourceHeight=0, textureToAssign=null, isVideo=false; if(!isStatic && videoTextureRef.current){textureToAssign=videoTextureRef.current; isVideo=true; if(textureToAssign.image){sourceWidth=textureToAssign.image.videoWidth; sourceHeight=textureToAssign.image.videoHeight;}} else if(isStatic && imageTextureRef.current){textureToAssign=imageTextureRef.current; if(textureToAssign.image){sourceWidth=textureToAssign.image.naturalWidth; sourceHeight=textureToAssign.image.naturalHeight;} if(textureToAssign.needsUpdate){textureToAssign.needsUpdate=true;}} if(baseMaterial){if(baseMaterial.map !== textureToAssign){baseMaterial.map=textureToAssign; baseMaterial.needsUpdate=true;}else if(textureToAssign && textureToAssign.needsUpdate){baseMaterial.needsUpdate=true;}} const planeVisible = !!baseMaterial?.map && sourceWidth > 0 && sourceHeight > 0; if(planeVisible){fitPlaneToCamera(sourceWidth,sourceHeight); const scaleX=Math.abs(basePlaneMeshRef.current.scale.x); const newScaleX=isVideo?-scaleX:scaleX; if(basePlaneMeshRef.current.scale.x !== newScaleX){basePlaneMeshRef.current.scale.x=newScaleX;}}else{if(basePlaneMeshRef.current?.scale.x !== 0 || basePlaneMeshRef.current?.scale.y !== 0){basePlaneMeshRef.current?.scale.set(0,0,0);}}

            // 3. Render Base Scene to Target
            rendererInstanceRef.current.setRenderTarget(renderTargetRef.current);
            rendererInstanceRef.current.setClearColor(0x000000, 0); rendererInstanceRef.current.clear();
             if (planeVisible && baseSceneRef.current && baseCameraRef.current) { rendererInstanceRef.current.render(baseSceneRef.current, baseCameraRef.current); if (textureToAssign?.needsUpdate) { textureToAssign.needsUpdate = false; } }

            // 4. Unbind Render Target
             rendererInstanceRef.current.setRenderTarget(null);

            // 5. Update Post-Processing Uniforms (SceneTexture + S/B/C + Mask/Effect)
             postUniforms.uSceneTexture.value = renderTargetRef.current.texture;
             postUniforms.uSaturation.value = currentSaturation.current; // <<< Update Saturation
             postUniforms.uBrightness.value = currentBrightness.current; // <<< Update Brightness
             postUniforms.uContrast.value = currentContrast.current;     // <<< Update Contrast
             postUniforms.uSegmentationMask.value = segmentationTextureRef.current;
             const hasMask = !!segmentationTextureRef.current;
             postUniforms.uHasMask.value = hasMask;
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
                fragmentShader: postFragmentShader, // Use saturation+B/C shader
                uniforms: {
                    uSceneTexture: { value: renderTargetRef.current.texture },
                    uSaturation: { value: currentSaturation.current }, // <<< Add Saturation
                    uBrightness: { value: currentBrightness.current }, // <<< Add Brightness
                    uContrast: { value: currentContrast.current },     // <<< Add Contrast
                    // Keep effect uniforms defined
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
    }, [handleResize, postVertexShader, postFragmentShader, renderLoop]);


    // --- Setup / Cleanup Effect --- (Full cleanup)
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