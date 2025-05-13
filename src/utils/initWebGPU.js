// src/utils/initWebGPU.js (Adopt working pattern from minimal example)

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
  const dpr = window.devicePixelRatio || 1;
  console.log(`[initWebGPU] Device Pixel Ratio: ${dpr}`);

  // Use clientWidth/clientHeight to get CSS display size, then scale by DPR
  // This matches the logic from the successful minimal example.
  const displayWidth = Math.floor(canvas.clientWidth * dpr);
  const displayHeight = Math.floor(canvas.clientHeight * dpr);

  console.log(`[initWebGPU] Canvas clientWidth/Height (CSS display size): ${canvas.clientWidth}x${canvas.clientHeight}`);

  // Set canvas buffer size if it's different
  if (canvas.width !== displayWidth || canvas.height !== displayHeight) {
    canvas.width = displayWidth;
    canvas.height = displayHeight;
    console.log(`[initWebGPU] Canvas internal buffer dimensions UPDATED to (physical pixels): ${canvas.width}x${canvas.height}`);
  } else {
    console.log(`[initWebGPU] Canvas internal buffer dimensions ALREADY MATCH (physical pixels): ${canvas.width}x${canvas.height}`);
  }

  context.configure({
    device,
    format,
    alphaMode: 'premultiplied', // Keep our original alphaMode
    size: [displayWidth, displayHeight] // Use array form [width, height] or {width, height}
    // size: { width: canvas.width, height: canvas.height } // This also works as canvas.width/height are now correct
  });

  console.log(`[initWebGPU] Context configured with format: ${format} for size ${canvas.width}x${canvas.height}`);

  return { device, context, format };
}