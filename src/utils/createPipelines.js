// src/utils/createPipelines.js (Add flag for simple video pipeline)
import videoShaderSource from '@/shaders/videoBackground.wgsl?raw'; // This will be the simple version
import lipstickShaderSource from '@/shaders/lipstickEffect.wgsl?raw';

async function createSimpleVideoPipeline(device, format, videoBindGroupLayout) {
  const videoModule = device.createShaderModule({ code: videoShaderSource }); // Ensure this shader is simple
  return device.createRenderPipeline({
    label: 'Simple Video Background Pipeline',
    layout: device.createPipelineLayout({ bindGroupLayouts: [videoBindGroupLayout] }), // Only one bind group
    vertex: { module: videoModule, entryPoint: 'vert_main' },
    fragment: { module: videoModule, entryPoint: 'frag_main', targets: [{ format }] },
    primitive: { topology: 'triangle-list' },
  });
}

async function createFullVideoPipeline(device, format, videoBindGroupLayout, aspectRatioGroupLayout) {
  const videoModule = device.createShaderModule({ code: videoShaderSource }); // This shader needs aspect ratio group
  return device.createRenderPipeline({
    label: 'Full Video Background Pipeline',
    layout: device.createPipelineLayout({ bindGroupLayouts: [videoBindGroupLayout, aspectRatioGroupLayout] }),
    vertex: { module: videoModule, entryPoint: 'vert_main' },
    fragment: { module: videoModule, entryPoint: 'frag_main', targets: [{ format }] },
    primitive: { topology: 'triangle-list' },
  });
}

// Lipstick Pipeline (No change)
async function createLipstickPipeline(device, format) { /* ... same as before ... */ }

export default async function createPipelines(device, format, isSimpleVideoTest = false) { // Added flag
  const videoBindGroupLayout = device.createBindGroupLayout({ /* ... same as before ... */ 
    label: 'Video Texture Bind Group Layout',
    entries: [
      { binding: 0, visibility: GPUShaderStage.FRAGMENT, sampler: { type: 'filtering' } },
      { binding: 1, visibility: GPUShaderStage.FRAGMENT, externalTexture: {} }
    ]
  });

  let videoPipeline;
  let aspectRatioGroupLayout = null; // Only created if not simple

  if (isSimpleVideoTest) {
    console.log("[createPipelines] Creating SIMPLE video pipeline.");
    videoPipeline = await createSimpleVideoPipeline(device, format, videoBindGroupLayout);
  } else {
    console.log("[createPipelines] Creating FULL video pipeline with aspect ratio support.");
    aspectRatioGroupLayout = device.createBindGroupLayout({
        label: 'Aspect Ratio Uniforms Bind Group Layout',
        entries: [{ binding: 0, visibility: GPUShaderStage.FRAGMENT, buffer: { type: 'uniform' }}]
    });
    videoPipeline = await createFullVideoPipeline(device, format, videoBindGroupLayout, aspectRatioGroupLayout);
  }
  
  const lipstickPipeline = await createLipstickPipeline(device, format);
  return { videoPipeline, lipstickPipeline, videoBindGroupLayout, aspectRatioGroupLayout };
}