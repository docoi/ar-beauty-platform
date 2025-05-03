// ✅ WebGPUDemo.jsx (Stage 3: Animated Shader Gradient)
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
        console.error('WebGPU is not supported in this browser.');
        return;
      }

      try {
        const { device, context, format } = await initWebGPU(canvas);
        const pipeline = await createPipeline(device, format);

        const uniformBuffer = device.createBuffer({
          size: 4, // 1 float = 4 bytes
          usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
        });

        const bindGroup = device.createBindGroup({
          layout: pipeline.getBindGroupLayout(0),
          entries: [
            {
              binding: 0,
              resource: { buffer: uniformBuffer },
            },
          ],
        });

        function frame(time) {
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

          const seconds = time * 0.001;
          device.queue.writeBuffer(uniformBuffer, 0, new Float32Array([seconds]));

          pass.setPipeline(pipeline);
          pass.setBindGroup(0, bindGroup);
          pass.draw(6, 1, 0, 0);
          pass.end();

          device.queue.submit([encoder.finish()]);
          animationFrameId = requestAnimationFrame(frame);
        }

        animationFrameId = requestAnimationFrame(frame);
      } catch (err) {
        console.error('WebGPU init failed:', err);
      }
    }

    run();
    return () => cancelAnimationFrame(animationFrameId);
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
