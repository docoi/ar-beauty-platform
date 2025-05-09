import React, { useEffect, useRef } from 'react';
import initWebGPU from '../utils/initWebGPU';
import createPipeline from '../utils/createPipeline';
import { FaceLandmarker, FilesetResolver } from '@mediapipe/tasks-vision';
import lipTriangles from '../utils/lipTriangles';

export default function LipstickMirrorLive() {
  const canvasRef = useRef(null);
  const videoRef = useRef(null);

  useEffect(() => {
    const start = async () => {
      const canvas = canvasRef.current;
      const video = videoRef.current;

      // Setup camera
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      video.srcObject = stream;
      await video.play();

      // Load face landmark model
      const fileset = await FilesetResolver.forVisionTasks(
        'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision/wasm'
      );
      const faceLandmarker = await FaceLandmarker.createFromOptions(fileset, {
        baseOptions: {
          modelAssetPath: '/models/face_landmarker.task',
          delegate: 'GPU',
        },
        runningMode: 'VIDEO',
        numFaces: 1,
      });

      // WebGPU
      const { device, context, format } = await initWebGPU(canvas);
      const pipeline = await createPipeline(device, format);

      const render = async () => {
        const results = await faceLandmarker.detectForVideo(video, Date.now());

        const encoder = device.createCommandEncoder();
        const textureView = context.getCurrentTexture().createView();
        const pass = encoder.beginRenderPass({
          colorAttachments: [
            {
              view: textureView,
              clearValue: { r: 0, g: 0, b: 0, a: 1 },
              loadOp: 'clear',
              storeOp: 'store',
            },
          ],
        });

        if (results.faceLandmarks.length > 0) {
          const landmarks = results.faceLandmarks[0];
          const vertices = lipTriangles.flatMap(([a, b, c]) => [
            landmarks[a].x * 2 - 1, -(landmarks[a].y * 2 - 1),
            landmarks[b].x * 2 - 1, -(landmarks[b].y * 2 - 1),
            landmarks[c].x * 2 - 1, -(landmarks[c].y * 2 - 1),
          ]);

          const vertexBuffer = device.createBuffer({
            size: vertices.length * 4,
            usage: GPUBufferUsage.VERTEX,
            mappedAtCreation: true,
          });

          new Float32Array(vertexBuffer.getMappedRange()).set(vertices);
          vertexBuffer.unmap();

          pass.setPipeline(pipeline);
          pass.setVertexBuffer(0, vertexBuffer);
          pass.draw(vertices.length / 2, 1, 0, 0);
        }

        pass.end();
        device.queue.submit([encoder.finish()]);
        requestAnimationFrame(render);
      };

      render();
    };

    start();
  }, []);

  return (
    <div className="w-full h-full relative">
      <video ref={videoRef} className="absolute top-0 left-0 w-full h-full object-cover" muted playsInline />
      <canvas ref={canvasRef} className="absolute top-0 left-0 w-full h-full" />
    </div>
  );
}
