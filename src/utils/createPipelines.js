// src/utils/createPipeline.js

// Import the shader source code using ?raw suffix (Vite specific)
import videoShaderSource from '@/shaders/videoBackground.wgsl?raw';
import lipstickShaderSource from '@/shaders/lipstickEffect.wgsl?raw';

// Function to create the video background pipeline
async function createVideoPipeline(device, format, videoBindGroupLayout) {
  const videoModule = device.createShaderModule({
    label: 'Video Background Shader Module',
    code: videoShaderSource
  });

  return device.createRenderPipeline({
    label: 'Video Background Pipeline',
    layout: device.createPipelineLayout({
        label: 'Video Background Pipeline Layout',
        bindGroupLayouts: [videoBindGroupLayout] // Use the explicit layout passed in
    }),
    vertex: {
      module: videoModule,
      entryPoint: 'vert_main',
      // No vertex buffers needed as vertices are generated directly in the shader
    },
    fragment: {
      module: videoModule,
      entryPoint: 'frag_main',
      targets: [{ format }], // Output format matches the canvas context
    },
    primitive: {
      topology: 'triangle-list', // Draw triangles
    },
  });
}

// Function to create the lipstick overlay pipeline
async function createLipstickPipeline(device, format) {
  const lipstickModule = device.createShaderModule({
    label: 'Lipstick Shader Module',
    code: lipstickShaderSource
  });

  return device.createRenderPipeline({
    label: 'Lipstick Overlay Pipeline',
    // Use 'auto' layout for now, as this pipeline doesn't have bind groups yet.
    // We will change this later when adding color/uniforms for the lipstick.
    layout: 'auto',
    vertex: {
      module: lipstickModule,
      entryPoint: 'vert_main',
      buffers: [ // Define the vertex buffer layout
        {
          arrayStride: 2 * 4, // 2 floats (x, y) * 4 bytes per float = 8 bytes
          attributes: [
            {
              shaderLocation: 0, // Corresponds to @location(0) in vertex shader
              offset: 0,
              format: 'float32x2' // Format is two 32-bit floats (vec2f)
            }
          ],
        },
      ],
    },
    fragment: {
      module: lipstickModule,
      entryPoint: 'frag_main',
      targets: [{ format }], // Output format matches the canvas context
    },
    primitive: {
      topology: 'triangle-list', // Draw triangles
    },
  });
}


// Main export function (updated to create and return both pipelines)
export default async function createPipelines(device, format) {

  // Define the layout for the bind group used by the video pipeline.
  // This describes the resources (sampler, texture) expected by the shader at group 0.
  const videoBindGroupLayout = device.createBindGroupLayout({
     label: 'Video Texture Bind Group Layout',
    entries: [
      { // Entry for the Sampler
        binding: 0, // Corresponds to @binding(0) in WGSL
        visibility: GPUShaderStage.FRAGMENT, // Only needed in the fragment shader
        sampler: { type: 'filtering' }, // Use a filtering sampler (linear interpolation)
      },
      { // Entry for the External Texture (video)
        binding: 1, // Corresponds to @binding(1) in WGSL
        visibility: GPUShaderStage.FRAGMENT, // Only needed in the fragment shader
        externalTexture: {}, // Special type declaration for external textures
      }
    ]
  });
  console.log("Video Bind Group Layout created.");


  // Create both pipelines concurrently using Promise.all
  console.log("Creating pipelines...");
  const [videoPipeline, lipstickPipeline] = await Promise.all([
      createVideoPipeline(device, format, videoBindGroupLayout),
      createLipstickPipeline(device, format)
  ]);
  console.log("Video and Lipstick pipelines created.");

  // Return both created pipelines AND the bind group layout needed for the video bind group
  return { videoPipeline, lipstickPipeline, videoBindGroupLayout };
}