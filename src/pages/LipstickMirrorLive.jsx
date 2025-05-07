import React, { useEffect, useRef } from 'react';
import { loadFaceModel, detectFaceLandmarks } from '../utils/faceTracking';
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

      // Red screen test
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
      passEncoder.draw(6, 1, 0, 0);
      passEncoder.end();
      device.queue.submit([commandEncoder.finish()]);
      console.log('Red screen test draw submitted');

      // Load FaceMesh and detect
      const { faceMesh, videoElement } = await loadFaceModel(video);
      const landmarks = await detectFaceLandmarks({ faceMesh, videoElement });
      console.log('Face landmarks:', landmarks);

      // Future: Add draw effects here using landmarks
    };

    setup();
  }, []);

  return (
    <div className="w-full h-screen flex flex-col items-center justify-center bg-black">
      <video ref={videoRef} autoPlay playsInline className="hidden" />
      <canvas
        ref={canvasRef}
        className="w-full aspect-[9/16] rounded-xl"
      ></canvas>
    </div>
  );
}
