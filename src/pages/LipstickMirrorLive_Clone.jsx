// src/pages/LipstickMirrorLive_Clone.jsx

import React, { useEffect, useRef, useState } from 'react';
import createPipelines from '@/utils/createPipelines';
import { FaceLandmarker, FilesetResolver } from '@mediapipe/tasks-vision';
import { load } from '@loaders.gl/core';
import { GLTFLoader } from '@loaders.gl/gltf';
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

function getAccessorDataFromGLTF(gltfJson, accessorIndex, mainBinaryBuffer) {
    const accessor = gltfJson.accessors[accessorIndex];
    if (!accessor) throw new Error(`Accessor ${accessorIndex} not found.`);
    const bufferView = gltfJson.bufferViews[accessor.bufferView];
    if (!bufferView) throw new Error(`BufferView ${accessor.bufferView} not found for accessor ${accessorIndex}.`);
    const componentType = accessor.componentType; const type = accessor.type; const count = accessor.count; 
    let numComponents;
    switch (type) { case "SCALAR": numComponents = 1; break; case "VEC2":   numComponents = 2; break; case "VEC3":   numComponents = 3; break; case "VEC4":   numComponents = 4; break; default: throw new Error(`Unsupported accessor type: ${type}`);}
    let TypedArrayConstructor; let componentByteSize = 0;
    switch (componentType) { case 5120: TypedArrayConstructor = Int8Array; componentByteSize = 1; break; case 5121: TypedArrayConstructor = Uint8Array; componentByteSize = 1; break; case 5122: TypedArrayConstructor = Int16Array; componentByteSize = 2; break; case 5123: TypedArrayConstructor = Uint16Array; componentByteSize = 2; break; case 5125: TypedArrayConstructor = Uint32Array; componentByteSize = 4; break; case 5126: TypedArrayConstructor = Float32Array; componentByteSize = 4; break; default: throw new Error(`Unsupported component type: ${componentType}`);}
    const totalElements = count * numComponents; const accessorByteLength = totalElements * componentByteSize;
    const byteOffset = (bufferView.byteOffset || 0) + (accessor.byteOffset || 0);
    if (mainBinaryBuffer.byteLength < byteOffset + accessorByteLength) { throw new Error( `Buffer access out of bounds for accessor ${accessorIndex}. Offset: ${byteOffset}, Length: ${accessorByteLength}, BufferSize: ${mainBinaryBuffer.byteLength}. BV target: ${bufferView.target || 'N/A'}, bvLength: ${bufferView.byteLength}` ); }
    const bufferSlice = mainBinaryBuffer.slice(byteOffset, byteOffset + accessorByteLength);
    return new TypedArrayConstructor(bufferSlice);
}

