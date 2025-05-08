import React, { useEffect, useRef } from 'react';
import initWebGPU from '../utils/initWebGPU';
import createPipeline from '../utils/createPipeline';
import lipstickShader from '../shaders/lipstickEffect.wgsl?raw';

export default function LipstickMirrorLive() {
  const canvasRef = useRef(null);

  useEffect(() => {
    const start = async () => {
      console.log('Initializing Lipstick Mirror');
      const canvas = canvasRef.current;
      const { device, context, format } = await initWebGPU(canvas);
      const pipeline = await createPipeline(device, format, lipstickShader);

      const encoder = device.createCommandEncoder();
      const textureView = context.getCurrentTexture().createView();
      const pass = encoder.beginRenderPass({
        colorAttachments: [{
          view: textureView,
          clearValue: { r: 0, g: 0, b: 0, a: 1 },
          loadOp: 'clear',
          storeOp: 'store',
        }],
      });

      pass.setPipeline(pipeline);
      pass.draw(6, 1, 0, 0);
      pass.end();
      device.queue.submit([encoder.finish()]);
      console.log('Frame rendered');
    };

    start();
  }, []);

  return (
    <div className="w-full h-full">
      <canvas ref={canvasRef} className="w-full h-full" />
    </div>
  );
}
