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

// MODIFIED: Added lightingGroupLayout
async function createLipstickPipeline(device, format, aspectRatioGroupLayout, lipstickMaterialGroupLayout, lightingGroupLayout) {
  let lipstickModule;
  try {
    lipstickModule = device.createShaderModule({
      label: 'Lipstick Shader Module (Lighting)', // Updated label
      code: lipstickShaderSource
    });
    console.log("[createPipelines] Lipstick shader module created.");
  } catch (e) { console.error("[createPipelines] ERROR creating lipstick shader module:", e); return null; }

  try {
    const pipeline = await device.createRenderPipeline({
      label: 'Lipstick Overlay Pipeline (Lighting)', // Updated label
      // MODIFIED layout: Group 0: Aspect, Group 1: Material, Group 2: Lighting
      layout: device.createPipelineLayout({ bindGroupLayouts: [aspectRatioGroupLayout, lipstickMaterialGroupLayout, lightingGroupLayout] }),
      vertex: {
        module: lipstickModule,
        entryPoint: 'vert_main',
        buffers: [ // MODIFIED: Vertex buffer layout for Pos + UV + Normal
          {
            // Stride: Pos(2) + UV(2) + Normal(3) = 7 floats * 4 bytes/float = 28 bytes
            arrayStride: 7 * 4,
            attributes: [
              { shaderLocation: 0, offset: 0, format: 'float32x2' },     // @location(0) vec2f pos_ndc
              { shaderLocation: 1, offset: 2 * 4, format: 'float32x2' }, // @location(1) vec2f uv
              { shaderLocation: 2, offset: 4 * 4, format: 'float32x3' }, // @location(2) vec3f normal (offset by 4 floats)
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
    console.log("[createPipelines] Lipstick pipeline (with lighting support) created successfully.");
    return pipeline;
  } catch (e) { console.error("[createPipelines] ERROR creating lipstick render pipeline (lighting):", e); return null; }
}

export default async function createPipelines(device, format) {
  const videoBindGroupLayout = device.createBindGroupLayout({ /* ... (unchanged) ... */
    label: 'Video Texture Bind Group Layout', entries: [ { binding: 0, visibility: GPUShaderStage.FRAGMENT, sampler: { type: 'filtering' } }, { binding: 1, visibility: GPUShaderStage.FRAGMENT, externalTexture: {} } ]
  });
  const aspectRatioGroupLayout = device.createBindGroupLayout({ /* ... (unchanged) ... */
    label: 'Aspect Ratio Uniforms Bind Group Layout', entries: [{ binding: 0, visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT, buffer: { type: 'uniform' }}]
  });
  const lipstickMaterialGroupLayout = device.createBindGroupLayout({ /* ... (unchanged, includes color uniform, texture, sampler) ... */
    label: 'Lipstick Material Bind Group Layout (Texture)', entries: [ { binding: 0, visibility: GPUShaderStage.FRAGMENT, buffer: { type: 'uniform' } }, { binding: 1, visibility: GPUShaderStage.FRAGMENT, texture: { sampleType: 'float' } }, { binding: 2, visibility: GPUShaderStage.FRAGMENT, sampler: { type: 'filtering' } } ]
  });
  console.log("[createPipelines] Aspect Ratio & Material Group Layouts created.");


  // NEW: Lighting Uniforms Bind Group Layout
  const lightingGroupLayout = device.createBindGroupLayout({
    label: 'Lighting Uniforms Bind Group Layout',
    entries: [
      {
        binding: 0, // Uniform buffer for lighting params
        visibility: GPUShaderStage.FRAGMENT, // Primarily used by the fragment shader
        buffer: { type: 'uniform' }
      }
    ]
  });
  console.log("[createPipelines] Lighting Group Layout created.");


  console.log("[createPipelines] Creating pipelines (with lighting support)...");
  const videoPipeline = await createFullVideoPipeline(device, format, videoBindGroupLayout, aspectRatioGroupLayout);
  // Pass all three layouts to lipstick pipeline
  const lipstickPipeline = await createLipstickPipeline(device, format, aspectRatioGroupLayout, lipstickMaterialGroupLayout, lightingGroupLayout);

  if (!videoPipeline) { console.error("[createPipelines] videoPipeline creation failed!"); }
  if (!lipstickPipeline) { console.error("[createPipelines] lipstickPipeline creation failed!"); }

  // Return the new layout as well
  return { videoPipeline, lipstickPipeline, videoBindGroupLayout, aspectRatioGroupLayout, lipstickMaterialGroupLayout, lightingGroupLayout };
}