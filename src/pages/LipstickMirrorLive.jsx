// src/components/LipstickMirrorLive.jsx
import React, { useEffect, useRef } from 'react';
import initWebGPU from '../utils/initWebGPU';
import createPipeline from '../utils/createPipeline';
import { FaceLandmarker, FilesetResolver } from '@mediapipe/tasks-vision';
import lipTriangles from '../utils/lipTriangulation';

export default function LipstickMirrorLive() {
  const canvasRef = useRef(null);
  const videoRef = useRef(null);

  useEffect(() => {
    const start = async () => {
      console.log('Initializing Lipstick Mirror');
      const canvas = canvasRef.current;
      const video = videoRef.current;

      // Start video stream
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      video.srcObject = stream;
      await video.play();

      // Load MediaPipe face landmark model
      const fileset = await FilesetResolver.forVisionTasks('/models');
      const faceLandmarker = await FaceLandmarker.createFromOptions(fileset, {
        baseOptions: {
          modelAssetPath: '/models/face_landmarker.task',
          delegate: 'GPU'
        },
        runningMode: 'VIDEO',
        numFaces: 1,
      });

      const { device, context, format } = await initWebGPU(canvas);
      const pipeline = await createPipeline(device, format);

      const render = async () => {
        const results = await faceLandmarker.detectForVideo(video, Date.now());
        if (results?.faceLandmarks?.length > 0) {
          const lips = results.faceLandmarks[0];
          const vertices = new Float32Array(lipTriangles.flatMap(([a, b, c]) => [
            lips[a].x * 2 - 1, -(lips[a].y * 2 - 1),
            lips[b].x * 2 - 1, -(lips[b].y * 2 - 1),
            lips[c].x * 2 - 1, -(lips[c].y * 2 - 1)
          ]));

          const vertexBuffer = device.createBuffer({
            size: vertices.byteLength,
            usage: GPUBufferUsage.VERTEX,
            mappedAtCreation: true
          });
          new Float32Array(vertexBuffer.getMappedRange()).set(vertices);
          vertexBuffer.unmap();

          const encoder = device.createCommandEncoder();
          const pass = encoder.beginRenderPass({
            colorAttachments: [{
              view: context.getCurrentTexture().createView(),
              loadOp: 'clear',
              storeOp: 'store',
              clearValue: { r: 0, g: 0, b: 0, a: 1 }
            }]
          });

          pass.setPipeline(pipeline);
          pass.setVertexBuffer(0, vertexBuffer);
          pass.draw(vertices.length / 2, 1, 0, 0);
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
    <div className="relative w-full h-full">
      <video ref={videoRef} className="absolute w-full h-full object-cover" muted autoPlay playsInline />
      <canvas ref={canvasRef} className="absolute w-full h-full" />
    </div>
  );
}
