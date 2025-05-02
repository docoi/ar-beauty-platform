// File: src/components/WebGPUDemo.jsx

import { useEffect, useRef } from 'react';
import initWebGPU from '@utils/initWebGPU.js';
import createPipeline from '@utils/createPipeline.js';

export default function WebGPUDemo() {
  const canvasRef = useRef(null);
  const videoRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const video = videoRef.current;

    if (!navigator.gpu) {
      console.error('WebGPU not supported.');
      return;
    }

    navigator.mediaDevices.getUserMedia({ video: true }).then(async (stream) => {
      video.srcObject = stream;
      await video.play();

      const { device, context, format } = await initWebGPU(canvas);
      const pipeline = await createPipeline(device, format);
      const bindGroupLayout = pipeline.getBindGroupLayout(0);

      function frame() {
        const videoTexture = device.importExternalTexture({ source: video });

        const bindGroup = device.createBindGroup({
          layout: bindGroupLayout,
          entries: [
            {
              binding: 0,
              resource: videoTexture,
            },
          ],
        });

        const commandEncoder = device.createCommandEncoder();
        const passEncoder = commandEncoder.beginRenderPass({
          colorAttachments: [
            {
              view: context.getCurrentTexture().createView(),
              loadOp: 'clear',
              clearValue: { r: 0, g: 0, b: 0, a: 1 },
              storeOp: 'store',
            },
          ],
        });

        passEncoder.setPipeline(pipeline);
        passEncoder.setBindGroup(0, bindGroup);
        passEncoder.draw(6, 1, 0, 0);
        passEncoder.end();
        device.queue.submit([commandEncoder.finish()]);

        requestAnimationFrame(frame);
      }

      frame();
    });
  }, []);

  return (
    <div className="relative w-full h-full">
      <video ref={videoRef} playsInline autoPlay muted style={{ display: 'none' }} />
      <canvas ref={canvasRef} className="w-full h-full" />
    </div>
  );
}
