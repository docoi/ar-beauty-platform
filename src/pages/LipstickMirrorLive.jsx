// src/pages/mirrorLive.jsx

import React, { useRef, useEffect } from 'react';
import initWebGPU from '../utils/initWebGPU';
import createPipeline from '../utils/createPipeline';
import lipstickShader from '../shaders/lipstickEffect.wgsl?raw';

const MirrorLive = () => {
  const canvasRef = useRef(null);
  const videoRef = useRef(null);

  useEffect(() => {
    const start = async () => {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      video.srcObject = stream;
      await video.play();

      const { device, context, format } = await initWebGPU(canvas);
      const module = device.createShaderModule({ code: lipstickShader });
      const pipeline = await createPipeline(device, format, module);

      const frame = () => {
        const encoder = device.createCommandEncoder();
        const pass = encoder.beginRenderPass({
          colorAttachments: [
            {
              view: context.getCurrentTexture().createView(),
              clearValue: { r: 1, g: 0, b: 1, a: 1 },
              loadOp: 'clear',
              storeOp: 'store',
            },
          ],
        });
        pass.setPipeline(pipeline);
        pass.draw(6, 1, 0, 0);
        pass.end();
        device.queue.submit([encoder.finish()]);
        requestAnimationFrame(frame);
      };

      frame();
    };

    start();
  }, []);

  return (
    <div className="w-full h-screen flex flex-col items-center justify-center">
      <video ref={videoRef} className="hidden" autoPlay playsInline muted />
      <canvas ref={canvasRef} className="w-full h-full" />
    </div>
  );
};

export default MirrorLive;
