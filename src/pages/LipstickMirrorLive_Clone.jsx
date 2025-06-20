// src/pages/LipstickMirrorLive_Clone.jsx

import React, { useEffect, useRef, useState } from 'react';
import createPipelines from '@/utils/createPipelines'; // Uses the simplified version
import { load } from '@loaders.gl/core';
import { GLTFLoader } from '@loaders.gl/gltf';
import { mat4, vec3 } from 'gl-matrix';

const LIPSTICK_COLORS = [ { name: 'Nude Pink', value: [228/255, 170/255, 170/255, 0.85] }, { name: 'Classic Red', value: [200/255, 0/255, 0/255, 0.9] }, { name: 'Deep Plum', value: [100/255, 20/255, 50/255, 0.85] }, { name: 'Coral Burst', value: [255/255, 100/255, 80/255, 0.8] }, { name: 'Soft Mauve', value: [180/255, 120/255, 150/255, 0.8] }, { name: 'Highlight Gloss', value: [1.0, 1.0, 1.0, 0.3] }, ];
async function loadImageBitmap(url) { const response = await fetch(url); if (!response.ok) { throw new Error(`Failed to fetch image ${url}: ${response.statusText}`); } const blob = await response.blob(); return createImageBitmap(blob); }
function getAccessorDataFromGLTF(gltfJson, accessorIndex, mainBinaryBuffer) { const accessor = gltfJson.accessors[accessorIndex]; if (!accessor) throw new Error(`Accessor ${accessorIndex} not found.`); const bufferView = gltfJson.bufferViews[accessor.bufferView]; if (!bufferView) throw new Error(`BufferView ${accessor.bufferView} not found for accessor ${accessorIndex}.`); const componentType = accessor.componentType; const type = accessor.type; const count = accessor.count; let numComponents; switch (type) { case "SCALAR": numComponents = 1; break; case "VEC2":   numComponents = 2; break; case "VEC3":   numComponents = 3; break; case "VEC4":   numComponents = 4; break; default: throw new Error(`Unsupported accessor type: ${type}`);} let TypedArrayConstructor; let componentByteSize = 0; switch (componentType) { case 5120: TypedArrayConstructor = Int8Array; componentByteSize = 1; break; case 5121: TypedArrayConstructor = Uint8Array; componentByteSize = 1; break; case 5122: TypedArrayConstructor = Int16Array; componentByteSize = 2; break; case 5123: TypedArrayConstructor = Uint16Array; componentByteSize = 2; break; case 5125: TypedArrayConstructor = Uint32Array; componentByteSize = 4; break; case 5126: TypedArrayConstructor = Float32Array; componentByteSize = 4; break; default: throw new Error(`Unsupported component type: ${componentType}`);} const totalElements = count * numComponents; const accessorByteLength = totalElements * componentByteSize; const byteOffset = (bufferView.byteOffset || 0) + (accessor.byteOffset || 0); if (mainBinaryBuffer.byteLength < byteOffset + accessorByteLength) { throw new Error( `Buffer access out of bounds for accessor ${accessorIndex}. Offset: ${byteOffset}, Length: ${accessorByteLength}, BufferSize: ${mainBinaryBuffer.byteLength}. BV target: ${bufferView.target || 'N/A'}, bvLength: ${bufferView.byteLength}` ); } const bufferSlice = mainBinaryBuffer.slice(byteOffset, byteOffset + accessorByteLength); return new TypedArrayConstructor(bufferSlice); }

