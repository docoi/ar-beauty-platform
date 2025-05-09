import React, { useEffect, useRef } from 'react';
import initWebGPU from '../utils/initWebGPU';
import createPipeline from '../utils/createPipeline';
import lipstickShader from '../shaders/lipstickEffect.wgsl?raw';
import { FaceLandmarker, FilesetResolver } from '@mediapipe/tasks-vision';

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
      const pipeline = await createPipeline(device, format, lipstickShader);

      const drawFrame = async () => {
        const results = await faceLandmarker.detectForVideo(video, Date.now());
        if (!results || results.faceLandmarks.length === 0) {
          requestAnimationFrame(drawFrame);
          return;
        }

        const lips = results.faceLandmarks[0].filter((_, i) =>
          // Outer lips: 61–80, Inner lips: 81–100 in FaceMesh
          (i >= 61 && i <= 80) || (i >= 81 && i <= 100)
        );

        const encoder = device.createCommandEncoder();
        const textureView = context.getCurrentTexture().createView();
        const pass = encoder.beginRenderPass({
          colorAttachments: [{
            view: textureView,
            clearValue: { r: 0, g: 0, b: 0, a: 1 },
            loadOp: 'clear',
            storeOp: 'store',
          }],
        });

        pass.setPipeline(pipeline);
        pass.draw(lips.length, 1, 0, 0); // crude render; will update to indexed triangles
        pass.end();

        device.queue.submit([encoder.finish()]);
        requestAnimationFrame(drawFrame);
      };

      drawFrame();
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
