// src/utils/createPipeline.js
export default async function createPipeline(device, format) {
  const shaderCode = `
    @vertex
    fn vert_main(@location(0) position: vec2<f32>) -> @builtin(position) vec4<f32> {
      return vec4<f32>(position, 0.0, 1.0);
    }

    @fragment
    fn frag_main() -> @location(0) vec4<f32> {
      return vec4<f32>(1.0, 1.0, 0.0, 0.8); // Yellow with transparency
    }
  `;

  const shaderModule = device.createShaderModule({ code: shaderCode });

  return device.createRenderPipeline({
    layout: 'auto',
    vertex: {
      module: shaderModule,
      entryPoint: 'vert_main',
      buffers: [{
        arrayStride: 8,
        attributes: [{
          shaderLocation: 0,
          format: 'float32x2',
          offset: 0,
        }],
      }],
    },
    fragment: {
      module: shaderModule,
      entryPoint: 'frag_main',
      targets: [{ format }]
    },
    primitive: {
      topology: 'triangle-list',
    },
  });
}
