export default async function initWebGPU(video, canvas) {
  if (!navigator.gpu) throw new Error("WebGPU not supported");

  const adapter = await navigator.gpu.requestAdapter();
  const device = await adapter.requestDevice();
  const context = canvas.getContext('webgpu');

  const format = navigator.gpu.getPreferredCanvasFormat();
  context.configure({ device, format, alphaMode: 'premultiplied' });

  const videoTexture = device.createTexture({
    size: [video.videoWidth, video.videoHeight],
    format: 'rgba8unorm',
    usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST | GPUTextureUsage.RENDER_ATTACHMENT,
  });

  const uploadVideoFrame = () => {
    const bitmap = new OffscreenCanvas(video.videoWidth, video.videoHeight);
    const ctx = bitmap.getContext('2d');
    ctx.drawImage(video, 0, 0);
    device.queue.copyExternalImageToTexture(
      { source: bitmap },
      { texture: videoTexture },
      [video.videoWidth, video.videoHeight]
    );
  };

  return { device, context, format, videoTexture, uploadVideoFrame };
}
