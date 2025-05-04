// src/utils/initWebGPU.js

export default async function initWebGPU(canvas) {
  if (!navigator.gpu) {
    alert("WebGPU not supported.");
    return null;
  }

  const adapter = await navigator.gpu.requestAdapter();
  const device = await adapter.requestDevice();
  const context = canvas.getContext("webgpu");

  const format = navigator.gpu.getPreferredCanvasFormat();

  // Resize canvas to physical pixels
  const dpr = window.devicePixelRatio || 1;
  canvas.width = canvas.clientWidth * dpr;
  canvas.height = canvas.clientHeight * dpr;

  context.configure({
    device,
    format,
    alphaMode: "opaque",
  });

  return { device, context, format, canvas };
}
