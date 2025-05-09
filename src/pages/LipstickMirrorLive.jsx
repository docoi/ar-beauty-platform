import React, { useEffect, useRef } from 'react';
import initWebGPU from '@/utils/initWebGPU';
import createPipeline from '@/utils/createPipeline';
import lipTriangles from '@/utils/lipTriangles';
import lipstickShader from '@/shaders/lipstickEffect.wgsl?raw';
import { FaceLandmarker, FilesetResolver } from '@mediapipe/tasks-vision';

export default function LipstickMirrorLive() {
  const canvasRef = useRef(null);
  const videoRef = useRef(null);

  useEffect(() => {
    let animationId;

    const setup = async () => {
      const video = videoRef.current;
      const canvas = canvasRef.current;

      // Start camera
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      video.srcObject = stream;
      await video.play();

      const fileset = await FilesetResolver.forVisionTasks(
        'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision/wasm'
      );
      const faceLandmarker = await FaceLandmarker.createFromOptions(fileset, {
        baseOptions: {
          modelAssetPath: '/models/face_landmarker.task',
          delegate: 'GPU',
        },
        runningMode: 'VIDEO',
        numFaces: 1,
      });

      const { device, context, format } = await initWebGPU(canvas);
      const pipeline = await createPipeline(device, format, lipstickShader);

      const colorUniform = device.createBuffer({
        size: 16,
        usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
      });
      device.queue.writeBuffer(colorUniform, 0, new Float32Array([1.0, 1.0, 0.0, 1.0])); // Yellow

      const vertexBuffer = device.createBuffer({
        size: 65536,
        usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
      });

      const render = async () => {
        const results = await faceLandmarker.detectForVideo(video, performance.now());

        if (results.faceLandmarks.length > 0) {
          const landmarks = results.faceLandmarks[0];
          const width = canvas.width;
          const height = canvas.height;

          const triangles = lipTriangles.flatMap(([a, b, c]) => {
            return [
              (landmarks[a].x * 2 - 1), -(landmarks[a].y * 2 - 1),
              (landmarks[b].x * 2 - 1), -(landmarks[b].y * 2 - 1),
              (landmarks[c].x * 2 - 1), -(landmarks[c].y * 2 - 1),
            ];
          });

          const vertices = new Float32Array(triangles);
          device.queue.writeBuffer(vertexBuffer, 0, vertices);

          const encoder = device.createCommandEncoder();
          const pass = encoder.beginRenderPass({
            colorAttachments: [{
              view: context.getCurrentTexture().createView(),
              clearValue: { r: 0, g: 0, b: 0, a: 0 },
              loadOp: 'clear',
              storeOp: 'store',
            }],
          });

          pass.setPipeline(pipeline);
          pass.setVertexBuffer(0, vertexBuffer);
          pass.setBindGroup(0, device.createBindGroup({
            layout: pipeline.getBindGroupLayout(0),
            entries: [{ binding: 0, resource: { buffer: colorUniform } }],
          }));
          pass.draw(vertices.length / 2, 1, 0, 0);
          pass.end();

          device.queue.submit([encoder.finish()]);
        }

        animationId = requestAnimationFrame(render);
      };

      render();
    };

    setup();

    return () => cancelAnimationFrame(animationId);
  }, []);

  return (
    <div className="relative w-full h-full">
      <video ref={videoRef} className="absolute w-full h-full object-cover" autoPlay playsInline muted />
      <canvas ref={canvasRef} className="absolute w-full h-full" />
    </div>
  );
}
