// src/utils/createPipeline.js

export default async function createPipeline(device, format, shaderCode) {
  const shaderModule = device.createShaderModule({ code: shaderCode });

  const pipeline = await device.createRenderPipelineAsync({
    layout: 'auto',
    vertex: {
      module: shaderModule,
      entryPoint: 'vert_main',
    },
    fragment: {
      module: shaderModule,
      entryPoint: 'frag_main',
      targets: [
        {
          format,
        },
      ],
    },
    primitive: {
      topology: 'triangle-list',
    },
  });

  return pipeline;
}
