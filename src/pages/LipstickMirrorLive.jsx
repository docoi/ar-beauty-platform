import React, { useRef, useEffect } from 'react';
import { loadFaceModel, detectFacelandmarks } from '../utils/faceTracking';
import initWebGPU from '../utils/initWebGPU';
import createPipeline from '../utils/createPipeline';
import lipstickShader from '../shaders/lipstickEffect.wgsl?raw';

export default function LipstickMirrorLive() {
  const canvasRef = useRef(null);
  const videoRef = useRef(null);
  const contextRef = useRef(null);

  useEffect(() => {
    const setup = async () => {
      console.log('🔁 Initializing Lipstick Mirror');

      const canvas = canvasRef.current;
      const video = videoRef.current;
      if (!canvas || !video) {
        console.error('Canvas or video not found');
        return;
      }

      try {
        await loadFaceModel();
        console.log('✅ Face model loaded');

        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'user' },
        });

        video.srcObject = stream;
        await video.play();

        console.log('📷 Camera started');

        const { device, context, format } = await initWebGPU(canvas);
        contextRef.current = context;

        const shaderModule = device.createShaderModule({
          code: lipstickShader,
        });

        const pipeline = createPipeline(device, format, shaderModule);

        const render = async () => {
          const landmarks = await detectFacelandmarks(video);
          if (landmarks) {
            // Your future rendering logic here with landmarks
          }

          const renderPassDescriptor = {
            colorAttachments: [
              {
                view: context.getCurrentTexture().createView(),
                clearValue: { r: 0, g: 0, b: 0, a: 1 },
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
          requestAnimationFrame(render);
        };

        requestAnimationFrame(render);
      } catch (error) {
        console.error('❌ Error during setup:', error);
      }
    };

    setup();
  }, []);

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-black text-white">
      <video ref={videoRef} className="hidden" playsInline muted></video>
      <canvas ref={canvasRef} className="w-full h-auto aspect-[3/4]" />
    </div>
  );
}
