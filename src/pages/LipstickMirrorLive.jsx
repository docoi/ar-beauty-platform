import React, { useEffect, useRef } from 'react';
import { detectFaceLandmarks } from '../utils/faceTracking';
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

      // Init WebGPU
      const { device, context, format } = await initWebGPU(canvas);
      contextRef.current = context;

      const shaderModule = device.createShaderModule({
        code: lipstickShader,
      });

      const pipeline = createPipeline(device, format, shaderModule);

      // Red fill test
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

      // Start Mediapipe
      detectFaceLandmarks(video, (results) => {
        console.log('Face landmarks:', results.multiFaceLandmarks);
        // You can add your lipstick drawing logic here
      });
    };

    setup();
  }, []);

  return (
    <div className="flex flex-col items-center justify-center h-screen bg-black">
      <video
        ref={videoRef}
        autoPlay
        playsInline
        className="absolute w-full h-full object-cover"
      />
      <canvas
        ref={canvasRef}
        className="absolute w-full h-full pointer-events-none"
      />
    </div>
  );
}
