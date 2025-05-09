import React, { useEffect, useRef } from 'react';
import initWebGPU from '../utils/initWebGPU';
import createPipeline from '../utils/createPipeline';
import lipTriangles from '../utils/lipTriangles';
import { FaceLandmarker, FilesetResolver } from '@mediapipe/tasks-vision';

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
        outputFaceBlendshapes: false,
        outputFacialTransformationMatrixes: false,
        runningMode: 'VIDEO',
        numFaces: 1,
      });

      const { device, context, format, videoTexture, uploadVideoFrame } = await initWebGPU(video, canvas);
      const pipeline = await createPipeline(device, format);

      const render = async () => {
        uploadVideoFrame();

        const results = await faceLandmarker.detectForVideo(video, Date.now());
        const landmarks = results?.faceLandmarks?.[0];

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

        pass.setPipeline(pipeline);
        pass.setBindGroup(0, pipeline.bindGroup);
        pass.setVertexBuffer(0, pipeline.vertexBuffer);
        pass.setFragmentTexture(0, videoTexture);

        if (landmarks) {
          const lipVerts = [];
          for (let tri of lipTriangles) {
            for (let i = 0; i < 3; i++) {
              const pt = landmarks[tri[i]];
              lipVerts.push(pt.x * 2 - 1, -(pt.y * 2 - 1)); // NDC
            }
          }
          device.queue.writeBuffer(pipeline.vertexBuffer, 0, new Float32Array(lipVerts));
          pass.draw(lipVerts.length / 2, 1, 0, 0);
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
      <video ref={videoRef} className="hidden" muted playsInline />
      <canvas ref={canvasRef} className="absolute top-0 left-0 w-full h-full" />
    </div>
  );
}
