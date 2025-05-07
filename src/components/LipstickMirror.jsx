import { useEffect, useRef } from 'react';
import initWebGPU from '@/utils/initWebGPU';
import createPipeline from '@/utils/createPipeline';
import lipstickShader from '@/shaders/lipstickEffect.wgsl?raw';

export default function LipstickMirror() {
  const canvasRef = useRef(null);
  const pointerRef = useRef({ x: 0.5, y: 0.5 });

  useEffect(() => {
    const run = async () => {
      const canvas = canvasRef.current;
      const { device, context, format } = await initWebGPU(canvas);

      const module = device.createShaderModule({ code: lipstickShader });

      const uniformBuffer = device.createBuffer({
        size: 2 * 4,
        usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
      });

      const pipeline = createPipeline(device, format, module);

      const bindGroup = device.createBindGroup({
        layout: pipeline.getBindGroupLayout(0),
        entries: [
          {
            binding: 0,
            resource: { buffer: uniformBuffer },
          },
        ],
      });

      const render = () => {
        const { x, y } = pointerRef.current;
        const data = new Float32Array([x, y]);
        device.queue.writeBuffer(uniformBuffer, 0, data);

        const encoder = device.createCommandEncoder();
        const pass = encoder.beginRenderPass({
          colorAttachments: [
            {
              view: context.getCurrentTexture().createView(),
              loadOp: 'clear',
              storeOp: 'store',
              clearValue: { r: 0, g: 0, b: 0, a: 1 },
            },
          ],
        });

        pass.setPipeline(pipeline);
        pass.setBindGroup(0, bindGroup);
        pass.draw(6, 1, 0, 0);
        pass.end();

        device.queue.submit([encoder.finish()]);
        requestAnimationFrame(render);
      };

      render();
    };

    run();
  }, []);

  return (
    <canvas
      ref={canvasRef}
      width={640}
      height={480}
      className="w-full h-full"
    />
  );
}
