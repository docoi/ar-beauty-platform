// src/components/TryOnRenderer.jsx - Saturation Adjustment ONLY (to match preview)

import React, { useRef, forwardRef, useEffect, useCallback } from 'react';
import * as THREE from 'three';

// --- Target value for saturation adjustment ---
// Start with a noticeable reduction. ADJUST THIS VALUE based on visual feedback.
const TARGET_PREVIEW_SATURATION = 0.8; // e.g., 0.8 = 80% of original saturation
// ---------------------------------------------

const TryOnRenderer = forwardRef(({
    videoRefProp, imageElement,
    // Unused props in this specific step:
    mediaPipeResults, segmentationResults, isStatic, brightness, contrast, effectIntensity,
    className, style
 }, ref) => {

    // --- Core Refs / Internal State Refs ---
    const canvasRef = useRef(null); const rendererInstanceRef = useRef(null); const animationFrameHandle = useRef(null); const isInitialized = useRef(false);
    const baseSceneRef = useRef(null); const baseCameraRef = useRef(null); const basePlaneMeshRef = useRef(null); const videoTextureRef = useRef(null);
    const imageTextureRef = useRef(null); const postSceneRef = useRef(null); const postCameraRef = useRef(null); const postMaterialRef = useRef(null);
    const renderTargetRef = useRef(null);
    // Keep segmentationTextureRef only because the effect hook might still create it
    const segmentationTextureRef = useRef(null);
    // Add ref for saturation
    const currentSaturation = useRef(TARGET_PREVIEW_SATURATION);
    const renderLoopCounter = useRef(0); const lastMaskUpdateTime = useRef(0); // Mask update time still relevant for mask effect hook


    // --- ***** Shaders (Saturation Adjustment ONLY) ***** ---
    const postVertexShader = `varying vec2 vUv; void main() { vUv = uv; gl_Position = vec4(position, 1.0); }`;
    const postFragmentShader = `
        uniform sampler2D uSceneTexture;
        // Only Saturation uniform needed
        uniform float uSaturation;
        // Removed: uBrightness, uContrast, uSegmentationMask, uEffectIntensity, uHasMask

        varying vec2 vUv;

        // --- RGB <-> HSL Conversion Functions ---
        vec3 rgb2hsl(vec3 color) { float maxC=max(color.r,max(color.g,color.b)); float minC=min(color.r,min(color.g,color.b)); float delta=maxC-minC; float H=0.0; float S=0.0; float L=(maxC+minC)/2.0; if(delta>0.0){ S = (L<0.5)?(delta/(maxC+minC)):(delta/(2.0-maxC-minC)); if(color.r==maxC){H=(color.g-color.b)/delta;}else if(color.g==maxC){H=2.0+(color.b-color.r)/delta;}else{H=4.0+(color.r-color.g)/delta;} H/=6.0; if(H<0.0){H+=1.0;} } return vec3(H,S,L); }
        float hue2rgb(float p,float q,float t){ if(t<0.0)t+=1.0; if(t>1.0)t-=1.0; if(t<1.0/6.0)return p+(q-p)*6.0*t; if(t<1.0/2.0)return q; if(t<2.0/3.0)return p+(q-p)*(2.0/3.0-t)*6.0; return p; }
        vec3 hsl2rgb(vec3 hsl) { float H=hsl.x; float S=hsl.y; float L=hsl.z; vec3 rgb=vec3(L); if(S>0.0){ float q=(L<0.5)?(L*(1.0+S)):(L+S-L*S); float p=2.0*L-q; rgb.r=hue2rgb(p,q,H+1.0/3.0); rgb.g=hue2rgb(p,q,H); rgb.b=hue2rgb(p,q,H-1.0/3.0); } return rgb; }
        // --- End HSL Functions ---

        void main() {
            vec4 baseColor = texture2D(uSceneTexture, vUv);

            // Adjust Saturation
            vec3 hslColor = rgb2hsl(baseColor.rgb);
            hslColor.y *= uSaturation; // Multiply Saturation component
            vec3 finalColor = hsl2rgb(hslColor);

            // Output adjusted color
            finalColor = clamp(finalColor, 0.0, 1.0);
            gl_FragColor = vec4(finalColor, baseColor.a);
        }
    `;
    // --- ********************************************************** ---

    // --- Prop Effects --- (Only Saturation needed)
    useEffect(() => {
        currentSaturation.current = TARGET_PREVIEW_SATURATION;
        console.log(`TryOnRenderer Effect: Set Saturation target (${currentSaturation.current})`);
    }, []); // Run only once

    // Remove Intensity effect for now to simplify
    // useEffect(() => { currentIntensity.current = effectIntensity; }, [effectIntensity]);

    // --- Video/Image Texture Effects / Mask Effect --- (Keep these running)
    useEffect(() => { /* ... Video Texture Logic ... */ }, [isStatic, videoRefProp]);
    useEffect(() => { /* ... Image Texture Logic ... */ }, [isStatic, imageElement]);
    useEffect(() => { /* ... Segmentation Mask Texture Logic (creates texture but shader doesn't use it) ... */ }, [segmentationResults, isStatic]);

    // --- Handle Resizing / Scale Plane --- (No changes needed)
    const handleResize = useCallback(() => { /* ... */ }, []);
    const fitPlaneToCamera = useCallback((textureWidth, textureHeight) => { /* ... */ }, []);

    // --- Render Loop --- (Update Saturation Uniform)
     const renderLoop = useCallback(() => {
        animationFrameHandle.current = requestAnimationFrame(renderLoop);
        if (!isInitialized.current || !rendererInstanceRef.current /* ... etc ... */ || !postMaterialRef.current) { return; }

        try {
            const postUniforms = postMaterialRef.current.uniforms;
            // Check uniforms needed by current shader
            if (!postUniforms?.uSceneTexture || !postUniforms?.uSaturation) { return; }

            // 1 & 2: Select Texture & Update Plane (Condensed)
            const baseMaterial = basePlaneMeshRef.current.material; /* ... */ let sourceWidth=0, sourceHeight=0, textureToAssign=null, isVideo=false; if(!isStatic && videoTextureRef.current){textureToAssign=videoTextureRef.current; isVideo=true; if(textureToAssign.image){sourceWidth=textureToAssign.image.videoWidth; sourceHeight=textureToAssign.image.videoHeight;}} else if(isStatic && imageTextureRef.current){textureToAssign=imageTextureRef.current; if(textureToAssign.image){sourceWidth=textureToAssign.image.naturalWidth; sourceHeight=textureToAssign.image.naturalHeight;} if(textureToAssign.needsUpdate){textureToAssign.needsUpdate=true;}} if(baseMaterial){if(baseMaterial.map !== textureToAssign){baseMaterial.map=textureToAssign; baseMaterial.needsUpdate=true;}else if(textureToAssign && textureToAssign.needsUpdate){baseMaterial.needsUpdate=true;}} const planeVisible = !!baseMaterial?.map && sourceWidth > 0 && sourceHeight > 0; if(planeVisible){fitPlaneToCamera(sourceWidth,sourceHeight); const scaleX=Math.abs(basePlaneMeshRef.current.scale.x); const newScaleX=isVideo?-scaleX:scaleX; if(basePlaneMeshRef.current.scale.x !== newScaleX){basePlaneMeshRef.current.scale.x=newScaleX;}}else{if(basePlaneMeshRef.current?.scale.x !== 0 || basePlaneMeshRef.current?.scale.y !== 0){basePlaneMeshRef.current?.scale.set(0,0,0);}}

            // 3. Render Base Scene to Target
            rendererInstanceRef.current.setRenderTarget(renderTargetRef.current);
            rendererInstanceRef.current.setClearColor(0x000000, 0); rendererInstanceRef.current.clear();
             if (planeVisible) { rendererInstanceRef.current.render(baseSceneRef.current, baseCameraRef.current); if (textureToAssign?.needsUpdate) { textureToAssign.needsUpdate = false; } }

            // 4. Unbind Render Target
             rendererInstanceRef.current.setRenderTarget(null);

            // 5. Update Post-Processing Uniforms (SceneTexture + Saturation)
             postUniforms.uSceneTexture.value = renderTargetRef.current.texture;
             postUniforms.uSaturation.value = currentSaturation.current; // <<< Update Saturation

            // 6. Render Post-Processing Scene to Screen
             rendererInstanceRef.current.render(postSceneRef.current, postCameraRef.current);

        } catch (error) { console.error("Error in renderLoop:", error); }
    }, [fitPlaneToCamera, isStatic]);


    // --- Initialize Scene --- (Add Saturation Uniform Only)
    const initThreeScene = useCallback(() => {
        if (!canvasRef.current || isInitialized.current) return;
        console.log("DEBUG: initThreeScene START (Saturation Adjustment Only)");
        try {
            // Renderer, Render Target, Base Scene, Post Scene setup
             const canvas = canvasRef.current; const initialWidth = canvas.clientWidth || 640; const initialHeight = canvas.clientHeight || 480;
            rendererInstanceRef.current = new THREE.WebGLRenderer({ canvas: canvas, antialias: true }); rendererInstanceRef.current.setSize(initialWidth, initialHeight); rendererInstanceRef.current.setPixelRatio(window.devicePixelRatio); rendererInstanceRef.current.outputColorSpace = THREE.SRGBColorSpace;
            renderTargetRef.current = new THREE.WebGLRenderTarget(initialWidth, initialHeight, { minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, format: THREE.RGBAFormat, colorSpace: THREE.SRGBColorSpace, depthBuffer: true, stencilBuffer: true });
            renderTargetRef.current.texture.generateMipmaps = false; renderTargetRef.current.texture.minFilter = THREE.LinearFilter; renderTargetRef.current.texture.magFilter = THREE.LinearFilter;
            baseSceneRef.current = new THREE.Scene(); baseCameraRef.current = new THREE.OrthographicCamera(-initialWidth / 2, initialWidth / 2, initialHeight / 2, -initialHeight / 2, 0.1, 10); baseCameraRef.current.position.z = 1; const planeGeometry = new THREE.PlaneGeometry(1, 1); const planeMaterial = new THREE.MeshBasicMaterial({ map: null, side: THREE.DoubleSide, color: 0xffffff, transparent: true }); basePlaneMeshRef.current = new THREE.Mesh(planeGeometry, planeMaterial); baseSceneRef.current.add(basePlaneMeshRef.current);
            postSceneRef.current = new THREE.Scene(); postCameraRef.current = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1); const postPlaneGeometry = new THREE.PlaneGeometry(2, 2);

            // Initialize Material with Saturation Uniform
            postMaterialRef.current = new THREE.ShaderMaterial({
                vertexShader: postVertexShader,
                fragmentShader: postFragmentShader, // Use saturation shader
                uniforms: {
                    uSceneTexture: { value: renderTargetRef.current.texture },
                    uSaturation: { value: currentSaturation.current }, // <<< Add Saturation
                    // Define others so they exist for cleanup/future, but shader won't use them
                    uSegmentationMask: { value: null },
                    uEffectIntensity: { value: 0.5 }, // Use default intensity ref value
                    uHasMask: { value: false },
                    uBrightness: { value: 1.0 },
                    uContrast: { value: 1.0 },
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
        return () => { /* ... Full cleanup ... */ }; // Keep full cleanup logic
     }, [initThreeScene, handleResize]);


    // --- JSX --- (No change)
    return ( <canvas ref={canvasRef} className={`renderer-canvas ${className || ''}`} style={{ display: 'block', width: '100%', height: '100%', ...(style || {}) }} /> );

});
TryOnRenderer.displayName = 'TryOnRenderer';
export default TryOnRenderer;