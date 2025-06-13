// src/utils/createPipelines.js

import videoShaderSource from '@/shaders/videoBackground.wgsl?raw';
import lipstickShaderSource from '@/shaders/lipstickEffect.wgsl?raw'; // This will serve as the shader for the 3D model

// Pipeline for rendering the 2D video background
async function createVideoBackgroundPipeline(device, format, videoBindGroupLayout, aspectRatioGroupLayout) {
  const videoModule = device.createShaderModule({ label: 'Video Background Shader Module', code: videoShaderSource });
  try {
    return await device.createRenderPipeline({
      label: 'Video Background Pipeline',
      layout: device.createPipelineLayout({ bindGroupLayouts: [videoBindGroupLayout, aspectRatioGroupLayout] }),
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
async function create3DLipModelPipeline(device, format, aspectRatioGroupLayout, lipstickMaterialGroupLayout, lightingGroupLayout) {
  let modelShaderModule;
  try {
    modelShaderModule = device.createShaderModule({
      label: '3D Lip Model Shader Module',
      code: lipstickShaderSource // lipstickEffect.wgsl will be adapted
    });
    console.log("[createPipelines] 3D Lip Model shader module created using lipstickEffect.wgsl.");
  } catch (e) { 
    console.error("[createPipelines] ERROR creating 3D Lip Model shader module:", e); 
    return null; 
  }

  try {
    const pipeline = await device.createRenderPipeline({
      label: '3D Lip Model Pipeline',
      layout: device.createPipelineLayout({ 
        bindGroupLayouts: [
            aspectRatioGroupLayout,      // Group 0: MVP Matrix (from a UBO that might also hold video dims)
            lipstickMaterialGroupLayout, // Group 1: Material (Color tint, AlbedoTex, Sampler, NormalTex)
            lightingGroupLayout          // Group 2: Lighting Uniforms
        ] 
      }),
      vertex: {
        module: modelShaderModule,
        entryPoint: 'vert_main_3d', // Needs to exist in lipstickEffect.wgsl
        buffers: [ 
          {
            // Interleaved: Pos(vec3f), Norm(vec3f), UV(vec2f)
            arrayStride: (3 + 3 + 2) * 4, // 8 floats * 4 bytes/float = 32 bytes
            attributes: [
              { shaderLocation: 0, offset: 0, format: 'float32x3' },     // Position (model space)
              { shaderLocation: 1, offset: 3 * 4, format: 'float32x3' }, // Normal (model space)
              { shaderLocation: 2, offset: 6 * 4, format: 'float32x2' }, // UV
            ],
          },
        ],
      },
      fragment: {
        module: modelShaderModule,
        entryPoint: 'frag_main_3d', // Needs to exist in lipstickEffect.wgsl
        targets: [{
          format,
          blend: { 
            color: { srcFactor: 'src-alpha', dstFactor: 'one-minus-src-alpha', operation: 'add' },
            alpha: { srcFactor: 'one', dstFactor: 'one-minus-src-alpha', operation: 'add' }
          }
        }],
      },
      primitive: { topology: 'triangle-list' },
      // TODO: Add depth stencil state for 3D rendering. This is CRITICAL for correct 3D.
      // We will add this once the basic pipeline creation is confirmed.
      // depthStencil: {
      //   depthWriteEnabled: true,
      //   depthCompare: 'less',
      //   format: 'depth24plus', // This format needs to match the depth texture view's format
      // },
    });
    console.log("[createPipelines] 3D Lip Model pipeline created successfully.");
    return pipeline;
  } catch (e) { 
    console.error("[createPipelines] ERROR creating 3D Lip Model pipeline:", e); 
    return null; 
  }
}

export default async function createPipelines(device, format, is3DModelMode = false) {
  // Common Bind Group Layouts definitions
  const videoBindGroupLayout = device.createBindGroupLayout({
    label: 'Video Texture BGL',
    entries: [
      { binding: 0, visibility: GPUShaderStage.FRAGMENT, sampler: { type: 'filtering' } },
      { binding: 1, visibility: GPUShaderStage.FRAGMENT, externalTexture: {} }
    ]
  });

  const aspectRatioGroupLayout = device.createBindGroupLayout({
    label: 'Aspect Ratio / MVP BGL',
    entries: [{ binding: 0, visibility: GPUShaderStage.VERTEX, buffer: { type: 'uniform' }}]
    // For video, frag shader uses it. For 3D model, vert shader uses it for MVP.
    // To be flexible, visibility can be VERTEX | FRAGMENT, but for now, specific usage is fine.
    // The UBO itself will be structured to hold video dims and then MVP matrix.
  });

  const lipstickMaterialGroupLayout = device.createBindGroupLayout({
    label: 'Lipstick Material BGL (Color, Albedo, Sampler, NormalMap)',
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

  const videoPipeline = await createVideoBackgroundPipeline(device, format, videoBindGroupLayout, aspectRatioGroupLayout);
  if (!videoPipeline) {
    console.error("[createPipelines] FATAL: Video background pipeline creation failed!");
    // If video pipeline fails, we probably can't proceed meaningfully.
  }

  let lipModelPipeline = null;
  if (is3DModelMode) {
    console.log("[createPipelines] is3DModelMode is true. Attempting to create 3D Lip Model pipeline...");
    lipModelPipeline = await create3DLipModelPipeline(device, format, aspectRatioGroupLayout, lipstickMaterialGroupLayout, lightingGroupLayout);
    if (!lipModelPipeline) {
        console.error("[createPipelines] FATAL: 3D Lip Model pipeline creation failed! This will cause issues in initializeAll.");
    }
  }
  
  return { 
    videoPipeline, 
    lipModelPipeline, // This is now correctly named and will be null if not in 3D mode
    videoBindGroupLayout, 
    aspectRatioGroupLayout, 
    lipstickMaterialGroupLayout, 
    lightingGroupLayout 
  };
}