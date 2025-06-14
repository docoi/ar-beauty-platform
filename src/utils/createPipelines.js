// src/utils/createPipelines.js

import videoShaderSource from '@/shaders/videoBackground.wgsl?raw';
import lipstickShaderSource from '@/shaders/lipstickEffect.wgsl?raw'; // Contains vert_main_3d, frag_main_3d

// Pipeline for rendering the 2D video background
async function createVideoBackgroundPipeline(device, format, videoBindGroupLayout, sceneUniformsGroupLayout) {
  const videoModule = device.createShaderModule({ label: 'Video Background Shader Module', code: videoShaderSource });
  try {
    return await device.createRenderPipeline({
      label: 'Video Background Pipeline',
      // Group 0 for video texture/sampler
      // Group 1 for scene uniforms (which will contain video dimensions for this pipeline)
      layout: device.createPipelineLayout({ bindGroupLayouts: [videoBindGroupLayout, sceneUniformsGroupLayout] }),
      vertex: { module: videoModule, entryPoint: 'vert_main' },
      fragment: { module: videoModule, entryPoint: 'frag_main', targets: [{ format }] },
      primitive: { topology: 'triangle-list' },
    });
  } catch (e) { 
    console.error("[createPipelines] ERROR creating Video Background Pipeline:", e);
    return null; 
  }
}

// Pipeline for rendering the 3D Lip Model
async function create3DLipModelPipeline(device, canvasFormat, sceneUniformsGroupLayout, lipstickMaterialGroupLayout, lightingGroupLayout) {
  let modelShaderModule;
  try {
    modelShaderModule = device.createShaderModule({
      label: '3D Lip Model Shader Module',
      code: lipstickShaderSource 
    });
    console.log("[createPipelines] 3D Lip Model shader module created.");
  } catch (e) { 
    console.error("[createPipelines] ERROR creating 3D Lip Model shader module:", e); 
    return null; 
  }

  try {
    const pipeline = await device.createRenderPipeline({
      label: '3D Lip Model Pipeline',
      layout: device.createPipelineLayout({ 
        bindGroupLayouts: [
            sceneUniformsGroupLayout,      // Group 0: Scene Uniforms (Matrices)
            lipstickMaterialGroupLayout, // Group 1: Material (Color, Textures, Sampler)
            lightingGroupLayout          // Group 2: Lighting Uniforms
        ] 
      }),
      vertex: {
        module: modelShaderModule,
        entryPoint: 'vert_main_3d',
        buffers: [ 
          {
            // Interleaved: Pos(vec3f), Norm(vec3f), UV(vec2f)
            arrayStride: (3 + 3 + 2) * 4, // 32 bytes
            attributes: [
              { shaderLocation: 0, offset: 0,     format: 'float32x3' }, // position_model
              { shaderLocation: 1, offset: 3 * 4, format: 'float32x3' }, // normal_model
              { shaderLocation: 2, offset: 6 * 4, format: 'float32x2' }, // uv_in
            ],
          },
        ],
      },
      fragment: {
        module: modelShaderModule,
        entryPoint: 'frag_main_3d',
        targets: [{
          format: canvasFormat,
          blend: { 
            color: { srcFactor: 'src-alpha', dstFactor: 'one-minus-src-alpha', operation: 'add' },
            alpha: { srcFactor: 'one', dstFactor: 'one-minus-src-alpha', operation: 'add' }
          }
        }],
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
    console.log("[createPipelines] 3D Lip Model pipeline CREATED successfully.");
    return pipeline;
  } catch (e) { 
    console.error("[createPipelines] ERROR creating 3D Lip Model pipeline:", e); 
    return null; 
  }
}

export default async function createPipelines(device, canvasFormat, is3DModelMode = false) {
  // Bind Group Layout definitions
  const videoBindGroupLayout = device.createBindGroupLayout({
    label: 'Video Texture BGL',
    entries: [
      { binding: 0, visibility: GPUShaderStage.FRAGMENT, sampler: { type: 'filtering' } },
      { binding: 1, visibility: GPUShaderStage.FRAGMENT, externalTexture: {} }
    ]
  });

  const sceneUniformsGroupLayout = device.createBindGroupLayout({
    label: 'Scene Uniforms BGL (MVP / AspectRatio)',
    entries: [{ binding: 0, visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT, buffer: { type: 'uniform' }}]
  });

  const lipstickMaterialGroupLayout = device.createBindGroupLayout({
    label: 'Lipstick Material BGL',
    entries: [
      { binding: 0, visibility: GPUShaderStage.FRAGMENT, buffer: { type: 'uniform' } }, 
      { binding: 1, visibility: GPUShaderStage.FRAGMENT, texture: { sampleType: 'float' } }, 
      { binding: 2, visibility: GPUShaderStage.FRAGMENT, sampler: { type: 'filtering' } }, 
      { binding: 3, visibility: GPUShaderStage.FRAGMENT, texture: { sampleType: 'float' } }
    ]
  });

  const lightingGroupLayout = device.createBindGroupLayout({
    label: 'Lighting BGL',
    entries: [ { binding: 0, visibility: GPUShaderStage.FRAGMENT, buffer: { type: 'uniform' } } ]
  });
  console.log("[createPipelines] All common Bind Group Layouts created.");

  const videoPipeline = await createVideoBackgroundPipeline(device, canvasFormat, videoBindGroupLayout, sceneUniformsGroupLayout);
  if (!videoPipeline) {
    console.error("[createPipelines] FATAL: Video background pipeline creation failed!");
  }

  let lipModelPipeline = null;
  if (is3DModelMode) {
    console.log("[createPipelines] is3DModelMode is true. Attempting to create 3D Lip Model pipeline...");
    lipModelPipeline = await create3DLipModelPipeline(device, canvasFormat, sceneUniformsGroupLayout, lipstickMaterialGroupLayout, lightingGroupLayout);
    if (!lipModelPipeline) {
        console.error("[createPipelines] FATAL: 3D Lip Model pipeline creation returned null/undefined!");
    }
  }
  
  console.log("[createPipelines] Returning pipelines. Lip Model Pipeline is:", lipModelPipeline ? "OK" : "null");

  return { 
    videoPipeline, 
    lipModelPipeline, 
    videoBindGroupLayout, 
    sceneUniformsGroupLayout,
    lipstickMaterialGroupLayout, 
    lightingGroupLayout 
  };
}