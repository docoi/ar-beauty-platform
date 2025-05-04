import { useEffect, useRef } from 'react';
import initWebGPU from '@utils/initWebGPU';
import createPipeline from '@utils/createPipeline';

export default function WebGPUDemo() {
  const canvasRef = useRef(null);
  const pointerRef = useRef({ x: 0.5, y: 0.5 });

  useEffect(() => {
    const canvas = canvasRef.current;
    let animationFrameId, device, uniformBuffer;

    async function run() {
      const { device: dev, context, format } = await initWebGPU(canvas);
      device = dev;

      const { pipeline, uniformBuffer: uBuffer } = await createPipeline(device, format);
      uniformBuffer = uBuffer;

      const render = (time) => {
        const t = time * 0.001;
        const { x, y } = pointerRef.current;
        const data = new Float32Array([t, x, y]);
        device.queue.writeBuffer(uniformBuffer, 0, data);

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
        const bindGroup = device.createBindGroup({
          layout: pipeline.getBindGroupLayout(0),
          entries: [{ binding: 0, resource: { buffer: uniformBuffer } }],
        });
        passEncoder.setBindGroup(0, bindGroup);
        passEncoder.draw(6, 1, 0, 0);
        passEncoder.end();
        device.queue.submit([commandEncoder.finish()]);
        animationFrameId = requestAnimationFrame(render);
      };

      animationFrameId = requestAnimationFrame(render);
    }

    const updatePointer = (e) => {
      const rect = canvas.getBoundingClientRect();
      const touch = e.touches?.[0] ?? e;
      pointerRef.current = {
        x: (touch.clientX - rect.left) / rect.width,
        y: (touch.clientY - rect.top) / rect.height,
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

  return <canvas ref={canvasRef} className="w-full h-screen block" />;
}
