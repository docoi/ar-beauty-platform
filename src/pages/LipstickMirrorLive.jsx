import React, { useRef, useEffect } from 'react';
import { loadFaceModel, detectFacelandmarks } from '../utils/faceTracking';
import initWebGPU from '../utils/initWebGPU';
import createPipeline from '../utils/createPipeline';
import lipstickShader from '../shaders/lipstickEffect.wgsl?raw';

export default function LipstickMirrorLive() {
  const canvasRef = useRef(null);
  const videoRef = useRef(null);
  const contextRef = useRef(null);
  const deviceRef = useRef(null);
  const pipelineRef = useRef(null);
  const vertexBufferRef = useRef(null);

  useEffect(() => {
    const setup = async () => {
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

      // Initialize WebGPU
      const { device, context, format } = await initWebGPU(canvas);
      contextRef.current = context;
      deviceRef.current = device;

      const shaderModule = device.createShaderModule({ code: lipstickShader });
      const pipeline = createPipeline(device, format, shaderModule);
      pipelineRef.current = pipeline;

      // Start rendering loop
      requestAnimationFrame(render);
    };

    const render = async () => {
      const device = deviceRef.current;
      const context = contextRef.current;
      const pipeline = pipelineRef.current;
      const video = videoRef.current;

      if (!device || !context || !pipeline || !video) {
        requestAnimationFrame(render);
        return;
      }

      // Detect landmarks
      const landmarks = await detectFacelandmarks(video);
      if (landmarks) {
        // Extract lip landmarks (example indices for lips)
        const lipIndices = [
          61, 146, 91, 181, 84, 17, 314, 405, 321, 375,
          291, 308, 324, 318, 402, 317, 14, 87, 178, 88,
          95, 185, 40, 39, 37, 0, 267, 269, 270, 409,
          415, 310, 311, 312, 13, 82, 81, 42, 183, 78
        ];
        const lipLandmarks = lipIndices.map(index => landmarks[index]);

        // Convert to clip space coordinates (-1 to 1)
        const positions = lipLandmarks.map(point => {
          const x = (point.x - 0.5) * 2;
          const y = (0.5 - point.y) * 2;
          return [x, y];
        });

        // Flatten the positions array
        const flattenedPositions = positions.flat();

        // Create or update vertex buffer
        const vertexBuffer = device.createBuffer({
          size: flattenedPositions.length * 4,
          usage: GPUBufferUsage.VERTEX,
          mappedAtCreation: true,
        });

        new Float32Array(vertexBuffer.getMappedRange()).set(flattenedPositions);
        vertexBuffer.unmap();
        vertexBufferRef.current = vertexBuffer;

        // Render to canvas
        const renderPassDescriptor = {
          colorAttachments: [{
            view: context.getCurrentTexture().createView(),
            clearValue: { r: 0, g: 0, b: 0, a: 1 },
            loadOp: 'clear',
            storeOp: 'store',
          }],
        };

        const commandEncoder = device.createCommandEncoder();
        const passEncoder = commandEncoder.beginRenderPass(renderPassDescriptor);
        passEncoder.setPipeline(pipeline);
        passEncoder.setVertexBuffer(0, vertexBuffer);
        passEncoder.draw(positions.length, 1, 0, 0);
        passEncoder.end();

        device.queue.submit([commandEncoder.finish()]);
      }

      requestAnimationFrame(render);
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
