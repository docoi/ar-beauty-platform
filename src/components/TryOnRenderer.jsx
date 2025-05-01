// src/components/TryOnRenderer.jsx - FINAL onBeforeCompile APPROACH
// Uses direct material shader modification for face-constrained effect
// Based on verified stable structure from Message #309

import React, { useRef, forwardRef, useEffect, useCallback, useState } from 'react';
import * as THREE from 'three';

// Define which landmarks form the outer face contour.
const FACE_OUTLINE_INDICES = [
    10,  338, 297, 332, 284, 251, 389, 356, 454, 323, 361, 288,
    397, 365, 379, 378, 400, 377, 152, 148, 176, 149, 150, 136,
    172, 58,  132, 93,  234, 127, 162, 21,  54,  103, 67,  109
];
const MAX_FACE_POINTS = FACE_OUTLINE_INDICES.length;

const TryOnRenderer = forwardRef(({
    videoRefProp, imageElement,
    mediaPipeResults,     // <<< Used for landmarks
    segmentationResults, // <<< Used for silhouette mask
    isStatic,
    effectIntensity,
    className, style
 }, ref) => {

    // --- Core Refs ---
    const canvasRef = useRef(null); const rendererInstanceRef = useRef(null); const animationFrameHandle = useRef(null);
    const isInitialized = useRef(false); const sceneRef = useRef(null); const cameraRef = useRef(null);
    const planeMeshRef = useRef(null); const videoTextureRef = useRef(null); const imageTextureRef = useRef(null);
    const segmentationTextureRef = useRef(null);
    const faceOutlinePoints = useRef(new Array(MAX_FACE_POINTS).fill(null).map(() => new THREE.Vector2()));
    const numFacePoints = useRef(0);

    // --- State ---
    const [isMaterialReady, setIsMaterialReady] = useState(false); // To sync uniform updates

    // --- Internal Refs ---
    const renderLoopCounter = useRef(0); const lastMaskUpdateTime = useRef(0); const lastLandmarkUpdateTime = useRef(0);


    // --- Texture Management Effects ---
    // Video Texture Effect (Assigns to material.map if ready)
    useEffect(() => {
        const videoElement = videoRefProp?.current;
        const material = planeMeshRef.current?.material;

        if (!isStatic && videoElement && videoElement.readyState >= videoElement.HAVE_METADATA) {
            if (!videoTextureRef.current || videoTextureRef.current.image !== videoElement) {
                videoTextureRef.current?.dispose();
                videoTextureRef.current = new THREE.VideoTexture(videoElement);
                videoTextureRef.current.colorSpace = THREE.SRGBColorSpace;
                if (material) { // Assign only if material exists
                    material.map = videoTextureRef.current;
                    material.needsUpdate = true;
                 }
            }
        } else if (!isStatic && videoTextureRef.current) {
             if (material?.map === videoTextureRef.current) { material.map = null; material.needsUpdate = true; }
             videoTextureRef.current.dispose(); videoTextureRef.current = null;
        }
    }, [isStatic, videoRefProp, videoRefProp?.current?.readyState]);

    // Image Texture Effect (Assigns to material.map if ready)
    useEffect(() => {
        const material = planeMeshRef.current?.material;
        if (isStatic && imageElement && imageElement.complete && imageElement.naturalWidth > 0) {
             if (!imageTextureRef.current || imageTextureRef.current.image !== imageElement) {
                 imageTextureRef.current?.dispose();
                 imageTextureRef.current = new THREE.Texture(imageElement);
                 imageTextureRef.current.colorSpace = THREE.SRGBColorSpace;
                 imageTextureRef.current.needsUpdate = true;
                 if (material) { // Assign only if material exists
                     material.map = imageTextureRef.current;
                     material.needsUpdate = true;
                 }
             }
        } else if (isStatic && imageTextureRef.current) {
             if (material?.map === imageTextureRef.current) { material.map = null; material.needsUpdate = true; }
             imageTextureRef.current.dispose(); imageTextureRef.current = null;
        }
    }, [isStatic, imageElement, imageElement?.complete]);


    // --- Uniform Update Effects (Depend on isMaterialReady) ---
    // Segmentation Mask Texture Effect
    useEffect(() => {
        if (!isMaterialReady || !planeMeshRef.current?.material?.uniforms?.uSegmentationMask) return;
        const material = planeMeshRef.current.material; const results = segmentationResults; const hasMaskData = results?.confidenceMasks?.[0];
        if (hasMaskData) { const confidenceMaskObject = results.confidenceMasks[0]; const maskWidth = confidenceMaskObject?.width; const maskHeight = confidenceMaskObject?.height; let maskData = null; try { if (typeof confidenceMaskObject?.getAsFloat32Array === 'function') { maskData = confidenceMaskObject.getAsFloat32Array(); } else if (confidenceMaskObject?.data instanceof Float32Array) { maskData = confidenceMaskObject.data; } } catch (error) { maskData = null; console.error("Error getting mask data:", error); } if (maskData instanceof Float32Array && maskWidth > 0 && maskHeight > 0) { const now = performance.now(); const timeSinceLastUpdate = now - lastMaskUpdateTime.current; const throttleThreshold = isStatic ? 0 : 66; if (timeSinceLastUpdate > throttleThreshold) { lastMaskUpdateTime.current = now; try { let texture = segmentationTextureRef.current; if (!texture || texture.image.width !== maskWidth || texture.image.height !== maskHeight) { texture?.dispose(); texture = new THREE.DataTexture(maskData, maskWidth, maskHeight, THREE.RedFormat, THREE.FloatType); texture.minFilter = THREE.NearestFilter; texture.magFilter = THREE.NearestFilter; texture.generateMipmaps = false; texture.needsUpdate = true; segmentationTextureRef.current = texture; material.uniforms.uSegmentationMask.value = texture; material.uniforms.uHasMask.value = true; } else { texture.image.data = maskData; texture.needsUpdate = true; if (!material.uniforms.uHasMask.value) material.uniforms.uHasMask.value = true; } } catch (error) { console.error("Error processing mask texture:", error); segmentationTextureRef.current?.dispose(); segmentationTextureRef.current = null; material.uniforms.uSegmentationMask.value = null; material.uniforms.uHasMask.value = false; } } else { if (material.uniforms.uSegmentationMask.value !== segmentationTextureRef.current) { material.uniforms.uSegmentationMask.value = segmentationTextureRef.current; material.uniforms.uHasMask.value = !!segmentationTextureRef.current; } } } else { if (segmentationTextureRef.current) { segmentationTextureRef.current.dispose(); segmentationTextureRef.current = null; } material.uniforms.uSegmentationMask.value = null; material.uniforms.uHasMask.value = false; }
        } else { if (segmentationTextureRef.current) { segmentationTextureRef.current.dispose(); segmentationTextureRef.current = null; } material.uniforms.uSegmentationMask.value = null; material.uniforms.uHasMask.value = false; }
    }, [segmentationResults, isStatic, isMaterialReady]);

    // Landmark Uniform Effect
    useEffect(() => {
        if (!isMaterialReady || !planeMeshRef.current?.material?.uniforms?.uFaceOutline) return;
        const material = planeMeshRef.current.material; const landmarks = mediaPipeResults?.faceLandmarks?.[0]; let needsUniformUpdate = false; let currentCount = 0;
        if (landmarks && landmarks.length > 0) { const now = performance.now(); const timeSinceLastUpdate = now - lastLandmarkUpdateTime.current; const throttleThreshold = isStatic ? 0 : 33; if (timeSinceLastUpdate > throttleThreshold) { lastLandmarkUpdateTime.current = now; try { currentCount = 0; for(let i=0; i < FACE_OUTLINE_INDICES.length; ++i) { const index = FACE_OUTLINE_INDICES[i]; if (index < landmarks.length) { if(!faceOutlinePoints.current[i]) faceOutlinePoints.current[i] = new THREE.Vector2(); faceOutlinePoints.current[i].set(landmarks[index].x, landmarks[index].y); currentCount++; } else { if(!faceOutlinePoints.current[i]) faceOutlinePoints.current[i] = new THREE.Vector2(); faceOutlinePoints.current[i].set(0, 0); } } numFacePoints.current = currentCount; needsUniformUpdate = true; } catch (error) { console.error("Error processing landmark uniforms:", error); numFacePoints.current = 0; needsUniformUpdate = true; } } else { currentCount = numFacePoints.current; }
        } else if (numFacePoints.current !== 0) { numFacePoints.current = 0; needsUniformUpdate = true; }
        if (needsUniformUpdate) { const hasValidLandmarks = numFacePoints.current > 0; material.uniforms.uHasLandmarks.value = hasValidLandmarks; material.uniforms.uNumFacePoints.value = numFacePoints.current; if (hasValidLandmarks) { for(let i=0; i<numFacePoints.current; ++i) { if (!material.uniforms.uFaceOutline.value[i]) { material.uniforms.uFaceOutline.value[i] = new THREE.Vector2(); } material.uniforms.uFaceOutline.value[i].copy(faceOutlinePoints.current[i]); } for(let i=numFacePoints.current; i<MAX_FACE_POINTS; ++i) { if (material.uniforms.uFaceOutline.value[i]) { material.uniforms.uFaceOutline.value[i].set(0, 0); } } } }
    }, [mediaPipeResults, isStatic, isMaterialReady]);

     // Effect Intensity Uniform Effect
     useEffect(() => {
         if (!isMaterialReady || !planeMeshRef.current?.material?.uniforms?.uEffectIntensity) return;
         planeMeshRef.current.material.uniforms.uEffectIntensity.value = effectIntensity;
     }, [effectIntensity, isMaterialReady]);


    // --- Resizing Logic (No Change) ---
    const handleResize = useCallback(() => { /* ... */ }, []);
    // --- Plane Scaling Logic (No Change) ---
    const fitPlaneToCamera = useCallback((textureWidth, textureHeight) => { /* ... */ }, []);


    // --- Render Loop (Simplified) ---
     const renderLoop = useCallback(() => {
        animationFrameHandle.current = requestAnimationFrame(renderLoop);
        if (!isInitialized.current || !rendererInstanceRef.current || !sceneRef.current || !cameraRef.current || !planeMeshRef.current?.material?.uniforms) return;

        try {
            const mesh = planeMeshRef.current; const material = mesh.material; let sourceWidth = 0, sourceHeight = 0; let currentTexture = null; const isVideo = !isStatic;

            // Texture assignment (texture effects handle this now, but map might need initial set)
            if (isVideo && videoTextureRef.current && material.map !== videoTextureRef.current) { material.map = videoTextureRef.current; material.needsUpdate = true; }
            else if (isStatic && imageTextureRef.current && material.map !== imageTextureRef.current) { material.map = imageTextureRef.current; material.needsUpdate = true; }

            // Get dimensions for scaling
            if (isVideo && videoTextureRef.current) { const video = videoTextureRef.current.image; if (video?.readyState >= 2) { sourceWidth = video.videoWidth; sourceHeight = video.videoHeight; } }
            else if (isStatic && imageTextureRef.current) { const image = imageTextureRef.current.image; if (image?.complete) { sourceWidth = image.naturalWidth; sourceHeight = image.naturalHeight; } }

            // Update scale/mirroring
            const planeVisible = !!material.map && sourceWidth > 0 && sourceHeight > 0; if (planeVisible) { fitPlaneToCamera(sourceWidth, sourceHeight); const scaleX = Math.abs(mesh.scale.x); const newScaleX = isVideo ? -scaleX : scaleX; if(mesh.scale.x !== newScaleX) { mesh.scale.x = newScaleX; } } else { if (mesh.scale.x !== 0 || mesh.scale.y !== 0) { mesh.scale.set(0, 0, 0); } }
            if (material.map?.needsUpdate) { material.map.needsUpdate = false; } // Reset texture flag after use

            // Update Flip Uniform
            material.uniforms.uFlipMaskX.value = isVideo;

            // Render
            rendererInstanceRef.current.render(sceneRef.current, cameraRef.current);

        } catch (error) {
            console.error("Error in renderLoop:", error); cancelAnimationFrame(animationFrameHandle.current); isInitialized.current = false;
        }
    }, [fitPlaneToCamera, isStatic]);


    // --- Initialization (Injects Shader via onBeforeCompile) ---
    const initThreeScene = useCallback(() => {
        console.log("DEBUG: initThreeScene START (onBeforeCompile - Final)");
        if (!canvasRef.current || isInitialized.current) return;
        setIsMaterialReady(false); // Ensure false initially

        try {
            const canvas = canvasRef.current; const initialWidth = canvas.clientWidth || 640; const initialHeight = canvas.clientHeight || 480;
            console.log("DEBUG: Init Renderer"); const renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true }); renderer.setSize(initialWidth, initialHeight); renderer.setPixelRatio(window.devicePixelRatio); renderer.outputColorSpace = THREE.SRGBColorSpace; rendererInstanceRef.current = renderer;
            console.log("DEBUG: Init Scene"); sceneRef.current = new THREE.Scene();
            console.log("DEBUG: Init Camera"); cameraRef.current = new THREE.OrthographicCamera(-initialWidth / 2, initialWidth / 2, initialHeight / 2, -initialHeight / 2, 0.1, 10); cameraRef.current.position.z = 1;
            console.log("DEBUG: Init Geometry"); const planeGeometry = new THREE.PlaneGeometry(1, 1);
            console.log("DEBUG: Init Material"); const planeMaterial = new THREE.MeshBasicMaterial({ map: null, side: THREE.DoubleSide, color: 0xffffff, transparent: true });

            const customUniforms = { uSegmentationMask: { value: null }, uHasMask: { value: false }, uFlipMaskX: { value: false }, uFaceOutline: { value: new Array(MAX_FACE_POINTS).fill(new THREE.Vector2()) }, uNumFacePoints: { value: 0 }, uHasLandmarks: { value: false }, uEffectIntensity: { value: 0.5 } };

            console.log("DEBUG: Assigning onBeforeCompile");
            planeMaterial.onBeforeCompile = (shader) => {
                console.log("DEBUG: onBeforeCompile triggered.");
                try {
                    Object.assign(shader.uniforms, customUniforms); // Add our uniforms

                    // Inject GLSL declarations and functions
                    shader.fragmentShader = `
                        // Uniform Declarations (Injected)
                        uniform sampler2D uSegmentationMask;
                        uniform vec2 uFaceOutline[${MAX_FACE_POINTS}];
                        uniform int uNumFacePoints;
                        uniform float uEffectIntensity;
                        uniform bool uHasMask;
                        uniform bool uHasLandmarks;
                        uniform bool uFlipMaskX;
                        varying vec2 vMapUv; // Added varying

                        // Helper Functions (Injected)
                        bool isInsideFace(vec2 pUV, bool flipX) { vec2 p = vec2(pUV.x, 1.0 - pUV.y); if (flipX) { p.x = 1.0 - p.x; } bool inside = false; int count = min(uNumFacePoints, ${MAX_FACE_POINTS}); if (count < 3) return false; for (int i = 0, j = count - 1; i < count; j = i++) { vec2 pi = uFaceOutline[i]; vec2 pj = uFaceOutline[j]; if ( ((pi.y > p.y) != (pj.y > p.y)) && (p.x < (pj.x - pi.x) * (p.y - pi.y) / (pj.y - pi.y + 0.00001) + pi.x) ) { inside = !inside; } } return inside; }
                        vec3 applyHydrationEffect(vec3 c, float intensity){ vec3 h=c*(1.0+0.1*intensity); h+=vec3(0.05*intensity); return clamp(h, 0.0, 1.0); }

                    ` + shader.fragmentShader;

                    // Ensure vMapUv is declared if USE_MAP is defined
                    shader.fragmentShader = shader.fragmentShader.replace(
                        'varying vec2 vUv;',
                        'varying vec2 vUv; varying vec2 vMapUv;' // Add vMapUv
                    );

                    // Modify main shader logic (injecting before output_fragment)
                    shader.fragmentShader = shader.fragmentShader.replace(
                        '#include <output_fragment>',
                        `
                        vec3 calculatedColor = diffuse.rgb; // Start with color from map/vertex color

                        bool applyEffect = false;
                        if(uHasLandmarks && uNumFacePoints > 2 && uHasMask && uEffectIntensity > 0.01) {
                            if (isInsideFace(vMapUv, uFlipMaskX)) { // Use vMapUv
                                float maskCoordX = uFlipMaskX ? (1.0 - vMapUv.x) : vMapUv.x;
                                float maskCoordY = 1.0 - vMapUv.y;
                                float silhouetteMaskValue = texture2D(uSegmentationMask, vec2(maskCoordX, maskCoordY)).r;
                                if (silhouetteMaskValue > 0.5) { applyEffect = true; }
                            }
                        }
                        if (applyEffect) { calculatedColor = applyHydrationEffect(calculatedColor, uEffectIntensity); }

                        diffuse = vec4(calculatedColor, diffuse.a); // Modify the diffuse color

                        #include <output_fragment> // Include the original chunk AFTER our modification
                        `
                    );
                    // Set material ready flag AFTER successful compilation/modification
                     requestAnimationFrame(() => setIsMaterialReady(true));

                } catch(compileError) {
                     console.error("Error during onBeforeCompile execution:", compileError);
                     setIsMaterialReady(false);
                }
            }; // End of onBeforeCompile

            console.log("DEBUG: Init Mesh"); planeMeshRef.current = new THREE.Mesh(planeGeometry, planeMaterial);
            console.log("DEBUG: Add Mesh to Scene"); sceneRef.current.add(planeMeshRef.current);
            console.log("DEBUG: Finalizing Init"); isInitialized.current = true; handleResize(); cancelAnimationFrame(animationFrameHandle.current); animationFrameHandle.current = requestAnimationFrame(renderLoop);
            console.log("DEBUG: initThreeScene SUCCESSFUL.");

        } catch (error) {
            console.error("DEBUG: initThreeScene FAILED:", error); isInitialized.current = false; setIsMaterialReady(false);
        }
    }, [handleResize, renderLoop]);


    // --- Setup / Cleanup Effect ---
    useEffect(() => {
        initThreeScene();
        let resizeObserver; const currentCanvas = canvasRef.current; if (currentCanvas) { resizeObserver = new ResizeObserver(() => { handleResize(); }); resizeObserver.observe(currentCanvas); }
        return () => {
            resizeObserver?.disconnect(); cancelAnimationFrame(animationFrameHandle.current); isInitialized.current = false;
            videoTextureRef.current?.dispose(); videoTextureRef.current = null; imageTextureRef.current?.dispose(); imageTextureRef.current = null;
            segmentationTextureRef.current?.dispose(); segmentationTextureRef.current = null;
            planeMeshRef.current?.geometry?.dispose(); planeMeshRef.current?.material?.map?.dispose(); planeMeshRef.current?.material?.dispose(); planeMeshRef.current = null;
            rendererInstanceRef.current?.dispose(); rendererInstanceRef.current = null; sceneRef.current = null; cameraRef.current = null;
        };
     }, [initThreeScene, handleResize]);


    // --- JSX ---
    return ( <canvas ref={canvasRef} className={`renderer-canvas ${className || ''}`} style={{ display: 'block', width: '100%', height: '100%', ...(style || {}) }} /> );

});
TryOnRenderer.displayName = 'TryOnRenderer';
export default TryOnRenderer;