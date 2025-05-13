// src/utils/initWebGPU.js (SIMPLIFIED - NO DPR HANDLING)

export default async function initWebGPU(canvas) {
  if (!navigator.gpu) {
    console.error("WebGPU not supported.");
    throw new Error('WebGPU not supported');
  }
  const adapter = await navigator.gpu.requestAdapter();
  if (!adapter) {
    console.error("Failed to get GPU adapter.");
    throw new Error('No GPU adapter found');
  }
  const device = await adapter.requestDevice();
  if (!device) {
    console.error("Failed to get GPU device.");
    throw new Error('No GPU device found');
  }
  const context = canvas.getContext('webgpu');
  if (!context) {
    console.error("Failed to get WebGPU context.");
    throw new Error('Could not get WebGPU context');
  }

  const format = navigator.gpu.getPreferredCanvasFormat();

  // Use logical dimensions directly from clientWidth/Height
  const logicalWidth = canvas.clientWidth;
  const logicalHeight = canvas.clientHeight;

  canvas.width = logicalWidth;
  canvas.height = logicalHeight;
  console.log(`[initWebGPU - SIMPLIFIED] Canvas internal buffer dimensions SET TO (logical pixels): ${canvas.width}x${canvas.height}`);

  context.configure({
    device,
    format,
    alphaMode: 'premultiplied',
    size: { width: logicalWidth, height: logicalHeight } // Use logical size
  });

  console.log(`[initWebGPU - SIMPLIFIED] Context configured with format: ${format} for explicit size ${logicalWidth}x${logicalHeight}`);
  return { device, context, format };
}