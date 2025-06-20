// src/utils/createPipelines.js

import lipstickShaderSource from '@/shaders/lipstickEffect.wgsl?raw';

async function create3DLipModelPipeline(device, canvasFormat) {
  let modelShaderModule;
  try {
    modelShaderModule = device.createShaderModule({ label: '3D Lip Model Shader Module (Diagnostic)', code: lipstickShaderSource });
  } catch (e) { console.error("ERROR creating shader module:", e); return null; }

  try {
    const pipeline = await device.createRenderPipeline({
      label: '3D Lip Model Pipeline (Diagnostic)',
      layout: device.createPipelineLayout({ bindGroupLayouts: [] }), // NO BIND GROUPS
      vertex: {
        module: modelShaderModule, entryPoint: 'vert_main_3d',
        buffers: [ {
            arrayStride: 3 * 4, // Only sending position data for this test
            attributes: [ { shaderLocation: 0, offset: 0, format: 'float32x3' } ],
        } ],
      },
      fragment: {
        module: modelShaderModule, entryPoint: 'frag_main_3d',
        targets: [{ format: canvasFormat }],
      },
      primitive: { topology: 'triangle-list', cullMode: 'back' },
      depthStencil: { depthWriteEnabled: true, depthCompare: 'less', format: 'depth24plus' },
    });
    console.log("[createPipelines] SIMPLIFIED Diagnostic 3D Lip Model pipeline CREATED.");
    return pipeline;
  } catch (e) { console.error("ERROR creating Diagnostic 3D Lip Model pipeline:", e); return null; }
}

export default async function createPipelines(device, canvasFormat) {
  const lipModelPipeline = await create3DLipModelPipeline(device, canvasFormat);
  return { lipModelPipeline };
}