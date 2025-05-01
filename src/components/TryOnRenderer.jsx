// src/components/TryOnRenderer.jsx - onBeforeCompile APPROACH (Attempt fix mount issue)

import React, { useRef, forwardRef, useEffect, useCallback, useState } from 'react';
import * as THREE from 'three';

// Define constants
const FACE_OUTLINE_INDICES = [ 10, 338, 297, 332, 284, 251, 389, 356, 454, 323, 361, 288, 397, 365, 379, 378, 400, 377, 152, 148, 176, 149, 150, 136, 172, 58, 132, 93, 234, 127, 162, 21, 54, 103, 67, 109 ];
const MAX_FACE_POINTS = FACE_OUTLINE_INDICES.length;

const TryOnRenderer = forwardRef(({
    videoRefProp, imageElement,
    mediaPipeResults, segmentationResults,
    isStatic, effectIntensity,
    className, style
 }, ref) => {

    // --- Core Refs ---
    const canvasRef = useRef(null); const rendererInstanceRef = useRef(null); const animationFrameHandle = useRef(null);
    const isInitialized = useRef(false); const sceneRef = useRef(null); const cameraRef = useRef(null);
    const planeMeshRef = useRef(null); const videoTextureRef = useRef(null); const imageTextureRef = useRef(null);
    const segmentationTextureRef = useRef(null);
    const faceOutlinePoints = useRef(new Array(MAX_FACE_POINTS).fill(null).map(() => new THREE.Vector2())); // Pre-fill with Vector2
    const numFacePoints = useRef(0);

    // --- State ---
    const [isMaterialReady, setIsMaterialReady] = useState(false);

    // --- Internal Refs ---
    const renderLoopCounter = useRef(0); const lastMaskUpdateTime = useRef(0); const lastLandmarkUpdateTime = useRef(0);

    // --- Shaders --- Define outside component or ensure stable ref if needed
    const customVertexShader = `varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 ); }`;
    const customFragmentShader = `
        #define MAX_FACE_POINTS ${MAX_FACE_POINTS}
        uniform sampler2D map; // <<< Use 'map' uniform from MeshBasicMaterial
        uniform sampler2D uSegmentationMask;
        uniform vec2 uFaceOutline[MAX_FACE_POINTS];
        uniform int uNumFacePoints;
        uniform float uEffectIntensity;
        uniform bool uHasMask;
        uniform bool uHasLandmarks;
        uniform bool uFlipMaskX;
        varying vec2 vMapUv; // <<< Use vMapUv from MeshBasicMaterial

        bool isInsideFace(vec2 pUV, bool flipX) { /* ... PointInPolygon ... */ vec2 p = vec2(pUV.x, 1.0 - pUV.y); if (flipX) { p.x = 1.0 - p.x; } bool inside = false; int count = min(uNumFacePoints, ${MAX_FACE_POINTS}); if (count < 3) return false; for (int i = 0, j = count - 1; i < count; j = i++) { vec2 pi = uFaceOutline[i]; vec2 pj = uFaceOutline[j]; if ( ((pi.y > p.y) != (pj.y > p.y)) && (p.x < (pj.x - pi.x) * (p.y - pi.y) / (pj.y - pi.y + 0.00001) + pi.x) ) { inside = !inside; } } return inside; }
        vec3 applyHydrationEffect(vec3 c, float intensity){ /* ... Effect ... */ vec3 h=c*(1.0+0.1*intensity); h+=vec3(0.05*intensity); return clamp(h, 0.0, 1.0); }

        // <<< Modified Main Logic (integrated within standard structure) >>>
        vec3 calculateFinalColor() {
             vec4 diffuseColor = vec4(1.0); // Start white
             #ifdef USE_MAP
                vec4 texelColor = texture2D( map, vMapUv ); // Use vMapUv and map
                #ifdef DECODE_VIDEO_TEXTURE // Handle video texture specifics if needed
                    texelColor = vec4( decodeVideoTexture( texelColor ), 1.0 );
                #endif
                diffuseColor *= texelColor;
             #endif
             #ifdef USE_COLOR
                 diffuseColor.rgb *= vColor.rgb; // Use vertex color if enabled
             #endif

             vec3 finalColor = diffuseColor.rgb; // Base color from texture/vertex color
             bool applyEffect = false;

             if(uHasLandmarks && uNumFacePoints > 2 && uHasMask && uEffectIntensity > 0.01) {
                 if (isInsideFace(vMapUv, uFlipMaskX)) { // Use vMapUv
                     float maskCoordX = uFlipMaskX ? (1.0 - vMapUv.x) : vMapUv.x;
                     float maskCoordY = 1.0 - vMapUv.y;
                     float silhouetteMaskValue = texture2D(uSegmentationMask, vec2(maskCoordX, maskCoordY)).r;
                     if (silhouetteMaskValue > 0.5) { applyEffect = true; }
                 }
             }
             if (applyEffect) { finalColor = applyHydrationEffect(finalColor, uEffectIntensity); }
             return finalColor;
        }
    `; // Note: Main func logic injected via string replacement later

    // --- Texture Management Effects --- (No Change) ---
    useEffect(() => { /* Video */ }, [isStatic, videoRefProp, videoRefProp?.current?.readyState]);
    useEffect(() => { /* Image */ }, [isStatic, imageElement, imageElement?.complete]);

    // --- Uniform Update Effects (Depend on isMaterialReady) ---
    useEffect(() => { /* Mask Texture */ if (!isMaterialReady || !planeMeshRef.current?.material?.uniforms?.uSegmentationMask) return; const material = planeMeshRef.current.material; const results = segmentationResults; /* ... rest of logic ... */ }, [segmentationResults, isStatic, isMaterialReady]);
    useEffect(() => { /* Landmarks */ if (!isMaterialReady || !planeMeshRef.current?.material?.uniforms?.uFaceOutline) return; const material = planeMeshRef.current.material; const landmarks = mediaPipeResults?.faceLandmarks?.[0]; /* ... rest of logic ... */ }, [mediaPipeResults, isStatic, isMaterialReady]);
    useEffect(() => { /* Intensity */ if (!isMaterialReady || !planeMeshRef.current?.material?.uniforms?.uEffectIntensity) return; planeMeshRef.current.material.uniforms.uEffectIntensity.value = effectIntensity; }, [effectIntensity, isMaterialReady]);

    // --- Resizing Logic (No Change) ---
    const handleResize = useCallback(() => { /* ... */ }, []);
    // --- Plane Scaling Logic (No Change) ---
    const fitPlaneToCamera = useCallback((textureWidth, textureHeight) => { /* ... */ }, []);

    // --- Render Loop (No Change) ---
     const renderLoop = useCallback(() => {
        animationFrameHandle.current = requestAnimationFrame(renderLoop);
        if (!isInitialized.current || !rendererInstanceRef.current || !sceneRef.current || !cameraRef.current || !planeMeshRef.current?.material?.uniforms) return;
        try {
             const mesh = planeMeshRef.current; const material = mesh.material; let sourceWidth = 0, sourceHeight = 0; let currentTexture = null; const isVideo = !isStatic;
             // --- Assign texture to map ---
             if (isVideo && videoTextureRef.current) { currentTexture = videoTextureRef.current; /* ...get dims... */ } else if (isStatic && imageTextureRef.current) { currentTexture = imageTextureRef.current; /* ...get dims... */ }
             if (material.map !== currentTexture) { material.map = currentTexture; material.needsUpdate = true; }
              else if (currentTexture?.needsUpdate) { material.needsUpdate = true; }
             // --- Update scale/mirroring ---
             const planeVisible = !!material.map && sourceWidth > 0 && sourceHeight > 0; if (planeVisible) { fitPlaneToCamera(sourceWidth, sourceHeight); const scaleX = Math.abs(mesh.scale.x); const newScaleX = isVideo ? -scaleX : scaleX; if(mesh.scale.x !== newScaleX) { mesh.scale.x = newScaleX; } } else { if (mesh.scale.x !== 0 || mesh.scale.y !== 0) { mesh.scale.set(0, 0, 0); } }
             if (currentTexture?.needsUpdate) { currentTexture.needsUpdate = false; }
             // --- Update flip uniform ---
             material.uniforms.uFlipMaskX.value = isVideo;
             // --- Render ---
             rendererInstanceRef.current.render(sceneRef.current, cameraRef.current);
        } catch (error) { console.error("Error in renderLoop:", error); cancelAnimationFrame(animationFrameHandle.current); isInitialized.current = false; }
    }, [fitPlaneToCamera, isStatic]);


    // --- Initialization (Injects Shader via onBeforeCompile) ---
    const initThreeScene = useCallback(() => {
        console.log("DEBUG: initThreeScene Check 1: Start"); // <<< Log Start
        if (!canvasRef.current || isInitialized.current) {
             console.log("DEBUG: initThreeScene Check 2: Exit (No canvas or already init)");
             return;
        }
        console.log("DEBUG: initThreeScene Check 3: Proceeding");
        setIsMaterialReady(false); // Ensure false initially

        try {
            const canvas = canvasRef.current; const initialWidth = canvas.clientWidth || 640; const initialHeight = canvas.clientHeight || 480;
            console.log("DEBUG: initThreeScene Check 4: Renderer Init");
            const renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true }); renderer.setSize(initialWidth, initialHeight); renderer.setPixelRatio(window.devicePixelRatio); renderer.outputColorSpace = THREE.SRGBColorSpace; rendererInstanceRef.current = renderer;
            console.log("DEBUG: initThreeScene Check 5: Scene Init");
            sceneRef.current = new THREE.Scene();
            console.log("DEBUG: initThreeScene Check 6: Camera Init");
            cameraRef.current = new THREE.OrthographicCamera(-initialWidth / 2, initialWidth / 2, initialHeight / 2, -initialHeight / 2, 0.1, 10); cameraRef.current.position.z = 1;
            console.log("DEBUG: initThreeScene Check 7: Geometry Init");
            const planeGeometry = new THREE.PlaneGeometry(1, 1);
            console.log("DEBUG: initThreeScene Check 8: Material Init");
            const planeMaterial = new THREE.MeshBasicMaterial({ map: null, side: THREE.DoubleSide, color: 0xffffff, transparent: true });

            const customUniforms = { uSegmentationMask: { value: null }, uHasMask: { value: false }, uFlipMaskX: { value: false }, uFaceOutline: { value: new Array(MAX_FACE_POINTS).fill(new THREE.Vector2()) }, uNumFacePoints: { value: 0 }, uHasLandmarks: { value: false }, uEffectIntensity: { value: 0.5 } };

            console.log("DEBUG: initThreeScene Check 9: Assigning onBeforeCompile");
            planeMaterial.onBeforeCompile = (shader) => {
                console.log("DEBUG: onBeforeCompile triggered.");
                try { // Add try-catch inside onBeforeCompile
                    Object.assign(shader.uniforms, customUniforms);
                    // Inject declarations and functions
                    shader.fragmentShader = `
                        // Uniform Declarations (Injected)
                        uniform sampler2D uSegmentationMask;
                        uniform vec2 uFaceOutline[${MAX_FACE_POINTS}];
                        uniform int uNumFacePoints;
                        uniform float uEffectIntensity;
                        uniform bool uHasMask;
                        uniform bool uHasLandmarks;
                        uniform bool uFlipMaskX;
                        // Varyings needed by functions or main logic
                        varying vec2 vMapUv; // Make sure this is declared if used below

                        // Helper Functions (Injected)
                        bool isInsideFace(vec2 pUV, bool flipX) { vec2 p = vec2(pUV.x, 1.0 - pUV.y); if (flipX) { p.x = 1.0 - p.x; } bool inside = false; int count = min(uNumFacePoints, ${MAX_FACE_POINTS}); if (count < 3) return false; for (int i = 0, j = count - 1; i < count; j = i++) { vec2 pi = uFaceOutline[i]; vec2 pj = uFaceOutline[j]; if ( ((pi.y > p.y) != (pj.y > p.y)) && (p.x < (pj.x - pi.x) * (p.y - pi.y) / (pj.y - pi.y + 0.00001) + pi.x) ) { inside = !inside; } } return inside; }
                        vec3 applyHydrationEffect(vec3 c, float intensity){ vec3 h=c*(1.0+0.1*intensity); h+=vec3(0.05*intensity); return clamp(h, 0.0, 1.0); }

                        // Original Shader Code (with placeholder for injection)
                    ` + shader.fragmentShader;

                    // Inject main calculation logic *before* the final gl_FragColor assignment
                    // Replace a known line/chunk, e.g., output_fragment or fog_fragment
                    // Let's target output_fragment as it's usually near the end
                    shader.fragmentShader = shader.fragmentShader.replace(
                        '#include <output_fragment>',
                        `
                        vec3 calculatedColor = diffuse.rgb; // Start with color from map/vertex color (usually stored in 'diffuse')

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

                        // The original output_fragment chunk usually does encoding and assigns to gl_FragColor
                        // We replace the diffuse color *before* that chunk runs.
                         diffuse = vec4(calculatedColor, diffuse.a); // Modify the diffuse color THREE uses

                        #include <output_fragment> // Include the original chunk AFTER our modification
                        `
                    );

                    // Log modified shader (optional)
                    // console.log(shader.fragmentShader);

                    // SET MATERIAL READY FLAG
                    console.log("DEBUG: onBeforeCompile finished, setting material ready flag.");
                    // Use a slight delay to ensure state update happens after compilation potentially finishes
                    requestAnimationFrame(() => setIsMaterialReady(true));
                    // Or direct: setIsMaterialReady(true);

                } catch(compileError) {
                     console.error("Error during onBeforeCompile execution:", compileError);
                     setIsMaterialReady(false); // Ensure false on error
                }
            };

            console.log("DEBUG: initThreeScene Check 10: Mesh Init");
            planeMeshRef.current = new THREE.Mesh(planeGeometry, planeMaterial);
            console.log("DEBUG: initThreeScene Check 11: Adding Mesh to Scene");
            sceneRef.current.add(planeMeshRef.current);

            console.log("DEBUG: initThreeScene Check 12: Finalizing");
            isInitialized.current = true; handleResize(); cancelAnimationFrame(animationFrameHandle.current); animationFrameHandle.current = requestAnimationFrame(renderLoop);
            console.log("DEBUG: initThreeScene SUCCESSFUL.");

        } catch (error) {
            console.error("DEBUG: initThreeScene FAILED:", error); isInitialized.current = false; setIsMaterialReady(false);
        }
    }, [handleResize, renderLoop]); // Dependencies for initThreeScene

    // --- Setup / Cleanup Effect (No Change) ---
    useEffect(() => { /* ... */ }, [initThreeScene, handleResize]);

    // --- JSX --- (No Change)
    return ( <canvas ref={canvasRef} className={`renderer-canvas ${className || ''}`} style={{ display: 'block', width: '100%', height: '100%', ...(style || {}) }} /> );

});
TryOnRenderer.displayName = 'TryOnRenderer';
export default TryOnRenderer;