import shader from '@/shaders/lipstickEffect.wgsl?raw';

export default async function createPipeline(device, format) {
  const shaderModule = device.createShaderModule({
    code: shader,
  });

  return device.createRenderPipeline({
    layout: 'auto',
    vertex: {
      module: shaderModule,
      entryPoint: 'main_vertex',
      buffers: [
        {
          arrayStride: 2 * 4,
          attributes: [{ shaderLocation: 0, offset: 0, format: 'float32x2' }],
        },
        {
          arrayStride: 4 * 4,
          attributes: [{ shaderLocation: 1, offset: 0, format: 'float32x4' }],
        },
      ],
    },
    fragment: {
      module: shaderModule,
      entryPoint: 'main_fragment',
      targets: [{ format }],
    },
    primitive: {
      topology: 'triangle-list',
    },
  });
}
