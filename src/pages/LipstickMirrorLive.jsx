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
      try {
        const canvas = canvasRef.current;
        const { device, context, format } = await initWebGPU(canvas);
        deviceRef.current = device;
        contextRef.current = context;

        const module = device.createShaderModule({ code: lipstickShader });
        pipelineRef.current = createPipeline(device, format, module);

        const uniformBuffer = device.createBuffer({
          size: 2 * 4 * 100, // 100 vec2 floats
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
      } catch (err) {
        console.error("❌ WebGPU setup failed:", err);
      }
    }

    function render(landmarks) {
      const device = deviceRef.current;
      const context = contextRef.current;
      const pipeline = pipelineRef.current;

      const bufferData = new Float32Array(landmarks.flat());
      device.queue.writeBuffer(uniformBufferRef.current, 0, bufferData.buffer);

      const encoder = device.createCommandEncoder();
      const pass = encoder.beginRenderPass({
        colorAttachments: [
          {
            view: context.getCurrentTexture().createView(),
            clearValue: { r: 1, g: 0, b: 0, a: 1 },
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
        console.log("📸 FaceMesh results:", results);
        if (results.multiFaceLandmarks && results.multiFaceLandmarks.length > 0) {
          const landmarks = results.multiFaceLandmarks[0]
            .filter((_, i) => [61, 291, 78, 308, 13, 14, 17, 0].includes(i))
            .map((pt) => [
              pt.x * canvasRef.current.width,
              pt.y * canvasRef.current.height,
            ]);
          render(landmarks);
        }
      });

      if (!videoRef.current) {
        console.error("🚫 Video ref not found!");
        return;
      }

      const camera = new Camera(videoRef.current, {
        onFrame: async () => {
          await faceMesh.send({ image: videoRef.current });
        },
        width: 640,
        height: 480,
      });

      try {
        camera.start();
        console.log("📷 Camera started successfully:", videoRef.current);
      } catch (err) {
        console.error("❌ Camera failed to start:", err);
      }
    }

    // Check for media permissions
    navigator.mediaDevices
      .getUserMedia({ video: true })
      .then((stream) => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          console.log("🎥 Live video stream attached:", stream);
        }
      })
      .catch((err) => {
        console.error("🚫 Camera access denied or not available:", err);
      });

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
