// src/pages/LipstickMirrorLive.jsx

import React, { useEffect, useRef } from 'react';
import { Camera } from '@mediapipe/camera_utils';
import { FaceMesh } from '@mediapipe/face_mesh';

import initWebGPU from '@/utils/initWebGPU.js';
import createPipeline from '@/utils/createPipeline.js';
import lipstickShader from '@/shaders/lipstickEffect.wgsl?raw';

export default function LipstickMirrorLive() {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const deviceRef = useRef(null);
  const contextRef = useRef(null);

  useEffect(() => {
    const setup = async () => {
      const canvas = canvasRef.current;
      const video = videoRef.current;

      if (!canvas || !video) {
        console.error("Canvas or video not found");
        return;
      }

      const { device, context, format } = await initWebGPU(canvas);
      deviceRef.current = device;
      contextRef.current = context;

      const faceMesh = new FaceMesh({
        locateFile: (file) =>
          `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/${file}`,
      });

      faceMesh.setOptions({
        maxNumFaces: 1,
        refineLandmarks: true,
        minDetectionConfidence: 0.5,
        minTrackingConfidence: 0.5,
      });

      faceMesh.onResults((results) => {
        // Draw lipstick here
        console.log("Face landmarks:", results.multiFaceLandmarks);
      });

      const camera = new Camera(video, {
        onFrame: async () => {
          await faceMesh.send({ image: video });
        },
        width: 640,
        height: 480,
      });
      camera.start();
    };

    setup();
  }, []);

  return (
    <div className="w-full h-screen flex flex-col items-center justify-center">
      <video ref={videoRef} className="hidden" playsInline />
      <canvas ref={canvasRef} width="640" height="480" />
    </div>
  );
}
