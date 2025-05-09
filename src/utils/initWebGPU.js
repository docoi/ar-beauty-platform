export default async function initWebGPU(canvas) {
  if (!navigator.gpu) throw new Error('WebGPU not supported');

  const adapter = await navigator.gpu.requestAdapter();
  if (!adapter) throw new Error('Failed to get GPU adapter');

  const device = await adapter.requestDevice();
  const context = canvas.getContext('webgpu');
  const format = navigator.gpu.getPreferredCanvasFormat();

  context.configure({
    device,
    format,
    alphaMode: 'opaque',
  });

  return { device, context, format };
}
