// src/utils/initWebGPU.js

export default async function initWebGPU(canvas) {
  if (!navigator.gpu) {
    console.error("WebGPU not supported. Please use a browser that supports WebGPU.");
    throw new Error('WebGPU not supported');
  }

  const adapter = await navigator.gpu.requestAdapter();
  if (!adapter) {
    console.error("Failed to get GPU adapter. WebGPU might be disabled or unavailable.");
    throw new Error('No GPU adapter found');
  }

  const device = await adapter.requestDevice();
  if (!device) {
    console.error("Failed to get GPU device.");
    throw new Error('No GPU device found');
  }

  const context = canvas.getContext('webgpu');
  if (!context) {
    console.error("Failed to get WebGPU context from canvas.");
    throw new Error('Could not get WebGPU context');
  }

  const format = navigator.gpu.getPreferredCanvasFormat();

  // Explicitly set canvas drawing buffer size to match its HTML attributes
  // This can help with DPI scaling issues or if the canvas CSS size differs from its render size.
  // We want the internal buffer to be 1:1 with the canvas width/height attributes.
  canvas.width = canvas.clientWidth;   // Match CSS width if it's different, or just re-affirm
  canvas.height = canvas.clientHeight; // Match CSS height if it's different, or just re-affirm
  // For this project, clientWidth/Height should be 640/480 due to parent div styling.
  // This ensures the internal GPU texture matches this.

  console.log(`[initWebGPU] Canvas dimensions set to: ${canvas.width}x${canvas.height} (from clientWidth/clientHeight)`);
  console.log(`[initWebGPU] Canvas HTML attributes: ${canvas.getAttribute('width')}x${canvas.getAttribute('height')}`);


  context.configure({
    device,
    format,
    alphaMode: 'premultiplied', // Or 'opaque' if no transparency needed from canvas itself
    // Optional: Explicitly set the size for the presentation context
    // size: { width: canvas.width, height: canvas.height } // This is often implicit
  });

  console.log(`[initWebGPU] Context configured with format: ${format}`);

  return { device, context, format };
}