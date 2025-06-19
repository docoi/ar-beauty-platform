// src/utils/createPipelines.js

import videoShaderSource from '@/shaders/videoBackground.wgsl?raw';
import lipstickShaderSource from '@/shaders/lipstickEffect.wgsl?raw';

// This function remains the same.
async function createVideoBackgroundPipeline(device, format, videoBindGroupLayout, videoAspectRatioGroupLayout) {
  const videoModule = device.createShaderModule({ label: 'Video BG Shader Module', code: videoShaderSource });
  try {
    return await device.createRenderPipeline({
      label: 'Video Background Pipeline',
      layout: device.createPipelineLayout({ bindGroupLayouts: [videoBindGroupLayout, videoAspectRatioGroupLayout] }),
      vertex: { module: videoModule, entryPoint: 'vert_main' },
      fragment: { module: videoModule, entryPoint: 'frag_main', targets: [{ format }] },
      primitive: { topology: 'triangle-list' },
      depthStencil: {
        depthWriteEnabled: false,
        depthCompare: 'always',
        format: 'depth24plus',
      },
    });
  } catch (e) { console.error("ERROR creating Video BG Pipeline:", e); return null; }
}

// This function is now SIMPLIFIED for the diagnostic test.
async function create3DLipModelPipeline(device, canvasFormat, lipModelMatrixGroupLayout) {
  let modelShaderModule;
  try {
    modelShaderModule = device.createShaderModule({
      label: '3D Lip Model Shader Module (Simplified)',
      code: lipstickShaderSource 
    });
  } catch (e) { 
    console.error("ERROR creating 3D Lip Model shader module:", e); 
    return null; 
  }

  try {
    const pipeline = await device.createRenderPipeline({
      label: '3D Lip Model Pipeline (Simplified)',
      // Layout now only has ONE bind group for the MVP matrix.
      layout: device.createPipelineLayout({ bindGroupLayouts: [ lipModelMatrixGroupLayout ] }),
      vertex: {
        module: modelShaderModule,
        entryPoint: 'vert_main_3d',
        buffers: [ 
          {
            // We still use the interleaved buffer, but only describe the position attribute to the pipeline.
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
        targets: [{ format: canvasFormat }], // No blending needed for solid color test
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
    console.log("[createPipelines] SIMPLIFIED 3D Lip Model pipeline CREATED successfully.");
    return pipeline;
  } catch (e) { 
    console.error("ERROR creating SIMPLIFIED 3D Lip Model pipeline:", e); 
    return null; 
  }
}

export default async function createPipelines(device, canvasFormat, is3DModelMode = false) {
  // Define all necessary layouts, even if unused by the simplified pipeline
  const videoBindGroupLayout = device.createBindGroupLayout({ label: 'Video Texture BGL', entries: [ { binding: 0, visibility: GPUShaderStage.FRAGMENT, sampler: { type: 'filtering' } }, { binding: 1, visibility: GPUShaderStage.FRAGMENT, externalTexture: {} } ] });
  const videoAspectRatioGroupLayout = device.createBindGroupLayout({ label: 'Video Aspect Ratio BGL', entries: [{ binding: 0, visibility: GPUShaderStage.FRAGMENT, buffer: { type: 'uniform' }}] });
  const lipModelMatrixGroupLayout = device.createBindGroupLayout({ label: 'Lip Model Matrix BGL', entries: [{ binding: 0, visibility: GPUShaderStage.VERTEX, buffer: { type: 'uniform' }}] });
  
  // These layouts are not used by the simplified pipeline, but we define them for future steps
  const lipstickMaterialGroupLayout = device.createBindGroupLayout({ label: 'Lipstick Material BGL', entries: [ { binding: 0, visibility: GPUShaderStage.FRAGMENT, buffer: { type: 'uniform' } }, { binding: 1, visibility: GPUShaderStage.FRAGMENT, texture: { sampleType: 'float' } }, { binding: 2, visibility: GPUShaderStage.FRAGMENT, sampler: { type: 'filtering' } }, { binding: 3, visibility: GPUShaderStage.FRAGMENT, texture: { sampleType: 'float' } } ] });
  const lightingGroupLayout = device.createBindGroupLayout({ label: 'Lighting BGL', entries: [ { binding: 0, visibility: GPUShaderStage.FRAGMENT, buffer: { type: 'uniform' } } ] });
  
  console.log("[createPipelines] All Bind Group Layouts defined.");

  // For this test, we don't need the video pipeline, but we'll create it anyway to ensure it doesn't break.
  const videoPipeline = await createVideoBackgroundPipeline(device, canvasFormat, videoBindGroupLayout, videoAspectRatioGroupLayout);
  
  let lipModelPipeline = null;
  if (is3DModelMode) {
    lipModelPipeline = await create3DLipModelPipeline(device, canvasFormat, lipModelMatrixGroupLayout); // Pass only the required layout
  }
  
  console.log("[createPipelines] Returning pipelines. Lip Model Pipeline is:", lipModelPipeline ? "OK" : "null");

  // Return all layouts so the main component can still create the necessary buffers/bind groups
  return { 
    videoPipeline, 
    lipModelPipeline, 
    videoBindGroupLayout, 
    videoAspectRatioGroupLayout,
    lipModelMatrixGroupLayout, 
    lipstickMaterialGroupLayout, 
    lightingGroupLayout 
  };
}