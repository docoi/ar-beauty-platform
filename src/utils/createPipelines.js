// src/utils/createPipelines.js (Add uniform buffer for aspect ratios to video pipeline)

import videoShaderSource from '@/shaders/videoBackground.wgsl?raw';
import lipstickShaderSource from '@/shaders/lipstickEffect.wgsl?raw';

// Video Pipeline (Modified)
async function createVideoPipeline(device, format, videoBindGroupLayout, aspectRatioGroupLayout) { // Added aspectRatioGroupLayout
  const videoModule = device.createShaderModule({
    label: 'Video Background Shader Module', code: videoShaderSource
  });
  return device.createRenderPipeline({
    label: 'Video Background Pipeline',
    layout: device.createPipelineLayout({
        label: 'Video Background Pipeline Layout',
        // Bind group 0 for texture/sampler, Bind group 1 for aspect ratios
        bindGroupLayouts: [videoBindGroupLayout, aspectRatioGroupLayout] 
    }),
    vertex: { module: videoModule, entryPoint: 'vert_main' },
    fragment: { module: videoModule, entryPoint: 'frag_main', targets: [{ format }] },
    primitive: { topology: 'triangle-list' },
  });
}

// Lipstick Pipeline (No change)
async function createLipstickPipeline(device, format) {
  // ... (no changes to this function)
  const lipstickModule = device.createShaderModule({
    label: 'Lipstick Shader Module', code: lipstickShaderSource
  });
  return device.createRenderPipeline({
    label: 'Lipstick Overlay Pipeline', layout: 'auto',
    vertex: {
      module: lipstickModule, entryPoint: 'vert_main',
      buffers: [{ arrayStride: 2 * 4, attributes: [{ shaderLocation: 0, offset: 0, format: 'float32x2' }] }],
    },
    fragment: { module: lipstickModule, entryPoint: 'frag_main', targets: [{ format }] },
    primitive: { topology: 'triangle-list' },
  });
}

// Main export function (Modified)
export default async function createPipelines(device, format) {
  const videoBindGroupLayout = device.createBindGroupLayout({
    label: 'Video Texture Bind Group Layout',
    entries: [
      { binding: 0, visibility: GPUShaderStage.FRAGMENT, sampler: { type: 'filtering' } },
      { binding: 1, visibility: GPUShaderStage.FRAGMENT, externalTexture: {} }
    ]
  });

  // NEW: Bind group layout for aspect ratio uniforms
  const aspectRatioGroupLayout = device.createBindGroupLayout({
    label: 'Aspect Ratio Uniforms Bind Group Layout',
    entries: [
      {
        binding: 0,
        visibility: GPUShaderStage.FRAGMENT, // Only needed in fragment shader
        buffer: { type: 'uniform' }
      }
    ]
  });
  console.log("Aspect Ratio Group Layout created.");

  console.log("Creating pipelines...");
  const [videoPipeline, lipstickPipeline] = await Promise.all([
      createVideoPipeline(device, format, videoBindGroupLayout, aspectRatioGroupLayout), // Pass new layout
      createLipstickPipeline(device, format)
  ]);
  console.log("Video and Lipstick pipelines created.");
  // Return pipelines AND BOTH layouts
  return { videoPipeline, lipstickPipeline, videoBindGroupLayout, aspectRatioGroupLayout };
}