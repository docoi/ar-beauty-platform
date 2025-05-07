import React, { useEffect, useRef } from 'react';
import { Camera } from '@mediapipe/camera_utils';
import { FaceMesh } from '@mediapipe/face_mesh';
import initWebGPU from '@utils/initWebGPU';
import createPipeline from '@utils/createPipeline';
import lipstickShader from '@shaders/lipstickEffect.wgsl?raw';

export default function LipstickMirrorLive() {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const contextRef = useRef(null);
  const deviceRef = useRef(null);
  const pipelineRef = useRef(null);

  useEffect(() => {
    const setup = async () => {
      const canvas = canvasRef.current;
      const video = videoRef.current;

      if (!canvas || !video) {
        console.error('Canvas or video element missing.');
        return;
      }

      // Init WebGPU
      const { device, context, format } = await initWebGPU(canvas);
      contextRef.current = context;
      deviceRef.current = device;

      const shaderModule = device.createShaderModule({ code: lipstickShader });
      const pipeline = createPipeline(device, format, shaderModule);
      pipelineRef.current = pipeline;

      // Force red draw immediately
      const encoder = device.createCommandEncoder();
      const pass = encoder.beginRenderPass({
        colorAttachments: [
          {
            view: context.getCurrentTexture().createView(),
            loadOp: 'clear',
            storeOp: 'store',
            clearValue: { r: 0, g: 0, b: 0, a: 1 }, // black base
          },
        ],
      });
      pass.setPipeline(pipeline);
      pass.draw(6, 1, 0, 0); // Fullscreen draw
      pass.end();
      device.queue.submit([encoder.finish()]);
      console.log('✅ Red screen test draw submitted');

      // FaceMesh setup
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
        if (
          !results.multiFaceLandmarks ||
          results.multiFaceLandmarks.length === 0
        ) {
          console.warn('⚠️ No face detected');
          return;
        }

        const landmarks = results.multiFaceLandmarks[0];
        if (!landmarks) {
          console.warn('⚠️ Face landmarks missing');
          return;
        }

        console.log('✅ Face landmarks detected');

        const commandEncoder = device.createCommandEncoder();
        const renderPass = commandEncoder.beginRenderPass({
          colorAttachments: [
            {
              view: context.getCurrentTexture().createView(),
              loadOp: 'clear',
              storeOp: 'store',
              clearValue: { r: 0.2, g: 0.2, b: 0.2, a: 1 }, // different shade
            },
          ],
        });

        renderPass.setPipeline(pipeline);
        renderPass.draw(6, 1, 0, 0); // still just testing
        renderPass.end();

        device.queue.submit([commandEncoder.finish()]);
      });

      // Start camera
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
    <div className="w-full h-full flex justify-center items-center">
      <video
        ref={videoRef}
        className="hidden"
        autoPlay
        playsInline
        muted
        width="640"
        height="480"
      />
      <canvas
        ref={canvasRef}
        width="640"
        height="480"
        className="border"
      />
    </div>
  );
}
