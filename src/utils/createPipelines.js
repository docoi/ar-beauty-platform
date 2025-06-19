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

async function create3DLipModelPipeline(device, canvasFormat, lipModelMatrixGroupLayout, lipstickMaterialGroupLayout, lightingGroupLayout) {
  let modelShaderModule;
  try { modelShaderModule = device.createShaderModule({ label: '3D Lip Model Shader Module', code: lipstickShaderSource });
  } catch (e) { console.error("ERROR creating 3D Lip Model shader module:", e); return null; }

  try {
    const pipeline = await device.createRenderPipeline({
      label: '3D Lip Model Pipeline',
      layout: device.createPipelineLayout({ bindGroupLayouts: [ lipModelMatrixGroupLayout, lipstickMaterialGroupLayout, lightingGroupLayout ] }),
      vertex: {
        module: modelShaderModule, entryPoint: 'vert_main_3d',
        buffers: [ {
            arrayStride: (3 + 3 + 2) * 4, // Interleaved: Pos(3) + Norm(3) + UV(2) = 8 floats
            attributes: [
              { shaderLocation: 0, offset: 0,     format: 'float32x3' }, // Position
              { shaderLocation: 1, offset: 3 * 4, format: 'float32x3' }, // Normal
              { shaderLocation: 2, offset: 6 * 4, format: 'float32x2' }, // UV
            ],
        } ],
      },
      fragment: {
        module: modelShaderModule, entryPoint: 'frag_main_3d',
        targets: [{ format: canvasFormat, blend: { color: { srcFactor: 'src-alpha', dstFactor: 'one-minus-src-alpha', operation: 'add' }, alpha: { srcFactor: 'one', dstFactor: 'one-minus-src-alpha', operation: 'add' } } }],
      },
      primitive: { topology: 'triangle-list', cullMode: 'back' },
      depthStencil: { depthWriteEnabled: true, depthCompare: 'less', format: 'depth24plus' },
    });
    console.log("[createPipelines] 3D Lip Model pipeline CREATED successfully (Interleaved).");
    return pipeline;
  } catch (e) { console.error("ERROR creating 3D Lip Model pipeline:", e); return null; }
}

export default async function createPipelines(device, canvasFormat, is3DModelMode = false) {
  const videoBindGroupLayout = device.createBindGroupLayout({ label: 'Video Texture BGL', entries: [ { binding: 0, visibility: GPUShaderStage.FRAGMENT, sampler: { type: 'filtering' } }, { binding: 1, visibility: GPUShaderStage.FRAGMENT, externalTexture: {} } ] });
  const videoAspectRatioGroupLayout = device.createBindGroupLayout({ label: 'Video Aspect Ratio BGL', entries: [{ binding: 0, visibility: GPUShaderStage.FRAGMENT, buffer: { type: 'uniform' }}] });
  const lipModelMatrixGroupLayout = device.createBindGroupLayout({ label: 'Lip Model Matrix BGL', entries: [{ binding: 0, visibility: GPUShaderStage.VERTEX, buffer: { type: 'uniform' }}] });
  const lipstickMaterialGroupLayout = device.createBindGroupLayout({ label: 'Lipstick Material BGL', entries: [ { binding: 0, visibility: GPUShaderStage.FRAGMENT, buffer: { type: 'uniform' } }, { binding: 1, visibility: GPUShaderStage.FRAGMENT, texture: { sampleType: 'float' } }, { binding: 2, visibility: GPUShaderStage.FRAGMENT, sampler: { type: 'filtering' } }, { binding: 3, visibility: GPUShaderStage.FRAGMENT, texture: { sampleType: 'float' } } ] });
  const lightingGroupLayout = device.createBindGroupLayout({ label: 'Lighting BGL', entries: [ { binding: 0, visibility: GPUShaderStage.FRAGMENT, buffer: { type: 'uniform' } } ] });
  
  console.log("[createPipelines] All Bind Group Layouts created.");
  const videoPipeline = await createVideoBackgroundPipeline(device, canvasFormat, videoBindGroupLayout, videoAspectRatioGroupLayout);
  let lipModelPipeline = null;
  if (is3DModelMode) {
    lipModelPipeline = await create3DLipModelPipeline(device, canvasFormat, lipModelMatrixGroupLayout, lipstickMaterialGroupLayout, lightingGroupLayout);
  }
  return { videoPipeline, lipModelPipeline, videoBindGroupLayout, videoAspectRatioGroupLayout, lipModelMatrixGroupLayout, lipstickMaterialGroupLayout, lightingGroupLayout };
}