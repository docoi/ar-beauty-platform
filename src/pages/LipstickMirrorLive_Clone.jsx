// src/pages/LipstickMirrorLive_Clone.jsx

import React, { useEffect, useRef, useState } from 'react';
import createPipelines from '@/utils/createPipelines';
import { load } from '@loaders.gl/core';
import { GLTFLoader } from '@loaders.gl/gltf';
import { mat4, vec3 } from 'gl-matrix';

function getAccessorDataFromGLTF(gltfJson, accessorIndex, mainBinaryBuffer) {
    const accessor = gltfJson.accessors[accessorIndex]; if (!accessor) throw new Error(`Accessor ${accessorIndex} not found.`);
    const bufferView = gltfJson.bufferViews[accessor.bufferView]; if (!bufferView) throw new Error(`BufferView ${accessor.bufferView} not found for accessor ${accessorIndex}.`);
    const componentType = accessor.componentType; const type = accessor.type; const count = accessor.count; let numComponents;
    switch (type) { case "SCALAR": numComponents = 1; break; case "VEC2":   numComponents = 2; break; case "VEC3":   numComponents = 3; break; case "VEC4":   numComponents = 4; break; default: throw new Error(`Unsupported type: ${type}`);}
    let TypedArrayConstructor; let componentByteSize = 0;
    switch (componentType) { case 5123: TypedArrayConstructor = Uint16Array; componentByteSize = 2; break; case 5125: TypedArrayConstructor = Uint32Array; componentByteSize = 4; break; case 5126: TypedArrayConstructor = Float32Array; componentByteSize = 4; break; default: throw new Error(`Unsupported component type: ${componentType}`);}
    const accessorByteLength = count * numComponents * componentByteSize;
    const byteOffset = (bufferView.byteOffset || 0) + (accessor.byteOffset || 0);
    if (mainBinaryBuffer.byteLength < byteOffset + accessorByteLength) { throw new Error(`Buffer out of bounds for accessor ${accessorIndex}.`); }
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
    depthTexture: null,
    depthTextureView: null,
  }).current;

  const [error, setError] = useState(null);
  const [debugMessage, setDebugMessage] = useState('Initializing...');

  useEffect(() => {
    console.log("[LML_Clone 3DModel] Main useEffect (Static Model Rotation Test - Final Fix).");
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
            resizeObserver.observe(canvas);
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
        
        device.queue.writeBuffer(pipelineStateRef.lipModelMatrixUBO, 0, mvpMatrix);

        const currentTextureView = context.getCurrentTexture().createView();
        const commandEncoder = device.createCommandEncoder();
        const passEncoder = commandEncoder.beginRenderPass({
            colorAttachments: [{ view: currentTextureView, clearValue: { r: 0, g: 0, b: 0, a: 1 }, loadOp: 'clear', storeOp: 'store' }],
            depthStencilAttachment: { view: pipelineStateRef.depthTextureView, depthClearValue: 1.0, depthLoadOp: 'clear', depthStoreOp: 'store' }
        });

        passEncoder.setPipeline(pipelineStateRef.lipModelPipeline);
        passEncoder.setBindGroup(0, pipelineStateRef.lipModelMatrixBindGroup); 
        passEncoder.setVertexBuffer(0, pipelineStateRef.lipModelVertexBuffer);
        passEncoder.setIndexBuffer(pipelineStateRef.lipModelIndexBuffer, pipelineStateRef.lipModelIndexFormat);
        passEncoder.drawIndexed(pipelineStateRef.lipModelNumIndices);
        
        passEncoder.end();
        device.queue.submit([commandEncoder.finish()]);
        animationFrameIdRef.current = requestAnimationFrame(render);
    };

    const initializeAll = async () => {
      try {
        let gltfData = await load('/models/lips_model.glb', GLTFLoader);
        const gltfJson = gltfData.json;
        if (!gltfJson?.meshes?.[0]?.primitives?.[0]) throw new Error("GLTF missing mesh/primitive structure.");
        const primitiveJson = gltfJson.meshes[0].primitives[0];
        if (primitiveJson.attributes.POSITION === undefined || primitiveJson.indices === undefined) throw new Error("Primitive missing POSITION or indices.");
        const mainBinaryBuffer = gltfData.buffers[0].arrayBuffer;
        const positions = getAccessorDataFromGLTF(gltfJson, primitiveJson.attributes.POSITION, mainBinaryBuffer);
        const indices = getAccessorDataFromGLTF(gltfJson, primitiveJson.indices, mainBinaryBuffer);
        pipelineStateRef.lipModelData = { positions, indices };

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
        if (!layoutsAndPipelines.lipModelPipeline || !layoutsAndPipelines.lipModelMatrixGroupLayout) {
            throw new Error("Simplified pipeline or its layout creation failed.");
        }
        
        pipelineStateRef.lipModelPipeline = layoutsAndPipelines.lipModelPipeline;
        pipelineStateRef.lipModelMatrixGroupLayout = layoutsAndPipelines.lipModelMatrixGroupLayout;
        
        pipelineStateRef.lipModelMatrixUBO = device.createBuffer({ label: "Scene Matrix UB", size: 16 * 4, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST });
        pipelineStateRef.lipModelMatrixBindGroup = device.createBindGroup({
            label: "SceneMatrix_BG",
            layout: pipelineStateRef.lipModelMatrixGroupLayout,
            entries: [{binding:0, resource:{buffer: pipelineStateRef.lipModelMatrixUBO}}]
        });
        
        // For this diagnostic, we only need the position data in the vertex buffer.
        pipelineStateRef.lipModelVertexBuffer = device.createBuffer({ label: "Positions VB", size: positions.byteLength, usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST });
        device.queue.writeBuffer(pipelineStateRef.lipModelVertexBuffer, 0, positions);
        
        let indicesData = indices;
        let finalIndexByteLength = indicesData.byteLength;
        if (indicesData.byteLength % 4 !== 0) { finalIndexByteLength = Math.ceil(indicesData.byteLength / 4) * 4; const paddedBuffer = new Uint8Array(finalIndexByteLength); paddedBuffer.set(new Uint8Array(indicesData.buffer, indicesData.byteOffset, indicesData.byteLength)); indicesData = paddedBuffer;}
        pipelineStateRef.lipModelIndexBuffer = device.createBuffer({ label: "Indices IB", size: finalIndexByteLength, usage: GPUBufferUsage.INDEX | GPUBufferUsage.COPY_DST });
        device.queue.writeBuffer(pipelineStateRef.lipModelIndexBuffer, 0, indicesData, 0, finalIndexByteLength);
        pipelineStateRef.lipModelIndexFormat = (indices instanceof Uint16Array) ? 'uint16' : 'uint32';
        pipelineStateRef.lipModelNumIndices = indices.length;

        console.log("GPU resources for diagnostic test initialized.");
        setDebugMessage("Running Diagnostic...");
        if (!renderLoopStarted) { render(); renderLoopStarted = true; }
      } catch (err) { setError(`Init Error: ${err.message.substring(0,100)}`); console.error("Init Error:", err); }
    };
    
    initializeAll();
    return () => {
        if (animationFrameIdRef.current) cancelAnimationFrame(animationFrameIdRef.current);
        if (resizeObserver && canvas) resizeObserver.unobserve(canvas);
        const { lipModelVertexBuffer, lipModelIndexBuffer, depthTexture, lipModelMatrixUBO } = pipelineStateRef;
        lipModelVertexBuffer?.destroy();
        lipModelIndexBuffer?.destroy();
        depthTexture?.destroy();
        lipModelMatrixUBO?.destroy();
    };
  }, []);

  return (
    <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}>
      <div style={{ position: 'absolute', top: '5px', left: '5px', color: 'white', zIndex: 10 }}>{debugMessage} {error && ` - ${error}`}</div>
      <canvas ref={canvasRef} style={{ width: '100%', height: '100%', display: 'block' }} />
    </div>
  );
}