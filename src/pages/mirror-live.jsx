// src/pages/mirror-live.jsx

import React, { useEffect, useRef } from 'react';
import initWebGPU from '@/utils/initWebGPU';
import createPipeline from '@/utils/createPipeline';
import lipstickShader from '@/shaders/lipstickEffect.wgsl?raw';

export default function MirrorLive() {
  const canvasRef = useRef(null);
  const videoRef = useRef(null);

  useEffect(() => {
    const run = async () => {
      const canvas = canvasRef.current;
      const video = videoRef.current;

      // Get webcam stream
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      video.srcObject = stream;
      await video.play();

      // Wait for video to be ready
      await new Promise(resolve => {
        video.onloadedmetadata = () => resolve();
      });

      const { device, format, context } = await initWebGPU(canvas);

      const module = device.createShaderModule({
        code: lipstickShader,
      });

      const pipeline = createPipeline(device, format, module);

      function frame() {
        const encoder = device.createCommandEncoder();
        const pass = encoder.beginRenderPass({
          colorAttachments: [
            {
              view: context.getCurrentTexture().createView(),
              loadOp: 'clear',
              storeOp: 'store',
              clearValue: { r: 0, g: 0, b: 0, a: 1 },
            },
          ],
        });

        pass.setPipeline(pipeline);
        pass.draw(6);
        pass.end();
        device.queue.submit([encoder.finish()]);
        requestAnimationFrame(frame);
      }

      requestAnimationFrame(frame);
    };

    run();
  }, []);

  return (
    <div className="flex justify-center items-center h-screen bg-black">
      <video ref={videoRef} className="hidden" />
      <canvas ref={canvasRef} width={640} height={480} />
    </div>
  );
}
