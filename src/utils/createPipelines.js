// src/utils/createPipelines.js

import videoShaderSource from '@/shaders/videoBackground.wgsl?raw';
import lipstickShaderSource from '@/shaders/lipstickEffect.wgsl?raw';

async function createVideoBackgroundPipeline(device, format, videoBindGroupLayout, videoAspectRatioGroupLayout) {
  const videoModule = device.createShaderModule({ label: 'Video BG Shader Module', code: videoShaderSource });
  try {
    return await device.createRenderPipeline({
      label: 'Video Background Pipeline',
      layout: device.createPipelineLayout({ bindGroupLayouts: [videoBindGroupLayout, videoAspectRatioGroupLayout] }),
      vertex: { module: videoModule, entryPoint: 'vert_main' },
      fragment: { module: videoModule, entryPoint: 'frag_main', targets: [{ format }] },
      primitive: { topology: 'triangle-list' },
      depthStencil: { depthWriteEnabled: false, depthCompare: 'always', format: 'depth24plus' },
    });
  } catch (e) { console.error("ERROR creating Video BG Pipeline:", e); return null; }
}

async function create3DLipModelPipeline(device, canvasFormat, lipModelMatrixGroupLayout) {
  let modelShaderModule;
  try {
    modelShaderModule = device.createShaderModule({ label: '3D Lip Model Shader Module', code: lipstickShaderSource });
  } catch (e) { console.error("ERROR creating 3D Lip Model shader module:", e); return null; }

  try {
    const pipeline = await device.createRenderPipeline({
      label: '3D Lip Model Pipeline',
      layout: device.createPipelineLayout({ bindGroupLayouts: [ lipModelMatrixGroupLayout ] }),
      vertex: {
        module: modelShaderModule, entryPoint: 'vert_main_3d',
        buffers: [ {
            arrayStride: (3 + 3 + 2) * 4, // Still use full stride of interleaved data
            attributes: [ { shaderLocation: 0, offset: 0, format: 'float32x3' } ], // But only read position
        } ],
      },
      fragment: {
        module: modelShaderModule, entryPoint: 'frag_main_3d',
        targets: [{ format: canvasFormat }],
      },
      primitive: { topology: 'triangle-list', cullMode: 'back' },
      depthStencil: { depthWriteEnabled: true, depthCompare: 'less', format: 'depth24plus' },
    });
    console.log("[createPipelines] 3D Lip Model pipeline CREATED successfully (Simplified).");
    return pipeline;
  } catch (e) { console.error("ERROR creating 3D Lip Model pipeline:", e); return null; }
}

export default async function createPipelines(device, canvasFormat, is3DModelMode = false) {
  const videoBindGroupLayout = device.createBindGroupLayout({ label: 'Video Texture BGL', entries: [ { binding: 0, visibility: GPUShaderStage.FRAGMENT, sampler: { type: 'filtering' } }, { binding: 1, visibility: GPUShaderStage.FRAGMENT, externalTexture: {} } ] });
  const videoAspectRatioGroupLayout = device.createBindGroupLayout({ label: 'Video Aspect Ratio BGL', entries: [{ binding: 0, visibility: GPUShaderStage.FRAGMENT, buffer: { type: 'uniform' }}] });
  const lipModelMatrixGroupLayout = device.createBindGroupLayout({ label: 'Lip Model Matrix BGL', entries: [{ binding: 0, visibility: GPUShaderStage.VERTEX, buffer: { type: 'uniform' }}] });
  
  const videoPipeline = await createVideoBackgroundPipeline(device, canvasFormat, videoBindGroupLayout, videoAspectRatioGroupLayout);
  let lipModelPipeline = null;
  if (is3DModelMode) {
    lipModelPipeline = await create3DLipModelPipeline(device, canvasFormat, lipModelMatrixGroupLayout);
  }
  
  return { videoPipeline, lipModelPipeline, videoBindGroupLayout, videoAspectRatioGroupLayout, lipModelMatrixGroupLayout };
}