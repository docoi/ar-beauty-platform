import React, { useRef, useEffect } from 'react';
import { Camera } from '@mediapipe/camera_utils';
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

      // Initialize WebGPU
      const { device, context, format } = await initWebGPU(canvas);
      contextRef.current = context;

      const shaderModule = device.createShaderModule({
        code: lipstickShader,
      });

      const pipeline = createPipeline(device, format, shaderModule);

      // Red test draw
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

      // Load FaceMesh model
      const faceMesh = await loadFaceModel(video, (results) => {
        const landmarks = results.multiFaceLandmarks?.[0] || [];
        console.log('Detected landmarks:', landmarks);
        // TODO: Add render logic using landmarks
      });

      // Start Mediapipe camera
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
    <div className="w-full h-screen bg-black flex items-center justify-center">
      <div className="relative w-full max-w-md h-full overflow-hidden border-4 border-gray-200 rounded-xl">
        <video
          ref={videoRef}
          className="absolute inset-0 w-full h-full object-cover z-10"
          autoPlay
          muted
          playsInline
        />
        <canvas
          ref={canvasRef}
          className="absolute inset-0 w-full h-full z-20"
        />
      </div>
    </div>
  );
}
