// src/components/TryOnRenderer.jsx - onBeforeCompile APPROACH
// Uses direct material shader modification for face-constrained effect

import React, { useRef, forwardRef, useEffect, useCallback } from 'react';
import * as THREE from 'three';
// No EffectComposer needed
// import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
// import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
// import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
// import { UniformsUtils } from 'three'; // Not strictly needed now

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
    const canvasRef = useRef(null);
    const rendererInstanceRef = useRef(null);
    const animationFrameHandle = useRef(null);
    const isInitialized = useRef(false);
    const sceneRef = useRef(null);
    const cameraRef = useRef(null);
    const planeMeshRef = useRef(null); // The plane showing video/image
    const videoTextureRef = useRef(null);
    const imageTextureRef = useRef(null);
    const segmentationTextureRef = useRef(null); // For silhouette mask
    // No landmark texture needed
    // Store face outline points in a simple ref for processing
    const faceOutlinePoints = useRef(new Array(MAX_FACE_POINTS).fill(new THREE.Vector2()));
    const numFacePoints = useRef(0); // Actual number of points processed

    const renderLoopCounter = useRef(0);
    const lastMaskUpdateTime = useRef(0);
    const lastLandmarkUpdateTime = useRef(0);


    // --- Texture Management Effects --- (No Change from Baseline) ---
    useEffect(() => { /* Video Texture Effect */ }, [isStatic, videoRefProp, videoRefProp?.current?.readyState]);
    useEffect(() => { /* Image Texture Effect */ }, [isStatic, imageElement, imageElement?.complete]);


    // --- Uniform Update Effects ---

    // Segmentation Mask Texture Effect (Updates Material Uniform)
    useEffect(() => {
        const results = segmentationResults; const hasMaskData = results?.confidenceMasks?.[0];
        const material = planeMeshRef.current?.material;
        if (!material) return; // Need material to update uniforms

        if (hasMaskData) {
            const confidenceMaskObject = results.confidenceMasks[0]; const maskWidth = confidenceMaskObject?.width; const maskHeight = confidenceMaskObject?.height; let maskData = null;
            try { if (typeof confidenceMaskObject?.getAsFloat32Array === 'function') { maskData = confidenceMaskObject.getAsFloat32Array(); } else if (confidenceMaskObject?.data instanceof Float32Array) { maskData = confidenceMaskObject.data; } } catch (error) { maskData = null; console.error("Error getting mask data:", error); }

            if (maskData instanceof Float32Array && maskWidth > 0 && maskHeight > 0) {
                const now = performance.now(); const timeSinceLastUpdate = now - lastMaskUpdateTime.current; const throttleThreshold = isStatic ? 0 : 66;
                if (timeSinceLastUpdate > throttleThreshold) {
                    lastMaskUpdateTime.current = now;
                    try {
                        let texture = segmentationTextureRef.current;
                        if (!texture || texture.image.width !== maskWidth || texture.image.height !== maskHeight) {
                            texture?.dispose(); texture = new THREE.DataTexture(maskData, maskWidth, maskHeight, THREE.RedFormat, THREE.FloatType);
                            texture.minFilter = THREE.NearestFilter; texture.magFilter = THREE.NearestFilter; texture.generateMipmaps = false; texture.needsUpdate = true; segmentationTextureRef.current = texture;
                            // Initial assignment or if texture object changed
                            material.uniforms.uSegmentationMask.value = texture;
                            material.uniforms.uHasMask.value = true;
                            console.log("TryOnRenderer: Assigning NEW Segmentation Mask Texture to uniform.");
                        } else {
                            texture.image.data = maskData; texture.needsUpdate = true;
                            // Texture object is the same, data updated. Ensure uniform flag is correct.
                            if (!material.uniforms.uHasMask.value) {
                                material.uniforms.uHasMask.value = true;
                            }
                            // console.log("TryOnRenderer: Updating Segmentation Mask Texture data.");
                        }
                    } catch (error) {
                        console.error("Error processing mask texture:", error);
                        segmentationTextureRef.current?.dispose(); segmentationTextureRef.current = null;
                        material.uniforms.uSegmentationMask.value = null; material.uniforms.uHasMask.value = false;
                    }
                } else {
                    // Ensure uniform points to the current texture even if throttled
                     if (material.uniforms.uSegmentationMask.value !== segmentationTextureRef.current) {
                          material.uniforms.uSegmentationMask.value = segmentationTextureRef.current;
                          material.uniforms.uHasMask.value = !!segmentationTextureRef.current;
                     }
                }
            } else { // Invalid data
                if (segmentationTextureRef.current) { segmentationTextureRef.current.dispose(); segmentationTextureRef.current = null; }
                material.uniforms.uSegmentationMask.value = null; material.uniforms.uHasMask.value = false;
            }
        } else { // No mask data in results
            if (segmentationTextureRef.current) { segmentationTextureRef.current.dispose(); segmentationTextureRef.current = null; }
            material.uniforms.uSegmentationMask.value = null; material.uniforms.uHasMask.value = false;
        }
    }, [segmentationResults, isStatic]);


    // Landmark Uniform Effect (Updates Material Uniforms)
    useEffect(() => {
        const landmarks = mediaPipeResults?.faceLandmarks?.[0];
        const material = planeMeshRef.current?.material;
        if (!material) return; // Need material

        let needsUniformUpdate = false;
        let currentCount = 0;

        if (landmarks && landmarks.length > 0) {
             const now = performance.now(); const timeSinceLastUpdate = now - lastLandmarkUpdateTime.current; const throttleThreshold = isStatic ? 0 : 33;
             if (timeSinceLastUpdate > throttleThreshold) {
                 lastLandmarkUpdateTime.current = now;
                 try {
                     // Extract outline points into the ref array
                     currentCount = 0;
                     for(let i=0; i < FACE_OUTLINE_INDICES.length; ++i) {
                         const index = FACE_OUTLINE_INDICES[i];
                         if (index < landmarks.length) {
                             if(!faceOutlinePoints.current[i]) faceOutlinePoints.current[i] = new THREE.Vector2();
                             faceOutlinePoints.current[i].set(landmarks[index].x, landmarks[index].y);
                             currentCount++;
                         } else {
                             if(!faceOutlinePoints.current[i]) faceOutlinePoints.current[i] = new THREE.Vector2();
                             faceOutlinePoints.current[i].set(0, 0); // Default for safety
                         }
                     }
                     numFacePoints.current = currentCount;
                     needsUniformUpdate = true;
                     // console.log("DEBUG: Processed", numFacePoints.current, "face outline points.");
                 } catch (error) {
                     console.error("TryOnRenderer: Error processing landmark uniforms:", error);
                     numFacePoints.current = 0; needsUniformUpdate = true; // Update flag to false
                 }
             } else {
                 // Throttled: Keep last count
                 currentCount = numFacePoints.current;
                 // No update needed unless flag needs changing (handled below)
             }
        } else if (numFacePoints.current !== 0) {
             // No landmarks found, but previous state had landmarks
             numFacePoints.current = 0; needsUniformUpdate = true;
        }

        // Update uniforms if needed
        if (needsUniformUpdate) {
             const hasValidLandmarks = numFacePoints.current > 0;
             material.uniforms.uHasLandmarks.value = hasValidLandmarks;
             material.uniforms.uNumFacePoints.value = numFacePoints.current;
             if (hasValidLandmarks) {
                 // Copy the processed points to the uniform array value
                  for(let i=0; i<numFacePoints.current; ++i) {
                      // Ensure target array elements exist within the uniform value
                      if (!material.uniforms.uFaceOutline.value[i]) {
                           material.uniforms.uFaceOutline.value[i] = new THREE.Vector2();
                      }
                      material.uniforms.uFaceOutline.value[i].copy(faceOutlinePoints.current[i]);
                  }
                 // If number of points decreased, you might want to zero out remaining elements
                 for(let i=numFacePoints.current; i<MAX_FACE_POINTS; ++i) {
                      if (material.uniforms.uFaceOutline.value[i]) {
                           material.uniforms.uFaceOutline.value[i].set(0, 0);
                      }
                 }
             }
             // console.log("DEBUG: Updated Landmark Uniforms. HasLandmarks:", hasValidLandmarks, "Count:", numFacePoints.current);
        }
    }, [mediaPipeResults, isStatic]);

     // Effect Intensity Uniform Effect
     useEffect(() => {
         const material = planeMeshRef.current?.material;
         if (material?.uniforms?.uEffectIntensity) { // Check if uniform exists
             material.uniforms.uEffectIntensity.value = effectIntensity;
         }
     }, [effectIntensity]);


    // --- Resizing Logic (No Change from Baseline) ---
    const handleResize = useCallback(() => { /* ... */ }, []);
    // --- Plane Scaling Logic (No Change from Baseline) ---
    const fitPlaneToCamera = useCallback((textureWidth, textureHeight) => { /* ... */ }, []);


    // --- Render Loop (Updates flip uniform) ---
     const renderLoop = useCallback(() => {
        animationFrameHandle.current = requestAnimationFrame(renderLoop);
        if (!isInitialized.current || !rendererInstanceRef.current || !sceneRef.current || !cameraRef.current || !planeMeshRef.current?.material?.uniforms) { // Check uniforms exist
             return;
        }

        try {
            const mesh = planeMeshRef.current;
            const material = mesh.material;
            let sourceWidth = 0, sourceHeight = 0;
            let currentTexture = null;
            const isVideo = !isStatic;

            // 1 & 2: Select Texture, Assign Map, Update Plane Scale/Mirroring
            if (isVideo && videoTextureRef.current) { /* ... */ } else if (isStatic && imageTextureRef.current) { /* ... */ }
            if (material.map !== currentTexture) { material.map = currentTexture; material.needsUpdate = true; }
             else if (currentTexture?.needsUpdate) { material.needsUpdate = true; }
            const planeVisible = !!material.map && sourceWidth > 0 && sourceHeight > 0;
            if (planeVisible) { fitPlaneToCamera(sourceWidth, sourceHeight); const scaleX = Math.abs(mesh.scale.x); const newScaleX = isVideo ? -scaleX : scaleX; if(mesh.scale.x !== newScaleX) { mesh.scale.x = newScaleX; } }
            else { if (mesh.scale.x !== 0 || mesh.scale.y !== 0) { mesh.scale.set(0, 0, 0); } }
            if (currentTexture?.needsUpdate) { currentTexture.needsUpdate = false; }

            // 3. Update Flip Uniform
            material.uniforms.uFlipMaskX.value = isVideo;

            // 4. Render the scene directly
            rendererInstanceRef.current.render(sceneRef.current, cameraRef.current);

        } catch (error) {
            console.error("TryOnRenderer onBeforeCompile: Error in renderLoop:", error);
            cancelAnimationFrame(animationFrameHandle.current); isInitialized.current = false;
        }
    }, [fitPlaneToCamera, isStatic]);


    // --- Initialization (Injects Shader via onBeforeCompile) ---
    const initThreeScene = useCallback(() => {
        if (!canvasRef.current || isInitialized.current) return;
        console.log("DEBUG: initThreeScene START (onBeforeCompile)");
        try {
            const canvas = canvasRef.current; const initialWidth = canvas.clientWidth || 640; const initialHeight = canvas.clientHeight || 480;

            // 1. Renderer
            const renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true });
            renderer.setSize(initialWidth, initialHeight); renderer.setPixelRatio(window.devicePixelRatio); renderer.outputColorSpace = THREE.SRGBColorSpace;
            rendererInstanceRef.current = renderer;
            console.log("DEBUG: Renderer initialized.");

            // 2. Scene
            sceneRef.current = new THREE.Scene();
            console.log("DEBUG: Scene created.");

            // 3. Camera
            cameraRef.current = new THREE.OrthographicCamera(-initialWidth / 2, initialWidth / 2, initialHeight / 2, -initialHeight / 2, 0.1, 10);
            cameraRef.current.position.z = 1;
            console.log("DEBUG: Camera created.");

            // 4. Geometry
            const planeGeometry = new THREE.PlaneGeometry(1, 1);
            console.log("DEBUG: Geometry created.");

            // 5. Material with onBeforeCompile
            const planeMaterial = new THREE.MeshBasicMaterial({
                map: null, side: THREE.DoubleSide, color: 0xffffff, // Start white
                transparent: true, // Enable transparency if effect might need it
            });
            console.log("DEBUG: Base Material created.");

            // Define uniforms to be injected
            const customUniforms = {
                uSegmentationMask: { value: null },
                uHasMask: { value: false },
                uFlipMaskX: { value: false },
                uFaceOutline: { value: new Array(MAX_FACE_POINTS).fill(new THREE.Vector2()) },
                uNumFacePoints: { value: 0 },
                uHasLandmarks: { value: false },
                uEffectIntensity: { value: 0.5 } // Initial intensity
            };

            planeMaterial.onBeforeCompile = (shader) => {
                console.log("DEBUG: onBeforeCompile triggered.");

                // A. Add custom uniforms to the shader's uniform object
                Object.assign(shader.uniforms, customUniforms);

                // B. Inject uniform declarations and functions into fragment shader
                // Find a place before main() or at the top
                shader.fragmentShader = `
                    // Injected Uniforms
                    uniform sampler2D uSegmentationMask;
                    uniform vec2 uFaceOutline[${MAX_FACE_POINTS}];
                    uniform int uNumFacePoints;
                    uniform float uEffectIntensity;
                    uniform bool uHasMask;
                    uniform bool uHasLandmarks;
                    uniform bool uFlipMaskX;

                    // Injected Functions
                    bool isInsideFace(vec2 pointUV, bool shouldFlipX) {
                        vec2 p = vec2(pointUV.x, 1.0 - pointUV.y);
                        if (shouldFlipX) { p.x = 1.0 - p.x; }
                        bool inside = false;
                        int count = min(uNumFacePoints, ${MAX_FACE_POINTS});
                        if (count < 3) return false;
                        for (int i = 0, j = count - 1; i < count; j = i++) {
                            vec2 pi = uFaceOutline[i];
                            vec2 pj = uFaceOutline[j];
                            if ( ((pi.y > p.y) != (pj.y > p.y)) &&
                                (p.x < (pj.x - pi.x) * (p.y - pi.y) / (pj.y - pi.y + 0.00001) + pi.x) ) {
                                inside = !inside;
                            }
                        }
                        return inside;
                    }

                    vec3 applyHydrationEffect(vec3 c, float intensity){
                         vec3 h=c*(1.0+0.1*intensity);
                         h+=vec3(0.05*intensity);
                         return clamp(h, 0.0, 1.0); // Clamp here too
                    }

                ` + shader.fragmentShader;

                 // C. Modify the main logic - inject before final color assignment
                 // We replace the standard map/color output part
                 shader.fragmentShader = shader.fragmentShader.replace(
                     '#include <color_fragment>', // Common injection point before final color calcs
                     `
                        vec4 diffuseColor = vec4(1.0); // Default white

                        #ifdef USE_MAP
                           vec4 texelColor = texture2D( map, vMapUv );
                           diffuseColor *= texelColor;
                        #endif

                         #ifdef USE_COLOR
                           diffuseColor.rgb *= vColor.rgb;
                         #endif

                         // --- START CUSTOM LOGIC ---
                         vec3 finalColor = diffuseColor.rgb; // Start with base color/texture
                         bool applyEffect = false;

                         // Check prerequisites
                         if(uHasLandmarks && uNumFacePoints > 2 && uHasMask && uEffectIntensity > 0.01) {
                             // Check if pixel is inside the face polygon
                             if (isInsideFace(vMapUv, uFlipMaskX)) { // Use vMapUv (correct UV after potential transform)
                                 // If inside face polygon, check the silhouette mask value
                                 float maskCoordX = uFlipMaskX ? (1.0 - vMapUv.x) : vMapUv.x; // Use vMapUv
                                 float maskCoordY = 1.0 - vMapUv.y;                           // Use vMapUv
                                 float silhouetteMaskValue = texture2D(uSegmentationMask, vec2(maskCoordX, maskCoordY)).r;

                                 // Apply effect only if also inside the silhouette
                                 if (silhouetteMaskValue > 0.5) {
                                     applyEffect = true;
                                 }
                             }
                         }

                         if (applyEffect) {
                             finalColor = applyHydrationEffect(finalColor, uEffectIntensity);
                         }
                         // --- END CUSTOM LOGIC ---

                         diffuseColor.rgb = finalColor; // Overwrite diffuseColor with our result

                         // Original color_fragment chunk continues after this replacement...
                     `
                 );

                  // Optional: Log the modified shader for debugging
                 // console.log("------ Modified Fragment Shader ------");
                 // console.log(shader.fragmentShader);
                 // console.log("------------------------------------");
            }; // End of onBeforeCompile

            console.log("DEBUG: onBeforeCompile handler assigned.");

            // 6. Mesh
            planeMeshRef.current = new THREE.Mesh(planeGeometry, planeMaterial);
            sceneRef.current.add(planeMeshRef.current);
            console.log("DEBUG: Plane mesh added to scene.");

            // 7. Finalize
            isInitialized.current = true;
            handleResize(); // Set initial size
            cancelAnimationFrame(animationFrameHandle.current);
            animationFrameHandle.current = requestAnimationFrame(renderLoop);
            console.log("DEBUG: initThreeScene SUCCESSFUL.");

        } catch (error) {
            console.error("DEBUG: initThreeScene FAILED:", error);
            isInitialized.current = false;
        }
    }, [handleResize, renderLoop]); // Dependencies


    // --- Setup / Cleanup Effect (No Composer/ShaderPass refs) ---
    useEffect(() => {
        console.log("TryOnRenderer onBeforeCompile: Mounting, calling initThreeScene.");
        initThreeScene();
        let resizeObserver; const currentCanvas = canvasRef.current;
        if (currentCanvas) { resizeObserver = new ResizeObserver(() => { handleResize(); }); resizeObserver.observe(currentCanvas); }
        return () => {
            console.log("TryOnRenderer onBeforeCompile: Unmounting, cleaning up...");
            resizeObserver?.disconnect(); cancelAnimationFrame(animationFrameHandle.current); isInitialized.current = false;
            // Dispose textures
            videoTextureRef.current?.dispose(); videoTextureRef.current = null;
            imageTextureRef.current?.dispose(); imageTextureRef.current = null;
            segmentationTextureRef.current?.dispose(); segmentationTextureRef.current = null;
            // Dispose mesh, geometry, material
            planeMeshRef.current?.geometry?.dispose();
            planeMeshRef.current?.material?.map?.dispose(); // Dispose map if necessary
            planeMeshRef.current?.material?.dispose(); planeMeshRef.current = null;
            // Dispose renderer
            rendererInstanceRef.current?.dispose(); rendererInstanceRef.current = null;
            sceneRef.current = null; cameraRef.current = null;
            console.log("TryOnRenderer onBeforeCompile: Cleanup complete.");
        };
     }, [initThreeScene, handleResize]);


    // --- JSX ---
    return ( <canvas ref={canvasRef} className={`renderer-canvas ${className || ''}`} style={{ display: 'block', width: '100%', height: '100%', ...(style || {}) }} /> );

});
TryOnRenderer.displayName = 'TryOnRenderer';
export default TryOnRenderer;