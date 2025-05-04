import { useEffect, useRef } from 'react';
import initWebGPU from '@utils/initWebGPU.js';
import createPipeline from '@utils/createPipeline.js';

export default function WebGPUDemo() {
  const canvasRef = useRef(null);
  const pointerRef = useRef({ x: 0.5, y: 0.5 }); // Normalised pointer

  useEffect(() => {
    const canvas = canvasRef.current;
    let animationFrameId;

    async function run() {
      const { device, context, format } = await initWebGPU(canvas);
      const { pipeline, uniformBuffer } = await createPipeline(device, format);

      const startTime = performance.now();

      function frame() {
        const now = performance.now();
        const elapsed = (now - startTime) / 1000;
        const { x, y } = pointerRef.current;

        const uniformData = new Float32Array([elapsed, x, y]);
        device.queue.writeBuffer(uniformBuffer, 0, uniformData.buffer);

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
        const bindGroup = device.createBindGroup({
          layout: pipeline.getBindGroupLayout(0),
          entries: [{ binding: 0, resource: { buffer: uniformBuffer } }],
        });
        pass.setBindGroup(0, bindGroup);
        pass.draw(6, 1, 0, 0);
        pass.end();

        device.queue.submit([encoder.finish()]);
        animationFrameId = requestAnimationFrame(frame);
      }

      animationFrameId = requestAnimationFrame(frame);
    }

    const updatePointer = (e) => {
      const rect = canvasRef.current.getBoundingClientRect();
      let clientX, clientY;

      if (e.touches?.length > 0) {
        clientX = e.touches[0].clientX;
        clientY = e.touches[0].clientY;
      } else {
        clientX = e.clientX;
        clientY = e.clientY;
      }

      pointerRef.current = {
        x: (clientX - rect.left) / rect.width,
        y: (clientY - rect.top) / rect.height,
      };
    };

    canvas.addEventListener('mousemove', updatePointer);
    canvas.addEventListener('touchmove', updatePointer, { passive: true });

    run();
    return () => {
      cancelAnimationFrame(animationFrameId);
      canvas.removeEventListener('mousemove', updatePointer);
      canvas.removeEventListener('touchmove', updatePointer);
    };
  }, []);

  return <canvas ref={canvasRef} className="w-full h-full block" />;
}
