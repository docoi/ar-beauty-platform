// src/utils/initWebGPU.js (Restore to version with DPR, explicit size, and alphaMode: 'opaque')

export default async function initWebGPU(canvas) { // Original function name
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

  const presentationWidth = canvas.clientWidth;
  const presentationHeight = canvas.clientHeight;
  console.log(`[initWebGPU] Canvas clientWidth/Height (CSS display size): ${presentationWidth}x${presentationHeight}`);

  const physicalWidth = Math.round(presentationWidth * dpr);
  const physicalHeight = Math.round(presentationHeight * dpr);

  // Set canvas buffer size if it's different or not yet set correctly
  if (canvas.width !== physicalWidth || canvas.height !== physicalHeight) {
    canvas.width = physicalWidth;
    canvas.height = physicalHeight;
    console.log(`[initWebGPU] Canvas internal buffer dimensions UPDATED to (physical pixels): ${canvas.width}x${canvas.height}`);
  } else {
    console.log(`[initWebGPU] Canvas internal buffer dimensions ALREADY MATCH (physical pixels): ${canvas.width}x${canvas.height}`);
  }

  context.configure({
    device,
    format,
    alphaMode: 'opaque', // Matched minimal example
    size: [physicalWidth, physicalHeight] // Explicitly use array form
  });

  console.log(`[initWebGPU] Context configured with format: ${format} for explicit size ${physicalWidth}x${physicalHeight}, alphaMode: 'opaque'`);

  return { device, context, format };
}