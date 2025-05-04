// src/utils/createPipeline.js

export default async function createPipeline(device) {
  const shaderCode = `
    struct Uniforms {
      time: f32,
      mouse: vec2<f32>,
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
    fn fs_main(@builtin(position) FragCoord: vec4<f32>) -> @location(0) vec4<f32> {
      let uv = FragCoord.xy / vec2<f32>(640.0, 480.0);
      let dx = uv.x - uniforms.mouse.x;
      let dy = uv.y - uniforms.mouse.y;
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

  // ✅ Create a uniform buffer (12 bytes: 1 float time + 2 float mouse)
  const uniformBuffer = device.createBuffer({
    size: 12,
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

  return { pipeline, uniformBuffer }; // ✅ Return both
}
