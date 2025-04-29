// src/components/TryOnRenderer.jsx - Post-Processing with Masked Effect ONLY (No S/B/C)

import React, { useRef, forwardRef, useEffect, useCallback } from 'react';
import * as THREE from 'three';

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

    // --- Core Refs / Internal State Refs --- (Restore Post-Processing Refs)
    const canvasRef = useRef(null); const rendererInstanceRef = useRef(null); const animationFrameHandle = useRef(null); const isInitialized = useRef(false);
    const baseSceneRef = useRef(null); const baseCameraRef = useRef(null); const basePlaneMeshRef = useRef(null); const videoTextureRef = useRef(null);
    const imageTextureRef = useRef(null); const postSceneRef = useRef(null); const postCameraRef = useRef(null); const postMaterialRef = useRef(null);
    const renderTargetRef = useRef(null); const segmentationTextureRef = useRef(null);
    // Only Intensity Ref needed now
    const currentIntensity = useRef(0.5);
    const renderLoopCounter = useRef(0); const lastMaskUpdateTime = useRef(0);


    // --- Shaders (Subtle Effect + Mask Flip, NO S/B/C) ---
    const postVertexShader = `varying vec2 vUv; void main() { vUv = uv; gl_Position = vec4(position, 1.0); }`;
    const postFragmentShader = `
        uniform sampler2D uSceneTexture;       // Base image from render target
        uniform sampler2D uSegmentationMask; // Mask texture
        uniform float uEffectIntensity;      // Slider value (0.0 to 1.0)
        uniform bool uHasMask;               // Flag indicating if mask is available
        // No S/B/C uniforms

        varying vec2 vUv;

        // Subtle "Hydration" effect function
        vec3 applyHydrationEffect(vec3 color) {
             vec3 hydratedLook = color * (1.0 + 0.1); // 10% brighter base for effect
             // hydratedLook = mix(hydratedLook, vec3(1.0), 0.05); // Optional slight desaturation
             return hydratedLook;
        }

        void main() {
            vec4 baseColor = texture2D(uSceneTexture, vUv);
            vec3 finalColor = baseColor.rgb; // Start directly with the base color

            // Apply Serum Effect based on Mask and Intensity
            if (uHasMask && uEffectIntensity > 0.0) {
                // Flip the Y coordinate for mask sampling
                float maskValue = texture2D(uSegmentationMask, vec2(vUv.x, 1.0 - vUv.y)).r;

                vec3 hydratedColor = applyHydrationEffect(finalColor); // Apply effect

                // Blend based on mask value and intensity slider
                float blendAmount = smoothstep(0.3, 0.8, maskValue) * uEffectIntensity;
                finalColor = mix(finalColor, hydratedColor, blendAmount);
            }

            finalColor = clamp(finalColor, 0.0, 1.0);
            gl_FragColor = vec4(finalColor, baseColor.a);
        }
    `;


    // --- Prop Effects --- (Only Intensity)
    useEffect(() => { currentIntensity.current = effectIntensity; }, [effectIntensity]);

    // --- Video/Image Texture Effects / Mask Effect --- (No changes needed)
    useEffect(() => { /* ... Video Texture Logic ... */ }, [isStatic, videoRefProp]);
    useEffect(() => { /* ... Image Texture Logic ... */ }, [isStatic, imageElement]);
    useEffect(() => { /* ... Segmentation Mask Texture Logic ... */ }, [segmentationResults, isStatic]);

    // --- Handle Resizing / Scale Plane --- (No changes needed)
    const handleResize = useCallback(() => { /* ... (Includes RT resize) ... */ }, []);
    const fitPlaneToCamera = useCallback((textureWidth, textureHeight) => { /* ... (same as before) ... */ }, []);


    // --- Render Loop --- (Update Effect Uniforms)
     const renderLoop = useCallback(() => {
        animationFrameHandle.current = requestAnimationFrame(renderLoop);
        if (!isInitialized.current || !rendererInstanceRef.current /* ... etc ... */ || !postMaterialRef.current) { return; }

        try {
            const postUniforms = postMaterialRef.current.uniforms;
            // Check uniforms needed by this shader
            if (!postUniforms?.uSceneTexture || !postUniforms?.uSegmentationMask || !postUniforms?.uHasMask || !postUniforms?.uEffectIntensity) { return; }

            // 1 & 2: Select Texture & Update Plane (Condensed)
            /* ... */ const baseMaterial=basePlaneMeshRef.current.material; let sourceWidth=0,sourceHeight=0,textureToAssign=null,isVideo=false; if(!isStatic&&videoTextureRef.current){textureToAssign=videoTextureRef.current;isVideo=true;if(textureToAssign.image){sourceWidth=textureToAssign.image.videoWidth;sourceHeight=textureToAssign.image.videoHeight;}}else if(isStatic&&imageTextureRef.current){textureToAssign=imageTextureRef.current;if(textureToAssign.image){sourceWidth=textureToAssign.image.naturalWidth;sourceHeight=textureToAssign.image.naturalHeight;}if(textureToAssign.needsUpdate){textureToAssign.needsUpdate=true;}} if(baseMaterial){if(baseMaterial.map!==textureToAssign){baseMaterial.map=textureToAssign;baseMaterial.needsUpdate=true;}else if(textureToAssign&&textureToAssign.needsUpdate){baseMaterial.needsUpdate=true;}} const planeVisible=!!baseMaterial?.map&&sourceWidth>0&&sourceHeight>0; if(planeVisible){fitPlaneToCamera(sourceWidth,sourceHeight);const scaleX=Math.abs(basePlaneMeshRef.current.scale.x);const newScaleX=isVideo?-scaleX:scaleX;if(basePlaneMeshRef.current.scale.x!==newScaleX){basePlaneMeshRef.current.scale.x=newScaleX;}}else{if(basePlaneMeshRef.current?.scale.x!==0||basePlaneMeshRef.current?.scale.y!==0){basePlaneMeshRef.current?.scale.set(0,0,0);}}

            // 3. Render Base Scene to Target
            rendererInstanceRef.current.setRenderTarget(renderTargetRef.current);
            rendererInstanceRef.current.setClearColor(0x000000, 0); rendererInstanceRef.current.clear();
             if (planeVisible && baseSceneRef.current && baseCameraRef.current) { rendererInstanceRef.current.render(baseSceneRef.current, baseCameraRef.current); if (textureToAssign?.needsUpdate) { textureToAssign.needsUpdate = false; } }

            // 4. Unbind Render Target
             rendererInstanceRef.current.setRenderTarget(null);

            // 5. Update Post-Processing Uniforms (SceneTex + Mask/Effect)
             postUniforms.uSceneTexture.value = renderTargetRef.current.texture;
             postUniforms.uSegmentationMask.value = segmentationTextureRef.current;
             const hasMask = !!segmentationTextureRef.current;
             postUniforms.uHasMask.value = hasMask;
             postUniforms.uEffectIntensity.value = currentIntensity.current;
             // No S/B/C uniforms to update

            // 6. Render Post-Processing Scene to Screen
             if(postSceneRef.current && postCameraRef.current) {
                 rendererInstanceRef.current.render(postSceneRef.current, postCameraRef.current);
             }

        } catch (error) { console.error("Error in renderLoop:", error); }
    }, [fitPlaneToCamera, isStatic]);


    // --- Initialize Scene --- (Effect Shader, No S/B/C Uniforms)
    const initThreeScene = useCallback(() => {
        if (!canvasRef.current || isInitialized.current) return;
        console.log("DEBUG: initThreeScene START (Masked Effect Only Shader)");
        try {
            // Renderer, Render Target (with mipmap fix), Base Scene, Post Scene setup
             const canvas = canvasRef.current; const initialWidth = canvas.clientWidth || 640; const initialHeight = canvas.clientHeight || 480;
            rendererInstanceRef.current = new THREE.WebGLRenderer({ canvas: canvas, antialias: true }); rendererInstanceRef.current.setSize(initialWidth, initialHeight); rendererInstanceRef.current.setPixelRatio(window.devicePixelRatio); rendererInstanceRef.current.outputColorSpace = THREE.SRGBColorSpace;
            renderTargetRef.current = new THREE.WebGLRenderTarget(initialWidth, initialHeight, { minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, format: THREE.RGBAFormat, colorSpace: THREE.SRGBColorSpace, depthBuffer: true, stencilBuffer: true });
            renderTargetRef.current.texture.generateMipmaps = false; renderTargetRef.current.texture.minFilter = THREE.LinearFilter; renderTargetRef.current.texture.magFilter = THREE.LinearFilter;
            baseSceneRef.current = new THREE.Scene(); baseCameraRef.current = new THREE.OrthographicCamera(-initialWidth / 2, initialWidth / 2, initialHeight / 2, -initialHeight / 2, 0.1, 10); baseCameraRef.current.position.z = 1; const planeGeometry = new THREE.PlaneGeometry(1, 1); const planeMaterial = new THREE.MeshBasicMaterial({ map: null, side: THREE.DoubleSide, color: 0xffffff, transparent: true }); basePlaneMeshRef.current = new THREE.Mesh(planeGeometry, planeMaterial); baseSceneRef.current.add(basePlaneMeshRef.current);
            postSceneRef.current = new THREE.Scene(); postCameraRef.current = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1); const postPlaneGeometry = new THREE.PlaneGeometry(2, 2);

            // Initialize Material with ONLY Effect Uniforms needed
            postMaterialRef.current = new THREE.ShaderMaterial({
                vertexShader: postVertexShader,
                fragmentShader: postFragmentShader, // Use effect shader
                uniforms: {
                    uSceneTexture: { value: renderTargetRef.current.texture },
                    uSegmentationMask: { value: null }, // Initialize
                    uEffectIntensity: { value: currentIntensity.current }, // Initialize
                    uHasMask: { value: false }, // Initialize
                    // Define others for cleanup safety, though unused by shader
                    uSaturation: { value: 1.0 },
                    uBrightness: { value: 1.0 },
                    uContrast: { value: 1.0 },
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