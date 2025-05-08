import React, { useRef, useEffect } from 'react';
import * as mpCamera from '@mediapipe/camera_utils'; // ✅ Correct import
import { loadFaceModel, detectFacelandmarks } from '../utils/faceTracking';
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

      console.log('🎥 Video and canvas elements ready');

      // Step 1: Init WebGPU
      const { device, context, format } = await initWebGPU(canvas);
      contextRef.current = context;

      const shaderModule = device.createShaderModule({
        code: lipstickShader,
      });

      const pipeline = createPipeline(device, format, shaderModule);

      // Red test background
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

      console.log('✅ Red screen test draw submitted');

      // Step 2: Load face mesh model
      await loadFaceModel();

      // Step 3: Start camera
      const camera = new mpCamera.Camera(video, {
        onFrame: async () => {
          const landmarks = await detectFacelandmarks(video);
          console.log('📍 Face landmarks:', landmarks);
        },
        width: 640,
        height: 480,
      });

      await camera.start();
      console.log('📹 MediaPipe camera started');
    };

    setup();
  }, []);

  return (
    <div className="w-full h-screen flex flex-col items-center justify-center bg-black">
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        className="absolute w-full h-full object-cover z-0"
      />
      <canvas
        ref={canvasRef}
        className="absolute w-full h-full z-10 rounded-xl"
      />
    </div>
  );
}
