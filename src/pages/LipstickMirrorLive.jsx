// src/components/LipstickMirrorLive.jsx

import React, { useEffect, useRef } from 'react';
import initWebGPU from '../utils/initWebGPU';
import createPipeline from '../utils/createPipeline';
import lipstickShader from '../shaders/lipstickEffect.wgsl?raw';
import { setupFaceLandmarker, LIP_INDICES, LIP_TRIANGLES } from '../utils/faceTracking';

export default function LipstickMirrorLive() {
  const canvasRef = useRef(null);
  const videoRef = useRef(null);

  useEffect(() => {
    const start = async () => {
      const canvas = canvasRef.current;
      const video = videoRef.current;

      // Start webcam
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      video.srcObject = stream;
      await video.play();

      // Load face landmark model
      const faceLandmarker = await setupFaceLandmarker();

      const { device, context, format } = await initWebGPU(canvas);
      const pipeline = await createPipeline(device, format, lipstickShader);

      const vertexBuffer = device.createBuffer({
        size: 1024,
        usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
      });

      const render = async () => {
        const results = await faceLandmarker.detectForVideo(video, Date.now());
        const landmarks = results?.faceLandmarks?.[0];

        if (landmarks) {
          const vertices = [];
          for (const [i0, i1, i2] of LIP_TRIANGLES) {
            [i0, i1, i2].forEach((idx) => {
              const pt = landmarks[LIP_INDICES[idx]];
              const x = (pt.x - 0.5) * 2;
              const y = (0.5 - pt.y) * 2;
              vertices.push(x, y);
            });
          }

          const vertexData = new Float32Array(vertices);
          device.queue.writeBuffer(vertexBuffer, 0, vertexData.buffer);

          const encoder = device.createCommandEncoder();
          const pass = encoder.beginRenderPass({
            colorAttachments: [
              {
                view: context.getCurrentTexture().createView(),
                clearValue: { r: 0, g: 0, b: 0, a: 0 },
                loadOp: 'clear',
                storeOp: 'store',
              },
            ],
          });

          pass.setPipeline(pipeline);
          pass.setVertexBuffer(0, vertexBuffer);
          pass.draw(vertexData.length / 2, 1, 0, 0);
          pass.end();

          device.queue.submit([encoder.finish()]);
        }

        requestAnimationFrame(render);
      };

      render();
    };

    start();
  }, []);

  return (
    <div className="w-full h-full relative">
      <video
        ref={videoRef}
        className="absolute top-0 left-0 w-full h-full object-cover"
        muted
        playsInline
      ></video>
      <canvas ref={canvasRef} className="absolute top-0 left-0 w-full h-full" />
    </div>
  );
}
