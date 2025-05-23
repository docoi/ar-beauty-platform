// src/utils/createPipelines.js

import videoShaderSource from '@/shaders/videoBackground.wgsl?raw';
import lipstickShaderSource from '@/shaders/lipstickEffect.wgsl?raw';

async function createFullVideoPipeline(device, format, videoBindGroupLayout, aspectRatioGroupLayout) {
  const videoModule = device.createShaderModule({ label: 'Full Video Shader Module', code: videoShaderSource });
  try {
    return await device.createRenderPipeline({
      label: 'Full Video Background Pipeline',
      layout: device.createPipelineLayout({ bindGroupLayouts: [videoBindGroupLayout, aspectRatioGroupLayout] }), // Group 0: Tex, Group 1: Aspect
      vertex: { module: videoModule, entryPoint: 'vert_main' },
      fragment: { module: videoModule, entryPoint: 'frag_main', targets: [{ format }] },
      primitive: { topology: 'triangle-list' },
    });
  } catch (e) {
    console.error("[createPipelines] ERROR creating Full Video Render Pipeline:", e);
    return null;
  }
}

// Lipstick Pipeline (MODIFIED layout for two bind groups)
async function createLipstickPipeline(device, format, aspectRatioGroupLayout, lipstickMaterialGroupLayout) { // Added lipstickMaterialGroupLayout
  let lipstickModule;
  try {
    lipstickModule = device.createShaderModule({
      label: 'Lipstick Shader Module',
      code: lipstickShaderSource
    });
    console.log("[createPipelines] Lipstick shader module created.");
  } catch (e) {
    console.error("[createPipelines] ERROR creating lipstick shader module:", e);
    return null;
  }

  try {
    const pipeline = await device.createRenderPipeline({
      label: 'Lipstick Overlay Pipeline',
      // MODIFIED layout: Group 0 for aspect ratio, Group 1 for lipstick material
      layout: device.createPipelineLayout({ bindGroupLayouts: [aspectRatioGroupLayout, lipstickMaterialGroupLayout] }),
      vertex: {
        module: lipstickModule,
        entryPoint: 'vert_main',
        buffers: [
          {
            arrayStride: 2 * 4, // 2 floats (x, y) * 4 bytes per float
            attributes: [{ shaderLocation: 0, offset: 0, format: 'float32x2' }],
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
    console.log("[createPipelines] Lipstick pipeline created successfully.");
    return pipeline;
  } catch (e) {
    console.error("[createPipelines] ERROR creating lipstick render pipeline:", e);
    return null;
  }
}

export default async function createPipelines(device, format) {
  const videoBindGroupLayout = device.createBindGroupLayout({
    label: 'Video Texture Bind Group Layout',
    entries: [
      { binding: 0, visibility: GPUShaderStage.FRAGMENT, sampler: { type: 'filtering' } },
      { binding: 1, visibility: GPUShaderStage.FRAGMENT, externalTexture: {} }
    ]
  });

  const aspectRatioGroupLayout = device.createBindGroupLayout({
    label: 'Aspect Ratio Uniforms Bind Group Layout',
    entries: [{ binding: 0, visibility: GPUShaderStage.VERTEX, buffer: { type: 'uniform' } }] // Only Vertex for video bg, lipstick vert also uses it.
    // Lipstick vertex shader will use this at @group(0)
    // Video fragment shader will use this at @group(1)
  });
  console.log("[createPipelines] Aspect Ratio Group Layout created.");

  // NEW: Lipstick Material Bind Group Layout
  const lipstickMaterialGroupLayout = device.createBindGroupLayout({
    label: 'Lipstick Material Uniforms Bind Group Layout',
    entries: [
      {
        binding: 0, // Uniform buffer for color etc.
        visibility: GPUShaderStage.FRAGMENT, // Only used by the fragment shader
        buffer: { type: 'uniform' }
      }
      // We can add texture bindings here later for albedo, normal maps etc.
      // e.g. { binding: 1, visibility: GPUShaderStage.FRAGMENT, texture: { sampleType: 'float' } }
      // e.g. { binding: 2, visibility: GPUShaderStage.FRAGMENT, sampler: { type: 'filtering' } }
    ]
  });
  console.log("[createPipelines] Lipstick Material Group Layout created.");

  console.log("[createPipelines] Creating pipelines...");
  const videoPipeline = await createFullVideoPipeline(device, format, videoBindGroupLayout, aspectRatioGroupLayout);
  // Pass both layouts to lipstick pipeline
  const lipstickPipeline = await createLipstickPipeline(device, format, aspectRatioGroupLayout, lipstickMaterialGroupLayout);

  if (!videoPipeline) { console.error("[createPipelines] videoPipeline creation failed!"); }
  if (!lipstickPipeline) { console.error("[createPipelines] lipstickPipeline creation failed!"); }

  // Return the new layout as well
  return { videoPipeline, lipstickPipeline, videoBindGroupLayout, aspectRatioGroupLayout, lipstickMaterialGroupLayout };
}