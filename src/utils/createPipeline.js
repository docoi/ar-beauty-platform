// src/utils/createPipeline.js

export default function createPipeline(device, format, shaderModule) {
  return device.createRenderPipeline({
    layout: 'auto',
    vertex: {
      module: shaderModule,
      entryPoint: 'vertexMain', // This must match your WGSL
    },
    fragment: {
      module: shaderModule,
      entryPoint: 'fragmentMain', // This must match your WGSL
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
}
