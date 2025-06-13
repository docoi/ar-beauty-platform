// src/pages/LipstickMirrorLive_Clone.jsx

import React, { useEffect, useRef, useState } from 'react';
import createPipelines from '@/utils/createPipelines';
import { FaceLandmarker, FilesetResolver } from '@mediapipe/tasks-vision';
import { load } from '@loaders.gl/core';
import { GLTFLoader } from '@loaders.gl/gltf';
import { mat4, vec3 } from 'gl-matrix'; // Make sure gl-matrix is installed

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

// Helper function to get typed array data from GLTF accessors
function getAccessorDataFromGLTF(gltfJson, accessorIndex, mainBinaryBuffer) {
    const accessor = gltfJson.accessors[accessorIndex];
    if (!accessor) throw new Error(`Accessor ${accessorIndex} not found.`);
    
    const bufferView = gltfJson.bufferViews[accessor.bufferView];
    if (!bufferView) throw new Error(`BufferView ${accessor.bufferView} not found for accessor ${accessorIndex}.`);

    const componentType = accessor.componentType;
    const type = accessor.type; // "SCALAR", "VEC2", "VEC3", "VEC4"
    const count = accessor.count; 

    let numComponents;
    switch (type) {
        case "SCALAR": numComponents = 1; break;
        case "VEC2":   numComponents = 2; break;
        case "VEC3":   numComponents = 3; break;
        case "VEC4":   numComponents = 4; break;
        default: throw new Error(`Unsupported accessor type: ${type}`);
    }

    let TypedArrayConstructor;
    let componentByteSize = 0;
    switch (componentType) {
        case 5120: TypedArrayConstructor = Int8Array; componentByteSize = 1; break;
        case 5121: TypedArrayConstructor = Uint8Array; componentByteSize = 1; break;
        case 5122: TypedArrayConstructor = Int16Array; componentByteSize = 2; break;
        case 5123: TypedArrayConstructor = Uint16Array; componentByteSize = 2; break;
        case 5125: TypedArrayConstructor = Uint32Array; componentByteSize = 4; break;
        case 5126: TypedArrayConstructor = Float32Array; componentByteSize = 4; break;
        default: throw new Error(`Unsupported component type: ${componentType}`);
    }
    
    const totalElements = count * numComponents; // Total number of individual float/short/byte values
    const accessorByteLength = totalElements * componentByteSize;
    const byteOffset = (bufferView.byteOffset || 0) + (accessor.byteOffset || 0);

    if (mainBinaryBuffer.byteLength < byteOffset + accessorByteLength) {
        throw new Error(
            `Buffer access out of bounds for accessor ${accessorIndex}. ` +
            `Calculated offset: ${byteOffset}, length: ${accessorByteLength}. ` +
            `Binary buffer size: ${mainBinaryBuffer.byteLength}. ` +
            `BufferView target: ${bufferView.target || 'N/A'}, bvLength: ${bufferView.byteLength}`
        );
    }
    
    const bufferSlice = mainBinaryBuffer.slice(byteOffset, byteOffset + accessorByteLength);
    return new TypedArrayConstructor(bufferSlice);
}


