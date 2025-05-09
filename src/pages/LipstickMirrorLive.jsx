import React, { useEffect, useRef } from 'react';
import { FaceLandmarker, FilesetResolver } from '@mediapipe/tasks-vision';
import initWebGPU from '@/utils/initWebGPU'; // ✅ default import
import createPipeline from '@/utils/createPipeline';
import lipTriangles from '@/utils/lipTriangles';

export default function LipstickMirrorLive() {
  const canvasRef = useRef(null);
  const videoRef = useRef(null);

  useEffect(() => {
    let animationFrameId;
    let faceLandmarker;
    let device, context, format, pipeline;

    const render = async () => {
      if (!videoRef.current || videoRef.current.readyState < 2) {
        animationFrameId = requestAnimationFrame(render);
        return;
      }

      const faces = faceLandmarker.detect(videoRef.current);
      const landmarks = faces?.landmarks?.[0];
      if (!landmarks) {
        animationFrameId = requestAnimationFrame(render);
        return;
      }

      const vertices = [];
      const colors = [];

      lipTriangles.forEach(([a, b, c]) => {
        [a, b, c].forEach((index) => {
          const { x, y } = landmarks[index];
          vertices.push((x - 0.5) * 2, (0.5 - y) * 2);
          colors.push(1.0, 1.0, 0.0, 1.0); // yellow
        });
      });

      const vertexBuffer = device.createBuffer({
        size: vertices.length * 4,
        usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
      });
      device.queue.writeBuffer(vertexBuffer, 0, new Float32Array(vertices));

      const colorBuffer = device.createBuffer({
        size: colors.length * 4,
        usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
      });
      device.queue.writeBuffer(colorBuffer, 0, new Float32Array(colors));

      const encoder = device.createCommandEncoder();
      const pass = encoder.beginRenderPass({
        colorAttachments: [{
          view: context.getCurrentTexture().createView(),
          loadOp: 'clear',
          storeOp: 'store',
          clearValue: { r: 0, g: 0, b: 0, a: 1 },
        }],
      });

      pass.setPipeline(pipeline);
      pass.setVertexBuffer(0, vertexBuffer);
      pass.setVertexBuffer(1, colorBuffer);
      pass.draw(vertices.length / 2);
      pass.end();

      device.queue.submit([encoder.finish()]);
      animationFrameId = requestAnimationFrame(render);
    };

    const start = async () => {
      const video = videoRef.current;
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      video.srcObject = stream;
      await video.play();

      const fileset = await FilesetResolver.forVisionTasks(
        'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm'
      );
      faceLandmarker = await FaceLandmarker.createFromOptions(fileset, {
        baseOptions: {
          modelAssetPath: '/models/face_landmarker.task',
          delegate: 'GPU',
        },
        runningMode: 'VIDEO',
        numFaces: 1,
      });

      const webgpu = await initWebGPU(canvasRef.current);
      device = webgpu.device;
      context = webgpu.context;
      format = webgpu.format;
      pipeline = await createPipeline(device, format);

      render();
    };

    start();
    return () => cancelAnimationFrame(animationFrameId);
  }, []);

  return (
    <div className="w-full h-screen relative">
      <video
        ref={videoRef}
        className="absolute top-0 left-0 w-full h-full object-cover"
        playsInline
        muted
        autoPlay
      />
      <canvas
        ref={canvasRef}
        width={720}
        height={1280}
        className="absolute top-0 left-0 w-full h-full"
      />
    </div>
  );
}
