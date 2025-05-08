import React, { useRef, useEffect } from 'react';
import * as mpCamera from '@mediapipe/camera_utils';
import { loadFaceModel } from '../utils/faceTracking';
import initWebGPU from '../utils/initWebGPU';
import createPipeline from '../utils/createPipeline';
import lipstickShader from '../shaders/lipstickEffect.wgsl?raw';

export default function LipstickMirrorLive() {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const contextRef = useRef(null);

  useEffect(() => {
    const setup = async () => {
      const canvas = canvasRef.current;
      const video = videoRef.current;

      if (!canvas || !video) {
        console.error('Canvas or video not found');
        return;
      }

      const { device, context, format } = await initWebGPU(canvas);
      contextRef.current = context;

      const shaderModule = device.createShaderModule({ code: lipstickShader });
      const pipeline = createPipeline(device, format, shaderModule);

      const renderPassDescriptor = {
        colorAttachments: [
          {
            view: context.getCurrentTexture().createView(),
            clearValue: { r: 1, g: 0, b: 0, a: 1 },
            loadOp: 'clear',
            storeOp: 'store',
          },
        ],
      };

      const commandEncoder = device.createCommandEncoder();
      const passEncoder = commandEncoder.beginRenderPass(renderPassDescriptor);
      passEncoder.setPipeline(pipeline);
      passEncoder.draw(3, 1, 0, 0);
      passEncoder.end();
      device.queue.submit([commandEncoder.finish()]);
      console.log('Red screen test draw submitted');

      // Load model
      await loadFaceModel();

      // Check Camera is defined
      if (typeof mpCamera.Camera !== 'function') {
        console.error('mpCamera.Camera is not a constructor. Import issue.');
        console.log('mpCamera:', mpCamera);
        return;
      }

      const camera = new mpCamera.Camera(video, {
        onFrame: async () => {
          console.log('Frame received');
        },
        width: 640,
        height: 480,
      });

      camera.start();
    };

    setup();
  }, []);

  return (
    <div className="w-full h-full flex justify-center items-center bg-black">
      <video
        ref={videoRef}
        className="hidden"
        autoPlay
        playsInline
        muted
        width="640"
        height="480"
      />
      <canvas ref={canvasRef} className="rounded-xl w-full h-full" />
    </div>
  );
}
