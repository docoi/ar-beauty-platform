// src/pages/LipstickMirrorLive.jsx

import React, { useRef, useEffect } from 'react';
import initWebGPU from '../utils/initWebGPU';
import createPipeline from '../utils/createPipeline';
import lipstickShader from '../shaders/lipstickEffect.wgsl?raw';

export default function LipstickMirrorLive() {
  const canvasRef = useRef(null);

  useEffect(() => {
    const setup = async () => {
      console.log('🔧 Initializing Lipstick Mirror');
      const canvas = canvasRef.current;
      if (!canvas) {
        console.error('❌ Canvas not found');
        return;
      }

      try {
        const { device, context, format } = await initWebGPU(canvas);

        const shaderModule = device.createShaderModule({
          code: lipstickShader,
        });

        const pipeline = createPipeline(device, format, shaderModule);

        const renderPassDescriptor = {
          colorAttachments: [
            {
              view: context.getCurrentTexture().createView(),
              clearValue: { r: 1, g: 0, b: 0, a: 1 },
              loadOp: 'clear',
              storeOp: 'store',
            },
          ],
        };

        const commandEncoder = device.createCommandEncoder();
        const passEncoder = commandEncoder.beginRenderPass(renderPassDescriptor);
        passEncoder.setPipeline(pipeline);
        passEncoder.draw(3, 1, 0, 0);
        passEncoder.end();

        device.queue.submit([commandEncoder.finish()]);
        console.log('✅ Frame rendered');
      } catch (error) {
        console.error('🚨 Setup error:', error);
      }
    };

    setup();
  }, []);

  return (
    <div className="w-full h-full">
      <canvas ref={canvasRef} width={640} height={480} className="w-full h-full" />
    </div>
  );
}
