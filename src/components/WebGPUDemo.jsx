import { useEffect, useRef } from 'react';
import initWebGPU from '@utils/initWebGPU.js';
import createPipeline from '@utils/createPipeline.js';

export default function WebGPUDemo() {
  const canvasRef = useRef(null);
  const pointerRef = useRef({ x: 0.5, y: 0.5 }); // Center by default

  useEffect(() => {
    const canvas = canvasRef.current;
    let animationFrameId;

    const updatePointer = (e) => {
      const rect = canvas.getBoundingClientRect();
      let x, y;
      if (e.touches?.length > 0) {
        x = e.touches[0].clientX;
        y = e.touches[0].clientY;
      } else {
        x = e.clientX;
        y = e.clientY;
      }
      pointerRef.current = {
        x: (x - rect.left) / rect.width,
        y: (y - rect.top) / rect.height,
      };
    };

    async function run() {
      const { device, context, format } = await initWebGPU(canvas);
      const { pipeline, uniformBuffer, bindGroup } = await createPipeline(device, format);

      function frame(time) {
        const t = time * 0.001;
        const { x, y } = pointerRef.current;
        const uniforms = new Float32Array([t, x, y]);

        device.queue.writeBuffer(uniformBuffer, 0, uniforms);

        const encoder = device.createCommandEncoder();
        const pass = encoder.beginRenderPass({
          colorAttachments: [
            {
              view: context.getCurrentTexture().createView(),
              loadOp: 'clear',
              clearValue: { r: 0, g: 0, b: 0, a: 1 },
              storeOp: 'store',
            },
          ],
        });

        pass.setPipeline(pipeline);
        pass.setBindGroup(0, bindGroup);
        pass.draw(6, 1, 0, 0);
        pass.end();

        device.queue.submit([encoder.finish()]);
        animationFrameId = requestAnimationFrame(frame);
      }

      animationFrameId = requestAnimationFrame(frame);
    }

    canvas.addEventListener('mousemove', updatePointer);
    canvas.addEventListener('touchmove', updatePointer, { passive: true });

    run();

    return () => {
      cancelAnimationFrame(animationFrameId);
      canvas.removeEventListener('mousemove', updatePointer);
      canvas.removeEventListener('touchmove', updatePointer);
    };
  }, []);

  return <canvas ref={canvasRef} className="w-full h-full" />;
}
