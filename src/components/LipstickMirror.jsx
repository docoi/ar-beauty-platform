import { useEffect, useRef } from 'react';
import initWebGPU from '@utils/initWebGPU';
import createPipeline from '@utils/createPipeline';
import { lipstickShader } from '@/shaders/lipstickEffect.wgsl';

export default function LipstickMirror() {
  const canvasRef = useRef(null);
  const pointerRef = useRef({ x: 0.5, y: 0.5 });

  useEffect(() => {
    const canvas = canvasRef.current;
    let animationId, device, uniformBuffer;

    const run = async () => {
      const { device: dev, context, format } = await initWebGPU(canvas);
      device = dev;

      const module = device.createShaderModule({
        code: lipstickShader,
      });

      uniformBuffer = device.createBuffer({
        size: 3 * 4,
        usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
      });

      const pipeline = await createPipeline(device, format, module);

      const bindGroup = device.createBindGroup({
        layout: pipeline.getBindGroupLayout(0),
        entries: [{ binding: 0, resource: { buffer: uniformBuffer } }],
      });

      const render = (time) => {
        const t = time * 0.001;
        const { x, y } = pointerRef.current;
        const data = new Float32Array([t, x, y]);
        device.queue.writeBuffer(uniformBuffer, 0, data);

        const encoder = device.createCommandEncoder();
        const pass = encoder.beginRenderPass({
          colorAttachments: [{
            view: context.getCurrentTexture().createView(),
            loadOp: 'clear',
            storeOp: 'store',
            clearValue: { r: 0, g: 0, b: 0, a: 1 },
          }],
        });

        pass.setPipeline(pipeline);
        pass.setBindGroup(0, bindGroup);
        pass.draw(6, 1, 0, 0);
        pass.end();

        device.queue.submit([encoder.finish()]);
        animationId = requestAnimationFrame(render);
      };

      animationId = requestAnimationFrame(render);
    };

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
      cancelAnimationFrame(animationId);
      canvas.removeEventListener('mousemove', updatePointer);
      canvas.removeEventListener('touchmove', updatePointer);
    };
  }, []);

  return <canvas ref={canvasRef} className="w-full h-screen block" />;
}