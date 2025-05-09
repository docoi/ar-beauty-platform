import shader from '../shaders/lipstickShader.wgsl?raw';

export default async function createPipeline(device, format) {
  const pipeline = await device.createRenderPipelineAsync({
    layout: 'auto',
    vertex: {
      module: device.createShaderModule({ code: shader }),
      entryPoint: 'vert_main',
      buffers: [{
        arrayStride: 8,
        attributes: [{ shaderLocation: 0, offset: 0, format: 'float32x2' }],
      }],
    },
    fragment: {
      module: device.createShaderModule({ code: shader }),
      entryPoint: 'frag_main',
      targets: [{ format }],
    },
    primitive: {
      topology: 'triangle-list',
    },
  });

  return pipeline;
}
