// src/utils/createPipelines.js (Implement createLipstickPipeline)

import videoShaderSource from '@/shaders/videoBackground.wgsl?raw'; 
// Ensure this is the 'Robust Contain Aspect Ratio' version if not doing a simple video test
import lipstickShaderSource from '@/shaders/lipstickEffect.wgsl?raw';

async function createSimpleVideoPipeline(device, format, videoBindGroupLayout) {
  // ... (this function seems okay from before)
  const videoModule = device.createShaderModule({ label: 'Simple Video Shader Module', code: videoShaderSource }); 
  try {
    return await device.createRenderPipeline({
        label: 'Simple Video Background Pipeline',
        layout: device.createPipelineLayout({ bindGroupLayouts: [videoBindGroupLayout] }), 
        vertex: { module: videoModule, entryPoint: 'vert_main' },
        fragment: { module: videoModule, entryPoint: 'frag_main', targets: [{ format }] },
        primitive: { topology: 'triangle-list' },
    });
  } catch (e) {
    console.error("[createPipelines] ERROR creating Simple Video Render Pipeline:", e);
    return null;
  }
}

async function createFullVideoPipeline(device, format, videoBindGroupLayout, aspectRatioGroupLayout) {
  // ... (this function seems okay from before)
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

// --- IMPLEMENT THIS FUNCTION ---
async function createLipstickPipeline(device, format) {
  let lipstickModule;
  try {
    lipstickModule = device.createShaderModule({
      label: 'Lipstick Shader Module',
      code: lipstickShaderSource 
    });
    console.log("[createPipelines] Lipstick shader module created.");
  } catch (e) {
    console.error("[createPipelines] ERROR creating lipstick shader module:", e);
    return null; // Return null on failure
  }

  try {
    const pipeline = await device.createRenderPipeline({
      label: 'Lipstick Overlay Pipeline',
      layout: 'auto', // WGSL shader for lipstick currently defines no bind groups
      vertex: {
        module: lipstickModule,
        entryPoint: 'vert_main', // Must match your WGSL @vertex function name
        buffers: [ 
          {
            arrayStride: 2 * 4, // 2 floats (x,y) * 4 bytes each
            attributes: [{ shaderLocation: 0, offset: 0, format: 'float32x2' }],
          },
        ],
      },
      fragment: {
        module: lipstickModule,
        entryPoint: 'frag_main', // Must match your WGSL @fragment function name
        targets: [{ format }], // Target the canvas format
      },
      primitive: {
        topology: 'triangle-list', // We are drawing triangles
      },
      // Optional: Add depth/stencil state if needed later, not for simple overlay
    });
    console.log("[createPipelines] Lipstick pipeline created successfully.");
    return pipeline;
  } catch (e) {
    console.error("[createPipelines] ERROR creating lipstick render pipeline:", e);
    return null; // Return null on failure
  }
}
// --- END OF IMPLEMENTATION ---

export default async function createPipelines(device, format, isSimpleVideoTest = false) {
  const videoBindGroupLayout = device.createBindGroupLayout({ 
    label: 'Video Texture Bind Group Layout',
    entries: [
      { binding: 0, visibility: GPUShaderStage.FRAGMENT, sampler: { type: 'filtering' } },
      { binding: 1, visibility: GPUShaderStage.FRAGMENT, externalTexture: {} }
    ]
  });

  let videoPipeline;
  let aspectRatioGroupLayout = null;

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
  
  // This will now call the implemented function
  const lipstickPipeline = await createLipstickPipeline(device, format);

  if (!videoPipeline) {
    console.error("[createPipelines] videoPipeline creation failed!");
  }
  if (!lipstickPipeline) {
    console.error("[createPipelines] lipstickPipeline creation failed! This is likely the problem.");
  }
  
  return { videoPipeline, lipstickPipeline, videoBindGroupLayout, aspectRatioGroupLayout };
}