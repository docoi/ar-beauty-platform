// src/utils/createPipeline.js

export default async function createPipeline(device, format, shaderCode) {
  const shaderModule = device.createShaderModule({
    code: shaderCode,
  });

  const pipeline = await device.createRenderPipelineAsync({
    layout: 'auto',
    vertex: {
      module: shaderModule,
      entryPoint: 'vertexMain',
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
