import { useEffect, useRef } from 'react';
import initWebGPU from '@/utils/initWebGPU';
import createPipeline from '@/utils/createPipelines';
import lipstickShader from '@/shaders/lipstickEffect.wgsl?raw';

export default function Mirror() {
  const canvasRef = useRef(null);

  useEffect(() => {
    const run = async () => {
      const canvas = canvasRef.current;
      if (!canvas) return;

      const { device, context, format } = await initWebGPU(canvas);

      const shaderModule = device.createShaderModule({
        code: lipstickShader,
      });

      const pipeline = createPipeline(device, format, shaderModule);

      const render = () => {
        const commandEncoder = device.createCommandEncoder();
        const textureView = context.getCurrentTexture().createView();

        const renderPass = commandEncoder.beginRenderPass({
          colorAttachments: [
            {
              view: textureView,
              clearValue: { r: 0, g: 0, b: 0, a: 1 },
              loadOp: 'clear',
              storeOp: 'store',
            },
          ],
        });

        renderPass.setPipeline(pipeline);
        renderPass.draw(6, 1, 0, 0); // 6 vertices for fullscreen quad
        renderPass.end();

        device.queue.submit([commandEncoder.finish()]);
      };

      render();
    };

    run();
  }, []);

  return (
    <div className="w-full h-screen bg-black">
      <canvas ref={canvasRef} width={640} height={480} />
    </div>
  );
}
