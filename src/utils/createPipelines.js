// src/utils/createPipelines.js (Add aspectRatioGroupLayout to lipstickPipeline)

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

// Lipstick Pipeline (MODIFIED to include aspectRatioGroupLayout)
async function createLipstickPipeline(device, format, aspectRatioGroupLayout) { // Added aspectRatioGroupLayout
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
      // MODIFIED layout: Group 0 will now be for aspect ratio uniforms
      layout: device.createPipelineLayout({ bindGroupLayouts: [aspectRatioGroupLayout] }), 
      vertex: {
        module: lipstickModule,
        entryPoint: 'vert_main', 
        buffers: [ 
          {
            arrayStride: 2 * 4, 
            attributes: [{ shaderLocation: 0, offset: 0, format: 'float32x2' }], // Input vertex pos
          },
        ],
      },
      fragment: {
        module: lipstickModule,
        entryPoint: 'frag_main', 
        targets: [{ format, blend: { // ADD BLENDING for lipstick
            color: {
                srcFactor: 'src-alpha',
                dstFactor: 'one-minus-src-alpha',
                operation: 'add',
            },
            alpha: { // Optional: if your lipstick shader outputs alpha differently
                srcFactor: 'one',
                dstFactor: 'one-minus-src-alpha',
                operation: 'add',
            }
        }}], 
      },
      primitive: {
        topology: 'triangle-list', 
      },
    });
    console.log("[createPipelines] Lipstick pipeline created successfully.");
    return pipeline;
  } catch (e) {
    console.error("[createPipelines] ERROR creating lipstick render pipeline:", e);
    return null;
  }
}

export default async function createPipelines(device, format) { // Removed isSimpleVideoTest flag, always create full
  const videoBindGroupLayout = device.createBindGroupLayout({ 
    label: 'Video Texture Bind Group Layout',
    entries: [
      { binding: 0, visibility: GPUShaderStage.FRAGMENT, sampler: { type: 'filtering' } },
      { binding: 1, visibility: GPUShaderStage.FRAGMENT, externalTexture: {} }
    ]
  });

  const aspectRatioGroupLayout = device.createBindGroupLayout({ // This layout will be shared
      label: 'Aspect Ratio Uniforms Bind Group Layout',
      entries: [{ binding: 0, visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT, buffer: { type: 'uniform' }}]
      // Visibility changed to VERTEX | FRAGMENT as lipstick vertex shader will use it.
  });
  console.log("[createPipelines] Aspect Ratio Group Layout created.");
  
  console.log("[createPipelines] Creating pipelines...");
  // Pass aspectRatioGroupLayout to both
  const videoPipeline = await createFullVideoPipeline(device, format, videoBindGroupLayout, aspectRatioGroupLayout);
  const lipstickPipeline = await createLipstickPipeline(device, format, aspectRatioGroupLayout); // Pass it here

  if (!videoPipeline) { console.error("[createPipelines] videoPipeline creation failed!"); }
  if (!lipstickPipeline) { console.error("[createPipelines] lipstickPipeline creation failed!"); }
  
  return { videoPipeline, lipstickPipeline, videoBindGroupLayout, aspectRatioGroupLayout };
}