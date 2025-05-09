import React, { useEffect, useRef, useState } from 'react';
import initWebGPU from '@/utils/initWebGPU';
import createPipeline from '@/utils/createPipeline';
import lipTriangles from '@/utils/lipTriangles';
import { FaceLandmarker, FilesetResolver } from '@mediapipe/tasks-vision';

export default function LipstickMirrorLive() {
  const canvasRef = useRef(null);
  const videoRef = useRef(null);
  const [landmarker, setLandmarker] = useState(null);

  useEffect(() => {
    const init = async () => {
      const vision = await FilesetResolver.forVisionTasks(
        'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision/wasm'
      );
      const faceLandmarker = await FaceLandmarker.createFromOptions(vision, {
        baseOptions: {
          modelAssetPath: '/models/face_landmarker.task',
          delegate: 'GPU',
        },
        outputFaceBlendshapes: false,
        runningMode: 'VIDEO',
        numFaces: 1,
      });
      setLandmarker(faceLandmarker);

      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      videoRef.current.srcObject = stream;
      await videoRef.current.play();

      const { device, context, format } = await initWebGPU(canvasRef.current);
      const pipeline = await createPipeline(device, format);

      const render = async () => {
        const now = performance.now();
        const results = faceLandmarker.detectForVideo(videoRef.current, now);
        if (!results || results.faceLandmarks.length === 0) {
          requestAnimationFrame(render);
          return;
        }

        const landmarks = results.faceLandmarks[0];
        const lips = lipTriangles.map(([a, b, c]) => [
          landmarks[a],
          landmarks[b],
          landmarks[c],
        ]);

        const vertices = new Float32Array(
          lips.flat().map(pt => [(pt.x - 0.5) * 2, (0.5 - pt.y) * 2]).flat()
        );

        const vertexBuffer = device.createBuffer({
          size: vertices.byteLength,
          usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
          mappedAtCreation: true,
        });
        new Float32Array(vertexBuffer.getMappedRange()).set(vertices);
        vertexBuffer.unmap();

        const commandEncoder = device.createCommandEncoder();
        const pass = commandEncoder.beginRenderPass({
          colorAttachments: [{
            view: context.getCurrentTexture().createView(),
            loadOp: 'clear',
            storeOp: 'store',
            clearValue: { r: 0, g: 0, b: 0, a: 1 },
          }],
        });

        pass.setPipeline(pipeline);
        pass.setVertexBuffer(0, vertexBuffer);
        pass.draw(vertices.length / 2, 1, 0, 0);
        pass.end();
        device.queue.submit([commandEncoder.finish()]);

        requestAnimationFrame(render);
      };

      render();
    };
    init();
  }, []);

  return (
    <div>
      <video ref={videoRef} style={{ display: 'none' }} />
      <canvas ref={canvasRef} width={640} height={480} />
    </div>
  );
}
