// src/utils/createPipelines.js

import lipstickShaderSource from '@/shaders/lipstickEffect.wgsl?raw';

async function create3DLipModelPipeline(device, canvasFormat) {
  let modelShaderModule;
  try {
    modelShaderModule = device.createShaderModule({
      label: '3D Lip Model Shader Module (Diagnostic)',
      code: lipstickShaderSource 
    });
  } catch (e) { 
    console.error("ERROR creating shader module:", e); 
    return null; 
  }

  try {
    const pipeline = await device.createRenderPipeline({
      label: '3D Lip Model Pipeline (Diagnostic)',
      // NO BIND GROUPS FOR THIS TEST
      layout: device.createPipelineLayout({ bindGroupLayouts: [] }),
      vertex: {
        module: modelShaderModule,
        entryPoint: 'vert_main_3d',
        buffers: [ 
          {
            // The buffer still contains interleaved data, but we only describe the position part to the pipeline.
            arrayStride: (3 + 3 + 2) * 4, // 32 bytes (Pos, Norm, UV)
            attributes: [
              { shaderLocation: 0, offset: 0, format: 'float32x3' }, // @location(0) position
            ],
          },
        ],
      },
      fragment: {
        module: modelShaderModule,
        entryPoint: 'frag_main_3d',
        targets: [{ format: canvasFormat }],
      },
      primitive: { 
        topology: 'triangle-list',
        cullMode: 'back', 
      },
      depthStencil: {
        depthWriteEnabled: true,
        depthCompare: 'less',
        format: 'depth24plus',
      },
    });
    console.log("[createPipelines] SIMPLIFIED Diagnostic 3D Lip Model pipeline CREATED.");
    return pipeline;
  } catch (e) { 
    console.error("ERROR creating Diagnostic 3D Lip Model pipeline:", e); 
    return null; 
  }
}

export default async function createPipelines(device, canvasFormat) {
  const lipModelPipeline = await create3DLipModelPipeline(device, canvasFormat);
  
  // Only return the single pipeline needed for this test.
  return { 
    lipModelPipeline
  };
}