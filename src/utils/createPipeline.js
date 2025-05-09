export default async function createPipeline(device, format, shaderCode) {
  const module = device.createShaderModule({ code: shaderCode });

  const pipeline = await device.createRenderPipelineAsync({
    layout: 'auto',
    vertex: {
      module,
      entryPoint: 'vert_main',
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

  return pipeline;
}
