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
      let uv = FragCoord.xy / vec2<f32>(640.0, 480.0); // ✅ Consider replacing with uniform for dynamic sizing
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

  // ✅ Fix: Dynamically get canvas format
  const format = navigator.gpu.getPreferredCanvasFormat();

  return device.createRenderPipeline({
    layout: 'auto',
    vertex: {
      module: shaderModule,
      entryPoint: 'vs_main',
    },
    fragment: {
      module: shaderModule,
      entryPoint: 'fs_main',
      targets: [
        {
          format: format,
        },
      ],
    },
    primitive: {
      topology: 'triangle-list',
    },
  });
}
