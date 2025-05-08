import React, { useRef, useEffect } from 'react';
import { loadFaceModel, detectFacelandmarks, drawConnectors, FACEMESH_LIPS } from '../utils/faceTracking';
import initWebGPU from '../utils/initWebGPU';
import createPipeline from '../utils/createPipeline';
import lipstickShader from '../shaders/lipstickEffect.wgsl?raw';

export default function LipstickMirrorLive() {
  const canvasRef = useRef(null);
  const videoRef = useRef(null);
  const contextRef = useRef(null);

  useEffect(() => {
    const setup = async () => {
      console.log('🔧 Initializing Lipstick Mirror');

      const canvas = canvasRef.current;
      const video = videoRef.current;

      if (!canvas || !video) {
        console.error('Canvas or video element is missing.');
        return;
      }

      // Set video dimensions
      video.width = 640;
      video.height = 480;

      // Get camera stream
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true });
        video.srcObject = stream;
        await video.play();
        console.log('📷 Camera started');
      } catch (err) {
        console.error('Camera access failed:', err);
        return;
      }

      // Load face model
      await loadFaceModel();
      console.log('✅ Face model loaded');

      // Detect landmarks
      const landmarks = await detectFacelandmarks(video);
      console.log('🔍 Detected landmarks:', landmarks);

      // Initialize WebGPU
      const { device, context, format } = await initWebGPU(canvas);
      contextRef.current = context;

      const shaderModule = device.createShaderModule({ code: lipstickShader });
      const pipeline = createPipeline(device, format, shaderModule);

      // Render to canvas
      const renderPassDescriptor = {
        colorAttachments: [{
          view: context.getCurrentTexture().createView(),
          clearValue: { r: 1, g: 0, b: 0, a: 1 }, // Red for debug
          loadOp: 'clear',
          storeOp: 'store',
        }],
      };

      const commandEncoder = device.createCommandEncoder();
      const passEncoder = commandEncoder.beginRenderPass(renderPassDescriptor);
      passEncoder.setPipeline(pipeline);
      passEncoder.draw(3, 1, 0, 0);
      passEncoder.end();

      device.queue.submit([commandEncoder.finish()]);
      console.log('🖼️ Frame rendered');

      // Optional: Draw landmarks on top using 2D overlay if needed
      // drawConnectors(canvas.getContext('2d'), landmarks, FACEMESH_LIPS, { color: 'white' });
    };

    setup();
  }, []);

  return (
    <div className="w-full h-screen flex flex-col items-center justify-center bg-black">
      <video ref={videoRef} style={{ display: 'none' }} playsInline muted />
      <canvas
        ref={canvasRef}
        className="w-full h-full rounded-lg"
      />
    </div>
  );
}