export default function LipstickMirrorLive_Clone() {
  const canvasRef = useRef(null);
  const videoRef = useRef(null);
  const animationFrameIdRef = useRef(null);
  const frameCounter = useRef(0);
  const resizeHandlerRef = useRef(null);
  const deviceRef = useRef(null);
  const contextRef = useRef(null);
  const formatRef = useRef(null);
  const landmarkerRef = useRef(null);
  const [selectedColorUI, setSelectedColorUI] = useState(LIPSTICK_COLORS[0].value);
  const selectedColorForRenderRef = useRef(LIPSTICK_COLORS[0].value);
  const lightSettingsRef = useRef({
    direction: [0.5, 0.5, 1.0],
    ambientColor: [0.2, 0.2, 0.2, 1.0],
    diffuseColor: [0.8, 0.8, 0.8, 1.0],
  });

  const pipelineStateRef = useRef({
    videoPipeline: null, videoBindGroupLayout: null, videoSampler: null,
    aspectRatioGroupLayout: null, aspectRatioUniformBuffer: null, aspectRatioBindGroup: null,
    lipstickMaterialGroupLayout: null, lipstickMaterialUniformBuffer: null,
    lightingGroupLayout: null, lightingUniformBuffer: null, lightingBindGroup: null,
    lipstickAlbedoTexture: null, lipstickAlbedoTextureView: null,
    lipstickNormalTexture: null, lipstickNormalTextureView: null,
    lipstickAlbedoSampler: null,
    lipModelData: null, lipModelVertexBuffer: null, lipModelIndexBuffer: null,
    lipModelIndexFormat: 'uint16', lipModelNumIndices: 0,
    lipModelPipeline: null, lipModelMaterialBindGroup: null,
    lipModelAspectRatioBindGroup: null, lipModelLightingBindGroup: null,
    depthTexture: null, depthTextureView: null, // Added for 3D depth
  });

  const [landmarkerState, setLandmarkerState] = useState(null);
  const [error, setError] = useState(null);
  const [debugMessage, setDebugMessage] = useState('Initializing...');

  useEffect(() => { selectedColorForRenderRef.current = selectedColorUI; }, [selectedColorUI]);

  useEffect(() => {
    console.log("[LML_Clone 3DModel] Main useEffect (Final buffer write & TS assertion fix).");
    let deviceInternal = null; let contextInternal = null; let formatInternal = null;
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
            console.log(`[LML_Clone 3DModel] Canvas configured (${targetWidth}x${targetHeight}), Depth texture (re)created.`);
        }
    };
    resizeHandlerRef.current = configureCanvasAndDepthTexture;

    const render = async () => {
        const currentDevice = deviceRef.current; const currentContext = contextRef.current;
        const currentVideoEl = videoRef.current; const pState = pipelineStateRef.current;
        if (!currentDevice || !currentContext || !pState.videoPipeline || !pState.depthTextureView || (pState.lipModelData && !pState.lipModelPipeline) ) { animationFrameIdRef.current = requestAnimationFrame(render); return; }
        frameCounter.current++;
        if (!currentVideoEl || currentVideoEl.readyState < currentVideoEl.HAVE_ENOUGH_DATA || currentVideoEl.videoWidth === 0 || currentVideoEl.videoHeight === 0) { animationFrameIdRef.current = requestAnimationFrame(render); return; }
        if (pState.depthTexture.width !== currentContext.canvas.width || pState.depthTexture.height !== currentContext.canvas.height) { configureCanvasAndDepthTexture(); animationFrameIdRef.current = requestAnimationFrame(render); return; }

        if (pState.aspectRatioUniformBuffer) {
            const videoDimData = new Float32Array([currentVideoEl.videoWidth, currentVideoEl.videoHeight, currentContext.canvas.width, currentContext.canvas.height]);
            currentDevice.queue.writeBuffer(pState.aspectRatioUniformBuffer, 0, videoDimData);
            const projectionMatrix = mat4.create(); const canvasAspectRatio = currentContext.canvas.width / currentContext.canvas.height;
            mat4.ortho(projectionMatrix, -canvasAspectRatio, canvasAspectRatio, -1, 1, -10, 10); 
            const viewMatrix = mat4.create(); mat4.lookAt(viewMatrix, vec3.fromValues(0,0,1), vec3.fromValues(0,0,0), vec3.fromValues(0,1,0));
            const modelMatrix = mat4.create(); 
            const mvMatrix = mat4.create(); mat4.multiply(mvMatrix, viewMatrix, modelMatrix);
            const mvpMatrix = mat4.create(); mat4.multiply(mvpMatrix, projectionMatrix, mvMatrix);
            // Write mvpMatrix (as Float32Array if it's not already, gl-matrix mat4 is Float32Array compatible)
            currentDevice.queue.writeBuffer(pState.aspectRatioUniformBuffer, 4 * Float32Array.BYTES_PER_ELEMENT, mvpMatrix); // No 'as Float32Array'
        }
        if (pState.lipstickMaterialUniformBuffer) { const colorData = new Float32Array(selectedColorForRenderRef.current); currentDevice.queue.writeBuffer(pState.lipstickMaterialUniformBuffer, 0, colorData); }
        if (pState.lightingUniformBuffer) { const lightDir = lightSettingsRef.current.direction; const ambientCol = lightSettingsRef.current.ambientColor; const diffuseCol = lightSettingsRef.current.diffuseColor; const lightingData = new Float32Array([ lightDir[0], lightDir[1], lightDir[2], 0.0, ambientCol[0], ambientCol[1], ambientCol[2], ambientCol[3], diffuseCol[0], diffuseCol[1], diffuseCol[2], diffuseCol[3] ]); currentDevice.queue.writeBuffer(pState.lightingUniformBuffer, 0, lightingData); }
        
        let videoTextureGPU, frameBindGroupForTexture; try { videoTextureGPU = currentDevice.importExternalTexture({ source: currentVideoEl }); if (pState.videoBindGroupLayout && pState.videoSampler) { frameBindGroupForTexture = currentDevice.createBindGroup({ layout: pState.videoBindGroupLayout, entries: [{ binding: 0, resource: pState.videoSampler }, { binding: 1, resource: videoTextureGPU }] }); } else { animationFrameIdRef.current = requestAnimationFrame(render); return; } } catch (e) { console.error("Error importing video texture:", e); animationFrameIdRef.current = requestAnimationFrame(render); return; }
        let currentGpuTexture, currentTextureView; try { currentGpuTexture = currentContext.getCurrentTexture(); currentTextureView = currentGpuTexture.createView(); } catch (e) { console.warn("Error getting current texture", e); if (resizeHandlerRef.current) resizeHandlerRef.current(); animationFrameIdRef.current = requestAnimationFrame(render); return; }
        
        const cmdEnc = currentDevice.createCommandEncoder({label: "Main Render Encoder"});
        const passEnc = cmdEnc.beginRenderPass({ colorAttachments: [{ view: currentTextureView, clearValue: { r: 0.0, g: 0.0, b: 0.0, a: 1.0 }, loadOp: 'clear', storeOp: 'store' }], depthStencilAttachment: { view: pState.depthTextureView, depthClearValue: 1.0, depthLoadOp: 'clear', depthStoreOp: 'store' }});
        passEnc.setViewport(0, 0, currentGpuTexture.width, currentGpuTexture.height, 0, 1); passEnc.setScissorRect(0, 0, currentGpuTexture.width, currentGpuTexture.height);
        if (pState.videoPipeline && frameBindGroupForTexture && pState.aspectRatioBindGroup) { passEnc.setPipeline(pState.videoPipeline); passEnc.setBindGroup(0, frameBindGroupForTexture); passEnc.setBindGroup(1, pState.aspectRatioBindGroup); passEnc.draw(6); }
        if (pState.lipModelPipeline && pState.lipModelVertexBuffer && pState.lipModelIndexBuffer && pState.lipModelNumIndices > 0 && pState.lipModelAspectRatioBindGroup && pState.lipModelMaterialBindGroup && pState.lipModelLightingBindGroup) { passEnc.setPipeline(pState.lipModelPipeline); passEnc.setBindGroup(0, pState.lipModelAspectRatioBindGroup); passEnc.setBindGroup(1, pState.lipModelMaterialBindGroup); passEnc.setBindGroup(2, pState.lipModelLightingBindGroup); passEnc.setVertexBuffer(0, pState.lipModelVertexBuffer); passEnc.setIndexBuffer(pState.lipModelIndexBuffer, pState.lipModelIndexFormat); passEnc.drawIndexed(pState.lipModelNumIndices); }
        passEnc.end(); currentDevice.queue.submit([cmdEnc.finish()]);
        animationFrameIdRef.current = requestAnimationFrame(render);
    };

    const initializeAll = async () => {
        console.log("[LML_Clone 3DModel] Attempting to load /models/lips_model.glb using @loaders.gl/gltf");
        setDebugMessage("Loading 3D Lip Model...");
        let gltfDataFromLoaders; 
        try {
            gltfDataFromLoaders = await load('/models/lips_model.glb', GLTFLoader);
            console.log("[LML_Clone 3DModel] GLB model loaded by @loaders.gl. Full data object:", gltfDataFromLoaders);
            const gltfJson = gltfDataFromLoaders.json; let mainBinaryBuffer;
            if (gltfDataFromLoaders.buffers?.[0]?.arrayBuffer instanceof ArrayBuffer) { mainBinaryBuffer = gltfDataFromLoaders.buffers[0].arrayBuffer; console.log("[LML_Clone 3DModel] Using mainBinaryBuffer from gltfData.buffers[0].arrayBuffer"); } 
            else if (gltfDataFromLoaders.glb?.binChunks?.[0]?.arrayBuffer instanceof ArrayBuffer) { mainBinaryBuffer = gltfDataFromLoaders.glb.binChunks[0].arrayBuffer; console.log("[LML_Clone 3DModel] Using mainBinaryBuffer from gltfData.glb.binChunks[0].arrayBuffer (fallback)"); } 
            else { console.error("[LML_Clone 3DModel] Detailed gltfDataFromLoaders structure for buffer hunting:", gltfDataFromLoaders); throw new Error("Could not find the main binary ArrayBuffer."); }
            if (!gltfJson) throw new Error("GLTF JSON part not found."); if (!mainBinaryBuffer) throw new Error("Main binary buffer not extracted.");
            if (!gltfJson.meshes || gltfJson.meshes.length === 0) throw new Error("No meshes array in GLTF JSON.");
            const meshJson = gltfJson.meshes[0]; if (!meshJson.primitives || meshJson.primitives.length === 0) throw new Error("No primitives in first mesh.");
            const primitiveJson = meshJson.primitives[0]; if (primitiveJson.attributes.POSITION === undefined) throw new Error("Primitive missing POSITION attribute index.");
            const positions = getAccessorDataFromGLTF(gltfJson, primitiveJson.attributes.POSITION, mainBinaryBuffer);
            const normals = primitiveJson.attributes.NORMAL !== undefined ? getAccessorDataFromGLTF(gltfJson, primitiveJson.attributes.NORMAL, mainBinaryBuffer) : null;
            const uvs = primitiveJson.attributes.TEXCOORD_0 !== undefined ? getAccessorDataFromGLTF(gltfJson, primitiveJson.attributes.TEXCOORD_0, mainBinaryBuffer) : null;
            const indices = primitiveJson.indices !== undefined ? getAccessorDataFromGLTF(gltfJson, primitiveJson.indices, mainBinaryBuffer) : null;
            const targetsData = []; const shapeKeyNames = meshJson.extras?.targetNames || primitiveJson.extras?.targetNames || [];
            if (primitiveJson.targets) { primitiveJson.targets.forEach((target, index) => { const targetPositions = target.POSITION !== undefined ? getAccessorDataFromGLTF(gltfJson, target.POSITION, mainBinaryBuffer) : null; targetsData.push({ positions: targetPositions, name: shapeKeyNames[index] || `target_${index}` }); }); }
            if (!positions) throw new Error("Positions missing after accessor processing.");
            pipelineStateRef.current.lipModelData = { positions, normals, uvs, indices, targets: targetsData, shapeKeyNames };
            console.log("[LML_Clone 3DModel] Mesh data extracted:", { hasPos:!!positions, numPos:positions?.length/3, hasNorm:!!normals, numNorm:normals?.length/3, hasUV:!!uvs, numUV:uvs?.length/2, hasIdx:!!indices, numIdx:indices?.length, numTargets: targetsData.length, names: shapeKeyNames });
            setDebugMessage("3D Model Parsed. Initializing GPU...");
        } catch (modelLoadError) { console.error("[LML_Clone 3DModel] Error loading/processing lip model:", modelLoadError); setError(`Model Load: ${modelLoadError.message.substring(0, 100)}`); setDebugMessage("Error: Model Load"); return;  }

        if (!navigator.gpu) { setError("WebGPU not supported."); return; }
        setDebugMessage("Initializing WebGPU...");
        try {
            const vision = await FilesetResolver.forVisionTasks('https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm');
            const lmInstance = await FaceLandmarker.createFromOptions(vision, { baseOptions: { modelAssetPath: '/models/face_landmarker.task', delegate: 'GPU' }, outputFaceBlendshapes: true, runningMode: 'VIDEO', numFaces: 1 });
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
            
            const p = pipelineStateRef.current;
            const layoutsAndPipelines = await createPipelines(deviceInternal, formatInternal, true); 
            if (!layoutsAndPipelines.videoPipeline || !layoutsAndPipelines.lipModelPipeline) throw new Error(`Pipeline creation failed. Video: ${!!layoutsAndPipelines.videoPipeline}, Model: ${!!layoutsAndPipelines.lipModelPipeline}`);
            p.videoPipeline = layoutsAndPipelines.videoPipeline; p.lipModelPipeline = layoutsAndPipelines.lipModelPipeline;
            p.videoBindGroupLayout = layoutsAndPipelines.videoBindGroupLayout; p.aspectRatioGroupLayout = layoutsAndPipelines.aspectRatioGroupLayout;
            p.lipstickMaterialGroupLayout = layoutsAndPipelines.lipstickMaterialGroupLayout; p.lightingGroupLayout = layoutsAndPipelines.lightingGroupLayout;
            
            p.aspectRatioUniformBuffer = deviceInternal.createBuffer({ label: "VideoDim_MVP_UB", size: 20 * 4, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST });
            p.aspectRatioBindGroup = deviceInternal.createBindGroup({ label: "VideoDim_BG", layout: p.aspectRatioGroupLayout, entries: [{binding:0, resource:{buffer: p.aspectRatioUniformBuffer}}]});
            p.lipModelAspectRatioBindGroup = deviceInternal.createBindGroup({ label: "MVP_Matrix_BG", layout: p.aspectRatioGroupLayout, entries: [{binding:0, resource:{buffer: p.aspectRatioUniformBuffer}}]});
            p.lipstickMaterialUniformBuffer = deviceInternal.createBuffer({ label: "MaterialTint_UB", size: 4 * 4, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST });
            p.lightingUniformBuffer = deviceInternal.createBuffer({ label: "Lighting_UB", size: 12 * 4, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST });
            p.lipModelLightingBindGroup = deviceInternal.createBindGroup({ label: "Lighting_BG", layout: p.lightingGroupLayout, entries: [{binding:0, resource:{buffer:p.lightingUniformBuffer}}]});
            p.videoSampler = deviceInternal.createSampler({ magFilter: 'linear', minFilter: 'linear' });
            if (lipstickAlbedoImageBitmap) { p.lipstickAlbedoTexture = deviceInternal.createTexture({label:"AlbedoTex", size:[lipstickAlbedoImageBitmap.width, lipstickAlbedoImageBitmap.height], format:'rgba8unorm', usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST | GPUTextureUsage.RENDER_ATTACHMENT}); deviceInternal.queue.copyExternalImageToTexture({source:lipstickAlbedoImageBitmap}, {texture:p.lipstickAlbedoTexture}, [lipstickAlbedoImageBitmap.width, lipstickAlbedoImageBitmap.height]); p.lipstickAlbedoTextureView = p.lipstickAlbedoTexture.createView(); }
            p.lipstickAlbedoSampler = deviceInternal.createSampler({label:"MaterialSampler", magFilter:'linear', minFilter:'linear', addressModeU:'repeat', addressModeV:'repeat'});
            if (lipstickNormalImageBitmap) { p.lipstickNormalTexture = deviceInternal.createTexture({label:"NormalTex", size:[lipstickNormalImageBitmap.width, lipstickNormalImageBitmap.height], format:'rgba8unorm', usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST | GPUTextureUsage.RENDER_ATTACHMENT}); deviceInternal.queue.copyExternalImageToTexture({source:lipstickNormalImageBitmap}, {texture:p.lipstickNormalTexture}, [lipstickNormalImageBitmap.width, lipstickNormalImageBitmap.height]); p.lipstickNormalTextureView = p.lipstickNormalTexture.createView(); }
            const materialEntries = [{binding:0, resource:{buffer:p.lipstickMaterialUniformBuffer}}];
            if (p.lipstickAlbedoTextureView) materialEntries.push({binding:1, resource:p.lipstickAlbedoTextureView}); else console.warn("AlbedoTV missing for MatBG");
            if (p.lipstickAlbedoSampler) materialEntries.push({binding:2, resource:p.lipstickAlbedoSampler}); else console.warn("Sampler missing for MatBG");
            if (p.lipstickNormalTextureView) materialEntries.push({binding:3, resource:p.lipstickNormalTextureView}); else console.warn("NormalTV missing for MatBG");
            if (p.lipstickMaterialGroupLayout && p.lipstickMaterialUniformBuffer ) { p.lipModelMaterialBindGroup = deviceInternal.createBindGroup({label:"3DLipMatBG", layout:p.lipstickMaterialGroupLayout, entries: materialEntries}); } else { throw new Error("Material BG creation failed."); }
            
            const model = p.lipModelData;
            if (model && model.positions && model.normals && model.uvs && model.indices) {
                const numVertices = model.positions.length / 3;
                const interleavedBufferData = new Float32Array(numVertices * 8); 
                for (let i = 0; i < numVertices; i++) { let offset = i * 8; interleavedBufferData[offset++] = model.positions[i*3+0]; interleavedBufferData[offset++] = model.positions[i*3+1]; interleavedBufferData[offset++] = model.positions[i*3+2]; interleavedBufferData[offset++] = model.normals[i*3+0]; interleavedBufferData[offset++] = model.normals[i*3+1]; interleavedBufferData[offset++] = model.normals[i*3+2]; interleavedBufferData[offset++] = model.uvs[i*2+0]; interleavedBufferData[offset++] = model.uvs[i*2+1]; }
                
                // Ensure GPUBufferUsage.COPY_DST is present for writeBuffer
                p.lipModelVertexBuffer = deviceInternal.createBuffer({ label: "3DLipVB", size: interleavedBufferData.byteLength, usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST });
                deviceInternal.queue.writeBuffer(p.lipModelVertexBuffer, 0, interleavedBufferData);

                p.lipModelIndexBuffer = deviceInternal.createBuffer({ label: "3DLipIB", size: model.indices.byteLength, usage: GPUBufferUsage.INDEX | GPUBufferUsage.COPY_DST });
                deviceInternal.queue.writeBuffer(p.lipModelIndexBuffer, 0, model.indices);

                if (model.indices instanceof Uint16Array) { p.lipModelIndexFormat = 'uint16'; } 
                else if (model.indices instanceof Uint32Array) { p.lipModelIndexFormat = 'uint32'; } 
                else { throw new Error("Unsupported index type for model.indices. Expected Uint16Array or Uint32Array."); }
                p.lipModelNumIndices = model.indices.length;
                console.log(`[LML_Clone 3DModel] Created VB (${numVertices}v) & IB (${p.lipModelNumIndices}i, ${p.lipModelIndexFormat}) using writeBuffer.`);
            } else { 
                let missing=[]; if(!model?.positions)missing.push("pos");if(!model?.normals)missing.push("norm");if(!model?.uvs)missing.push("uv");if(!model?.indices)missing.push("idx"); 
                throw new Error(`Essential model data (${missing.join()}) missing for GPU buffers.`);  
            }
            
            const stream = await navigator.mediaDevices.getUserMedia({ video: { width: 640, height: 480 } }); videoElement.srcObject = stream; await new Promise((res, rej) => { videoElement.onloadedmetadata = res; videoElement.onerror = () => rej(new Error("Video metadata error."));}); await videoElement.play();
            resizeObserverInternal = new ResizeObserver(resizeHandlerRef.current); resizeObserverInternal.observe(canvasElement);
            configureCanvasAndDepthTexture(); 
            
            console.log("[LML_Clone 3DModel] GPU resources and video initialized.");
            setDebugMessage("Ready (3D Model).");
            if (!renderLoopStartedInternal) { render(); renderLoopStartedInternal = true; }
        } catch (err) { setError(`GPU Init: ${err.message.substring(0,100)}`); console.error("[LML_Clone 3DModel] GPU Init Error:", err); setDebugMessage("Error: GPU Init"); }
    }; // End of initializeAll

    initializeAll();
    return () => { 
        console.log("[LML_Clone 3DModel] Cleanup."); 
        if (animationFrameIdRef.current) cancelAnimationFrame(animationFrameIdRef.current); 
        if (resizeObserverInternal && canvasElement.current) resizeObserverInternal.unobserve(canvasElement.current); 
        if (resizeObserverInternal) resizeObserverInternal.disconnect(); 
        videoRef.current?.srcObject?.getTracks().forEach(t => t.stop()); 
        if (videoRef.current) videoRef.current.srcObject = null; 
        const pS=pipelineStateRef.current; 
        pS.aspectRatioUniformBuffer?.destroy(); pS.lipstickMaterialUniformBuffer?.destroy();
        pS.lightingUniformBuffer?.destroy(); pS.lipstickAlbedoTexture?.destroy();
        pS.lipstickNormalTexture?.destroy(); pS.lipModelVertexBuffer?.destroy();
        pS.lipModelIndexBuffer?.destroy(); pS.depthTexture?.destroy(); 
        if (landmarkerRef.current?.close) landmarkerRef.current.close(); 
        landmarkerRef.current=null; setLandmarkerState(null); 
        deviceRef.current=null; contextRef.current=null; formatRef.current=null; 
        console.log("[LML_Clone 3DModel] Cleanup complete."); 
    };
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