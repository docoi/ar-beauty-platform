import React, { useRef, useEffect } from 'react';
import Camera from '@mediapipe/camera_utils'; // ✅ default import – FIXED
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

      // Step 1: Init WebGPU
      const { device, context, format } = await initWebGPU(canvas);
      contextRef.current = context;

      const shaderModule = device.createShaderModule({
        code: lipstickShader,
      });

      const pipeline = createPipeline(device, format, shaderModule);

      // Step 2: Red test (confirm canvas renders)
      const renderPassDescriptor = {
        colorAttachments: [
          {
            view: context.getCurrentTexture().createView(),
            clearValue: { r: 1, g: 0, b: 0, a: 1 }, // red
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

      // Step 3: Load face detection model
      await loadFaceModel();
      console.log('Face model loaded');

      // Step 4: Start camera
      const camera = new Camera(video, {
        onFrame: async () => {
          const landmarks = await detectFacelandmarks(video);
          console.log('Landmarks:', landmarks);
        },
        width: 640,
        height: 480,
      });

      await camera.start();
      console.log('Camera started');
    };

    setup();
  }, []);

  return (
    <div className="w-full h-screen bg-black flex flex-col items-center justify-center">
      <video ref={videoRef} autoPlay playsInline className="hidden" />
      <canvas ref={canvasRef} className="w-full h-full rounded-md" />
    </div>
  );
}