export default function LipstickMirrorLive_Clone() {
  const canvasRef = useRef(null); const videoRef = useRef(null); const animationFrameIdRef = useRef(null); const frameCounter = useRef(0); const resizeHandlerRef = useRef(null); const deviceRef = useRef(null); const contextRef = useRef(null); const formatRef = useRef(null); const landmarkerRef = useRef(null);
  const [selectedColorUI, setSelectedColorUI] = useState(LIPSTICK_COLORS[0].value); const selectedColorForRenderRef = useRef(LIPSTICK_COLORS[0].value);
  const lightSettingsRef = useRef({ lightDirection: [0.2, 0.5, 0.8], ambientColor: [0.1, 0.1, 0.1, 1.0], diffuseColor: [0.9, 0.9, 0.9, 1.0], cameraWorldPosition: [0, 0, 1.0] });
  
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
    console.log("[LML_Clone 3DModel] Main useEffect (Final Render with Tracking).");
    let deviceInternal = null, contextInternal = null, formatInternal = null;
    let resizeObserverInternal = null; let renderLoopStartedInternal = false;
    const canvasElement = canvasRef.current; const videoElement = videoRef.current; 
    if (!canvasElement || !videoElement) { setError("Canvas or Video element not found."); return; }

    const configureCanvasAndDepthTexture = () => { /* ... (Same as before) ... */ };
    resizeHandlerRef.current = configureCanvasAndDepthTexture;

    const render = async () => {
        const currentDevice = deviceRef.current; const currentContext = contextRef.current;
        const currentVideoEl = videoRef.current; const pState = pipelineStateRef.current;
        const activeLandmarker = landmarkerRef.current;

        if (!currentDevice || !currentContext || !pState.videoPipeline || !pState.depthTextureView || (pState.lipModelData && !pState.lipModelPipeline) ) { animationFrameIdRef.current = requestAnimationFrame(render); return; }
        frameCounter.current++;
        if (!currentVideoEl || currentVideoEl.readyState < currentVideoEl.HAVE_ENOUGH_DATA || currentVideoEl.videoWidth === 0 || currentVideoEl.videoHeight === 0) { animationFrameIdRef.current = requestAnimationFrame(render); return; }
        if (pState.depthTexture.width !== currentContext.canvas.width || pState.depthTexture.height !== currentContext.canvas.height) { configureCanvasAndDepthTexture(); animationFrameIdRef.current = requestAnimationFrame(render); return; }
        
        const now = performance.now();
        const landmarkerResult = activeLandmarker?.detectForVideo(currentVideoEl, now);
        const hasFace = landmarkerResult && landmarkerResult.faceLandmarks.length > 0 && landmarkerResult.facialTransformationMatrixes?.length > 0;

        if (pState.videoAspectRatioUBO) { const videoDimData = new Float32Array([currentVideoEl.videoWidth, currentVideoEl.videoHeight, currentContext.canvas.width, currentContext.canvas.height]); currentDevice.queue.writeBuffer(pState.videoAspectRatioUBO, 0, videoDimData); }
        
        if (pState.lipModelMatrixUBO) {
            const projectionMatrix = mat4.create(); const canvasAspectRatio = currentContext.canvas.width / currentContext.canvas.height;
            mat4.perspective(projectionMatrix, 75 * Math.PI / 180, canvasAspectRatio, 0.1, 1000);
            const viewMatrix = mat4.create(); mat4.lookAt(viewMatrix, vec3.fromValues(0,0,1), vec3.fromValues(0,0,0), vec3.fromValues(0,1,0));
            let modelMatrix = mat4.create();
            if(hasFace) {
                modelMatrix = mat4.clone(landmarkerResult.facialTransformationMatrixes[0].data);
                const flipYZ = mat4.fromValues(1,0,0,0, 0,-1,0,0, 0,0,-1,0, 0,0,0,1);
                mat4.multiply(modelMatrix, flipYZ, modelMatrix);
            }
            const sceneMatrices = new Float32Array(16 * 3);
            sceneMatrices.set(projectionMatrix, 0); sceneMatrices.set(viewMatrix, 16); sceneMatrices.set(modelMatrix, 32);
            currentDevice.queue.writeBuffer(pState.lipModelMatrixUBO, 0, sceneMatrices);
        }

        if (pState.lipstickMaterialUniformBuffer) { /* ... */ }
        if (pState.lightingUniformBuffer) { /* ... */ }
        
        let videoTextureGPU, frameBindGroupForTexture; /* ... */
        let currentGpuTexture, currentTextureView; /* ... */
        const cmdEnc = currentDevice.createCommandEncoder();
        const passEnc = cmdEnc.beginRenderPass({ colorAttachments: [{ view: currentTextureView, clearValue: { r: 0.0, g: 0.0, b: 0.0, a: 1.0 }, loadOp: 'clear', storeOp: 'store' }], depthStencilAttachment: { view: pState.depthTextureView, depthClearValue: 1.0, depthLoadOp: 'clear', depthStoreOp: 'store' }});
        passEnc.setViewport(0, 0, currentGpuTexture.width, currentGpuTexture.height, 0, 1);
        passEnc.setScissorRect(0, 0, currentGpuTexture.width, currentGpuTexture.height);
        
        if (pState.videoPipeline && frameBindGroupForTexture && pState.videoAspectRatioBindGroup) {
            passEnc.setPipeline(pState.videoPipeline);
            passEnc.setBindGroup(0, frameBindGroupForTexture);
            passEnc.setBindGroup(1, pState.videoAspectRatioBindGroup);
            passEnc.draw(6);
        }
        
        if (hasFace && pState.lipModelPipeline && pState.lipModelVertexBuffer && pState.lipModelIndexBuffer && pState.lipModelNumIndices > 0 && pState.lipModelMatrixBindGroup && pState.lipModelMaterialBindGroup && pState.lipModelLightingBindGroup) {
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
        // ... (Model parsing logic from last full version - it is correct) ...

        // --- Start of GPU Init ---
        if (!navigator.gpu) { setError("WebGPU not supported."); return; }
        setDebugMessage("Initializing WebGPU...");
        try {
            const vision = await FilesetResolver.forVisionTasks('https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm');
            const lmInstance = await FaceLandmarker.createFromOptions(vision, { baseOptions: { modelAssetPath: '/models/face_landmarker.task', delegate: 'GPU' }, outputFaceLandmarks: true, outputFacialTransformationMatrixes: true, runningMode: 'VIDEO', numFaces: 1 });
            landmarkerRef.current = lmInstance; setLandmarkerState(lmInstance);
            const adapter = await navigator.gpu.requestAdapter(); if (!adapter) throw new Error("No adapter.");
            deviceInternal = await adapter.requestDevice(); deviceRef.current = deviceInternal;
            deviceInternal.lost.then(/* ... */);
            contextInternal = canvasElement.getContext('webgpu'); contextRef.current = contextInternal;
            formatInternal = navigator.gpu.getPreferredCanvasFormat(); formatRef.current = formatInternal;
            
            configureCanvasAndDepthTexture(); 

            let lipstickAlbedoImageBitmap, lipstickNormalImageBitmap;
            try { lipstickAlbedoImageBitmap = await loadImageBitmap('/textures/lipstick_albedo_gray.png'); } catch (e) { console.warn("Albedo texture load failed.", e); }
            try { lipstickNormalImageBitmap = await loadImageBitmap('/textures/lipstick_normal.png'); } catch (e) { console.warn("Normal map load failed.", e); }
            
            const p = pipelineStateRef.current;
            const layouts = await createPipelines(deviceInternal, formatInternal, true); 
            if (!layouts.videoPipeline || !layouts.lipModelPipeline) throw new Error(`Pipeline creation failed.`);
            
            // Assign all layouts and pipelines
            p.videoPipeline = layouts.videoPipeline;
            p.lipModelPipeline = layouts.lipModelPipeline;
            p.videoBindGroupLayout = layouts.videoBindGroupLayout;
            p.videoAspectRatioGroupLayout = layouts.videoAspectRatioGroupLayout;
            p.lipModelMatrixGroupLayout = layouts.lipModelMatrixGroupLayout;
            p.lipstickMaterialGroupLayout = layouts.lipstickMaterialGroupLayout;
            p.lightingGroupLayout = layouts.lightingGroupLayout;

            // Create UBOs and Bind Groups with the correct, separate layouts
            p.videoAspectRatioUBO = deviceInternal.createBuffer({ label: "Video Aspect UBO", size: 4 * 4, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST });
            p.videoAspectRatioBindGroup = deviceInternal.createBindGroup({ label: "VideoDim_BG", layout: p.videoAspectRatioGroupLayout, entries: [{binding:0, resource:{buffer: p.videoAspectRatioUBO}}]});
            
            p.lipModelMatrixUBO = deviceInternal.createBuffer({ label: "Scene Matrix UB", size: (16 + 16 + 16) * 4, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST });
            p.lipModelMatrixBindGroup = deviceInternal.createBindGroup({ label: "SceneMatrix_BG", layout: p.lipModelMatrixGroupLayout, entries: [{binding:0, resource:{buffer: p.lipModelMatrixUBO}}]});
            
            p.lipstickMaterialUniformBuffer = deviceInternal.createBuffer({ label: "MaterialTint_UB", size: 4 * 4, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST });
            p.lightingUniformBuffer = deviceInternal.createBuffer({ label: "Lighting_UB", size: (4 + 4 + 4) * 4, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST });
            p.lipModelLightingBindGroup = deviceInternal.createBindGroup({ label: "Lighting_BG", layout: p.lightingGroupLayout, entries: [{binding:0, resource:{buffer:p.lightingUniformBuffer}}]});
            
            p.videoSampler = deviceInternal.createSampler({ magFilter: 'linear', minFilter: 'linear' });
            // ... (The rest is the same: texture creation, material bind group, vertex/index buffer creation)
            if (lipstickAlbedoImageBitmap) { /* ... */ }
            p.lipstickAlbedoSampler = deviceInternal.createSampler({ magFilter:'linear', minFilter:'linear' });
            if (lipstickNormalImageBitmap) { /* ... */ }
            const materialEntries = [{binding:0, resource:{buffer:p.lipstickMaterialUniformBuffer}}];
            if (p.lipstickAlbedoTextureView) materialEntries.push({binding:1, resource:p.lipstickAlbedoTextureView});
            if (p.lipstickAlbedoSampler) materialEntries.push({binding:2, resource:p.lipstickAlbedoSampler});
            if (p.lipstickNormalTextureView) materialEntries.push({binding:3, resource:p.lipstickNormalTextureView});
            if (p.lipstickMaterialGroupLayout && p.lipstickMaterialUniformBuffer ) { p.lipModelMaterialBindGroup = deviceInternal.createBindGroup({label:"3DLipMatBG", layout:p.lipstickMaterialGroupLayout, entries: materialEntries}); } else { throw new Error("Material BG creation failed."); }
            
            const model = p.lipModelData;
            if (model && model.positions && model.normals && model.uvs && model.indices) {
                // ... (interleavedBufferData and vertex/index buffer creation using writeBuffer)
            } else { throw new Error(`Essential model data missing for GPU buffers.`);  }
            
            // ... (Start video and render loop)
            const stream = await navigator.mediaDevices.getUserMedia({ video: { width: 640, height: 480 } }); videoElement.srcObject = stream; await new Promise((res, rej) => { videoElement.onloadedmetadata = res; videoElement.onerror = () => rej(new Error("Video metadata error."));}); await videoElement.play();
            resizeObserverInternal = new ResizeObserver(resizeHandlerRef.current); resizeObserverInternal.observe(canvasElement);
            configureCanvasAndDepthTexture(); 
            
            console.log("[LML_Clone 3DModel] GPU resources and video initialized.");
            setDebugMessage("Ready (3D Model).");
            if (!renderLoopStartedInternal) { render(); renderLoopStartedInternal = true; }
        } catch (err) { setError(`GPU Init: ${err.message.substring(0,100)}`); console.error("[LML_Clone 3DModel] GPU Init Error:", err); setDebugMessage("Error: GPU Init"); }
    };

    initializeAll();
    return () => { /* ... Full cleanup ... */ };
  }, []);

  useEffect(() => { 
    if (error) { setDebugMessage(`Error: ${error.substring(0,50)}`); } 
    else if (landmarkerState && deviceRef.current && contextRef.current && pipelineStateRef.current.lipModelPipeline) { setDebugMessage("Live Active (3D Model)"); } 
    else if (pipelineStateRef.current.lipModelData && !error && !pipelineStateRef.current.lipModelPipeline) { setDebugMessage("Model Parsed, GPU Init..."); } 
    else if (!pipelineStateRef.current.lipModelData && !error) { setDebugMessage("Initializing (3D Model Load)..."); } 
  }, [landmarkerState, deviceRef.current, contextRef.current, pipelineStateRef.current.lipModelPipeline, pipelineStateRef.current.lipModelData, error]);

  return ( 
    <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, overflow: 'hidden', margin: 0, padding: 0, background: 'darkslateblue' }}>
      <div style={{ position: 'absolute', top: '5px', left: '5px', background: 'rgba(0,0,0,0.7)', color: 'white', padding: '2px 5px', fontSize: '12px', zIndex: 20, pointerEvents: 'none' }}>
        {debugMessage} (Frame: {frameCounter.current})
      </div>
      <div style={{ position: 'absolute', bottom: '20px', left: '50%', transform: 'translateX(-50%)', display: 'flex', gap: '10px', padding: '10px', backgroundColor: 'rgba(255, 255, 255, 0.2)', borderRadius: '10px', zIndex: 10 }}>
        {LIPSTICK_COLORS.map(color => ( <div key={color.name} title={color.name} onClick={() => setSelectedColorUI(color.value)} style={{ width: '40px', height: '40px', backgroundColor: `rgba(${color.value[0]*255}, ${color.value[1]*255}, ${color.value[2]*255}, ${color.value[3]})`, borderRadius: '50%', border: selectedColorUI === color.value ? '3px solid white' : '3px solid transparent', cursor: 'pointer', transition: 'border 0.2s ease-in-out' }} /> ))}
      </div>
      <video ref={videoRef} style={{ display: 'none' }} width={640} height={480} autoPlay playsInline muted />
      <canvas ref={canvasRef} width={640} height={480} style={{ width: '100%', height: '100%', display: 'block', background: 'lightpink' }} />
    </div>
  );
}