// File: src/components/WebGPUDemo.jsx
import { useEffect, useRef } from 'react';
import initWebGPU from '@/utils/initWebGPU';
import createPipeline from '@/utils/createPipeline';

export default function WebGPUDemo() {
  const canvasRef = useRef(null);
  const pointerRef = useRef({ x: 0.5, y: 0.5 });

  useEffect(() => {
    const canvas = canvasRef.current;
    let animationFrameId, device, context, uniformBuffer, pipeline;

    const updatePointer = (e) => {
      const rect = canvas.getBoundingClientRect();
      const touch = e.touches?.[0] ?? e;
      pointerRef.current = {
        x: (touch.clientX - rect.left) / rect.width,
        y: (touch.clientY - rect.top) / rect.height,
      };
    };

    async function run() {
      console.info('[WebGPU] Initializing...');
      const result = await initWebGPU(canvas);
      device = result.device;
      context = result.context;

      const pipelineResult = await createPipeline(device, result.format);
      pipeline = pipelineResult.pipeline;
      uniformBuffer = pipelineResult.uniformBuffer;

      function frame(time) {
        const t = time * 0.001;
        const { x, y } = pointerRef.current;
        const data = new Float32Array([t, x, y]);
        device.queue.writeBuffer(uniformBuffer, 0, data);

        const encoder = device.createCommandEncoder();
        const pass = encoder.beginRenderPass({
          colorAttachments: [{
            view: context.getCurrentTexture().createView(),
            loadOp: 'clear',
            clearValue: { r: 0, g: 0, b: 0, a: 1 },
            storeOp: 'store',
          }]
        });

        const bindGroup = device.createBindGroup({
          layout: pipeline.getBindGroupLayout(0),
          entries: [{ binding: 0, resource: { buffer: uniformBuffer } }],
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

  return <canvas ref={canvasRef} className="w-full h-screen block" />;
}
