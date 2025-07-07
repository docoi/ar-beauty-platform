// src/components/LipstickMirrorLive_Clone.jsx

import React, { useEffect, useRef, useState } from 'react';
import createPipelines from '@/utils/createPipelines';
import { FaceLandmarker, FilesetResolver } from '@mediapipe/tasks-vision';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { Mesh } from 'three';
import { mat4, vec3 } from 'gl-matrix';
import GUI from 'lil-gui';

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
    const x = positions[i]; const y = positions[i + 1]; const z = positions[i + 2];
    minX = Math.min(minX, x); minY = Math.min(minY, y); minZ = Math.min(minZ, z);
    maxX = Math.max(maxX, x); maxY = Math.max(maxY, y); maxZ = Math.max(maxZ, z);
  }
  const center = vec3.fromValues((minX + maxX) / 2, (minY + maxY) / 2, (minZ + maxZ) / 2);
  return center;
}

export default function LipstickMirrorLive_Clone() {
  const canvasRef = useRef(null); const videoRef = useRef(null); const animationFrameIdRef = useRef(null);
  const debugControlsRef = useRef({
      scale: 0.075,
      offsetX: 0.0,
      offsetY: -0.04,
      offsetZ: 0.05,
  });
  
  const [selectedColorUI, setSelectedColorUI] = useState(LIPSTICK_COLORS[0].value); const selectedColorForRenderRef = useRef(LIPSTICK_COLORS[0].value);
  const lightSettingsRef = useRef({ lightDirection: [0.2, 0.5, 0.8], ambientColor: [0.1, 0.1, 0.1, 1.0], diffuseColor: [0.9, 0.9, 0.9, 1.0], cameraWorldPosition: [0, 0, 1.2] });
  
  const pipelineStateRef = useRef({
    videoPipeline: null, videoBindGroupLayout: null, videoSampler: null, videoAspectRatioGroupLayout: null, videoAspectRatioUBO: null, videoAspectRatioBindGroup: null,
    lipstickMaterialGroupLayout: null, lipstickMaterialUniformBuffer: null,
    lightingGroupLayout: null, lightingUniformBuffer: null, lipModelLightingBindGroup: null,
    lipModelData: null, lipModelVertexBuffer: null, lipModelIndexBuffer: null,
    lipModelIndexFormat: 'uint16', lipModelNumIndices: 0,
    lipModelPipeline: null, lipModelMaterialBindGroup: null,
    lipModelMatrixGroupLayout: null, lipModelMatrixUBO: null, lipModelMatrixBindGroup: null,
    depthTexture: null, depthTextureView: null,
  });

  const [landmarkerState, setLandmarkerState] = useState(null); const [error, setError] = useState(null); const [debugMessage, setDebugMessage] = useState('Initializing...');
  useEffect(() => { selectedColorForRenderRef.current = selectedColorUI; }, [selectedColorUI]);

  useEffect(() => {
    let deviceInternal, contextInternal, formatInternal, resizeObserverInternal;
    let renderLoopStartedInternal = false;
    let gui = null;

    const canvasElement = canvasRef.current; const videoElement = videoRef.current; 
    if (!canvasElement || !videoElement) { return; }

    const configureCanvasAndDepthTexture = () => {
        if (!deviceInternal || !contextInternal || !formatInternal || !canvasElement) return;
        const dpr = window.devicePixelRatio || 1;
        const cw = canvasElement.clientWidth; const ch = canvasElement.clientHeight;
        if (cw === 0 || ch === 0) return;
        const targetWidth = Math.floor(cw * dpr); const targetHeight = Math.floor(ch * dpr);
        if (canvasElement.width === targetWidth && canvasElement.height === targetHeight) return;
        canvasElement.width = targetWidth; canvasElement.height = targetHeight;
        try { contextInternal.configure({ device: deviceInternal, format: formatInternal, alphaMode: 'opaque', size: [targetWidth, targetHeight] }); } 
        catch (e) { console.error("Error config context:", e); return; }
        const pState = pipelineStateRef.current;
        pState.depthTexture?.destroy(); 
        pState.depthTexture = deviceInternal.createTexture({ size: [targetWidth, targetHeight], format: 'depth24plus', usage: GPUTextureUsage.RENDER_ATTACHMENT });
        pState.depthTextureView = pState.depthTexture.createView();
    };

    const render = async () => {
        const pState = pipelineStateRef.current;
        if (!deviceInternal || !contextInternal || !pState.videoPipeline || !pState.depthTextureView || (pState.lipModelData && !pState.lipModelPipeline) ) { animationFrameIdRef.current = requestAnimationFrame(render); return; }
        if (!videoElement || videoElement.readyState < videoElement.HAVE_ENOUGH_DATA || videoElement.videoWidth === 0) { animationFrameIdRef.current = requestAnimationFrame(render); return; }
        if (pState.depthTexture.width !== contextInternal.canvas.width || pState.depthTexture.height !== contextInternal.canvas.height) { configureCanvasAndDepthTexture(); animationFrameIdRef.current = requestAnimationFrame(render); return; }
        
        const landmarkerResult = landmarkerRef.current?.detectForVideo(videoElement, performance.now());
        const hasFace = landmarkerResult && landmarkerResult.faceLandmarks.length > 0 && landmarkerResult.facialTransformationMatrixes?.length > 0;
        
        deviceInternal.queue.writeBuffer(pState.videoAspectRatioUBO, 0, new Float32Array([videoElement.videoWidth, videoElement.videoHeight, contextInternal.canvas.width, contextInternal.canvas.height]));
        
        const projectionMatrix = mat4.create();
        mat4.perspective(projectionMatrix, 45 * Math.PI / 180, contextInternal.canvas.width / contextInternal.canvas.height, 0.1, 1000.0);
        const viewMatrix = mat4.create();
        mat4.lookAt(viewMatrix, vec3.fromValues(0, 0, 1.2), vec3.fromValues(0, 0, 0), vec3.fromValues(0, 1, 0));
        let modelMatrix = mat4.create();
        if (hasFace && pState.lipModelData?.modelCenter) {
            const faceTransform = mat4.clone(landmarkerResult.facialTransformationMatrixes[0].data);
            const flipYZ = mat4.fromValues(1,0,0,0,  0,-1,0,0,  0,0,-1,0,  0,0,0,1);
            mat4.multiply(modelMatrix, faceTransform, flipYZ);
            const localAdjustmentMatrix = mat4.create();
            const modelCenter = pState.lipModelData.modelCenter;
            const centeringVector = vec3.negate(vec3.create(), modelCenter);
            const { scale, offsetX, offsetY, offsetZ } = debugControlsRef.current;
            const translationVector = vec3.fromValues(offsetX, offsetY, offsetZ);
            mat4.translate(localAdjustmentMatrix, localAdjustmentMatrix, translationVector);
            mat4.scale(localAdjustmentMatrix, localAdjustmentMatrix, vec3.fromValues(scale, scale, scale));
            mat4.translate(localAdjustmentMatrix, localAdjustmentMatrix, centeringVector);
            mat4.multiply(modelMatrix, modelMatrix, localAdjustmentMatrix);
        } else {
            mat4.scale(modelMatrix, modelMatrix, vec3.fromValues(0, 0, 0));
        }
        const sceneMatrices = new Float32Array(16 * 3);
        sceneMatrices.set(projectionMatrix, 0); sceneMatrices.set(viewMatrix, 16); sceneMatrices.set(modelMatrix, 32);
        deviceInternal.queue.writeBuffer(pState.lipModelMatrixUBO, 0, sceneMatrices);
        
        deviceInternal.queue.writeBuffer(pState.lipstickMaterialUniformBuffer, 0, new Float32Array(selectedColorForRenderRef.current));
        const { lightDirection, ambientColor, diffuseColor, cameraWorldPosition } = lightSettingsRef.current;
        deviceInternal.queue.writeBuffer(pState.lightingUniformBuffer, 0, new Float32Array([...lightDirection, 0.0, ...ambientColor, ...diffuseColor, ...cameraWorldPosition, 0.0]));
        
        let videoTextureGPU, frameBindGroupForTexture; 
        try { videoTextureGPU = deviceInternal.importExternalTexture({ source: videoElement }); frameBindGroupForTexture = deviceInternal.createBindGroup({ layout: pState.videoBindGroupLayout, entries: [{ binding: 0, resource: pState.videoSampler }, { binding: 1, resource: videoTextureGPU }] }); } 
        catch (e) { console.error("Error importing video texture:", e); animationFrameIdRef.current = requestAnimationFrame(render); return; }
        
        const currentTextureView = contextInternal.getCurrentTexture().createView();
        const cmdEnc = deviceInternal.createCommandEncoder();
        const passEnc = cmdEnc.beginRenderPass({ colorAttachments: [{ view: currentTextureView, clearValue: [0,0,0,1], loadOp: 'clear', storeOp: 'store' }], depthStencilAttachment: { view: pState.depthTextureView, depthClearValue: 1.0, depthLoadOp: 'clear', depthStoreOp: 'store' }});
        passEnc.setViewport(0, 0, contextInternal.canvas.width, contextInternal.canvas.height, 0, 1);
        passEnc.setScissorRect(0, 0, contextInternal.canvas.width, contextInternal.canvas.height);
        if (pState.videoPipeline && frameBindGroupForTexture) { passEnc.setPipeline(pState.videoPipeline); passEnc.setBindGroup(0, frameBindGroupForTexture); passEnc.setBindGroup(1, pState.videoAspectRatioBindGroup); passEnc.draw(6); }
        if (hasFace && pState.lipModelPipeline) { passEnc.setPipeline(pState.lipModelPipeline); passEnc.setBindGroup(0, pState.lipModelMatrixBindGroup); passEnc.setBindGroup(1, pState.lipModelMaterialBindGroup); passEnc.setBindGroup(2, pState.lipModelLightingBindGroup); passEnc.setVertexBuffer(0, pState.lipModelVertexBuffer); passEnc.setIndexBuffer(pState.lipModelIndexBuffer, pState.lipModelIndexFormat); passEnc.drawIndexed(pState.lipModelNumIndices); }
        passEnc.end();
        deviceInternal.queue.submit([cmdEnc.finish()]);
        animationFrameIdRef.current = requestAnimationFrame(render);
    };

    const initializeAll = async () => {
        setDebugMessage("Loading 3D Lip Model...");
        try {
            const loader = new GLTFLoader();
            const gltf = await loader.loadAsync('/models/lips_model.glb');
            let lipMesh = null;
            gltf.scene.traverse((object) => { if (object instanceof Mesh) { lipMesh = object; } });
            if (!lipMesh) throw new Error("Could not find a mesh in the loaded GLTF scene.");
            const geometry = lipMesh.geometry;
            const positions = geometry.attributes.position.array;
            const normals = geometry.attributes.normal.array;
            const uvs = geometry.attributes.uv.array;
            const indices = geometry.index.array;
            if (!positions || !normals || !uvs || !indices) throw new Error("Essential mesh attributes are missing.");
            const modelCenter = calculateBoundingBoxCenter(positions);
            pipelineStateRef.current.lipModelData = { positions, normals, uvs, indices, modelCenter };
            setDebugMessage("3D Model Parsed. Initializing GPU...");
        } catch (modelLoadError) { setError(`Model Load: ${modelLoadError.message}`); setDebugMessage("Error: Model Load"); return;  }
        
        if (!navigator.gpu) { setError("WebGPU not supported."); return; }
        setDebugMessage("Initializing WebGPU...");
        try {
            gui = new GUI();
            const controls = debugControlsRef.current;
            gui.add(controls, 'scale', 0.01, 0.2, 0.001).name('Scale');
            gui.add(controls, 'offsetX', -0.5, 0.5, 0.001).name('Offset X');
            gui.add(controls, 'offsetY', -0.5, 0.5, 0.001).name('Offset Y');
            gui.add(controls, 'offsetZ', -0.5, 0.5, 0.001).name('Offset Z');

            const vision = await FilesetResolver.forVisionTasks('https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm');
            const lmInstance = await FaceLandmarker.createFromOptions(vision, { baseOptions: { modelAssetPath: '/models/face_landmarker.task', delegate: 'GPU' }, outputFaceLandmarks: true, outputFacialTransformationMatrixes: true, runningMode: 'VIDEO', numFaces: 1 });
            landmarkerRef.current = lmInstance; setLandmarkerState(lmInstance);
            
            const adapter = await navigator.gpu.requestAdapter(); if (!adapter) throw new Error("No adapter.");
            deviceInternal = await adapter.requestDevice();
            contextInternal = canvasElement.getContext('webgpu');
            formatInternal = navigator.gpu.getPreferredCanvasFormat();
            
            configureCanvasAndDepthTexture(); 
            
            let lipstickAlbedoImageBitmap, lipstickNormalImageBitmap;
            try { lipstickAlbedoImageBitmap = await loadImageBitmap('/textures/lipstick_albedo_gray.png'); } catch (e) { console.warn("Albedo texture load failed.", e); }
            try { lipstickNormalImageBitmap = await loadImageBitmap('/textures/lipstick_normal.png'); } catch (e) { console.warn("Normal map load failed.", e); }
            
            const pState = pipelineStateRef.current;
            const layoutsAndPipelines = await createPipelines(deviceInternal, formatInternal, true); 
            if (!layoutsAndPipelines.videoPipeline || !layoutsAndPipelines.lipModelPipeline) throw new Error(`Pipeline creation failed.`);
            Object.assign(pState, layoutsAndPipelines);
            
            pState.videoAspectRatioUBO = deviceInternal.createBuffer({ size: 16, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST });
            pState.videoAspectRatioBindGroup = deviceInternal.createBindGroup({ layout: pState.videoAspectRatioGroupLayout, entries: [{binding:0, resource:{buffer:pState.videoAspectRatioUBO}}]});
            pState.lipModelMatrixUBO = deviceInternal.createBuffer({ size: 192, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST });
            pState.lipModelMatrixBindGroup = deviceInternal.createBindGroup({ layout: pState.lipModelMatrixGroupLayout, entries: [{binding:0, resource:{buffer:pState.lipModelMatrixUBO}}]});
            pState.lipstickMaterialUniformBuffer = deviceInternal.createBuffer({ size: 16, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST });
            pState.lightingUniformBuffer = deviceInternal.createBuffer({ size: 64, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST });
            pState.lipModelLightingBindGroup = deviceInternal.createBindGroup({ layout: pState.lightingGroupLayout, entries: [{binding:0, resource:{buffer:pState.lightingUniformBuffer}}]});
            pState.videoSampler = deviceInternal.createSampler({ magFilter: 'linear', minFilter: 'linear' });
            
            if (lipstickAlbedoImageBitmap) { pState.lipstickAlbedoTexture = deviceInternal.createTexture({ size:[lipstickAlbedoImageBitmap.width, lipstickAlbedoImageBitmap.height], format:'rgba8unorm', usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST | GPUTextureUsage.RENDER_ATTACHMENT}); deviceInternal.queue.copyExternalImageToTexture({source:lipstickAlbedoImageBitmap}, {texture:pState.lipstickAlbedoTexture}, [lipstickAlbedoImageBitmap.width, lipstickAlbedoImageBitmap.height]); pState.lipstickAlbedoTextureView = pState.lipstickAlbedoTexture.createView(); }
            if (lipstickNormalImageBitmap) { pState.lipstickNormalTexture = deviceInternal.createTexture({label:"NormalTex", size:[lipstickNormalImageBitmap.width, lipstickNormalImageBitmap.height], format:'rgba8unorm', usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST | GPUTextureUsage.RENDER_ATTACHMENT}); deviceInternal.queue.copyExternalImageToTexture({source:lipstickNormalImageBitmap}, {texture:pState.lipstickNormalTexture}, [lipstickNormalImageBitmap.width, lipstickNormalImageBitmap.height]); pState.lipstickNormalTextureView = pState.lipstickNormalTexture.createView(); }
            pState.lipstickAlbedoSampler = deviceInternal.createSampler({magFilter:'linear', minFilter:'linear'});

            const materialEntries = [{binding:0, resource:{buffer:pState.lipstickMaterialUniformBuffer}}];
            if (pState.lipstickAlbedoTextureView) materialEntries.push({binding:1, resource:pState.lipstickAlbedoTextureView});
            if (pState.lipstickAlbedoSampler) materialEntries.push({binding:2, resource:pState.lipstickAlbedoSampler});
            if (pState.lipstickNormalTextureView) materialEntries.push({binding:3, resource:pState.lipstickNormalTextureView});
            pState.lipModelMaterialBindGroup = deviceInternal.createBindGroup({layout:pState.lipstickMaterialGroupLayout, entries: materialEntries});
            
            const model = pState.lipModelData;
            const numVertices = model.positions.length / 3;
            const interleavedBufferData = new Float32Array(numVertices * 8); 
            for (let i = 0; i < numVertices; i++) { let offset = i * 8; interleavedBufferData[offset++] = model.positions[i*3+0]; interleavedBufferData[offset++] = model.positions[i*3+1]; interleavedBufferData[offset++] = model.positions[i*3+2]; interleavedBufferData[offset++] = model.normals[i*3+0]; interleavedBufferData[offset++] = model.normals[i*3+1]; interleavedBufferData[offset++] = model.normals[i*3+2]; interleavedBufferData[offset++] = model.uvs[i*2+0]; interleavedBufferData[offset++] = model.uvs[i*2+1]; }
            pState.lipModelVertexBuffer = deviceInternal.createBuffer({ size: interleavedBufferData.byteLength, usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST });
            deviceInternal.queue.writeBuffer(pState.lipModelVertexBuffer, 0, interleavedBufferData);
            
            const indicesData = model.indices;
            pState.lipModelIndexBuffer = deviceInternal.createBuffer({ size: indicesData.byteLength, usage: GPUBufferUsage.INDEX | GPUBufferUsage.COPY_DST });
            deviceInternal.queue.writeBuffer(pState.lipModelIndexBuffer, 0, indicesData);
            pState.lipModelIndexFormat = (indicesData instanceof Uint16Array) ? 'uint16' : 'uint32';
            pState.lipModelNumIndices = model.indices.length;

            const stream = await navigator.mediaDevices.getUserMedia({ video: { width: 640, height: 480 } }); 
            videoElement.srcObject = stream; 
            await videoElement.play();
            
            resizeObserverInternal = new ResizeObserver(configureCanvasAndDepthTexture);
            resizeObserverInternal.observe(canvasElement);

            if (!renderLoopStartedInternal) { render(); renderLoopStartedInternal = true; }
        } catch (err) { setError(`GPU Init: ${err.message}`); setDebugMessage("Error: GPU Init"); }
    };

    initializeAll();
    
    return () => { 
        if (gui) gui.destroy();
        if (animationFrameIdRef.current) cancelAnimationFrame(animationFrameIdRef.current); 
        if (resizeObserverInternal) resizeObserverInternal.disconnect(); 
        videoRef.current?.srcObject?.getTracks().forEach(t => t.stop()); 
        if (videoRef.current) videoRef.current.srcObject = null;
        if (landmarkerRef.current?.close) landmarkerRef.current.close(); 
    };
  }, []);

  useEffect(() => { 
    if (error) { setDebugMessage(`Error: ${error}`); } 
    else if (landmarkerState) { setDebugMessage("Ready"); } 
  }, [landmarkerState, error]);

  return ( 
    <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, overflow: 'hidden', margin: 0, padding: 0 }}>
      <div style={{ position: 'absolute', top: '5px', left: '5px', background: 'rgba(0,0,0,0.7)', color: 'white', padding: '2px 5px', fontSize: '12px', zIndex: 20, pointerEvents: 'none' }}>{debugMessage}</div>
      <div style={{ position: 'absolute', bottom: '20px', left: '50%', transform: 'translateX(-50%)', display: 'flex', gap: '10px', padding: '10px', backgroundColor: 'rgba(255, 255, 255, 0.2)', borderRadius: '10px', zIndex: 10 }}>
        {LIPSTICK_COLORS.map(color => ( <div key={color.name} title={color.name} onClick={() => setSelectedColorUI(color.value)} style={{ width: '40px', height: '40px', backgroundColor: `rgba(${color.value[0]*255}, ${color.value[1]*255}, ${color.value[2]*255}, ${color.value[3]})`, borderRadius: '50%', border: selectedColorUI === color.value ? '3px solid white' : '3px solid transparent', cursor: 'pointer' }} /> ))}
      </div>
      <video ref={videoRef} style={{ display: 'none' }} width={640} height={480} autoPlay playsInline muted />
      <canvas ref={canvasRef} style={{ width: '100%', height: '100%', display: 'block' }} />
    </div>
  );
}