export default function LipstickMirrorLive_Clone() {
  const canvasRef = useRef(null);
  const animationFrameIdRef = useRef(null);
  const frameCounter = useRef(0);
  const resizeHandlerRef = useRef(null);
  
  const pipelineStateRef = useRef({
    lipModelData: null,
    lipModelVertexBuffer: null,
    lipModelIndexBuffer: null,
    lipModelIndexFormat: 'uint16',
    lipModelNumIndices: 0,
    lipModelPipeline: null,
    lipModelMatrixUBO: null,
    lipModelMatrixBindGroup: null,
    depthTexture: null,
    depthTextureView: null,
  });

  const [error, setError] = useState(null);
  const [debugMessage, setDebugMessage] = useState('Initializing...');

  useEffect(() => {
    console.log("[LML_Clone 3DModel] Main useEffect (Static Model Rotation Test - Final Fix).");
    let device = null; 
    let context = null; 
    let format = null;
    let resizeObserver = null; 
    let renderLoopStarted = false; // The missing variable
    const canvasElement = canvasRef.current;
    if (!canvasElement) return;

    const configureCanvasAndDepthTexture = () => {
        if (!device || !context || !format || !canvasRef.current) { return; }
        const currentCanvas = canvasRef.current;
        const dpr = window.devicePixelRatio || 1;
        const cw = currentCanvas.clientWidth; const ch = currentCanvas.clientHeight;
        if (cw === 0 || ch === 0) return;
        const targetWidth = Math.floor(cw * dpr); const targetHeight = Math.floor(ch * dpr);
        let needsReconfigure = currentCanvas.width !== targetWidth || currentCanvas.height !== targetHeight;
        
        if (needsReconfigure) {
            currentCanvas.width = targetWidth;
            currentCanvas.height = targetHeight;
        }

        try { context.configure({ device, format, alphaMode: 'opaque', size: [targetWidth, targetHeight] }); } 
        catch (e) { setError("Error config context: " + e.message); return; }

        const pState = pipelineStateRef.current;
        if (needsReconfigure || !pState.depthTexture) {
            pState.depthTexture?.destroy(); 
            pState.depthTexture = device.createTexture({ size: [targetWidth, targetHeight], format: 'depth24plus', usage: GPUTextureUsage.RENDER_ATTACHMENT, label: "Depth Texture" });
            pState.depthTextureView = pState.depthTexture.createView({ label: "Depth Texture View"});
            console.log(`Canvas & Depth Texture Configured: ${targetWidth}x${targetHeight}`);
        }
    };
    resizeHandlerRef.current = configureCanvasAndDepthTexture;

    const render = async () => {
        if (!device || !context) { animationFrameIdRef.current = requestAnimationFrame(render); return; }
        const pState = pipelineStateRef.current;
        if (!pState.lipModelPipeline || !pState.depthTextureView) { animationFrameIdRef.current = requestAnimationFrame(render); return; }
        
        frameCounter.current++;
        if (pState.depthTexture.width !== context.canvas.width || pState.depthTexture.height !== context.canvas.height) {
            configureCanvasAndDepthTexture();
            animationFrameIdRef.current = requestAnimationFrame(render);
            return;
        }
        
        const projectionMatrix = mat4.create();
        const canvasAspectRatio = context.canvas.width / context.canvas.height;
        mat4.perspective(projectionMatrix, (45 * Math.PI) / 180, canvasAspectRatio, 0.01, 100.0);
        
        const viewMatrix = mat4.create();
        mat4.lookAt(viewMatrix, vec3.fromValues(0, 0, 0.2), vec3.fromValues(0, 0, 0), vec3.fromValues(0, 1, 0));
        
        const modelMatrix = mat4.create();
        mat4.rotateY(modelMatrix, modelMatrix, frameCounter.current * 0.01);
        mat4.scale(modelMatrix, modelMatrix, vec3.fromValues(0.3, 0.3, 0.3));

        const mvpMatrix = mat4.create();
        mat4.multiply(mvpMatrix, viewMatrix, modelMatrix);
        mat4.multiply(mvpMatrix, projectionMatrix, mvpMatrix);

        device.queue.writeBuffer(pState.lipModelMatrixUBO, 0, mvpMatrix);

        const currentTextureView = context.getCurrentTexture().createView();
        const commandEncoder = device.createCommandEncoder();
        const passEncoder = commandEncoder.beginRenderPass({
            colorAttachments: [{ view: currentTextureView, clearValue: { r: 0.0, g: 0.0, b: 0.0, a: 1.0 }, loadOp: 'clear', storeOp: 'store' }],
            depthStencilAttachment: { view: pState.depthTextureView, depthClearValue: 1.0, depthLoadOp: 'clear', depthStoreOp: 'store' }
        });

        passEncoder.setPipeline(pState.lipModelPipeline);
        passEncoder.setBindGroup(0, pState.lipModelMatrixBindGroup); 
        passEncoder.setVertexBuffer(0, pState.lipModelVertexBuffer);
        passEncoder.setIndexBuffer(pState.lipModelIndexBuffer, pState.lipModelIndexFormat);
        passEncoder.drawIndexed(pState.lipModelNumIndices);
        
        passEncoder.end();
        device.queue.submit([commandEncoder.finish()]);
        animationFrameIdRef.current = requestAnimationFrame(render);
    };

    const initializeAll = async () => {
        console.log("Attempting to load /models/lips_model.glb...");
        setDebugMessage("Loading 3D Lip Model...");
        let gltfDataFromLoaders; 
        try {
            gltfDataFromLoaders = await load('/models/lips_model.glb', GLTFLoader);
            const gltfJson = gltfDataFromLoaders.json; let mainBinaryBuffer;
            if (gltfDataFromLoaders.buffers?.[0]?.arrayBuffer instanceof ArrayBuffer) { mainBinaryBuffer = gltfDataFromLoaders.buffers[0].arrayBuffer; } 
            else if (gltfDataFromLoaders.glb?.binChunks?.[0]?.arrayBuffer instanceof ArrayBuffer) { mainBinaryBuffer = gltfDataFromLoaders.glb.binChunks[0].arrayBuffer; } 
            else { throw new Error("Could not find main binary ArrayBuffer."); }
            if (!gltfJson?.meshes?.[0]?.primitives?.[0]) throw new Error("GLTF data is missing required mesh/primitive structure.");
            const primitiveJson = gltfJson.meshes[0].primitives[0];
            if (primitiveJson.attributes.POSITION === undefined) throw new Error("Primitive missing POSITION.");
            const positions = getAccessorDataFromGLTF(gltfJson, primitiveJson.attributes.POSITION, mainBinaryBuffer);
            const normals = getAccessorDataFromGLTF(gltfJson, primitiveJson.attributes.NORMAL, mainBinaryBuffer);
            const uvs = getAccessorDataFromGLTF(gltfJson, primitiveJson.attributes.TEXCOORD_0, mainBinaryBuffer);
            const indices = getAccessorDataFromGLTF(gltfJson, primitiveJson.indices, mainBinaryBuffer);
            if (!positions || !normals || !uvs || !indices) { throw new Error("Essential mesh attributes are missing after parse."); }
            pipelineStateRef.current.lipModelData = { positions, normals, uvs, indices };
            console.log("Mesh data extracted:", { numPos:positions?.length/3, numNorm:normals?.length/3, numUV:uvs?.length/2, numIdx:indices?.length });
            setDebugMessage("3D Model Parsed. Initializing GPU...");
        } catch (modelLoadError) { console.error("Error loading/processing lip model:", modelLoadError); setError(`Model Load: ${modelLoadError.message.substring(0, 100)}`); return;  }

        if (!navigator.gpu) { setError("WebGPU not supported."); return; }
        setDebugMessage("Initializing WebGPU...");
        try {
            const adapter = await navigator.gpu.requestAdapter(); if (!adapter) throw new Error("No adapter.");
            device = await adapter.requestDevice();
            context = canvasElement.getContext('webgpu');
            format = navigator.gpu.getPreferredCanvasFormat();
            
            configureCanvasAndDepthTexture();
            
            const pState = pipelineStateRef.current;
            const layoutsAndPipelines = await createPipelines(device, format, true); 
            if (!layoutsAndPipelines.lipModelPipeline) throw new Error(`Lip Model Pipeline creation failed.`);
            
            pState.lipModelPipeline = layoutsAndPipelines.lipModelPipeline;
            pState.lipModelMatrixGroupLayout = layoutsAndPipelines.lipModelMatrixGroupLayout;
            
            pState.lipModelMatrixUBO = device.createBuffer({ label: "Scene Matrix UB", size: 16 * 4, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST });
            pState.lipModelMatrixBindGroup = device.createBindGroup({ label: "SceneMatrix_BG", layout: pState.lipModelMatrixGroupLayout, entries: [{binding:0, resource:{buffer: pState.lipModelMatrixUBO}}]});
            
            const model = pState.lipModelData;
            if (model && model.positions && model.normals && model.uvs && model.indices) {
                const numVertices = model.positions.length / 3;
                const interleavedBufferData = new Float32Array(numVertices * 8); 
                for (let i = 0; i < numVertices; i++) { let offset = i * 8; interleavedBufferData[offset++] = model.positions[i*3+0]; interleavedBufferData[offset++] = model.positions[i*3+1]; interleavedBufferData[offset++] = model.positions[i*3+2]; interleavedBufferData[offset++] = model.normals[i*3+0]; interleavedBufferData[offset++] = model.normals[i*3+1]; interleavedBufferData[offset++] = model.normals[i*3+2]; interleavedBufferData[offset++] = model.uvs[i*2+0]; interleavedBufferData[offset++] = model.uvs[i*2+1]; }
                
                pState.lipModelVertexBuffer = device.createBuffer({ label: "3DLipVB_Interleaved", size: interleavedBufferData.byteLength, usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST });
                device.queue.writeBuffer(pState.lipModelVertexBuffer, 0, interleavedBufferData);
                
                let indicesData = model.indices; let dataToWriteToGpu = indicesData; let finalIndexByteLength = indicesData.byteLength;
                if (indicesData.byteLength % 4 !== 0) { finalIndexByteLength = Math.ceil(indicesData.byteLength / 4) * 4; const paddedBuffer = new Uint8Array(finalIndexByteLength); paddedBuffer.set(new Uint8Array(indicesData.buffer, indicesData.byteOffset, indicesData.byteLength)); dataToWriteToGpu = paddedBuffer; }
                pState.lipModelIndexBuffer = device.createBuffer({ label: "3DLipIB", size: finalIndexByteLength, usage: GPUBufferUsage.INDEX | GPUBufferUsage.COPY_DST });
                device.queue.writeBuffer(pState.lipModelIndexBuffer, 0, dataToWriteToGpu, 0, finalIndexByteLength);
                
                if (model.indices instanceof Uint16Array) { pState.lipModelIndexFormat = 'uint16'; } 
                else if (model.indices instanceof Uint32Array) { pState.lipModelIndexFormat = 'uint32'; } 
                else { throw new Error("Unsupported index type."); }
                pState.lipModelNumIndices = model.indices.length;
                console.log(`Created Interleaved VB & IB (${pState.lipModelNumIndices}i)`);
            } else { throw new Error(`Essential model data missing for GPU buffers.`); }
            
            console.log("GPU resources for static model test initialized.");
            setDebugMessage("Ready (Static 3D Test).");
            if (!renderLoopStarted) { render(); renderLoopStarted = true; }
        } catch (err) { setError(`GPU Init: ${err.message.substring(0,100)}`); console.error("GPU Init Error:", err); setDebugMessage("Error: GPU Init"); }
    };

    initializeAll();
    return () => { 
        if (animationFrameIdRef.current) cancelAnimationFrame(animationFrameIdRef.current); 
        if (resizeObserverInternal && canvasElement.current) resizeObserverInternal.unobserve(canvasElement.current); 
        const pS=pipelineStateRef.current; 
        pS.lipModelMatrixUBO?.destroy(); pS.lipModelVertexBuffer?.destroy();
        pS.lipModelIndexBuffer?.destroy(); pS.depthTexture?.destroy(); 
    };
  }, []);

  useEffect(() => { 
    if (error) { setDebugMessage(`Error: ${error.substring(0,50)}`); } 
    else if (pipelineStateRef.current.lipModelPipeline) { setDebugMessage("Live Active (Static 3D Test)"); } 
    else if (pipelineStateRef.current.lipModelData && !error) { setDebugMessage("Model Parsed, GPU Init..."); } 
    else if (!pipelineStateRef.current.lipModelData && !error) { setDebugMessage("Initializing..."); } 
  }, [pipelineStateRef.current.lipModelPipeline, pipelineStateRef.current.lipModelData, error]);

  return ( 
    <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, overflow: 'hidden', margin: 0, padding: 0, background: 'darkslateblue' }}>
      <div style={{ position: 'absolute', top: '5px', left: '5px', background: 'rgba(0,0,0,0.7)', color: 'white', padding: '2px 5px', fontSize: '12px', zIndex: 20, pointerEvents: 'none' }}>
        {debugMessage} (Frame: {frameCounter.current})
      </div>
      {/* Hiding swatches for this test */}
      {/* <div style={{...}}>...</div> */}
      {/* Hiding video element for this test */}
      {/* <video ref={videoRef} style={{ display: 'none' }} ... /> */}
      <canvas ref={canvasRef} width={640} height={480} style={{ width: '100%', height: '100%', display: 'block', background: 'lightpink' }} />
    </div>
  );
}