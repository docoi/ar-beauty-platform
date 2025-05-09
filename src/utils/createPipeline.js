import shader from '@/shaders/lipstickEffect.wgsl?raw';

export default async function createPipeline(device, format) {
  const module = device.createShaderModule({ code: shader });

  return device.createRenderPipeline({
    layout: 'auto',
    vertex: {
      module,
      entryPoint: 'vert_main',
      buffers: [
        {
          arrayStride: 2 * 4,
          attributes: [
            {
              shaderLocation: 0,
              offset: 0,
              format: 'float32x2',
            },
          ],
        },
      ],
    },
    fragment: {
      module,
      entryPoint: 'frag_main',
      targets: [{ format }],
    },
    primitive: {
      topology: 'triangle-list',
    },
  });
}
