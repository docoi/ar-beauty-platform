import { useEffect, useRef } from 'react';
import initWebGPU from '@utils/initWebGPU.js';
import createPipeline from '@utils/createPipeline.js';

export default function WebGPUDemo() {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    let animationFrameId;

    async function run() {
      const { device, context, format } = await initWebGPU(canvas);
      const { pipeline, uniformBuffer, bindGroup } = await createPipeline(device, format);

      function frame(time) {
        const timeInSeconds = time * 0.001;
        device.queue.writeBuffer(uniformBuffer, 0, new Float32Array([timeInSeconds]));

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
        animationFrameId = requestAnimationFrame(frame);
      }

      animationFrameId = requestAnimationFrame(frame);
    }

    run();
    return () => cancelAnimationFrame(animationFrameId);
  }, []);

  return <canvas ref={canvasRef} className="w-full h-full" />;
}
