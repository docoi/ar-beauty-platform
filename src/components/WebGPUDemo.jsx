// ✅ WebGPUDemo.jsx (Mobile-Optimised WebGPU Demo)
import { useEffect, useRef } from 'react';
import initWebGPU from '@utils/initWebGPU.js';
import createPipeline from '@utils/createPipeline.js';

export default function WebGPUDemo() {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;

    async function run() {
      if (!navigator.gpu) {
        console.error('WebGPU is not supported in this browser.');
        return;
      }

      try {
        const { device, context, format } = await initWebGPU(canvas);
        const pipeline = await createPipeline(device, format);

        const commandEncoder = device.createCommandEncoder();
        const passEncoder = commandEncoder.beginRenderPass({
          colorAttachments: [
            {
              view: context.getCurrentTexture().createView(),
              loadOp: 'clear',
              clearValue: { r: 0.1, g: 0.1, b: 0.1, a: 1.0 },
              storeOp: 'store',
            },
          ],
        });

        passEncoder.setPipeline(pipeline);
        passEncoder.draw(6, 1, 0, 0);
        passEncoder.end();

        device.queue.submit([commandEncoder.finish()]);
      } catch (err) {
        console.error('WebGPU init failed:', err);
      }
    }

    run();
  }, []);

  return (
    <div className="w-full h-full flex items-center justify-center">
      <canvas
        ref={canvasRef}
        className="w-[100vw] h-[100vh] max-w-full max-h-full"
      />
    </div>
  );
}
