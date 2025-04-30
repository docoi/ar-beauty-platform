// src/components/TryOnRenderer.jsx - Reads Silhouette Mask from ImageSegmenter results
// Includes HalfFloatType Render Target Fix
// !! Applies MASK ALIGNMENT FIX in Fragment Shader !!

import React, { useRef, forwardRef, useEffect, useCallback } from 'react';
import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { UniformsUtils } from 'three';

const TryOnRenderer = forwardRef(({
    videoRefProp, imageElement,
    mediaPipeResults, // Passed but not used for mask
    segmentationResults, // USED for silhouette mask
    isStatic,
    effectIntensity,
    className, style
 }, ref) => {

    // --- Core Refs / Internal State Refs (No changes) ---
    const canvasRef = useRef(null); const rendererInstanceRef = useRef(null); const animationFrameHandle = useRef(null); const isInitialized = useRef(false);
    const baseSceneRef = useRef(null); const baseCameraRef = useRef(null); const basePlaneMeshRef = useRef(null); const videoTextureRef = useRef(null);
    const imageTextureRef = useRef(null); const segmentationTextureRef = useRef(null);
    const composerRef = useRef(null); const effectPassRef = useRef(null);
    const currentIntensity = useRef(0.5);
    const renderLoopCounter = useRef(0); const lastMaskUpdateTime = useRef(0);


    // --- Shaders (CORRECTED MASK SAMPLING LOGIC) ---
    const customVertexShader = `varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 ); }`;
    // !! Shader uses uFlipMaskX correctly !!
    const customFragmentShader = `
        uniform sampler2D tDiffuse;
        uniform sampler2D uSegmentationMask;
        uniform float uEffectIntensity;
        uniform bool uHasMask;
        uniform bool uFlipMaskX; // <<< Now USED correctly

        varying vec2 vUv;

        vec3 applyHydrationEffect(vec3 c){ vec3 h=c*(1.0+0.1*uEffectIntensity); h+=vec3(0.05*uEffectIntensity); return h; }

        void main() {
            vec4 bC=texture2D(tDiffuse,vUv);
            vec3 fC=bC.rgb;

            if(uHasMask && uEffectIntensity > 0.01) {
                // <<< APPLY CONDITIONAL X FLIP for mask sampling >>>
                float maskCoordX = uFlipMaskX ? (1.0 - vUv.x) : vUv.x; // Correct X coord
                float maskCoordY = 1.0 - vUv.y;                       // Correct Y coord
                // Sample using the corrected coordinates
                float mV = texture2D(uSegmentationMask, vec2(maskCoordX, maskCoordY)).r; // *** THE ONLY LINE CHANGED ***

                vec3 hC=applyHydrationEffect(fC);
                float bA=smoothstep(0.3, 0.8, mV) * uEffectIntensity;
                fC=mix(fC, hC, bA);
            }
            fC=clamp(fC, 0.0, 1.0);
            gl_FragColor=vec4(fC, bC.a);
        }
    `;

    const HydrationShader = useRef({
        uniforms: { 'tDiffuse': { value: null }, 'uSegmentationMask': { value: null }, 'uEffectIntensity': { value: 0.5 }, 'uHasMask': { value: false }, 'uFlipMaskX': { value: false } },
        vertexShader: customVertexShader, fragmentShader: customFragmentShader
    }).current;


    // --- Prop Effects / Texture Effects (No changes) ---
    useEffect(() => { currentIntensity.current = effectIntensity; if (effectPassRef.current) { effectPassRef.current.uniforms.uEffectIntensity.value = currentIntensity.current; } }, [effectIntensity]);
    useEffect(() => { /* Video Texture */ const videoElement = videoRefProp?.current; if (!isStatic && videoElement && videoElement.readyState >= videoElement.HAVE_METADATA) { if (!videoTextureRef.current || videoTextureRef.current.image !== videoElement) { videoTextureRef.current?.dispose(); videoTextureRef.current = new THREE.VideoTexture(videoElement); videoTextureRef.current.colorSpace = THREE.SRGBColorSpace; } } else if (!isStatic && videoTextureRef.current) { videoTextureRef.current.dispose(); videoTextureRef.current = null; } }, [isStatic, videoRefProp, videoRefProp?.current?.readyState]);
    useEffect(() => { /* Image Texture */ if (isStatic && imageElement && imageElement.complete && imageElement.naturalWidth > 0) { if (!imageTextureRef.current || imageTextureRef.current.image !== imageElement) { imageTextureRef.current?.dispose(); imageTextureRef.current = new THREE.Texture(imageElement); imageTextureRef.current.colorSpace = THREE.SRGBColorSpace; imageTextureRef.current.needsUpdate = true; } } else if (isStatic && imageTextureRef.current) { imageTextureRef.current.dispose(); imageTextureRef.current = null; } }, [isStatic, imageElement, imageElement?.complete]);
    useEffect(() => { /* Segmentation Mask Texture */ const results = segmentationResults; const hasMaskData = results?.confidenceMasks?.[0]; if (hasMaskData) { const confidenceMaskObject = results.confidenceMasks[0]; const maskWidth = confidenceMaskObject?.width; const maskHeight = confidenceMaskObject?.height; let maskData = null; try { if (typeof confidenceMaskObject?.getAsFloat32Array === 'function') { maskData = confidenceMaskObject.getAsFloat32Array(); } else if (confidenceMaskObject?.data instanceof Float32Array) { maskData = confidenceMaskObject.data; } else { console.warn("TryOnRenderer: confidenceMasks[0] data format not recognized."); } } catch (error) { console.error("TryOnRenderer: Error getting mask data from confidenceMasks:", error); maskData = null; } if (maskData instanceof Float32Array && maskWidth > 0 && maskHeight > 0) { const now = performance.now(); const timeSinceLastUpdate = now - lastMaskUpdateTime.current; const throttleThreshold = isStatic ? 0 : 66; if (timeSinceLastUpdate > throttleThreshold) { lastMaskUpdateTime.current = now; try { let texture = segmentationTextureRef.current; if (!texture || texture.image.width !== maskWidth || texture.image.height !== maskHeight) { texture?.dispose(); texture = new THREE.DataTexture(maskData, maskWidth, maskHeight, THREE.RedFormat, THREE.FloatType); texture.minFilter = THREE.NearestFilter; texture.magFilter = THREE.NearestFilter; texture.generateMipmaps = false; texture.needsUpdate = true; segmentationTextureRef.current = texture; } else { texture.image.data = maskData; texture.needsUpdate = true; } if (effectPassRef.current) { effectPassRef.current.uniforms.uSegmentationMask.value = segmentationTextureRef.current; effectPassRef.current.uniforms.uHasMask.value = true; } } catch (error) { console.error("TryOnRenderer: Error processing mask texture from ImageSegmenter:", error); segmentationTextureRef.current?.dispose(); segmentationTextureRef.current = null; if (effectPassRef.current) { effectPassRef.current.uniforms.uSegmentationMask.value = null; effectPassRef.current.uniforms.uHasMask.value = false; } } } else { if (effectPassRef.current && effectPassRef.current.uniforms.uSegmentationMask.value !== segmentationTextureRef.current) { effectPassRef.current.uniforms.uSegmentationMask.value = segmentationTextureRef.current; effectPassRef.current.uniforms.uHasMask.value = !!segmentationTextureRef.current; } } } else { if (segmentationTextureRef.current) { segmentationTextureRef.current.dispose(); segmentationTextureRef.current = null; } if (effectPassRef.current) { effectPassRef.current.uniforms.uSegmentationMask.value = null; effectPassRef.current.uniforms.uHasMask.value = false; } } } else { if (segmentationTextureRef.current) { segmentationTextureRef.current.dispose(); segmentationTextureRef.current = null; } if (effectPassRef.current) { effectPassRef.current.uniforms.uSegmentationMask.value = null; effectPassRef.current.uniforms.uHasMask.value = false; } } }, [segmentationResults, isStatic]);


    // --- Handle Resizing (No changes) ---
    const handleResize = useCallback(() => { const canvas = canvasRef.current; if (!rendererInstanceRef.current || !baseCameraRef.current || !composerRef.current || !composerRef.current.renderTarget || !canvas) return; const newWidth = canvas.clientWidth; const newHeight = canvas.clientHeight; if (newWidth === 0 || newHeight === 0) return; const currentSize = rendererInstanceRef.current.getSize(new THREE.Vector2()); if (currentSize.x === newWidth && currentSize.y === newHeight) return; try { rendererInstanceRef.current.setSize(newWidth, newHeight); composerRef.current.renderTarget.setSize(newWidth, newHeight); composerRef.current.setSize(newWidth, newHeight); baseCameraRef.current.left = -newWidth / 2; baseCameraRef.current.right = newWidth / 2; baseCameraRef.current.top = newHeight / 2; baseCameraRef.current.bottom = -newHeight / 2; baseCameraRef.current.updateProjectionMatrix(); } catch (e) { console.error("TryOnRenderer: Resize Error:", e); } }, []);
    // --- Scale Base Plane (No changes) ---
    const fitPlaneToCamera = useCallback((textureWidth, textureHeight) => { const canvas = canvasRef.current; if (!baseCameraRef.current || !basePlaneMeshRef.current || !textureWidth || !textureHeight || !canvas) return; const viewWidth = canvas.clientWidth; const viewHeight = canvas.clientHeight; if (viewWidth === 0 || viewHeight === 0) return; const viewAspect = viewWidth / viewHeight; const textureAspect = textureWidth / textureHeight; let scaleX, scaleY; if (viewAspect > textureAspect) { scaleX = viewWidth; scaleY = viewWidth / textureAspect; } else { scaleY = viewHeight; scaleX = viewHeight * textureAspect; } const currentScale = basePlaneMeshRef.current.scale; const signX = Math.sign(currentScale.x) || 1; const newScaleXWithSign = scaleX * signX; if (Math.abs(currentScale.y - scaleY) > 0.01 || Math.abs(currentScale.x - newScaleXWithSign) > 0.01) { currentScale.set(newScaleXWithSign, scaleY, 1); } }, []);


    // --- Render Loop (No changes) ---
     const renderLoop = useCallback(() => {
        animationFrameHandle.current = requestAnimationFrame(renderLoop); renderLoopCounter.current++; if (!isInitialized.current || !rendererInstanceRef.current || !composerRef.current || !basePlaneMeshRef.current || !effectPassRef.current) { return; } try { const baseMaterial = basePlaneMeshRef.current.material; let sourceWidth = 0, sourceHeight = 0; let textureToAssign = null; let isVideo = !isStatic; let needsTextureUpdate = false; if (isVideo && videoTextureRef.current) { textureToAssign = videoTextureRef.current; const video = textureToAssign.image; if(video && video.readyState >= video.HAVE_CURRENT_DATA) { sourceWidth = video.videoWidth; sourceHeight = video.videoHeight; needsTextureUpdate = (baseMaterial.map !== textureToAssign); } else { textureToAssign = null; } } else if (isStatic && imageTextureRef.current) { textureToAssign = imageTextureRef.current; const image = textureToAssign.image; if(image && image.complete && image.naturalWidth > 0) { sourceWidth = image.naturalWidth; sourceHeight = image.naturalHeight; needsTextureUpdate = (baseMaterial.map !== textureToAssign) || textureToAssign.needsUpdate; } else { textureToAssign = null; } } if (baseMaterial && needsTextureUpdate) { baseMaterial.map = textureToAssign; baseMaterial.needsUpdate = true; } else if (baseMaterial && baseMaterial.map !== textureToAssign && !textureToAssign) { baseMaterial.map = null; baseMaterial.needsUpdate = true; } const planeVisible = !!baseMaterial?.map && sourceWidth > 0 && sourceHeight > 0; if (planeVisible) { fitPlaneToCamera(sourceWidth, sourceHeight); const scaleX = Math.abs(basePlaneMeshRef.current.scale.x); const newScaleX = isVideo ? -scaleX : scaleX; if(basePlaneMeshRef.current.scale.x !== newScaleX) { basePlaneMeshRef.current.scale.x = newScaleX; } } else { if (basePlaneMeshRef.current.scale.x !== 0 || basePlaneMeshRef.current.scale.y !== 0) { basePlaneMeshRef.current.scale.set(0, 0, 0); } } if (planeVisible && textureToAssign && textureToAssign.needsUpdate) { textureToAssign.needsUpdate = false; }
             // Update Uniforms
             if (effectPassRef.current) { const uniforms = effectPassRef.current.uniforms; if (uniforms.uSegmentationMask.value !== segmentationTextureRef.current) { uniforms.uSegmentationMask.value = segmentationTextureRef.current; uniforms.uHasMask.value = !!segmentationTextureRef.current; } uniforms.uFlipMaskX.value = isVideo; } // Set flip flag
            // Render
            composerRef.current.render();
        } catch (error) { console.error("TryOnRenderer: Error in renderLoop:", error); }
    }, [fitPlaneToCamera, isStatic]);


    // --- Initialize Scene (No changes) ---
    const initThreeScene = useCallback(() => { /* ... */ }, [handleResize, renderLoop, HydrationShader]);
    // --- Setup / Cleanup Effect (No changes) ---
    useEffect(() => { /* ... */ }, [initThreeScene, handleResize]);


    // --- JSX --- (No change)
    return ( <canvas ref={canvasRef} className={`renderer-canvas ${className || ''}`} style={{ display: 'block', width: '100%', height: '100%', ...(style || {}) }} /> );

});
TryOnRenderer.displayName = 'TryOnRenderer';
export default TryOnRenderer;