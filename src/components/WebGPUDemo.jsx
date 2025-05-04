// File: src/components/WebGPUDemo.jsx
import { useEffect, useRef } from 'react';
import initWebGPU from '@utils/initWebGPU.js';
import createPipeline from '@utils/createPipeline.js';

export default function WebGPUDemo() {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;

    async function run() {
      if (!navigator.gpu) {
        console.error('WebGPU not supported.');
        return;
      }

      const { device, context, format } = await initWebGPU(canvas);
      const pipeline = await createPipeline(device, format);

      const commandEncoder = device.createCommandEncoder();
      const passEncoder = commandEncoder.beginRenderPass({
        colorAttachments: [{
          view: context.getCurrentTexture().createView(),
          loadOp: 'clear',
          clearValue: { r: 0.2, g: 0.4, b: 0.6, a: 1.0 }, // Blue-ish placeholder
          storeOp: 'store',
        }],
      });

      passEncoder.setPipeline(pipeline);
      passEncoder.draw(6, 1, 0, 0);
      passEncoder.end();
      device.queue.submit([commandEncoder.finish()]);
    }

    run();
  }, []);

  return (
    <div className="relative w-full h-full">
      <canvas ref={canvasRef} className="w-full h-full" />
    </div>
  );
}
