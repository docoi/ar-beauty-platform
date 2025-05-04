// src/utils/createPipeline.js

export default async function createPipeline(device) {
  const shaderCode = `
    struct Uniforms {
      time: f32,
      padding1: f32,
      pointer: vec2<f32>,
      resolution: vec2<f32>,
    };

    @group(0) @binding(0)
    var<uniform> uniforms: Uniforms;

    @vertex
    fn vs_main(@builtin(vertex_index) VertexIndex: u32) -> @builtin(position) vec4<f32> {
      var pos = array<vec2<f32>, 6>(
        vec2<f32>(-1.0, -1.0),
        vec2<f32>( 1.0, -1.0),
        vec2<f32>(-1.0,  1.0),
        vec2<f32>(-1.0,  1.0),
        vec2<f32>( 1.0, -1.0),
        vec2<f32>( 1.0,  1.0),
      );
      return vec4<f32>(pos[VertexIndex], 0.0, 1.0);
    }

    @fragment
    fn fs_main(@builtin(position) fragCoord: vec4<f32>) -> @location(0) vec4<f32> {
      return vec4<f32>(1.0, 0.0, 1.0, 1.0); // bright pink test
    }
  `;

  const shaderModule = device.createShaderModule({ code: shaderCode });
  const format = navigator.gpu.getPreferredCanvasFormat();

  // ✅ Aligned correctly for 6 floats (time, padding, 2x vec2)
  const uniformBuffer = device.createBuffer({
    size: 24,
    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
  });

  const pipeline = device.createRenderPipeline({
    layout: 'auto',
    vertex: {
      module: shaderModule,
      entryPoint: 'vs_main',
    },
    fragment: {
      module: shaderModule,
      entryPoint: 'fs_main',
      targets: [{ format }],
    },
    primitive: {
      topology: 'triangle-list',
    },
  });

  return { pipeline, uniformBuffer };
}
