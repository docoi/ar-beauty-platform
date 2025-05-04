import React, { useEffect, useRef } from 'react';
import initWebGPU from '@utils/initWebGPU';
import createPipeline from '@utils/createPipeline';
import lipstickEffect from '@effects/lipstickEffect';

export default function Mirror() {
  const canvasRef = useRef(null);

  useEffect(() => {
    const run = async () => {
      const canvas = canvasRef.current;
      if (!canvas) return;

      const { device, context, format } = await initWebGPU(canvas);

      const module = device.createShaderModule({
        code: lipstickEffect.shaderCode,
      });

      const pipeline = createPipeline(device, format, module);

      const render = () => {
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
        pass.draw(6);
        pass.end();

        device.queue.submit([encoder.finish()]);
      };

      render();
    };

    run();
  }, []);

  return <canvas ref={canvasRef} width={640} height={480} className="w-full h-auto" />;
}
