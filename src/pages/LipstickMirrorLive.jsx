// src/components/LipstickMirrorLive.jsx

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
          modelAssetPath:
            '/face_landmarker.task', // Local path assumed now — already working
          delegate: 'GPU',
        },
        outputFaceBlendshapes: false,
        outputFacialTransformationMatrixes: false,
        runningMode: 'VIDEO',
        numFaces: 1,
      });

      const { device, context, format } = await initWebGPU(canvas);
      const pipeline = await createPipeline(device, format, lipstickShader);

      const render = async () => {
        const now = Date.now();
        const results = await faceLandmarker.detectForVideo(video, now);

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

        // Optional: Pass in uniforms for lip detection later here
        pass.draw(6, 1, 0, 0); // We will soon limit this to lip region
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
      <video
        ref={videoRef}
        className="absolute top-0 left-0 w-full h-full object-cover"
        muted
        playsInline
      ></video>
      <canvas
        ref={canvasRef}
        className="absolute top-0 left-0 w-full h-full"
      />
    </div>
  );
}
