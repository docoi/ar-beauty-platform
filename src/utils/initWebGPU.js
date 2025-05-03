// File: src/utils/initWebGPU.js
export default async function initWebGPU(canvas) {
  if (!navigator.gpu) throw new Error('WebGPU not supported in this browser.');

  const adapter = await navigator.gpu.requestAdapter();
  if (!adapter) throw new Error('No GPU adapter found.');

  const device = await adapter.requestDevice();
  const context = canvas.getContext('webgpu');
  const format = navigator.gpu.getPreferredCanvasFormat();

  context.configure({
    device,
    format,
    alphaMode: 'premultiplied',
  });

  return { device, context, format };
}
