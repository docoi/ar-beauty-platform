// src/utils/initWebGPU.js (Simplified: Gets device and preferred format)

export default async function initWebGPUEssentials(canvas) { // Renamed for clarity
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
  
  const format = navigator.gpu.getPreferredCanvasFormat();
  // Context is NOT obtained or configured here anymore.
  // Canvas sizing is NOT done here anymore.

  console.log("[initWebGPUEssentials] Device and preferred format obtained.");
  return { device, format }; // Return only device and format
}