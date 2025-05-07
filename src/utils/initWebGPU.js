// src/utils/initWebGPU.js

export default async function initWebGPU(canvas) {
  if (!navigator.gpu) {
    throw new Error('WebGPU not supported in this browser. Please try on a supported mobile browser like Chrome Canary or a compatible Android device.');
  }

  const adapter = await navigator.gpu.requestAdapter();
  if (!adapter) throw new Error('Failed to get GPU adapter.');

  const device = await adapter.requestDevice();
  const context = canvas.getContext('webgpu');

  const format = navigator.gpu.getPreferredCanvasFormat(); // replaces "bgra8unorm"
  context.configure({
    device,
    format,
    alphaMode: 'premultiplied', // can change to 'opaque' if needed
  });

  return { device, context, format };
}
