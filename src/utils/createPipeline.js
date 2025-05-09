import shader from '../shaders/lipstickEffect.wgsl?raw';

export default async function createPipeline(device, format) {
  const module = device.createShaderModule({ code: shader });

  const vertexBuffer = device.createBuffer({
    size: 1024 * 4,
    usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
  });

  const colorUniform = device.createBuffer({
    size: 16,
    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
  });

  device.queue.writeBuffer(colorUniform, 0, new Float32Array([1.0, 1.0, 0.0, 0.8])); // yellow

  const bindGroupLayout = device.createBindGroupLayout({
    entries: [
      { binding: 0, visibility: GPUShaderStage.FRAGMENT, buffer: {} },
    ],
  });

  const pipelineLayout = device.createPipelineLayout({ bindGroupLayouts: [bindGroupLayout] });

  const pipeline = await device.createRenderPipelineAsync({
    layout: pipelineLayout,
    vertex: {
      module,
      entryPoint: 'main',
      buffers: [{ arrayStride: 8, attributes: [{ shaderLocation: 0, offset: 0, format: 'float32x2' }] }],
    },
    fragment: {
      module,
      entryPoint: 'frag_main',
      targets: [{ format }],
    },
    primitive: { topology: 'triangle-list' },
  });

  const bindGroup = device.createBindGroup({
    layout: bindGroupLayout,
    entries: [{ binding: 0, resource: { buffer: colorUniform } }],
  });

  return { pipeline, vertexBuffer, bindGroup };
}
