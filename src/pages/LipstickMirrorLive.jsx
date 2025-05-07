import React, { useEffect, useRef } from 'react';
import { Camera } from '@mediapipe/camera_utils';
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

      // Step 1: Init WebGPU
      const { device, context, format } = await initWebGPU(canvas);
      contextRef.current = context;

      const shaderModule = device.createShaderModule({
        code: lipstickShader,
      });

      const pipeline = createPipeline(device, format, shaderModule);

      // Red test
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
      console.log('✅ Red screen test draw submitted');

      // Step 2: Load face detection model
      const model = await loadFaceModel();

      // Step 3: Start webcam with MediaPipe
      const camera = new Camera(video, {
        onFrame: async () => {
          const landmarks = await detectFaceLandmarks(model, video);
          console.log('Detected landmarks:', landmarks);
          // TODO: Apply lipstick effect here
        },
        width: 640,
        height: 480,
      });

      await camera.start();
    };

    setup();
  }, []);

  return (
    <div className="w-full h-[100dvh] bg-black flex flex-col items-center justify-center">
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        className="w-0 h-0 absolute"
      />
      <canvas
        ref={canvasRef}
        width={640}
        height={480}
        className="w-full h-auto rounded-xl"
      />
    </div>
  );
}
