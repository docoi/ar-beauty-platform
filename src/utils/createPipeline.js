// src/utils/createPipeline.js

export default async function createPipeline(device, format, shaderCode) {
  const module = device.createShaderModule({ code: shaderCode });

  const pipeline = await device.createRenderPipelineAsync({
    layout: 'auto',
    vertex: {
      module,
      entryPoint: 'vertexMain',
    },
    fragment: {
      module,
      entryPoint: 'fragmentMain',
      targets: [{ format }],
    },
    primitive: {
      topology: 'triangle-list',
    },
  });

  return pipeline;
}
