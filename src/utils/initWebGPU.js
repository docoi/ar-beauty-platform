// src/utils/initWebGPU.js (Account for devicePixelRatio)

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

  // Get the desired display size of the canvas from its CSS-rendered size
  const presentationWidth = canvas.clientWidth;  // e.g., 638 CSS pixels
  const presentationHeight = canvas.clientHeight; // e.g., 478 CSS pixels
  console.log(`[initWebGPU] Canvas clientWidth/Height (CSS display size): ${presentationWidth}x${presentationHeight}`);

  // Set the canvas's internal drawing buffer size in PHYSICAL pixels.
  canvas.width = Math.round(presentationWidth * dpr);
  canvas.height = Math.round(presentationHeight * dpr);
  console.log(`[initWebGPU] Canvas internal buffer dimensions SET TO (physical pixels): ${canvas.width}x${canvas.height}`);
  // Note: The canvas's CSS style (e.g., width:100% or width:638px) should remain unchanged.
  // The browser will scale the high-resolution rendering down to the CSS display size.

  context.configure({
    device,
    format,
    alphaMode: 'premultiplied', // Or 'opaque'
    // The size for configure should be the physical pixel size of the canvas drawing buffer.
    // This is implicitly handled by canvas.width and canvas.height being set correctly.
    // You could also explicitly set it:
    // size: { width: canvas.width, height: canvas.height }
  });

  console.log(`[initWebGPU] Context configured with format: ${format} for physical canvas size ${canvas.width}x${canvas.height}`);

  return { device, context, format };
}