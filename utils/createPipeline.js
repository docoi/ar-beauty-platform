// File: src/utils/createPipeline.js
import shaderCode from '../shaders/basicEffect.wgsl?raw'; // Adjust path if needed

export default async function createPipeline(device, format) {
  const shaderModule = device.createShaderModule({
    code: shaderCode,
  });

  return device.createRenderPipeline({
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
}
