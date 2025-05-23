// src/utils/createPipelines.js

import videoShaderSource from '@/shaders/videoBackground.wgsl?raw';
import lipstickShaderSource from '@/shaders/lipstickEffect.wgsl?raw';

async function createFullVideoPipeline(device, format, videoBindGroupLayout, aspectRatioGroupLayout) {
  // ... (This function remains unchanged) ...
  const videoModule = device.createShaderModule({ label: 'Full Video Shader Module', code: videoShaderSource });
  try {
    return await device.createRenderPipeline({
      label: 'Full Video Background Pipeline',
      layout: device.createPipelineLayout({ bindGroupLayouts: [videoBindGroupLayout, aspectRatioGroupLayout] }),
      vertex: { module: videoModule, entryPoint: 'vert_main' },
      fragment: { module: videoModule, entryPoint: 'frag_main', targets: [{ format }] },
      primitive: { topology: 'triangle-list' },
    });
  } catch (e) {
    console.error("[createPipelines] ERROR creating Full Video Render Pipeline:", e);
    return null;
  }
}

async function createLipstickPipeline(device, format, aspectRatioGroupLayout, lipstickMaterialGroupLayout) {
  let lipstickModule;
  try {
    lipstickModule = device.createShaderModule({
      label: 'Lipstick Shader Module (Texture)', // Updated label
      code: lipstickShaderSource
    });
    console.log("[createPipelines] Lipstick shader module created.");
  } catch (e) {
    console.error("[createPipelines] ERROR creating lipstick shader module:", e);
    return null;
  }

  try {
    const pipeline = await device.createRenderPipeline({
      label: 'Lipstick Overlay Pipeline (Texture)', // Updated label
      layout: device.createPipelineLayout({ bindGroupLayouts: [aspectRatioGroupLayout, lipstickMaterialGroupLayout] }),
      vertex: {
        module: lipstickModule,
        entryPoint: 'vert_main',
        buffers: [ // MODIFIED: Vertex buffer layout for Pos + UV
          {
            arrayStride: 4 * 4, // 4 floats (posX, posY, U, V) * 4 bytes per float = 16 bytes
            attributes: [
              { shaderLocation: 0, offset: 0, format: 'float32x2' }, // @location(0) vec2f pos
              { shaderLocation: 1, offset: 2 * 4, format: 'float32x2' }, // @location(1) vec2f uv (offset by 2 floats)
            ],
          },
        ],
      },
      fragment: {
        module: lipstickModule,
        entryPoint: 'frag_main',
        targets: [{
          format,
          blend: { // Keep alpha blending
            color: { srcFactor: 'src-alpha', dstFactor: 'one-minus-src-alpha', operation: 'add' },
            alpha: { srcFactor: 'one', dstFactor: 'one-minus-src-alpha', operation: 'add' }
          }
        }],
      },
      primitive: { topology: 'triangle-list' },
    });
    console.log("[createPipelines] Lipstick pipeline (with texture support) created successfully.");
    return pipeline;
  } catch (e) {
    console.error("[createPipelines] ERROR creating lipstick render pipeline (texture):", e);
    return null;
  }
}

export default async function createPipelines(device, format) {
  const videoBindGroupLayout = device.createBindGroupLayout({
    // ... (videoBindGroupLayout remains unchanged) ...
    label: 'Video Texture Bind Group Layout',
    entries: [
      { binding: 0, visibility: GPUShaderStage.FRAGMENT, sampler: { type: 'filtering' } },
      { binding: 1, visibility: GPUShaderStage.FRAGMENT, externalTexture: {} }
    ]
  });

  const aspectRatioGroupLayout = device.createBindGroupLayout({
    // ... (aspectRatioGroupLayout remains unchanged, visibility is VERTEX | FRAGMENT) ...
    label: 'Aspect Ratio Uniforms Bind Group Layout',
    entries: [{
        binding: 0,
        visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT,
        buffer: { type: 'uniform' }
    }]
  });
  console.log("[createPipelines] Aspect Ratio Group Layout created.");

  // MODIFIED: Lipstick Material Bind Group Layout for Texture
  const lipstickMaterialGroupLayout = device.createBindGroupLayout({
    label: 'Lipstick Material Bind Group Layout (Texture)', // Updated label
    entries: [
      { // Binding 0: Uniform buffer for tint/alpha color
        binding: 0,
        visibility: GPUShaderStage.FRAGMENT,
        buffer: { type: 'uniform' }
      },
      { // Binding 1: Albedo Texture
        binding: 1,
        visibility: GPUShaderStage.FRAGMENT,
        texture: { sampleType: 'float' } // Use 'float' for unfilterable-float if needed, but 'float' is fine for rgba8unorm
      },
      { // Binding 2: Albedo Sampler
        binding: 2,
        visibility: GPUShaderStage.FRAGMENT,
        sampler: { type: 'filtering' } // Use 'filtering' for linear sampling
      }
      // We can add more textures/samplers here later (e.g., normal map, roughness map)
    ]
  });
  console.log("[createPipelines] Lipstick Material Group Layout (with Texture support) created.");

  console.log("[createPipelines] Creating pipelines (with texture support)...");
  const videoPipeline = await createFullVideoPipeline(device, format, videoBindGroupLayout, aspectRatioGroupLayout);
  const lipstickPipeline = await createLipstickPipeline(device, format, aspectRatioGroupLayout, lipstickMaterialGroupLayout);

  if (!videoPipeline) { console.error("[createPipelines] videoPipeline creation failed!"); }
  if (!lipstickPipeline) { console.error("[createPipelines] lipstickPipeline creation failed!"); }

  return { videoPipeline, lipstickPipeline, videoBindGroupLayout, aspectRatioGroupLayout, lipstickMaterialGroupLayout };
}