// src/components/TryOnRenderer.jsx - onBeforeCompile APPROACH (Corrected Timing)
// Uses state flag to ensure uniforms exist before useEffect updates them

import React, { useRef, forwardRef, useEffect, useCallback, useState } from 'react'; // Import useState
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
    mediaPipeResults,     // Used for landmarks
    segmentationResults, // Used for silhouette mask
    isStatic,
    effectIntensity,
    className, style
 }, ref) => {

    // --- Core Refs ---
    const canvasRef = useRef(null); const rendererInstanceRef = useRef(null); const animationFrameHandle = useRef(null);
    const isInitialized = useRef(false); const sceneRef = useRef(null); const cameraRef = useRef(null);
    const planeMeshRef = useRef(null); const videoTextureRef = useRef(null); const imageTextureRef = useRef(null);
    const segmentationTextureRef = useRef(null);
    const faceOutlinePoints = useRef(new Array(MAX_FACE_POINTS).fill(new THREE.Vector2()));
    const numFacePoints = useRef(0);

    // --- State ---
    const [isMaterialReady, setIsMaterialReady] = useState(false); // <<< State to track if onBeforeCompile ran

    // --- Internal Refs ---
    const renderLoopCounter = useRef(0); const lastMaskUpdateTime = useRef(0); const lastLandmarkUpdateTime = useRef(0);


    // --- Texture Management Effects --- (No Change from Baseline) ---
    useEffect(() => { /* Video Texture Effect */ }, [isStatic, videoRefProp, videoRefProp?.current?.readyState]);
    useEffect(() => { /* Image Texture Effect */ }, [isStatic, imageElement, imageElement?.complete]);


    // --- Uniform Update Effects (DEPEND ON isMaterialReady) ---

    // Segmentation Mask Texture Effect
    useEffect(() => {
        // <<< Wait for material readiness >>>
        if (!isMaterialReady || !planeMeshRef.current?.material?.uniforms?.uSegmentationMask) {
            // console.log("Seg Mask useEffect: Waiting for material/uniforms...");
            return;
        }
        const material = planeMeshRef.current.material;
        const results = segmentationResults; const hasMaskData = results?.confidenceMasks?.[0];

        // console.log("Seg Mask useEffect: Running update. Has Data:", !!hasMaskData);

        if (hasMaskData) { /* ... (rest of mask processing logic - NO CHANGE) ... */
            const confidenceMaskObject = results.confidenceMasks[0]; const maskWidth = confidenceMaskObject?.width; const maskHeight = confidenceMaskObject?.height; let maskData = null; try { if (typeof confidenceMaskObject?.getAsFloat32Array === 'function') { maskData = confidenceMaskObject.getAsFloat32Array(); } else if (confidenceMaskObject?.data instanceof Float32Array) { maskData = confidenceMaskObject.data; } } catch (error) { maskData = null; console.error("Error getting mask data:", error); } if (maskData instanceof Float32Array && maskWidth > 0 && maskHeight > 0) { const now = performance.now(); const timeSinceLastUpdate = now - lastMaskUpdateTime.current; const throttleThreshold = isStatic ? 0 : 66; if (timeSinceLastUpdate > throttleThreshold) { lastMaskUpdateTime.current = now; try { let texture = segmentationTextureRef.current; if (!texture || texture.image.width !== maskWidth || texture.image.height !== maskHeight) { texture?.dispose(); texture = new THREE.DataTexture(maskData, maskWidth, maskHeight, THREE.RedFormat, THREE.FloatType); texture.minFilter = THREE.NearestFilter; texture.magFilter = THREE.NearestFilter; texture.generateMipmaps = false; texture.needsUpdate = true; segmentationTextureRef.current = texture; material.uniforms.uSegmentationMask.value = texture; material.uniforms.uHasMask.value = true; } else { texture.image.data = maskData; texture.needsUpdate = true; if (!material.uniforms.uHasMask.value) material.uniforms.uHasMask.value = true; } } catch (error) { console.error("Error processing mask texture:", error); segmentationTextureRef.current?.dispose(); segmentationTextureRef.current = null; material.uniforms.uSegmentationMask.value = null; material.uniforms.uHasMask.value = false; } } else { if (material.uniforms.uSegmentationMask.value !== segmentationTextureRef.current) { material.uniforms.uSegmentationMask.value = segmentationTextureRef.current; material.uniforms.uHasMask.value = !!segmentationTextureRef.current; } } } else { if (segmentationTextureRef.current) { segmentationTextureRef.current.dispose(); segmentationTextureRef.current = null; } material.uniforms.uSegmentationMask.value = null; material.uniforms.uHasMask.value = false; }
        } else { if (segmentationTextureRef.current) { segmentationTextureRef.current.dispose(); segmentationTextureRef.current = null; } material.uniforms.uSegmentationMask.value = null; material.uniforms.uHasMask.value = false; }
    // <<< Add isMaterialReady dependency >>>
    }, [segmentationResults, isStatic, isMaterialReady]);


    // Landmark Uniform Effect
    useEffect(() => {
        // <<< Wait for material readiness >>>
        if (!isMaterialReady || !planeMeshRef.current?.material?.uniforms?.uFaceOutline) {
             // console.log("Landmark useEffect: Waiting for material/uniforms...");
            return;
        }
        const material = planeMeshRef.current.material;
        const landmarks = mediaPipeResults?.faceLandmarks?.[0];
        let needsUniformUpdate = false; let currentCount = 0;

        // console.log("Landmark useEffect: Running update. Has Landmarks raw:", !!landmarks);

        if (landmarks && landmarks.length > 0) { /* ... (rest of landmark processing logic - NO CHANGE) ... */
             const now = performance.now(); const timeSinceLastUpdate = now - lastLandmarkUpdateTime.current; const throttleThreshold = isStatic ? 0 : 33; if (timeSinceLastUpdate > throttleThreshold) { lastLandmarkUpdateTime.current = now; try { currentCount = 0; for(let i=0; i < FACE_OUTLINE_INDICES.length; ++i) { const index = FACE_OUTLINE_INDICES[i]; if (index < landmarks.length) { if(!faceOutlinePoints.current[i]) faceOutlinePoints.current[i] = new THREE.Vector2(); faceOutlinePoints.current[i].set(landmarks[index].x, landmarks[index].y); currentCount++; } else { if(!faceOutlinePoints.current[i]) faceOutlinePoints.current[i] = new THREE.Vector2(); faceOutlinePoints.current[i].set(0, 0); } } numFacePoints.current = currentCount; needsUniformUpdate = true; } catch (error) { console.error("Error processing landmark uniforms:", error); numFacePoints.current = 0; needsUniformUpdate = true; } } else { currentCount = numFacePoints.current; }
        } else if (numFacePoints.current !== 0) { numFacePoints.current = 0; needsUniformUpdate = true; }

        if (needsUniformUpdate) {
             const hasValidLandmarks = numFacePoints.current > 0;
             material.uniforms.uHasLandmarks.value = hasValidLandmarks;
             material.uniforms.uNumFacePoints.value = numFacePoints.current;
             if (hasValidLandmarks) {
                 for(let i=0; i<numFacePoints.current; ++i) { if (!material.uniforms.uFaceOutline.value[i]) { material.uniforms.uFaceOutline.value[i] = new THREE.Vector2(); } material.uniforms.uFaceOutline.value[i].copy(faceOutlinePoints.current[i]); }
                 for(let i=numFacePoints.current; i<MAX_FACE_POINTS; ++i) { if (material.uniforms.uFaceOutline.value[i]) { material.uniforms.uFaceOutline.value[i].set(0, 0); } }
             }
        }
    // <<< Add isMaterialReady dependency >>>
    }, [mediaPipeResults, isStatic, isMaterialReady]);

     // Effect Intensity Uniform Effect
     useEffect(() => {
         // <<< Wait for material readiness >>>
         if (!isMaterialReady || !planeMeshRef.current?.material?.uniforms?.uEffectIntensity) {
             // console.log("Intensity useEffect: Waiting for material/uniforms...");
             return;
         }
         // console.log("Intensity useEffect: Running update.");
         planeMeshRef.current.material.uniforms.uEffectIntensity.value = effectIntensity;
     // <<< Add isMaterialReady dependency >>>
     }, [effectIntensity, isMaterialReady]);


    // --- Resizing Logic (No Change) ---
    const handleResize = useCallback(() => { /* ... */ }, []);
    // --- Plane Scaling Logic (No Change) ---
    const fitPlaneToCamera = useCallback((textureWidth, textureHeight) => { /* ... */ }, []);


    // --- Render Loop (No Change) ---
     const renderLoop = useCallback(() => { /* ... */ }, [fitPlaneToCamera, isStatic]);


    // --- Initialization (Injects Shader & Sets isMaterialReady) ---
    const initThreeScene = useCallback(() => {
        if (!canvasRef.current || isInitialized.current) return;
        console.log("DEBUG: initThreeScene START (onBeforeCompile + Ready Flag)");
        try {
            // ... (Renderer, Scene, Camera, Geometry setup - NO CHANGE) ...
            const canvas = canvasRef.current; const initialWidth = canvas.clientWidth || 640; const initialHeight = canvas.clientHeight || 480; const renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true }); renderer.setSize(initialWidth, initialHeight); renderer.setPixelRatio(window.devicePixelRatio); renderer.outputColorSpace = THREE.SRGBColorSpace; rendererInstanceRef.current = renderer; sceneRef.current = new THREE.Scene(); cameraRef.current = new THREE.OrthographicCamera(-initialWidth / 2, initialWidth / 2, initialHeight / 2, -initialHeight / 2, 0.1, 10); cameraRef.current.position.z = 1; const planeGeometry = new THREE.PlaneGeometry(1, 1);

            // --- Material with onBeforeCompile ---
            const planeMaterial = new THREE.MeshBasicMaterial({ map: null, side: THREE.DoubleSide, color: 0xffffff, transparent: true });
            console.log("DEBUG: Base Material created.");

            // Define uniforms
            const customUniforms = { uSegmentationMask: { value: null }, uHasMask: { value: false }, uFlipMaskX: { value: false }, uFaceOutline: { value: new Array(MAX_FACE_POINTS).fill(new THREE.Vector2()) }, uNumFacePoints: { value: 0 }, uHasLandmarks: { value: false }, uEffectIntensity: { value: 0.5 } };

            planeMaterial.onBeforeCompile = (shader) => {
                console.log("DEBUG: onBeforeCompile triggered.");
                Object.assign(shader.uniforms, customUniforms); // Add uniforms

                // Inject GLSL (declarations, functions, main logic modification)
                shader.fragmentShader = `
                    uniform sampler2D uSegmentationMask;
                    uniform vec2 uFaceOutline[${MAX_FACE_POINTS}];
                    uniform int uNumFacePoints;
                    uniform float uEffectIntensity;
                    uniform bool uHasMask;
                    uniform bool uHasLandmarks;
                    uniform bool uFlipMaskX;

                    bool isInsideFace(vec2 pUV, bool flipX) { /* ... PointInPolygon ... */ vec2 p = vec2(pUV.x, 1.0 - pUV.y); if (flipX) { p.x = 1.0 - p.x; } bool inside = false; int count = min(uNumFacePoints, ${MAX_FACE_POINTS}); if (count < 3) return false; for (int i = 0, j = count - 1; i < count; j = i++) { vec2 pi = uFaceOutline[i]; vec2 pj = uFaceOutline[j]; if ( ((pi.y > p.y) != (pj.y > p.y)) && (p.x < (pj.x - pi.x) * (p.y - pi.y) / (pj.y - pi.y + 0.00001) + pi.x) ) { inside = !inside; } } return inside; }
                    vec3 applyHydrationEffect(vec3 c, float intensity){ /* ... Effect ... */ vec3 h=c*(1.0+0.1*intensity); h+=vec3(0.05*intensity); return clamp(h, 0.0, 1.0); }

                ` + shader.fragmentShader;

                 shader.fragmentShader = shader.fragmentShader.replace(
                     '#include <color_fragment>',
                     ` /* ... Custom main logic from Message #293 ... */ vec4 diffuseColor = vec4(1.0); #ifdef USE_MAP vec4 texelColor = texture2D( map, vMapUv ); diffuseColor *= texelColor; #endif #ifdef USE_COLOR diffuseColor.rgb *= vColor.rgb; #endif vec3 finalColor = diffuseColor.rgb; bool applyEffect = false; if(uHasLandmarks && uNumFacePoints > 2 && uHasMask && uEffectIntensity > 0.01) { if (isInsideFace(vMapUv, uFlipMaskX)) { float maskCoordX = uFlipMaskX ? (1.0 - vMapUv.x) : vMapUv.x; float maskCoordY = 1.0 - vMapUv.y; float silhouetteMaskValue = texture2D(uSegmentationMask, vec2(maskCoordX, maskCoordY)).r; if (silhouetteMaskValue > 0.5) { applyEffect = true; } } } if (applyEffect) { finalColor = applyHydrationEffect(finalColor, uEffectIntensity); } diffuseColor.rgb = finalColor; `
                 );

                 // <<< SET MATERIAL READY FLAG >>>
                 console.log("DEBUG: onBeforeCompile finished, setting material ready flag.");
                 setIsMaterialReady(true);
            }; // End of onBeforeCompile

            console.log("DEBUG: onBeforeCompile handler assigned.");

            // --- Mesh & Scene Add ---
            planeMeshRef.current = new THREE.Mesh(planeGeometry, planeMaterial);
            sceneRef.current.add(planeMeshRef.current);
            console.log("DEBUG: Plane mesh added to scene.");

            // Finalize
            isInitialized.current = true; handleResize(); cancelAnimationFrame(animationFrameHandle.current); animationFrameHandle.current = requestAnimationFrame(renderLoop);
            console.log("DEBUG: initThreeScene SUCCESSFUL.");

        } catch (error) {
            console.error("DEBUG: initThreeScene FAILED:", error);
            isInitialized.current = false; setIsMaterialReady(false); // Ensure flag is false on failure
        }
    }, [handleResize, renderLoop]);


    // --- Setup / Cleanup Effect (No Change) ---
    useEffect(() => { /* ... */ }, [initThreeScene, handleResize]);


    // --- JSX --- (No Change)
    return ( <canvas ref={canvasRef} className={`renderer-canvas ${className || ''}`} style={{ display: 'block', width: '100%', height: '100%', ...(style || {}) }} /> );

});
TryOnRenderer.displayName = 'TryOnRenderer';
export default TryOnRenderer;