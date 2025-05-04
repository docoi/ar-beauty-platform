import shaderCode from '@shaders/basicEffect.wgsl?raw';

export default function createPipeline(device, format) {
  const shaderModule = device.createShaderModule({ code: shaderCode });

  const uniformBuffer = device.createBuffer({
    size: 12, // time (1 float) + pointer (vec2 = 2 floats) = 3 floats * 4 bytes = 12 bytes
    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
  });

  const bindGroupLayout = device.createBindGroupLayout({
    entries: [
      {
        binding: 0,
        visibility: GPUShaderStage.FRAGMENT,
        buffer: {},
      },
    ],
  });

  const pipeline = device.createRenderPipeline({
    layout: device.createPipelineLayout({ bindGroupLayouts: [bindGroupLayout] }),
    vertex: {
      module: shaderModule,
      entryPoint: 'vs_main',
    },
    fragment: {
      module: shaderModule,
      entryPoint: 'fs_main',
      targets: [{ format }],
    },
    primitive: {
      topology: 'triangle-list',
    },
  });

  const bindGroup = device.createBindGroup({
    layout: bindGroupLayout,
    entries: [{ binding: 0, resource: { buffer: uniformBuffer } }],
  });

  return { pipeline, uniformBuffer, bindGroup };
}
