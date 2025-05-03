export default async function createPipeline(device, format) {
  const shaderCode = `
    struct Uniforms {
      time: f32,
    };
    @group(0) @binding(0) var<uniform> uniforms: Uniforms;

    @vertex
    fn vs(@builtin(vertex_index) VertexIndex: u32) -> @builtin(position) vec4<f32> {
      var pos = array<vec2<f32>, 6>(
        vec2<f32>(-1.0, -1.0),
        vec2<f32>( 1.0, -1.0),
        vec2<f32>(-1.0,  1.0),
        vec2<f32>(-1.0,  1.0),
        vec2<f32>( 1.0, -1.0),
        vec2<f32>( 1.0,  1.0)
      );
      return vec4<f32>(pos[VertexIndex], 0.0, 1.0);
    }

    @fragment
    fn fs(@builtin(position) FragCoord: vec4<f32>) -> @location(0) vec4<f32> {
      let uv = FragCoord.xy / vec2<f32>(640.0, 480.0); // adjust if needed
      let r = 0.5 + 0.5 * sin(uniforms.time + uv.x * 10.0);
      let g = 0.5 + 0.5 * cos(uniforms.time + uv.y * 10.0);
      let b = 0.5 + 0.5 * sin(uniforms.time * 1.5);
      return vec4<f32>(r, g, b, 1.0);
    }
  `;

  const shaderModule = device.createShaderModule({ code: shaderCode });

  return device.createRenderPipeline({
    layout: 'auto',
    vertex: {
      module: shaderModule,
      entryPoint: 'vs',
    },
    fragment: {
      module: shaderModule,
      entryPoint: 'fs',
      targets: [{ format }],
    },
    primitive: {
      topology: 'triangle-list',
    },
  });
}
