export default async function createPipeline(device, format) {
  const module = device.createShaderModule({ code: shader });

  return device.createRenderPipeline({
    layout: 'auto',
    vertex: {
      module,
      entryPoint: 'vert_main', // updated
      buffers: [{
        arrayStride: 8,
        attributes: [{ shaderLocation: 0, offset: 0, format: 'float32x2' }],
      }],
    },
    fragment: {
      module,
      entryPoint: 'frag_main', // updated
      targets: [{ format }],
    },
    primitive: {
      topology: 'triangle-list',
    },
  });
}
