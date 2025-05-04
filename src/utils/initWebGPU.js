// src/utils/initWebGPU.js

export default async function initWebGPU(canvas) {
  if (!navigator.gpu) {
    alert("WebGPU not supported in this browser.");
    return null;
  }

  const adapter = await navigator.gpu.requestAdapter();
  const device = await adapter.requestDevice();
  const context = canvas.getContext('webgpu');
  const format = navigator.gpu.getPreferredCanvasFormat();

  // ✅ Match physical pixels
  const devicePixelRatio = window.devicePixelRatio || 1;
  canvas.width = canvas.clientWidth * devicePixelRatio;
  canvas.height = canvas.clientHeight * devicePixelRatio;

  context.configure({
    device,
    format,
    alphaMode: 'opaque',
  });

  return { device, context, format, canvas };
}
