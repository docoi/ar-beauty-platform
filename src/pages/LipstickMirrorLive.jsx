import React, { useRef, useEffect } from 'react';
import initWebGPU from '../utils/initWebGPU';
import createPipeline from '../utils/createPipeline';
import { FaceLandmarker, FilesetResolver } from '@mediapipe/tasks-vision';
import lipTriangles from '../utils/lipTriangulation';

export default function LipstickMirrorLive() {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);

  useEffect(() => {
    const start = async () => {
      console.log('Initializing Lipstick Mirror');

      const video = videoRef.current;
      const canvas = canvasRef.current;

      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      video.srcObject = stream;
      await video.play();

      const fileset = await FilesetResolver.forVisionTasks('/models');
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
      const pipeline = await createPipeline(device, format);

      const render = async () => {
        const results = await faceLandmarker.detectForVideo(video, Date.now());
        const landmarks = results?.faceLandmarks?.[0];

        if (!landmarks) {
          requestAnimationFrame(render);
          return;
        }

        const vertices = [];
        for (const tri of lipTriangles) {
          for (const i of tri) {
            const { x, y } = landmarks[i];
            vertices.push(2 * x - 1, 1 - 2 * y); // clip space conversion
          }
        }

        const vertexBuffer = device.createBuffer({
          size: vertices.length * 4,
          usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
          mappedAtCreation: true,
        });

        new Float32Array(vertexBuffer.getMappedRange()).set(vertices);
        vertexBuffer.unmap();

        const encoder = device.createCommandEncoder();
        const pass = encoder.beginRenderPass({
          colorAttachments: [{
            view: context.getCurrentTexture().createView(),
            loadOp: 'clear',
            storeOp: 'store',
            clearValue: { r: 0, g: 0, b: 0, a: 1 },
          }],
        });

        pass.setPipeline(pipeline);
        pass.setVertexBuffer(0, vertexBuffer);
        pass.draw(vertices.length / 2, 1, 0, 0);
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
      <video ref={videoRef} className="absolute inset-0 w-full h-full object-cover" muted autoPlay playsInline />
      <canvas ref={canvasRef} className="absolute inset-0 w-full h-full" />
    </div>
  );
}
