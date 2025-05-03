// utils/createPipeline.js
export default async function createPipeline(device, format) {
  const shaderCode = `
    @vertex
    fn vs_main(@builtin(vertex_index) VertexIndex: u32) -> @builtin(position) vec4f {
      var pos = array<vec2f, 6>(
        vec2f(-1.0, -1.0), vec2f(1.0, -1.0), vec2f(-1.0, 1.0),
        vec2f(-1.0, 1.0), vec2f(1.0, -1.0), vec2f(1.0, 1.0)
      );
      return vec4f(pos[VertexIndex], 0.0, 1.0);
    }

    @fragment
    fn fs_main(@builtin(position) FragCoord: vec4f) -> @location(0) vec4f {
      let uv = FragCoord.xy / vec2f(640.0, 480.0); // Can adjust for dynamic size later
      return vec4f(uv.x, uv.y, 1.0 - uv.x, 1.0);
    }
  `;

  const module = device.createShaderModule({ code: shaderCode });

  return device.createRenderPipeline({
    layout: 'auto',
    vertex: {
      module,
      entryPoint: 'vs_main',
    },
    fragment: {
      module,
      entryPoint: 'fs_main',
      targets: [{ format }],
    },
    primitive: {
      topology: 'triangle-list',
    },
  });
}
