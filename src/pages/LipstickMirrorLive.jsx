// src/pages/LipstickMirrorLive.jsx

import React, { useRef, useEffect } from 'react';
import initWebGPU from '../utils/initWebGPU';
import createPipeline from '../utils/createPipeline';
import { FaceLandmarker, FilesetResolver } from '@mediapipe/tasks-vision';
import lipTriangles from '../utils/lipTriangles';
import shaderCode from '../shaders/lipstickEffect.wgsl?raw';

export default function LipstickMirrorLive() {
  const canvasRef = useRef(null);
  const videoRef = useRef(null);

  useEffect(() => {
    const start = async () => {
      console.log('Initializing Lipstick Mirror');
      const canvas = canvasRef.current;
      const video = videoRef.current;

      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      video.srcObject = stream;
      await video.play();

      const fileset = await FilesetResolver.forVisionTasks(
        '/models' // or the correct local path
      );

      const faceLandmarker = await FaceLandmarker.createFromOptions(fileset, {
        baseOptions: {
          modelAssetPath: '/models/face_landmarker.task',
          delegate: 'GPU',
        },
        outputFaceBlendshapes: false,
        outputFacialTransformationMatrixes: false,
        runningMode: 'VIDEO',
        numFaces: 1,
      });

      const { device, context, format } = await initWebGPU(canvas);
      const pipeline = await createPipeline(device, format, shaderCode);

      const vertexBuffer = device.createBuffer({
        size: 1024 * 1024,
        usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
      });

      const render = async () => {
        const results = await faceLandmarker.detectForVideo(video, Date.now());

        if (results.faceLandmarks.length > 0) {
          const landmarks = results.faceLandmarks[0];

          const vertices = lipTriangles.flatMap(tri =>
            tri.map(index => {
              const point = landmarks[index];
              return [point.x * 2 - 1, -(point.y * 2 - 1)];
            })
          ).flat();

          device.queue.writeBuffer(vertexBuffer, 0, new Float32Array(vertices));

          const encoder = device.createCommandEncoder();
          const pass = encoder.beginRenderPass({
            colorAttachments: [
              {
                view: context.getCurrentTexture().createView(),
                clearValue: { r: 0, g: 0, b: 0, a: 1 },
                loadOp: 'clear',
                storeOp: 'store',
              },
            ],
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
    <div className="w-full h-full relative">
      <video
        ref={videoRef}
        className="absolute top-0 left-0 w-full h-full object-cover"
        muted
        playsInline
      />
      <canvas
        ref={canvasRef}
        className="absolute top-0 left-0 w-full h-full"
      />
    </div>
  );
}
