// src/pages/LipstickMirrorLive.jsx

import React, { useEffect, useRef } from 'react';
import { FaceMesh } from '@mediapipe/face_mesh';
import { Camera } from '@mediapipe/camera_utils';
import initWebGPU from '@/utils/initWebGPU';
import createPipeline from '@/utils/createPipeline';
import lipstickShader from '@/shaders/lipstickEffect.wgsl?raw';

export default function LipstickMirrorLive() {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const uniformBufferRef = useRef(null);
  const deviceRef = useRef(null);
  const bindGroupRef = useRef(null);
  const pipelineRef = useRef(null);
  const contextRef = useRef(null);

  useEffect(() => {
    async function setupWebGPU() {
      const canvas = canvasRef.current;
      if (!canvas) {
        console.error("❌ Canvas not found");
        return;
      }

      const { device, context, format } = await initWebGPU(canvas);
      deviceRef.current = device;
      contextRef.current = context;

      const module = device.createShaderModule({ code: lipstickShader });
      pipelineRef.current = createPipeline(device, format, module);

      const uniformBuffer = device.createBuffer({
        size: 2 * 4 * 100,
        usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
      });
      uniformBufferRef.current = uniformBuffer;

      bindGroupRef.current = device.createBindGroup({
        layout: pipelineRef.current.getBindGroupLayout(0),
        entries: [
          {
            binding: 0,
            resource: { buffer: uniformBuffer },
          },
        ],
      });

      console.log("✅ WebGPU initialized");
    }

    function render(landmarks) {
      const device = deviceRef.current;
      const context = contextRef.current;
      const pipeline = pipelineRef.current;

      if (!device || !context || !pipeline) {
        console.warn("⚠️ Skipping render - GPU not ready");
        return;
      }

      const bufferData = new Float32Array(landmarks.flat());
      device.queue.writeBuffer(uniformBufferRef.current, 0, bufferData.buffer);

      const encoder = device.createCommandEncoder();
      const pass = encoder.beginRenderPass({
        colorAttachments: [
          {
            view: context.getCurrentTexture().createView(),
            clearValue: { r: 1, g: 0, b: 0, a: 1 }, // Red fallback
            loadOp: 'clear',
            storeOp: 'store',
          },
        ],
      });

      pass.setPipeline(pipeline);
      pass.setBindGroup(0, bindGroupRef.current);
      pass.draw(6, 1, 0, 0);
      pass.end();
      device.queue.submit([encoder.finish()]);
    }

    function setupFaceMesh() {
      const faceMesh = new FaceMesh({
        locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/${file}`,
      });
      faceMesh.setOptions({
        maxNumFaces: 1,
        refineLandmarks: true,
        minDetectionConfidence: 0.5,
        minTrackingConfidence: 0.5,
      });

      faceMesh.onResults((results) => {
        if (
          results.multiFaceLandmarks &&
          results.multiFaceLandmarks.length > 0
        ) {
          const landmarks = results.multiFaceLandmarks[0]
            .filter((_, i) => [61, 291, 78, 308, 13, 14, 17, 0].includes(i))
            .map((pt) => [
              pt.x * canvasRef.current.width,
              pt.y * canvasRef.current.height,
            ]);
          console.log("🟢 Landmarks detected:", landmarks.length);
          render(landmarks);
        } else {
          console.log("🔴 No face detected");
        }
      });

      const videoEl = videoRef.current;
      if (!videoEl) {
        console.error("❌ Video element not found");
        return;
      }

      const camera = new Camera(videoEl, {
        onFrame: async () => {
          await faceMesh.send({ image: videoEl });
        },
        width: 640,
        height: 480,
      });

      camera.start();
      console.log("📷 Camera started");
    }

    async function startVideo() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true });
        videoRef.current.srcObject = stream;
        console.log("🎥 Video stream acquired");
      } catch (err) {
        console.error("❌ Failed to access camera", err);
      }
    }

    startVideo();
    setupWebGPU();
    setupFaceMesh();
  }, []);

  return (
    <div className="relative w-full h-full flex items-center justify-center bg-black">
      <div className="relative" style={{ width: 640, height: 480 }}>
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          width={640}
          height={480}
          className="rounded-xl shadow-lg absolute"
          style={{ zIndex: 1, objectFit: 'cover', background: '#000' }}
        />
        <canvas
          ref={canvasRef}
          width={640}
          height={480}
          className="rounded-xl shadow-lg absolute"
          style={{ zIndex: 2, pointerEvents: 'none' }}
        />
      </div>
    </div>
  );
}
