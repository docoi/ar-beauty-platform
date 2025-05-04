// src/components/WebGPUDemo.jsx
import { useEffect, useRef } from 'react';
import initWebGPU from '../utils/initWebGPU';
import createPipeline from '../utils/createPipeline';
import shaderCode from '../shaders/basicEffect.wgsl?raw';

export default function WebGPUDemo() {
  const canvasRef = useRef(null);
  const mouseRef = useRef({ x: 0.5, y: 0.5 }); // Normalised

  useEffect(() => {
    let animationFrameId;
    let device, context, pipeline, uniformBuffer;

    const init = async () => {
      const canvas = canvasRef.current;
      const webgpu = await initWebGPU(canvas);
      if (!webgpu) return;

      ({ device, context } = webgpu);
      const { pipeline: newPipeline, uniformBuffer: newUniformBuffer } =
        await createPipeline(device, shaderCode);

      pipeline = newPipeline;
      uniformBuffer = newUniformBuffer;

      const render = (time) => {
        const t = time * 0.001;
        const mouseX = mouseRef.current.x;
        const mouseY = mouseRef.current.y;

        const uniformData = new Float32Array([t, mouseX, mouseY]);
        device.queue.writeBuffer(uniformBuffer, 0, uniformData.buffer);

        const encoder = device.createCommandEncoder();
        const pass = encoder.beginRenderPass({
          colorAttachments: [
            {
              view: context.getCurrentTexture().createView(),
              clearValue: { r: 0, g: 0, b: 0, a: 1 },
              loadOp: 'clear',
              storeOp: 'store',
            },
          ],
        });

        pass.setPipeline(pipeline);
        pass.setBindGroup(0, device.createBindGroup({
          layout: pipeline.getBindGroupLayout(0),
          entries: [{ binding: 0, resource: { buffer: uniformBuffer } }],
        }));
        pass.draw(6, 1, 0, 0);
        pass.end();

        device.queue.submit([encoder.finish()]);
        animationFrameId = requestAnimationFrame(render);
      };

      animationFrameId = requestAnimationFrame(render);
    };

    const updatePointer = (e) => {
      const rect = canvasRef.current.getBoundingClientRect();
      let clientX, clientY;
      if (e.touches && e.touches.length > 0) {
        clientX = e.touches[0].clientX;
        clientY = e.touches[0].clientY;
      } else {
        clientX = e.clientX;
        clientY = e.clientY;
      }

      mouseRef.current = {
        x: (clientX - rect.left) / rect.width,
        y: (clientY - rect.top) / rect.height,
      };
    };

    const canvas = canvasRef.current;
    canvas.addEventListener('mousemove', updatePointer);
    canvas.addEventListener('touchmove', updatePointer, { passive: true });

    init();

    return () => {
      cancelAnimationFrame(animationFrameId);
      canvas.removeEventListener('mousemove', updatePointer);
      canvas.removeEventListener('touchmove', updatePointer);
    };
  }, []);

  return <canvas ref={canvasRef} className="w-full h-screen block" />;
}
