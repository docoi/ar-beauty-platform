// File: src/utils/createPipeline.js
import shaderCode from '@shaders/basicEffect.wgsl?raw';

export default function createPipeline(device, format) {
  const shaderModule = device.createShaderModule({ code: shaderCode });

  const uniformBuffer = device.createBuffer({
    size: 12, // 1x float (time) + 2x float (pointer)
    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
  });

  const pipeline = device.createRenderPipeline({
    layout: 'auto',
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

  return { pipeline, uniformBuffer };
}
