export default async function createPipeline(device, format) {
  // Load WGSL shader as a string (you must have this shader file in your project)
  const shaderCode = `
    struct Uniforms {
      time: f32,
      pointerX: f32,
      pointerY: f32,
    };
    @group(0) @binding(0) var<uniform> uniforms: Uniforms;

    @vertex
    fn vs_main(@builtin(vertex_index) index: u32) -> @builtin(position) vec4<f32> {
      var pos = array<vec2<f32>, 6>(
        vec2(-1.0, -1.0), vec2(1.0, -1.0), vec2(-1.0, 1.0),
        vec2(-1.0, 1.0), vec2(1.0, -1.0), vec2(1.0, 1.0)
      );
      return vec4(pos[index], 0.0, 1.0);
    }

    @fragment
    fn fs_main(@builtin(position) fragCoord: vec4<f32>) -> @location(0) vec4<f32> {
      let u = uniforms;
      let pos = fragCoord.xy / vec2(1280.0, 720.0); // adjust as needed
      let dist = distance(pos, vec2(u.pointerX, u.pointerY));
      let color = vec3(0.5 + 0.5 * sin(u.time + dist * 10.0), dist, 1.0 - dist);
      return vec4(color, 1.0);
    }
  `;

  const shaderModule = device.createShaderModule({ code: shaderCode });

  const pipeline = await device.createRenderPipelineAsync({
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

  const uniformBuffer = device.createBuffer({
    size: 12, // 3 * 4 bytes (f32): time, x, y
    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
  });

  return { pipeline, uniformBuffer };
}
