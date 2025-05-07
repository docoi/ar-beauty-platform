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

      // Initialize WebGPU
      const { device, context, format } = await initWebGPU(canvas);
      contextRef.current = context;

      // Create render pipeline
      const shaderModule = device.createShaderModule({
        code: lipstickShader,
      });
      const pipeline = createPipeline(device, format, shaderModule);

      // Load face model
      const model = await loadFaceModel();

      // Start MediaPipe camera
      const camera = new Camera(video, {
        onFrame: async () => {
          await camera.send({ image: video });

          const landmarks = await detectFaceLandmarks(video);
          console.log('LIP landmarks:', landmarks);

          const commandEncoder = device.createCommandEncoder();
          const textureView = context.getCurrentTexture().createView();
          const renderPass = commandEncoder.beginRenderPass({
            colorAttachments: [
              {
                view: textureView,
                loadOp: 'clear',
                storeOp: 'store',
                clearValue: { r: 1, g: 0, b: 0, a: 1 }, // red canvas for test
              },
            ],
          });

          renderPass.setPipeline(pipeline);
          renderPass.draw(6, 1, 0, 0);
          renderPass.end();
          device.queue.submit([commandEncoder.finish()]);
        },
        width: 640,
        height: 480,
      });

      camera.start();
    };

    setup();
  }, []);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
      <video ref={videoRef} style={{ display: 'none' }} autoPlay playsInline muted />
      <canvas ref={canvasRef} width="640" height="480" style={{ border: '1px solid black' }} />
    </div>
  );
}
