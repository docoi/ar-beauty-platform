import { useEffect, useRef } from 'react';
import initWebGPU from '@utils/initWebGPU.js';
import createPipeline from '@utils/createPipeline.js';

export default function WebGPUDemo() {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    let animationFrameId;

    async function run() {
      if (!navigator.gpu) {
        console.error('WebGPU not supported');
        return;
      }

      const { device, context, format } = await initWebGPU(canvas);
      const pipeline = await createPipeline(device, format);

      function frame() {
        const commandEncoder = device.createCommandEncoder();
        const passEncoder = commandEncoder.beginRenderPass({
          colorAttachments: [
            {
              view: context.getCurrentTexture().createView(),
              loadOp: 'clear',
              clearValue: { r: 1.0, g: 0.0, b: 1.0, a: 1.0 }, // Magenta
              storeOp: 'store',
            },
          ],
        });

        passEncoder.setPipeline(pipeline);
        passEncoder.draw(6, 1, 0, 0);
        passEncoder.end();

        device.queue.submit([commandEncoder.finish()]);
        animationFrameId = requestAnimationFrame(frame);
      }

      animationFrameId = requestAnimationFrame(frame);
    }

    run();
    return () => cancelAnimationFrame(animationFrameId);
  }, []);

  return <canvas ref={canvasRef} className="w-full h-full" />;
}
