// src/pages/LipstickMirrorLive.jsx (WITH DETAILED LOGGING)

import React, { useEffect, useRef, useState, useCallback } from 'react';
import initWebGPU from '@/utils/initWebGPU';
import createPipelines from '@/utils/createPipelines'; // Ensure filename is createPipelines.js
import lipTriangles from '@/utils/lipTriangles';
import { FaceLandmarker, FilesetResolver } from '@mediapipe/tasks-vision';

export default function LipstickMirrorLive() {
  const canvasRef = useRef(null);
  const videoRef = useRef(null);
  const [landmarker, setLandmarker] = useState(null);
  const [error, setError] = useState(null);
  const [debugMessage, setDebugMessage] = useState('Initializing...');
  const frameCounter = useRef(0); // For logging render loop calls

  const renderState = useRef({
    device: null,
    context: null,
    videoPipeline: null,
    lipstickPipeline: null,
    videoBindGroupLayout: null,
    videoBindGroup: null,
    videoSampler: null,
    vertexBuffer: null,
    vertexBufferSize: 0,
    renderRequestId: null,
  }).current;

  useEffect(() => {
    const initLandmarker = async () => {
      try {
        setDebugMessage("Initializing FaceLandmarker...");
        console.log("[LM] Initializing FaceLandmarker...");
        const vision = await FilesetResolver.forVisionTasks(
          'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm'
        );
        const faceLandmarker = await FaceLandmarker.createFromOptions(vision, {
          baseOptions: {
            modelAssetPath: '/models/face_landmarker.task',
            delegate: 'GPU',
          },
          outputFaceBlendshapes: false,
          outputFacialTransformationMatrixes: false,
          runningMode: 'VIDEO',
          numFaces: 1,
        });
        setLandmarker(faceLandmarker);
        setDebugMessage("FaceLandmarker ready.");
        console.log("[LM] FaceLandmarker ready.");
      } catch (err) {
        console.error("[LM] Error initializing FaceLandmarker:", err);
        setError(`FaceLandmarker init failed: ${err.message}.`);
        setDebugMessage("Error.");
      }
    };
    initLandmarker();
  }, []);

  useEffect(() => {
    if (!canvasRef.current || !videoRef.current) {
      console.log("[INIT] Canvas or Video ref not ready yet.");
      return;
    }

    let isCleanup = false;

    const init = async () => {
      try {
        setDebugMessage("Initializing Camera and WebGPU...");
        console.log("[INIT] Initializing Camera and WebGPU...");

        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
          throw new Error("Camera access (getUserMedia) not supported.");
        }
        console.log("[INIT] Requesting camera stream...");
        setDebugMessage("Requesting camera access...");
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { width: 640, height: 480 }
        });

        if (isCleanup) {
          stream.getTracks().forEach(track => track.stop());
          console.log("[INIT] Cleanup started during camera init, stopping stream.");
          return;
        }

        videoRef.current.srcObject = stream;
        setDebugMessage("Waiting for video metadata...");
        console.log("[INIT] Video stream obtained, waiting for metadata...");

        await new Promise((resolve, reject) => {
          videoRef.current.onloadedmetadata = () => {
            console.log(`[INIT] Video metadata loaded: ${videoRef.current.videoWidth}x${videoRef.current.videoHeight}`);
            setDebugMessage("Video ready. Initializing WebGPU...");
            resolve();
          };
          videoRef.current.onerror = (e) => {
            console.error("[INIT] Video loading error:", e);
            reject(new Error("Failed to load video stream."));
          }
        });

        await videoRef.current.play();
        console.log("[INIT] Video playback started.");

        if (!navigator.gpu) {
          throw new Error("WebGPU is not supported.");
        }

        const { device, context, format } = await initWebGPU(canvasRef.current);
        renderState.device = device;
        renderState.context = context;
        console.log("[INIT] WebGPU device and context obtained.");
        setDebugMessage("WebGPU initialized. Creating pipelines...");

        device.lost.then((info) => {
          console.error(`[INIT] WebGPU device lost: ${info.message}`);
          setError(`WebGPU device lost: ${info.message}. Please refresh.`);
          setDebugMessage("Error: Device Lost.");
          if (renderState.renderRequestId) cancelAnimationFrame(renderState.renderRequestId);
          renderState.device = null;
        });

        const { videoPipeline, lipstickPipeline, videoBindGroupLayout } = await createPipelines(device, format);
        renderState.videoPipeline = videoPipeline;
        renderState.lipstickPipeline = lipstickPipeline;
        renderState.videoBindGroupLayout = videoBindGroupLayout;
        console.log("[INIT] WebGPU Pipelines created (video and lipstick).");
        setDebugMessage("Pipelines created. Setting up resources...");

        renderState.videoSampler = device.createSampler({
          label: 'Video Sampler',
          magFilter: 'linear',
          minFilter: 'linear',
          addressModeU: 'clamp-to-edge',
          addressModeV: 'clamp-to-edge',
        });
        console.log("[INIT] WebGPU Sampler created.");

        renderState.vertexBufferSize = 2048;
        renderState.vertexBuffer = device.createBuffer({
          label: 'Lip Vertices Buffer',
          size: renderState.vertexBufferSize,
          usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
        });
        console.log("[INIT] WebGPU Vertex Buffer created.");

        setDebugMessage("Initialization complete. Starting render loop...");
        console.log("[INIT] Initialization complete. Starting render loop...");
        startRenderLoop();

      } catch (err) {
        console.error("[INIT] Initialization failed:", err);
        setError(`Setup failed: ${err.message}`);
        setDebugMessage("Error.");
      }
    };

    init();

    return () => {
      console.log("[CLEANUP] Cleaning up LipstickMirrorLive component...");
      isCleanup = true;
      setDebugMessage("Closing...");

      if (renderState.renderRequestId) {
        cancelAnimationFrame(renderState.renderRequestId);
        renderState.renderRequestId = null;
        console.log("[CLEANUP] Render loop stopped.");
      }

      const stream = videoRef.current?.srcObject;
      if (stream && typeof stream.getTracks === 'function') {
        stream.getTracks().forEach(track => track.stop());
        console.log("[CLEANUP] Video stream tracks stopped.");
      }
      if (videoRef.current) videoRef.current.srcObject = null;

      renderState.vertexBuffer?.destroy();
      console.log("[CLEANUP] WebGPU resources released.");
      renderState.device = null; // Important to prevent further calls on lost/destroyed device
      console.log("[CLEANUP] Cleanup finished.");
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const startRenderLoop = useCallback(() => {
    const { device, context, videoPipeline, lipstickPipeline, videoBindGroupLayout, videoSampler, vertexBuffer } = renderState;

    if (!device || !context || !videoPipeline || !lipstickPipeline || !videoSampler || !vertexBuffer || !videoBindGroupLayout) {
      console.error("[RENDER_SETUP] Render loop cannot start: WebGPU resources not fully initialized.", renderState);
      setError("Render loop failed: WebGPU resources missing.");
      setDebugMessage("Error: Render Setup.");
      return;
    }
    console.log("[RENDER_SETUP] All necessary WebGPU resources are available. Starting render function.");

    const render = async () => {
      frameCounter.current++;
      // console.log(`[RENDER ${frameCounter.current}] Loop start.`);

      if (!renderState.device || renderState.renderRequestId === null) {
        console.warn(`[RENDER ${frameCounter.current}] Exiting: Device lost or cleanup initiated.`);
        return;
      }

      if (!landmarker) {
        // console.log(`[RENDER ${frameCounter.current}] Waiting for landmarker.`);
        renderState.renderRequestId = requestAnimationFrame(render);
        return;
      }
      if (!videoRef.current || videoRef.current.readyState < videoRef.current.HAVE_ENOUGH_DATA) {
        // console.log(`[RENDER ${frameCounter.current}] Waiting for video ready state (current: ${videoRef.current?.readyState}).`);
        renderState.renderRequestId = requestAnimationFrame(render);
        return;
      }
      // console.log(`[RENDER ${frameCounter.current}] Landmarker and video ready.`);

      const videoFrame = videoRef.current;
      let numLipVertices = 0;
      let faceDetected = false;

      try {
        const now = performance.now();
        // console.log(`[RENDER ${frameCounter.current}] Detecting landmarks...`);
        const results = landmarker.detectForVideo(videoFrame, now);

        if (results && results.faceLandmarks && results.faceLandmarks.length > 0) {
          faceDetected = true;
          // console.log(`[RENDER ${frameCounter.current}] Face detected. Processing landmarks.`);
          const landmarks = results.faceLandmarks[0];
          const lips = lipTriangles.map(([idxA, idxB, idxC]) => [
            landmarks[idxA], landmarks[idxB], landmarks[idxC],
          ]);

          const vertices = new Float32Array(
            lips.flat().map(pt => [
              (0.5 - pt.x) * 2, // Mirrored X
              (0.5 - pt.y) * 2
            ]).flat()
          );
          numLipVertices = vertices.length / 2;
          // console.log(`[RENDER ${frameCounter.current}] numLipVertices: ${numLipVertices}`);

          if (vertices.byteLength > 0) {
            if (vertices.byteLength <= renderState.vertexBufferSize) {
              device.queue.writeBuffer(vertexBuffer, 0, vertices);
              // console.log(`[RENDER ${frameCounter.current}] Vertex buffer updated with ${vertices.byteLength} bytes.`);
            } else {
              console.warn(`[RENDER ${frameCounter.current}] Vertex data (${vertices.byteLength} bytes) exceeds buffer size (${renderState.vertexBufferSize} bytes). Lip overlay skipped.`);
              numLipVertices = 0;
            }
          } else {
            numLipVertices = 0;
          }
        } else {
          // console.log(`[RENDER ${frameCounter.current}] No face detected.`);
          numLipVertices = 0;
        }
      } catch (err) {
        console.error(`[RENDER ${frameCounter.current}] Error during landmark detection or vertex processing:`, err);
        numLipVertices = 0;
      }

      let videoTextureGPU;
      try {
        // console.log(`[RENDER ${frameCounter.current}] Importing external texture from video frame.`);
        videoTextureGPU = device.importExternalTexture({
          label: 'Imported Video Texture',
          source: videoFrame
        });
      } catch (err) {
        console.error(`[RENDER ${frameCounter.current}] Failed to import external texture:`, err);
        renderState.renderRequestId = requestAnimationFrame(render);
        return;
      }
      // console.log(`[RENDER ${frameCounter.current}] External texture imported successfully.`);

      try {
        // console.log(`[RENDER ${frameCounter.current}] Creating video bind group.`);
        renderState.videoBindGroup = device.createBindGroup({
          label: 'Video Frame Bind Group',
          layout: videoBindGroupLayout,
          entries: [
            { binding: 0, resource: videoSampler },
            { binding: 1, resource: videoTextureGPU },
          ],
        });
      } catch (err) {
          console.error(`[RENDER ${frameCounter.current}] Failed to create video bind group:`, err);
          renderState.renderRequestId = requestAnimationFrame(render);
          return;
      }
      // console.log(`[RENDER ${frameCounter.current}] Video bind group created.`);


      let commandEncoder;
      try {
        commandEncoder = device.createCommandEncoder({ label: `Main Command Encoder F${frameCounter.current}` });
      } catch (e) {
        console.error(`[RENDER ${frameCounter.current}] Error creating command encoder:`, e);
        renderState.renderRequestId = requestAnimationFrame(render);
        return;
      }

      let canvasTextureView;
       try {
        canvasTextureView = context.getCurrentTexture().createView();
      } catch (e) {
        console.error(`[RENDER ${frameCounter.current}] Error getting current texture view:`, e);
        renderState.renderRequestId = requestAnimationFrame(render);
        return;
      }
      // console.log(`[RENDER ${frameCounter.current}] Got current texture view.`);

      const passEncoder = commandEncoder.beginRenderPass({
        label: `Main Render Pass F${frameCounter.current}`,
        colorAttachments: [{
          view: canvasTextureView,
          loadOp: 'clear',
          storeOp: 'store',
          clearValue: { r: 0.1, g: 0.1, b: 0.15, a: 1.0 }, // Dark grey clear
        }],
      });
      // console.log(`[RENDER ${frameCounter.current}] Render pass begun. Clear color should be dark grey.`);

      try {
        // console.log(`[RENDER ${frameCounter.current}] Drawing video background (expecting blue from debug shader).`);
        passEncoder.setPipeline(videoPipeline);
        passEncoder.setBindGroup(0, renderState.videoBindGroup);
        passEncoder.draw(6, 1, 0, 0); // Draw full-screen quad (2 triangles)
        // console.log(`[RENDER ${frameCounter.current}] Video background draw call issued.`);

        if (numLipVertices > 0) {
          // console.log(`[RENDER ${frameCounter.current}] Drawing lipstick overlay with ${numLipVertices} vertices.`);
          passEncoder.setPipeline(lipstickPipeline);
          passEncoder.setVertexBuffer(0, vertexBuffer);
          passEncoder.draw(numLipVertices, 1, 0, 0);
          // console.log(`[RENDER ${frameCounter.current}] Lipstick overlay draw call issued.`);
        } else {
          // console.log(`[RENDER ${frameCounter.current}] Skipping lipstick overlay (numLipVertices is 0).`);
        }
      } catch (err) {
         console.error(`[RENDER ${frameCounter.current}] Error during draw calls:`, err);
      }


      passEncoder.end();
      // console.log(`[RENDER ${frameCounter.current}] Render pass ended.`);
      try {
        device.queue.submit([commandEncoder.finish()]);
        // console.log(`[RENDER ${frameCounter.current}] Command queue submitted.`);
      } catch (err) {
         console.error(`[RENDER ${frameCounter.current}] Error submitting command queue:`, err);
      }


      if (renderState.device) {
        renderState.renderRequestId = requestAnimationFrame(render);
      } else {
        console.log(`[RENDER ${frameCounter.current}] Device is null, stopping render loop.`);
      }
    };

    console.log("[RENDER_SETUP] Requesting first animation frame.");
    renderState.renderRequestId = requestAnimationFrame(render);

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [landmarker]); // Dependencies for the render loop setup function

  return (
    <div style={{ width: '640px', height: '480px', margin: 'auto', border: '1px solid #ccc', position: 'relative', overflow: 'hidden' }}>
      <div style={{ position: 'absolute', top: '5px', left: '5px', background: 'rgba(0,0,0,0.7)', color: 'white', padding: '2px 5px', fontSize: '12px', zIndex: 10, pointerEvents: 'none' }}>
        {error ? `Error: ${error}` : debugMessage} (Frame: {frameCounter.current})
      </div>
      <video
        ref={videoRef}
        style={{
          position: 'absolute', top: 0, left: 0, width: '100%', height: '100%',
          objectFit: 'cover', opacity: 0, pointerEvents: 'none', zIndex: 1
        }}
        width={640} height={480} autoPlay playsInline muted
      />
      <canvas
        ref={canvasRef} width={640} height={480}
        style={{
          position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', zIndex: 2
        }}
      />
    </div>
  );
}