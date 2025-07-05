// src/pages/LipstickMirrorLive_Clone.jsx

import React, { useEffect, useRef, useState } from 'react';
import createPipelines from '@/utils/createPipelines';
import { FaceLandmarker, FilesetResolver } from '@mediapipe/tasks-vision';
import { load } from '@loaders.gl/core';
// getAccessorData is the official helper function we need.
import { GLTFLoader, getAccessorData } from '@loaders.gl/gltf';
import { mat4, vec3 } from 'gl-matrix';

const LIPSTICK_COLORS = [
  { name: 'Nude Pink', value: [228/255, 170/255, 170/255, 0.85] },
  { name: 'Classic Red', value: [200/255, 0/255, 0/255, 0.9] },
  { name: 'Deep Plum', value: [100/255, 20/255, 50/255, 0.85] },
  { name: 'Coral Burst', value: [255/255, 100/255, 80/255, 0.8] },
  { name: 'Soft Mauve', value: [180/255, 120/255, 150/255, 0.8] },
  { name: 'Highlight Gloss', value: [1.0, 1.0, 1.0, 0.3] },
];

async function loadImageBitmap(url) {
  const response = await fetch(url);
  if (!response.ok) { throw new Error(`Failed to fetch image ${url}: ${response.statusText}`); }
  const blob = await response.blob();
  return createImageBitmap(blob);
}

function calculateBoundingBoxCenter(positions) {
  if (!positions || positions.length < 3) return vec3.create();
  let minX = Infinity, minY = Infinity, minZ = Infinity;
  let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;
  for (let i = 0; i < positions.length; i += 3) {
    const x = positions[i];
    const y = positions[i + 1];
    const z = positions[i + 2];
    minX = Math.min(minX, x);
    minY = Math.min(minY, y);
    minZ = Math.min(minZ, z);
    maxX = Math.max(maxX, x);
    maxY = Math.max(maxY, y);
    maxZ = Math.max(maxZ, z);
  }
  const center = vec3.fromValues((minX + maxX) / 2, (minY + maxY) / 2, (minZ + maxZ) / 2);
  console.log("Calculated model center:", center);
  return center;
}

