// src/pages/LipstickMirrorLive.jsx

import React, { useEffect, useRef } from 'react';
import initWebGPU from '@/utils/initWebGPU';
import createPipeline from '@/utils/createPipeline';
import lipstickShader from '@/shaders/lipstickEffect.wgsl?raw';

export default function LipstickMirrorLive() {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);

  useEffect(() => {
    async function setupVideoAndCanvas() {
      // Set up the video stream
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }

      // Set up WebGPU rendering
      const canvas = canvasRef.current;
      const { device, context, format } = await initWebGPU(canvas);
      const shaderModule = device.createShaderModule({ code: lipstickShader });
      const pipeline = createPipeline(device, format, shaderModule);

      function drawFrame() {
        const encoder = device.createCommandEncoder();
        const pass = encoder.beginRenderPass({
          colorAttachments: [
            {
              view: context.getCurrentTexture().createView(),
              clearValue: { r: 1, g: 0, b: 0, a: 1 }, // Red background for visibility
              loadOp: 'clear',
              storeOp: 'store',
            },
          ],
        });

        pass.setPipeline(pipeline);
        pass.draw(6, 1, 0, 0);
        pass.end();

        device.queue.submit([encoder.finish()]);
        requestAnimationFrame(drawFrame);
      }

      drawFrame();
    }

    setupVideoAndCanvas();
  }, []);

  return (
    <div className="w-full h-full flex flex-col items-center justify-center gap-4 p-4 bg-black">
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        className="rounded-xl shadow-lg w-full max-w-md"
      />
      <canvas
        ref={canvasRef}
        width={640}
        height={480}
        className="rounded-xl shadow-lg w-full max-w-md"
      />
    </div>
  );
}
