// src/pages/mirror.jsx

import React, { useRef, useEffect } from 'react';
import initWebGPU from '../utils/initWebGPU';
import createPipeline from '../utils/createPipeline';
import lipstickShader from '../shaders/lipstickEffect.wgsl?raw';

const Mirror = () => {
  const canvasRef = useRef(null);
  const pointerRef = useRef({ x: 0.5, y: 0.5 });

  useEffect(() => {
    const run = async () => {
      const canvas = canvasRef.current;
      if (!canvas) return;

      const { device, context, format } = await initWebGPU(canvas);

      const module = device.createShaderModule({ code: lipstickShader });

      const uniformBuffer = device.createBuffer({
        size: 2 * Float32Array.BYTES_PER_ELEMENT,
        usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
      });

      const pipeline = createPipeline(device, format, module);

      const bindGroup = device.createBindGroup({
        layout: pipeline.getBindGroupLayout(0),
        entries: [{ binding: 0, resource: { buffer: uniformBuffer } }],
      });

      const render = () => {
        const data = new Float32Array([pointerRef.current.x, pointerRef.current.y]);
        device.queue.writeBuffer(uniformBuffer, 0, data.buffer);

        const commandEncoder = device.createCommandEncoder();
        const pass = commandEncoder.beginRenderPass({
          colorAttachments: [{
            view: context.getCurrentTexture().createView(),
            loadOp: 'clear',
            storeOp: 'store',
            clearValue: { r: 0, g: 0, b: 0, a: 1 },
          }],
        });

        pass.setPipeline(pipeline);
        pass.setBindGroup(0, bindGroup);
        pass.draw(6);
        pass.end();

        device.queue.submit([commandEncoder.finish()]);
        requestAnimationFrame(render);
      };

      render();
    };

    run();
  }, []);

  return (
    <div className="flex justify-center items-center w-full h-screen bg-black">
      <canvas
        ref={canvasRef}
        width={640}
        height={480}
        className="rounded-lg border border-gray-700"
      />
    </div>
  );
};

export default Mirror;