export default function LipstickMirrorLive_Clone() {
  const canvasRef = useRef(null); const videoRef = useRef(null); const animationFrameIdRef = useRef(null); const frameCounter = useRef(0); const resizeHandlerRef = useRef(null); const deviceRef = useRef(null); const contextRef = useRef(null); const formatRef = useRef(null); const landmarkerRef = useRef(null);
  const [selectedColorUI, setSelectedColorUI] = useState(LIPSTICK_COLORS[0].value); const selectedColorForRenderRef = useRef(LIPSTICK_COLORS[0].value);
  const lightSettingsRef = useRef({ lightDirection: [0.2, 0.5, 0.8], ambientColor: [0.1, 0.1, 0.1, 1.0], diffuseColor: [0.9, 0.9, 0.9, 1.0], cameraWorldPosition: [0, 0, 10.0] });
  
  const pipelineStateRef = useRef({
    videoPipeline: null, videoBindGroupLayout: null, videoSampler: null, videoAspectRatioGroupLayout: null, videoAspectRatioUBO: null, videoAspectRatioBindGroup: null,
    lipstickMaterialGroupLayout: null, lipstickMaterialUniformBuffer: null,
    lightingGroupLayout: null, lightingUniformBuffer: null, lipModelLightingBindGroup: null,
    lipstickAlbedoTexture: null, lipstickAlbedoTextureView: null,
    lipstickNormalTexture: null, lipstickNormalTextureView: null,
    lipstickAlbedoSampler: null,
    lipModelData: null, lipModelVertexBuffer: null, lipModelIndexBuffer: null,
    lipModelIndexFormat: 'uint16', lipModelNumIndices: 0,
    lipModelPipeline: null, lipModelMaterialBindGroup: null,
    lipModelMatrixGroupLayout: null, lipModelMatrixUBO: null, lipModelMatrixBindGroup: null,
    depthTexture: null, depthTextureView: null,
  });

  const [landmarkerState, setLandmarkerState] = useState(null); const [error, setError] = useState(null); const [debugMessage, setDebugMessage] = useState('Initializing...');
  useEffect(() => { selectedColorForRenderRef.current = selectedColorUI; }, [selectedColorUI]);

  useEffect(() => {
    let deviceInternal = null, contextInternal = null, formatInternal = null;
    let resizeObserverInternal = null; let renderLoopStartedInternal = false;
    const canvasElement = canvasRef.current; const videoElement = videoRef.current; 
    if (!canvasElement || !videoElement) { setError("Canvas or Video element not found."); return; }

    const configureCanvasAndDepthTexture = () => {
        if (!deviceInternal || !contextInternal || !formatInternal || !canvasRef.current) { return; }
        const currentCanvas = canvasRef.current;
        const dpr = window.devicePixelRatio || 1;
        const cw = currentCanvas.clientWidth; const ch = currentCanvas.clientHeight;
        if (cw === 0 || ch === 0) { return; }
        const targetWidth = Math.floor(cw * dpr); const targetHeight = Math.floor(ch * dpr);
        let needsReconfigure = false;
        if (currentCanvas.width !== targetWidth || currentCanvas.height !== targetHeight) { currentCanvas.width = targetWidth; currentCanvas.height = targetHeight; needsReconfigure = true; }
        try { contextInternal.configure({ device: deviceInternal, format: formatInternal, alphaMode: 'opaque', size: [targetWidth, targetHeight] }); } 
        catch (e) { setError("Error config context: " + e.message); console.error("Error config context:", e); return; }
        const pState = pipelineStateRef.current;
        if (needsReconfigure || !pState.depthTexture || pState.depthTexture.width !== targetWidth || pState.depthTexture.height !== targetHeight) {
            pState.depthTexture?.destroy(); 
            pState.depthTexture = deviceInternal.createTexture({ size: [targetWidth, targetHeight], format: 'depth24plus', usage: GPUTextureUsage.RENDER_ATTACHMENT, label: "Depth Texture" });
            pState.depthTextureView = pState.depthTexture.createView({ label: "Depth Texture View"});
            console.log(`[LML_Clone] Canvas configured (${targetWidth}x${targetHeight}), Depth texture (re)created.`);
        }
    };
    resizeHandlerRef.current = configureCanvasAndDepthTexture;

    const render = async () => {
        const currentDevice = deviceRef.current;
        const currentContext = contextRef.current;
        const currentVideoEl = videoRef.current;
        const pState = pipelineStateRef.current;
        const activeLandmarker = landmarkerRef.current;

        if (!currentDevice || !currentContext || !pState.videoPipeline || !pState.depthTextureView || (pState.lipModelData && !pState.lipModelPipeline) ) {
            animationFrameIdRef.current = requestAnimationFrame(render);
            return;
        }
        frameCounter.current++;
        if (!currentVideoEl || currentVideoEl.readyState < currentVideoEl.HAVE_ENOUGH_DATA || currentVideoEl.videoWidth === 0 || currentVideoEl.videoHeight === 0) {
            animationFrameIdRef.current = requestAnimationFrame(render);
            return;
        }
        if (pState.depthTexture.width !== currentContext.canvas.width || pState.depthTexture.height !== currentContext.canvas.height) {
            configureCanvasAndDepthTexture();
            animationFrameIdRef.current = requestAnimationFrame(render);
            return;
        }
        
        const now = performance.now();
        const landmarkerResult = activeLandmarker?.detectForVideo(currentVideoEl, now);
        const hasFace = landmarkerResult && landmarkerResult.faceLandmarks.length > 0 && landmarkerResult.facialTransformationMatrixes?.length > 0;

        if (pState.videoAspectRatioUBO) {
            const videoDimData = new Float32Array([currentVideoEl.videoWidth, currentVideoEl.videoHeight, currentContext.canvas.width, currentContext.canvas.height]);
            currentDevice.queue.writeBuffer(pState.videoAspectRatioUBO, 0, videoDimData);
        }
        
        if (pState.lipModelMatrixUBO) {
            const projectionMatrix = mat4.create();
            const canvasAspectRatio = currentContext.canvas.width / currentContext.canvas.height;
            mat4.perspective(projectionMatrix, 45 * Math.PI / 180, canvasAspectRatio, 0.1, 1000.0);
            
            const viewMatrix = mat4.create();
            mat4.lookAt(viewMatrix, vec3.fromValues(0, 0, 10), vec3.fromValues(0, 0, 0), vec3.fromValues(0, 1, 0));
            
            let modelMatrix;

            if (hasFace && pState.lipModelData?.modelCenter) {
                modelMatrix = mat4.create();
                const modelCenter = pState.lipModelData.modelCenter;
                const centeringVector = vec3.negate(vec3.create(), modelCenter);
                
                const scaleFactor = 0.05;
                const scaleVector = vec3.fromValues(scaleFactor, scaleFactor, scaleFactor);
                
                mat4.scale(modelMatrix, modelMatrix, scaleVector);
                mat4.translate(modelMatrix, modelMatrix, centeringVector);
                
            } else {
                modelMatrix = mat4.create();
                mat4.scale(modelMatrix, modelMatrix, vec3.fromValues(0, 0, 0));
            }
            
            const sceneMatrices = new Float32Array(16 * 3);
            sceneMatrices.set(projectionMatrix, 0);
            sceneMatrices.set(viewMatrix, 16);
            sceneMatrices.set(modelMatrix, 32);
            currentDevice.queue.writeBuffer(pState.lipModelMatrixUBO, 0, sceneMatrices);
        }

        if (pState.lipstickMaterialUniformBuffer) { const colorData = new Float32Array(selectedColorForRenderRef.current); currentDevice.queue.writeBuffer(pState.lipstickMaterialUniformBuffer, 0, colorData); }
        if (pState.lightingUniformBuffer) { const { lightDirection, ambientColor, diffuseColor, cameraWorldPosition } = lightSettingsRef.current; const lightingData = new Float32Array([ ...lightDirection, 0.0, ...ambientColor, ...diffuseColor, ...cameraWorldPosition, 0.0 ]); currentDevice.queue.writeBuffer(pState.lightingUniformBuffer, 0, lightingData); }
        
        let videoTextureGPU, frameBindGroupForTexture; 
        try { videoTextureGPU = currentDevice.importExternalTexture({ source: currentVideoEl }); if (pState.videoBindGroupLayout && pState.videoSampler) { frameBindGroupForTexture = currentDevice.createBindGroup({ layout: pState.videoBindGroupLayout, entries: [{ binding: 0, resource: pState.videoSampler }, { binding: 1, resource: videoTextureGPU }] }); } else { animationFrameIdRef.current = requestAnimationFrame(render); return; } } catch (e) { console.error("Error importing video texture:", e); animationFrameIdRef.current = requestAnimationFrame(render); return; }
        
        let currentGpuTexture, currentTextureView; 
        try { currentGpuTexture = currentContext.getCurrentTexture(); currentTextureView = currentGpuTexture.createView(); } catch (e) { console.warn("Error getting current texture", e); if (resizeHandlerRef.current) resizeHandlerRef.current(); animationFrameIdRef.current = requestAnimationFrame(render); return; }
        
        const cmdEnc = currentDevice.createCommandEncoder({label: "Main Render Encoder"});
        const passEnc = cmdEnc.beginRenderPass({ colorAttachments: [{ view: currentTextureView, clearValue: { r: 0.0, g: 0.0, b: 0.0, a: 1.0 }, loadOp: 'clear', storeOp: 'store' }], depthStencilAttachment: { view: pState.depthTextureView, depthClearValue: 1.0, depthLoadOp: 'clear', depthStoreOp: 'store' }});
        passEnc.setViewport(0, 0, currentGpuTexture.width, currentGpuTexture.height, 0, 1);
        passEnc.setScissorRect(0, 0, currentGpuTexture.width, currentGpuTexture.height);
        
        if (pState.videoPipeline && frameBindGroupForTexture && pState.videoAspectRatioBindGroup) {
            passEnc.setPipeline(pState.videoPipeline);
            passEnc.setBindGroup(0, frameBindGroupForTexture);
            passEnc.setBindGroup(1, pState.videoAspectRatioBindGroup);
            passEnc.draw(6);
        }
        
        if (hasFace && pState.lipModelPipeline && pState.lipModelVertexBuffer && pState.lipModelIndexBuffer && pState.lipModelNumIndices > 0) {
            passEnc.setPipeline(pState.lipModelPipeline);
            passEnc.setBindGroup(0, pState.lipModelMatrixBindGroup); 
            passEnc.setBindGroup(1, pState.lipModelMaterialBindGroup);   
            passEnc.setBindGroup(2, pState.lipModelLightingBindGroup);   
            passEnc.setVertexBuffer(0, pState.lipModelVertexBuffer);
            passEnc.setIndexBuffer(pState.lipModelIndexBuffer, pState.lipModelIndexFormat);
            passEnc.drawIndexed(pState.lipModelNumIndices);
        }
        passEnc.end(); currentDevice.queue.submit([cmdEnc.finish()]);
        animationFrameIdRef.current = requestAnimationFrame(render);
    };

    const initializeAll = async () => {
        setDebugMessage("Loading 3D Lip Model...");
        try {
            // Load the raw GLTF data. This is the simplest and most robust way.
            const gltfData = await load('/models/lips_model.glb', GLTFLoader);
            
            // The JSON structure is nested under the 'json' key.
            const gltfJson = gltfData.json;
            if (!gltfJson.meshes || gltfJson.meshes.length === 0) {
              throw new Error("No meshes found in gltf.json structure.");
            }

            const primitive = gltfJson.meshes[0].primitives[0];

            // Use the library's official 'getAccessorData' helper.
            // The signature is getAccessorData(gltf, accessorIndex).
            const positions = getAccessorData(gltfData, primitive.attributes.POSITION);
            const normals = getAccessorData(gltfData, primitive.attributes.NORMAL);
            const uvs = getAccessorData(gltfData, primitive.attributes.TEXCOORD_0);
            const indices = getAccessorData(gltfData, primitive.indices);

            if (!positions || !normals || !uvs || !indices) { throw new Error("Essential mesh attributes are missing after processing."); }

            const modelCenter = calculateBoundingBoxCenter(positions);
            pipelineStateRef.current.lipModelData = { positions, normals, uvs, indices, modelCenter };

            console.log("[LML_Clone] Mesh data extracted successfully using library helpers.");
            setDebugMessage("3D Model Parsed. Initializing GPU...");

        } catch (modelLoadError) { console.error("[LML_Clone] Error loading/processing lip model:", modelLoadError); setError(`Model Load: ${modelLoadError.message}`); setDebugMessage("Error: Model Load"); return;  }

        if (!navigator.gpu) { setError("WebGPU not supported."); return; }
        setDebugMessage("Initializing WebGPU...");
        try {
            const vision = await FilesetResolver.forVisionTasks('https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm');
            const lmInstance = await FaceLandmarker.createFromOptions(vision, { baseOptions: { modelAssetPath: '/models/face_landmarker.task', delegate: 'GPU' }, outputFaceLandmarks: true, outputFacialTransformationMatrixes: true, runningMode: 'VIDEO', numFaces: 1 });
            landmarkerRef.current = lmInstance; setLandmarkerState(lmInstance);
            const adapter = await navigator.gpu.requestAdapter(); if (!adapter) throw new Error("No adapter.");
            deviceInternal = await adapter.requestDevice(); deviceRef.current = deviceInternal;
            deviceInternal.lost.then((info) => { console.error(`Device lost: ${info.message}`); setError("Device lost"); deviceRef.current = null; if (animationFrameIdRef.current) cancelAnimationFrame(animationFrameIdRef.current); });
            contextInternal = canvasElement.getContext('webgpu'); contextRef.current = contextInternal;
            formatInternal = navigator.gpu.getPreferredCanvasFormat(); formatRef.current = formatInternal;
            
            configureCanvasAndDepthTexture(); 

            let lipstickAlbedoImageBitmap, lipstickNormalImageBitmap;
            try { lipstickAlbedoImageBitmap = await loadImageBitmap('/textures/lipstick_albedo_gray.png'); } catch (e) { console.warn("Albedo texture load failed.", e); }
            try { lipstickNormalImageBitmap = await loadImageBitmap('/textures/lipstick_normal.png'); } catch (e) { console.warn("Normal map load failed.", e); }
            
            const pState = pipelineStateRef.current;
            const layoutsAndPipelines = await createPipelines(deviceInternal, formatInternal, true); 
            if (!layoutsAndPipelines.videoPipeline || !layoutsAndPipelines.lipModelPipeline) throw new Error(`Pipeline creation failed.`);
            
            pState.videoPipeline = layoutsAndPipelines.videoPipeline; pState.lipModelPipeline = layoutsAndPipelines.lipModelPipeline;
            pState.videoBindGroupLayout = layoutsAndPipelines.videoBindGroupLayout;
            pState.videoAspectRatioGroupLayout = layoutsAndPipelines.videoAspectRatioGroupLayout;
            pState.lipModelMatrixGroupLayout = layoutsAndPipelines.lipModelMatrixGroupLayout;
            pState.lipstickMaterialGroupLayout = layoutsAndPipelines.lipstickMaterialGroupLayout;
            pState.lightingGroupLayout = layoutsAndPipelines.lightingGroupLayout;
            
            pState.videoAspectRatioUBO = deviceInternal.createBuffer({ label: "Video Aspect UBO", size: 4 * 4, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST });
            pState.videoAspectRatioBindGroup = deviceInternal.createBindGroup({ label: "VideoDim_BG", layout: pState.videoAspectRatioGroupLayout, entries: [{binding:0, resource:{buffer:pState.videoAspectRatioUBO}}]});
            
            pState.lipModelMatrixUBO = deviceInternal.createBuffer({ label: "Scene Matrix UB", size: (16 + 16 + 16) * 4, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST });
            pState.lipModelMatrixBindGroup = deviceInternal.createBindGroup({ label: "SceneMatrix_BG", layout: pState.lipModelMatrixGroupLayout, entries: [{binding:0, resource:{buffer:pState.lipModelMatrixUBO}}]});
            
            pState.lipstickMaterialUniformBuffer = deviceInternal.createBuffer({ label: "MaterialTint_UB", size: 4 * 4, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST });
            pState.lightingUniformBuffer = deviceInternal.createBuffer({ label: "Lighting_UB", size: (4 + 4 + 4 + 4) * 4, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST });
            pState.lipModelLightingBindGroup = deviceInternal.createBindGroup({ label: "Lighting_BG", layout: pState.lightingGroupLayout, entries: [{binding:0, resource:{buffer:pState.lightingUniformBuffer}}]});
            
            pState.videoSampler = deviceInternal.createSampler({ magFilter: 'linear', minFilter: 'linear' });
            if (lipstickAlbedoImageBitmap) { pState.lipstickAlbedoTexture = deviceInternal.createTexture({label:"AlbedoTex", size:[lipstickAlbedoImageBitmap.width, lipstickAlbedoImageBitmap.height], format:'rgba8unorm', usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST | GPUTextureUsage.RENDER_ATTACHMENT}); deviceInternal.queue.copyExternalImageToTexture({source:lipstickAlbedoImageBitmap}, {texture:pState.lipstickAlbedoTexture}, [lipstickAlbedoImageBitmap.width, lipstickAlbedoImageBitmap.height]); pState.lipstickAlbedoTextureView = pState.lipstickAlbedoTexture.createView(); }
            pState.lipstickAlbedoSampler = deviceInternal.createSampler({label:"MaterialSampler", magFilter:'linear', minFilter:'linear', addressModeU:'repeat', addressModeV:'repeat'});
            if (lipstickNormalImageBitmap) { pState.lipstickNormalTexture = deviceInternal.createTexture({label:"NormalTex", size:[lipstickNormalImageBitmap.width, lipstickNormalImageBitmap.height], format:'rgba8unorm', usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST | GPUTextureUsage.RENDER_ATTACHMENT}); deviceInternal.queue.copyExternalImageToTexture({source:lipstickNormalImageBitmap}, {texture:pState.lipstickNormalTexture}, [lipstickNormalImageBitmap.width, lipstickNormalImageBitmap.height]); pState.lipstickNormalTextureView = pState.lipstickNormalTexture.createView(); }
            
            const materialEntries = [{binding:0, resource:{buffer:pState.lipstickMaterialUniformBuffer}}];
            if (pState.lipstickAlbedoTextureView) materialEntries.push({binding:1, resource:pState.lipstickAlbedoTextureView});
            if (pState.lipstickAlbedoSampler) materialEntries.push({binding:2, resource:pState.lipstickAlbedoSampler});
            if (pState.lipstickNormalTextureView) materialEntries.push({binding:3, resource:pState.lipstickNormalTextureView});
            if (pState.lipstickMaterialGroupLayout && pState.lipstickMaterialUniformBuffer ) { pState.lipModelMaterialBindGroup = deviceInternal.createBindGroup({label:"3DLipMatBG", layout:pState.lipstickMaterialGroupLayout, entries: materialEntries}); } else { throw new Error("Material BG creation failed."); }
            
            const model = pState.lipModelData;
            const numVertices = model.positions.length / 3;
            const interleavedBufferData = new Float32Array(numVertices * 8); 
            for (let i = 0; i < numVertices; i++) { let offset = i * 8; interleavedBufferData[offset++] = model.positions[i*3+0]; interleavedBufferData[offset++] = model.positions[i*3+1]; interleavedBufferData[offset++] = model.positions[i*3+2]; interleavedBufferData[offset++] = model.normals[i*3+0]; interleavedBufferData[offset++] = model.normals[i*3+1]; interleavedBufferData[offset++] = model.normals[i*3+2]; interleavedBufferData[offset++] = model.uvs[i*2+0]; interleavedBufferData[offset++] = model.uvs[i*2+1]; }
            
            pState.lipModelVertexBuffer = deviceInternal.createBuffer({ label: "3DLipVB_Interleaved", size: interleavedBufferData.byteLength, usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST });
            deviceInternal.queue.writeBuffer(pState.lipModelVertexBuffer, 0, interleavedBufferData);
            
            let indicesData = model.indices; let dataToWriteToGpu = indicesData; let finalIndexByteLength = indicesData.byteLength;
            if (indicesData.byteLength % 4 !== 0) { finalIndexByteLength = Math.ceil(indicesData.byteLength / 4) * 4; const paddedBuffer = new Uint8Array(finalIndexByteLength); paddedBuffer.set(new Uint8Array(indicesData.buffer, indicesData.byteOffset, indicesData.byteLength)); dataToWriteToGpu = paddedBuffer; }
            pState.lipModelIndexBuffer = deviceInternal.createBuffer({ label: "3DLipIB", size: finalIndexByteLength, usage: GPUBufferUsage.INDEX | GPUBufferUsage.COPY_DST });
            deviceInternal.queue.writeBuffer(pState.lipModelIndexBuffer, 0, dataToWriteToGpu, 0, finalIndexByteLength);
            
            if (model.indices.BYTES_PER_ELEMENT === 2) { pState.lipModelIndexFormat = 'uint16'; } 
            else if (model.indices.BYTES_PER_ELEMENT === 4) { pState.lipModelIndexFormat = 'uint32'; } 
            
            pState.lipModelNumIndices = model.indices.length;
            console.log(`[LML_Clone] Created Interleaved VB & IB (${pState.lipModelNumIndices}i)`);
            
            const stream = await navigator.mediaDevices.getUserMedia({ video: { width: 640, height: 480 } }); videoElement.srcObject = stream; await new Promise((res, rej) => { videoElement.onloadedmetadata = res; videoElement.onerror = () => rej(new Error("Video metadata error."));}); await videoElement.play();
            resizeObserverInternal = new ResizeObserver(resizeHandlerRef.current); resizeObserverInternal.observe(canvasElement);
            configureCanvasAndDepthTexture(); 
            
            console.log("[LML_Clone] GPU resources and video initialized.");
            setDebugMessage("Ready (3D Model).");
            if (!renderLoopStartedInternal) { render(); renderLoopStartedInternal = true; }
        } catch (err) { setError(`GPU Init: ${err.message}`); console.error("[LML_Clone] GPU Init Error:", err); setDebugMessage("Error: GPU Init"); }
    };

    initializeAll();
    return () => { 
        if (animationFrameIdRef.current) cancelAnimationFrame(animationFrameIdRef.current); 
        if (resizeObserverInternal && canvasElement.current) resizeObserverInternal.unobserve(canvasElement.current); 
        if (resizeObserverInternal) resizeObserverInternal.disconnect(); 
        videoRef.current?.srcObject?.getTracks().forEach(t => t.stop()); 
        if (videoRef.current) videoRef.current.srcObject = null; 
        const pState=pipelineStateRef.current; 
        pState.videoAspectRatioUBO?.destroy(); pState.lipModelMatrixUBO?.destroy();
        pState.lipstickMaterialUniformBuffer?.destroy();
        pState.lightingUniformBuffer?.destroy(); pState.lipstickAlbedoTexture?.destroy();
        pState.lipstickNormalTexture?.destroy();
        pState.lipModelVertexBuffer?.destroy();
        pState.lipModelIndexBuffer?.destroy(); pState.depthTexture?.destroy(); 
        if (landmarkerRef.current?.close) landmarkerRef.current.close(); 
        landmarkerRef.current=null; setLandmarkerState(null); 
        deviceRef.current=null; contextRef.current=null; formatRef.current=null; 
    };
  }, []);

  useEffect(() => { 
    if (error) { setDebugMessage(`Error: ${error}`); } 
    else if (landmarkerState && deviceRef.current && contextRef.current && pipelineStateRef.current.lipModelPipeline) { setDebugMessage("Live Active (3D Model)"); } 
    else if (pipelineStateRef.current.lipModelData && !error && !pipelineStateRef.current.lipModelPipeline) { setDebugMessage("Model Parsed, GPU Init..."); } 
    else if (!pipelineStateRef.current.lipModelData && !error) { setDebugMessage("Initializing (3D Model Load)..."); } 
  }, [landmarkerState, deviceRef.current, contextRef.current, pipelineStateRef.current.lipModelPipeline, pipelineStateRef.current.lipModelData, error]);

  return ( 
    <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, overflow: 'hidden', margin: 0, padding: 0, background: 'darkslateblue' }}>
      <div style={{ position: 'absolute', top: '5px', left: '5px', background: 'rgba(0,0,0,0.7)', color: 'white', padding: '2px 5px', fontSize: '12px', zIndex: 20, pointerEvents: 'none' }}>
        {debugMessage}
      </div>
      <div style={{ position: 'absolute', bottom: '20px', left: '50%', transform: 'translateX(-50%)', display: 'flex', gap: '10px', padding: '10px', backgroundColor: 'rgba(255, 255, 255, 0.2)', borderRadius: '10px', zIndex: 10 }}>
        {LIPSTICK_COLORS.map(color => ( <div key={color.name} title={color.name} onClick={() => setSelectedColorUI(color.value)} style={{ width: '40px', height: '40px', backgroundColor: `rgba(${color.value[0]*255}, ${color.value[1]*255}, ${color.value[2]*255}, ${color.value[3]})`, borderRadius: '50%', border: selectedColorUI === color.value ? '3px solid white' : '3px solid transparent', cursor: 'pointer', transition: 'border 0.2s ease-in-out' }} /> ))}
      </div>
      <video ref={videoRef} style={{ display: 'none' }} width={640} height={480} autoPlay playsInline muted />
      <canvas ref={canvasRef} width={640} height={480} style={{ width: '100%', height: '100%', display: 'block', background: 'lightpink' }} />
    </div>
  );
}