// src/utils/createPipeline.js

export default async function createPipeline(device) {
  const shaderCode = `
    struct Uniforms {
      time: f32,
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
      let uv = fragCoord.xy / uniforms.resolution;

      let dx = uv.x - uniforms.pointer.x;
      let dy = uv.y - uniforms.pointer.y;
      let dist = sqrt(dx * dx + dy * dy);

      let t = uniforms.time;
      let color = vec3<f32>(
        0.5 + 0.5 * cos(t + dist * 10.0),
        0.5 + 0.5 * cos(t + dist * 10.0 + 2.0),
        0.5 + 0.5 * cos(t + dist * 10.0 + 4.0)
      );

      return vec4<f32>(color, 1.0);
    }
  `;

  const shaderModule = device.createShaderModule({ code: shaderCode });
  const format = navigator.gpu.getPreferredCanvasFormat();

  // ✅ Allocate 24 bytes = 1 (time) + 2 (pointer) + 2 (resolution) floats
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
