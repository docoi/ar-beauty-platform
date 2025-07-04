// src/pages/LipstickMirrorLive_Clone.jsx

import React, { useEffect, useRef, useState } from 'react';
import createPipelines from '@/utils/createPipelines';
import { load } from '@loaders.gl/core';
import { GLTFLoader } from '@loaders.gl/gltf';
import { mat4, vec3 } from 'gl-matrix';

// This helper function is correct and necessary for parsing the GLB
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
  const canvasRef = useRef(null);
  const animationFrameIdRef = useRef(null);
  const frameCounter = useRef(0);
  
  const pipelineStateRef = useRef({
    lipModelData: null,
    lipModelVertexBuffer: null,
    lipModelIndexBuffer: null,
    lipModelIndexFormat: 'uint16',
    lipModelNumIndices: 0,
    lipModelPipeline: null,
    lipModelMatrixGroupLayout: null,
    lipModelMatrixUBO: null,
    lipModelMatrixBindGroup: null,
    // Add back other resources needed for the full shader
    lipstickMaterialGroupLayout: null,
    lipstickMaterialUniformBuffer: null,
    lipModelMaterialBindGroup: null,
    lightingGroupLayout: null,
    lightingUniformBuffer: null,
    lipModelLightingBindGroup: null,
    lipstickAlbedoTextureView: null,
    lipstickNormalTextureView: null,
    lipstickAlbedoSampler: null,
    depthTexture: null,
    depthTextureView: null,
  }).current;

  const [error, setError] = useState(null);
  const [debugMessage, setDebugMessage] = useState('Initializing...');

  useEffect(() => {
    console.log("[LML_Clone 3DModel] Main useEffect (Static Model Rotation Test).");
    let device, context, format, resizeObserver; 
    let renderLoopStarted = false;
    const canvas = canvasRef.current;
    if (!canvas) return;

    const render = () => {
        if (!device || !context || !pipelineStateRef.lipModelPipeline || !pipelineStateRef.depthTextureView) {
            animationFrameIdRef.current = requestAnimationFrame(render); 
            return; 
        }
        frameCounter.current++;
        
        if (pipelineStateRef.depthTexture.width !== context.canvas.width || pipelineStateRef.depthTexture.height !== context.canvas.height) {
            resizeObserver.observe(canvas); // Re-trigger resize logic
            animationFrameIdRef.current = requestAnimationFrame(render);
            return;
        }
        
        const projectionMatrix = mat4.create();
        const canvasAspectRatio = context.canvas.width / context.canvas.height;
        mat4.perspective(projectionMatrix, 45 * Math.PI / 180, canvasAspectRatio, 0.01, 100.0);
        
        const viewMatrix = mat4.create();
        mat4.lookAt(viewMatrix, vec3.fromValues(0, 0, 0.2), vec3.fromValues(0, 0, 0), vec3.fromValues(0, 1, 0));
        
        const modelMatrix = mat4.create();
        mat4.rotateY(modelMatrix, modelMatrix, frameCounter.current * 0.01);
        mat4.scale(modelMatrix, modelMatrix, vec3.fromValues(0.3, 0.3, 0.3));

        const sceneMatrices = new Float32Array(16 * 3);
        sceneMatrices.set(projectionMatrix, 0);
        sceneMatrices.set(viewMatrix, 16);
        sceneMatrices.set(modelMatrix, 32);

        device.queue.writeBuffer(pipelineStateRef.lipModelMatrixUBO, 0, sceneMatrices);
        
        // Write placeholder data to other uniform buffers
        device.queue.writeBuffer(pipelineStateRef.lipstickMaterialUniformBuffer, 0, new Float32Array([1,1,1,1]));
        device.queue.writeBuffer(pipelineStateRef.lightingUniformBuffer, 0, new Float32Array(16));

        const currentTextureView = context.getCurrentTexture().createView();
        const commandEncoder = device.createCommandEncoder();
        const passEncoder = commandEncoder.beginRenderPass({
            colorAttachments: [{ view: currentTextureView, clearValue: { r: 0, g: 0, b: 0, a: 1 }, loadOp: 'clear', storeOp: 'store' }],
            depthStencilAttachment: { view: pipelineStateRef.depthTextureView, depthClearValue: 1.0, depthLoadOp: 'clear', depthStoreOp: 'store' }
        });
        
        passEncoder.setPipeline(pipelineStateRef.lipModelPipeline);
        passEncoder.setBindGroup(0, pipelineStateRef.lipModelMatrixBindGroup); 
        passEncoder.setBindGroup(1, pipelineStateRef.lipModelMaterialBindGroup);   
        passEncoder.setBindGroup(2, pipelineStateRef.lipModelLightingBindGroup);   
        passEncoder.setVertexBuffer(0, pipelineStateRef.lipModelVertexBuffer);
        passEncoder.setIndexBuffer(pipelineStateRef.lipModelIndexBuffer, pipelineStateRef.lipModelIndexFormat);
        passEncoder.drawIndexed(pipelineStateRef.lipModelNumIndices);
        
        passEncoder.end();
        device.queue.submit([commandEncoder.finish()]);
        animationFrameIdRef.current = requestAnimationFrame(render);
    };

    const initializeAll = async () => {
      try {
        console.log("Attempting to load /models/lips_model.glb...");
        setDebugMessage("Loading 3D Lip Model...");
        let gltfData = await load('/models/lips_model.glb', GLTFLoader);
        const gltfJson = gltfData.json;
        if (!gltfJson?.meshes?.[0]?.primitives?.[0]) throw new Error("GLTF missing mesh/primitive structure.");
        const primitiveJson = gltfJson.meshes[0].primitives[0];
        if (primitiveJson.attributes.POSITION === undefined || primitiveJson.indices === undefined) throw new Error("Primitive missing POSITION or indices.");
        const mainBinaryBuffer = gltfData.buffers[0].arrayBuffer;
        const positions = getAccessorDataFromGLTF(gltfJson, primitiveJson.attributes.POSITION, mainBinaryBuffer);
        const normals = getAccessorDataFromGLTF(gltfJson, primitiveJson.attributes.NORMAL, mainBinaryBuffer);
        const uvs = getAccessorDataFromGLTF(gltfJson, primitiveJson.attributes.TEXCOORD_0, mainBinaryBuffer);
        const indices = getAccessorDataFromGLTF(gltfJson, primitiveJson.indices, mainBinaryBuffer);
        if (!positions || !normals || !uvs || !indices) { throw new Error("Essential mesh attributes are missing after parse."); }
        pipelineStateRef.lipModelData = { positions, normals, uvs, indices };

        console.log("Model Parsed. Initializing WebGPU...");
        setDebugMessage("Model Parsed. Initializing GPU...");
        
        const adapter = await navigator.gpu.requestAdapter();
        device = await adapter.requestDevice();
        context = canvas.getContext('webgpu');
        format = navigator.gpu.getPreferredCanvasFormat();
        
        const configureAndRender = () => {
            const dpr = window.devicePixelRatio || 1;
            const targetWidth = canvas.clientWidth * dpr;
            const targetHeight = canvas.clientHeight * dpr;
            if (canvas.width !== targetWidth || canvas.height !== targetHeight) { canvas.width = targetWidth; canvas.height = targetHeight; }
            context.configure({ device, format, alphaMode: 'opaque', size: [canvas.width, canvas.height] });
            pipelineStateRef.depthTexture?.destroy();
            pipelineStateRef.depthTexture = device.createTexture({ size: [canvas.width, canvas.height], format: 'depth24plus', usage: GPUTextureUsage.RENDER_ATTACHMENT });
            pipelineStateRef.depthTextureView = pipelineStateRef.depthTexture.createView();
        };
        resizeObserver = new ResizeObserver(configureAndRender);
        resizeObserver.observe(canvas);
        configureAndRender();

        const layoutsAndPipelines = await createPipelines(device, format, true);
        if (!layoutsAndPipelines.lipModelPipeline) throw new Error("Simplified pipeline creation failed.");
        
        pipelineStateRef.lipModelPipeline = layoutsAndPipelines.lipModelPipeline;
        pipelineStateRef.lipModelMatrixGroupLayout = layoutsAndPipelines.lipModelMatrixGroupLayout;
        pipelineStateRef.lipstickMaterialGroupLayout = layoutsAndPipelines.lipstickMaterialGroupLayout;
        pipelineStateRef.lightingGroupLayout = layoutsAndPipelines.lightingGroupLayout;

        // Create all UBOs and Bind Groups
        pipelineStateRef.lipModelMatrixUBO = device.createBuffer({ label: "Scene Matrix UB", size: (16 * 3) * 4, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST });
        pipelineStateRef.lipModelMatrixBindGroup = device.createBindGroup({ label: "SceneMatrix_BG", layout: pipelineStateRef.lipModelMatrixGroupLayout, entries: [{binding:0, resource:{buffer: pipelineStateRef.lipModelMatrixUBO}}]});

        pipelineStateRef.lipstickMaterialUniformBuffer = device.createBuffer({ label: "MaterialTint_UB", size: 4 * 4, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST });
        pipelineStateRef.lightingUniformBuffer = device.createBuffer({ label: "Lighting_UB", size: (4 + 4 + 4 + 4) * 4, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST });
        
        let placeholderTex = device.createTexture({size: [1,1], format: 'rgba8unorm', usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST | GPUTextureUsage.RENDER_ATTACHMENT});
        let placeholderSampler = device.createSampler();

        pipelineStateRef.lipModelMaterialBindGroup = device.createBindGroup({
            label: "Material_BG_StaticTest",
            layout: pipelineStateRef.lipstickMaterialGroupLayout,
            entries: [
                { binding: 0, resource: { buffer: pipelineStateRef.lipstickMaterialUniformBuffer }},
                { binding: 1, resource: placeholderTex.createView() },
                { binding: 2, resource: placeholderSampler },
                { binding: 3, resource: placeholderTex.createView() },
            ]
        });
        pipelineStateRef.lipModelLightingBindGroup = device.createBindGroup({label: "Lighting_BG", layout: pipelineStateRef.lightingGroupLayout, entries: [{binding:0, resource:{buffer:pipelineStateRef.lightingUniformBuffer}}]});

        const model = pipelineStateRef.lipModelData;
        const numVertices = model.positions.length / 3;
        const interleavedBufferData = new Float32Array(numVertices * 8); 
        for (let i = 0; i < numVertices; i++) { let offset = i * 8; interleavedBufferData[offset++] = model.positions[i*3+0]; interleavedBufferData[offset++] = model.positions[i*3+1]; interleavedBufferData[offset++] = model.positions[i*3+2]; interleavedBufferData[offset++] = model.normals[i*3+0]; interleavedBufferData[offset++] = model.normals[i*3+1]; interleavedBufferData[offset++] = model.normals[i*3+2]; interleavedBufferData[offset++] = model.uvs[i*2+0]; interleavedBufferData[offset++] = model.uvs[i*2+1]; }
        
        pipelineStateRef.lipModelVertexBuffer = device.createBuffer({ label: "3DLipVB_Interleaved", size: interleavedBufferData.byteLength, usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST });
        device.queue.writeBuffer(pipelineStateRef.lipModelVertexBuffer, 0, interleavedBufferData);
        
        let indicesData = model.indices; let dataToWriteToGpu = indicesData; let finalIndexByteLength = indicesData.byteLength;
        if (indicesData.byteLength % 4 !== 0) { finalIndexByteLength = Math.ceil(indicesData.byteLength / 4) * 4; const paddedBuffer = new Uint8Array(finalIndexByteLength); paddedBuffer.set(new Uint8Array(indicesData.buffer, indicesData.byteOffset, indicesData.byteLength)); dataToWriteToGpu = paddedBuffer; }
        pipelineStateRef.lipModelIndexBuffer = device.createBuffer({ label: "3DLipIB", size: finalIndexByteLength, usage: GPUBufferUsage.INDEX | GPUBufferUsage.COPY_DST });
        device.queue.writeBuffer(pipelineStateRef.lipModelIndexBuffer, 0, dataToWriteToGpu, 0, finalIndexByteLength);
        
        pipelineStateRef.lipModelIndexFormat = (indices instanceof Uint16Array) ? 'uint16' : 'uint32';
        pipelineStateRef.lipModelNumIndices = indices.length;
        console.log(`Created Interleaved VB & IB (${pipelineStateRef.lipModelNumIndices}i)`);

        console.log("GPU resources for diagnostic test initialized.");
        setDebugMessage("Running Diagnostic...");
        if (!renderLoopStarted) { render(); renderLoopStarted = true; }
      } catch (err) { setError(`Init Error: ${err.message.substring(0,100)}`); console.error("Init Error:", err); }
    };
    
    initializeAll();
    return () => {
        if (animationFrameIdRef.current) cancelAnimationFrame(animationFrameIdRef.current);
        if (resizeObserver && canvas) resizeObserver.unobserve(canvas);
        // Simplified cleanup for this test
    };
  }, []);

  return (
    <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}>
      <div style={{ position: 'absolute', top: '5px', left: '5px', color: 'white', zIndex: 10 }}>{debugMessage} {error && ` - ${error}`}</div>
      <canvas ref={canvasRef} style={{ width: '100%', height: '100%', display: 'block' }} />
    </div>
  );
}