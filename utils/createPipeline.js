// File: src/components/WebGPUDemo.jsx
import shaderCode from './shaders/basicEffect.wgsl?raw';
import { useEffect, useRef } from 'react';
import initWebGPU from '../utils/initWebGPU';
import createPipeline from '../utils/createPipeline';

export default function WebGPUDemo() {
  const canvasRef = useRef(null);
  const videoRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const video = videoRef.current;

    // Request camera stream
    navigator.mediaDevices.getUserMedia({ video: true }).then(async (stream) => {
      video.srcObject = stream;
      await video.play();

      const { device, context, format } = await initWebGPU(canvas);
      const pipeline = await createPipeline(device, format);

      const videoTexture = device.importExternalTexture({ source: video });
      const commandEncoder = device.createCommandEncoder();

      function frame() {
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
        passEncoder.setBindGroup(0, device.createBindGroup({
          layout: pipeline.getBindGroupLayout(0),
          entries: [
            {
              binding: 0,
              resource: videoTexture,
            },
          ],
        }));

        passEncoder.draw(6, 1, 0, 0);
        passEncoder.end();
        device.queue.submit([commandEncoder.finish()]);

        requestAnimationFrame(frame);
      }

      frame();
    });
  }, []);

  return (
    <div className="relative w-full h-full">
      <video ref={videoRef} playsInline autoPlay muted style={{ display: 'none' }} />
      <canvas ref={canvasRef} className="w-full h-full" />
    </div>
  );
}  

// File: src/utils/initWebGPU.js
export default async function initWebGPU(canvas) {
  if (!navigator.gpu) throw new Error('WebGPU not supported.');
  const adapter = await navigator.gpu.requestAdapter();
  const device = await adapter.requestDevice();
  const context = canvas.getContext('webgpu');
  const format = navigator.gpu.getPreferredCanvasFormat();
  context.configure({ device, format, alphaMode: 'premultiplied' });
  return { device, context, format };
}

// File: src/utils/createPipeline.js
export default async function createPipeline(device, format) {
  const shaderCode = await fetch('/shaders/basicEffect.wgsl').then(res => res.text());
  const shaderModule = device.createShaderModule({ code: shaderCode });

  return device.createRenderPipeline({
    layout: 'auto',
    vertex: {
      module: shaderModule,
      entryPoint: 'vs_main',
    },
    fragment: {
      module: shaderModule,
      entryPoint: 'fs_main',
      targets: [{ format }],
    },
    primitive: {
      topology: 'triangle-list',
    },
  });
}

// File: public/shaders/basicEffect.wgsl
// WGSL Shader: basicEffect.wgsl
@vertex
fn vs_main(@builtin(vertex_index) vertexIndex : u32) -> @builtin(position) vec4f {
  var pos = array<vec2f, 6>(
    vec2f(-1.0, -1.0), vec2f(1.0, -1.0), vec2f(-1.0, 1.0),
    vec2f(-1.0, 1.0), vec2f(1.0, -1.0), vec2f(1.0, 1.0)
  );
  return vec4f(pos[vertexIndex], 0.0, 1.0);
}

@fragment
fn fs_main() -> @location(0) vec4f {
  return vec4f(1.0, 0.8, 0.9, 1.0); // Pink placeholder effect
}
