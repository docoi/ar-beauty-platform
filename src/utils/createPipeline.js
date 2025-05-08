// src/utils/createPipeline.js

export default async function createPipeline(device, format, shaderCode) {
  const shaderModule = device.createShaderModule({ code: shaderCode });

  const pipeline = await device.createRenderPipelineAsync({
    layout: 'auto',
    vertex: {
      module: shaderModule,
      entryPoint: 'vertexMain',
      buffers: [
        {
          arrayStride: 8,
          attributes: [{ shaderLocation: 0, offset: 0, format: 'float32x2' }],
        },
      ],
    },
    fragment: {
      module: shaderModule,
      entryPoint: 'fragmentMain',
      targets: [{ format }],
    },
    primitive: {
      topology: 'triangle-list',
    },
  });

  return pipeline;
}
