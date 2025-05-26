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
  } catch (e) { console.error("[createPipelines] ERROR creating Full Video Render Pipeline:", e); return null; }
}

async function createLipstickPipeline(device, format, aspectRatioGroupLayout, lipstickMaterialGroupLayout, lightingGroupLayout) {
  // ... (This function's signature and vertex buffer layout for normals are already correct from the previous "Lighting" step) ...
  // ... (The pipeline layout with three bind groups is also correct) ...
  let lipstickModule;
  try {
    lipstickModule = device.createShaderModule({
      label: 'Lipstick Shader Module (Normal Map)', // Updated label
      code: lipstickShaderSource
    });
    console.log("[createPipelines] Lipstick shader module created.");
  } catch (e) { console.error("[createPipelines] ERROR creating lipstick shader module:", e); return null; }

  try {
    const pipeline = await device.createRenderPipeline({
      label: 'Lipstick Overlay Pipeline (Normal Map)', // Updated label
      layout: device.createPipelineLayout({ bindGroupLayouts: [aspectRatioGroupLayout, lipstickMaterialGroupLayout, lightingGroupLayout] }),
      vertex: {
        module: lipstickModule,
        entryPoint: 'vert_main',
        buffers: [
          {
            arrayStride: 7 * 4, // Pos(2) + UV(2) + Normal(3) = 7 floats
            attributes: [
              { shaderLocation: 0, offset: 0, format: 'float32x2' },     // pos_ndc
              { shaderLocation: 1, offset: 2 * 4, format: 'float32x2' }, // uv
              { shaderLocation: 2, offset: 4 * 4, format: 'float32x3' }, // normal_in
            ],
          },
        ],
      },
      fragment: {
        module: lipstickModule,
        entryPoint: 'frag_main',
        targets: [{
          format,
          blend: {
            color: { srcFactor: 'src-alpha', dstFactor: 'one-minus-src-alpha', operation: 'add' },
            alpha: { srcFactor: 'one', dstFactor: 'one-minus-src-alpha', operation: 'add' }
          }
        }],
      },
      primitive: { topology: 'triangle-list' },
    });
    console.log("[createPipelines] Lipstick pipeline (with normal map support) created successfully.");
    return pipeline;
  } catch (e) { console.error("[createPipelines] ERROR creating lipstick render pipeline (normal map):", e); return null; }
}

export default async function createPipelines(device, format) {
  const videoBindGroupLayout = device.createBindGroupLayout({ /* ... (unchanged) ... */
    label: 'Video Texture Bind Group Layout', entries: [ { binding: 0, visibility: GPUShaderStage.FRAGMENT, sampler: { type: 'filtering' } }, { binding: 1, visibility: GPUShaderStage.FRAGMENT, externalTexture: {} } ]
  });
  const aspectRatioGroupLayout = device.createBindGroupLayout({ /* ... (unchanged) ... */
    label: 'Aspect Ratio Uniforms Bind Group Layout', entries: [{ binding: 0, visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT, buffer: { type: 'uniform' }}]
  });
  const lightingGroupLayout = device.createBindGroupLayout({ /* ... (unchanged from previous step) ... */
    label: 'Lighting Uniforms Bind Group Layout', entries: [ { binding: 0, visibility: GPUShaderStage.FRAGMENT, buffer: { type: 'uniform' } } ]
  });


  // MODIFIED: Lipstick Material Bind Group Layout for Normal Map
  const lipstickMaterialGroupLayout = device.createBindGroupLayout({
    label: 'Lipstick Material Bind Group Layout (Normal Map)', // Updated label
    entries: [
      { // Binding 0: Uniform buffer for tint/alpha color
        binding: 0,
        visibility: GPUShaderStage.FRAGMENT,
        buffer: { type: 'uniform' }
      },
      { // Binding 1: Albedo Texture
        binding: 1,
        visibility: GPUShaderStage.FRAGMENT,
        texture: { sampleType: 'float' }
      },
      { // Binding 2: Sampler (for Albedo AND Normal Map)
        binding: 2,
        visibility: GPUShaderStage.FRAGMENT,
        sampler: { type: 'filtering' }
      },
      { // Binding 3: Normal Map Texture
        binding: 3,
        visibility: GPUShaderStage.FRAGMENT,
        texture: { sampleType: 'float' } // Assuming normal map is also 'float' filterable
      }
    ]
  });
  console.log("[createPipelines] All Bind Group Layouts (including Normal Map support) created.");


  console.log("[createPipelines] Creating pipelines (with normal map support)...");
  const videoPipeline = await createFullVideoPipeline(device, format, videoBindGroupLayout, aspectRatioGroupLayout);
  const lipstickPipeline = await createLipstickPipeline(device, format, aspectRatioGroupLayout, lipstickMaterialGroupLayout, lightingGroupLayout);

  if (!videoPipeline) { console.error("[createPipelines] videoPipeline creation failed!"); }
  if (!lipstickPipeline) { console.error("[createPipelines] lipstickPipeline creation failed!"); }

  return { videoPipeline, lipstickPipeline, videoBindGroupLayout, aspectRatioGroupLayout, lipstickMaterialGroupLayout, lightingGroupLayout };
}