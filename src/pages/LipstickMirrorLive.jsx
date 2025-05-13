// src/pages/LipstickMirrorLive.jsx (Fix state update in loop)

import React, { useEffect, useRef, useState } from 'react';
import initWebGPU from '@/utils/initWebGPU';
import createPipelines from '@/utils/createPipelines';
import lipTriangles from '@/utils/lipTriangles';
import { FaceLandmarker, FilesetResolver } from '@mediapipe/tasks-vision';

export default function LipstickMirrorLive() {
  const canvasRef = useRef(null);
  const videoRef = useRef(null);
  const [landmarker, setLandmarker] = useState(null);
  const [error, setError] = useState(null);
  const [debugMessage, setDebugMessage] = useState('Initializing...');
  const frameCounter = useRef(0);

  const renderState = useRef({
    device: null,
    context: null,
    videoPipeline: null,
    lipstickPipeline: null,
    videoBindGroupLayout: null,
    videoSampler: null,
    vertexBuffer: null,
    vertexBufferSize: 0,
    renderRequestId: null,
  }).current;

  useEffect(() => {
    const initLandmarker = async () => {
      try {
        setDebugMessage("Initializing FaceLandmarker...");
        console.log("[LM_EFFECT] Initializing FaceLandmarker...");
        const vision = await FilesetResolver.forVisionTasks(
          'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm'
        );
        const faceLandmarker = await FaceLandmarker.createFromOptions(vision, {
          baseOptions: { modelAssetPath: '/models/face_landmarker.task', delegate: 'GPU' },
          outputFaceBlendshapes: false, outputFacialTransformationMatrixes: false,
          runningMode: 'VIDEO', numFaces: 1,
        });
        setLandmarker(faceLandmarker);
        setDebugMessage("FaceLandmarker ready.");
        console.log("[LM_EFFECT] FaceLandmarker ready.");
      } catch (err) {
        console.error("[LM_EFFECT] Error initializing FaceLandmarker:", err);
        setError(`FaceLandmarker init failed: ${err.message}.`);
        setDebugMessage("Error.");
      }
    };
    initLandmarker();
  }, []);

  useEffect(() => {
    if (!canvasRef.current || !videoRef.current) {
      console.log("[INIT_EFFECT] Canvas or Video ref not ready yet.");
      return;
    }
    let isCleanup = false;
    const initGPUAndVideo = async () => {
      try {
        setDebugMessage("Initializing Camera and WebGPU...");
        console.log("[INIT_EFFECT] Initializing Camera and WebGPU...");
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) throw new Error("Camera access not supported.");
        const stream = await navigator.mediaDevices.getUserMedia({ video: { width: 640, height: 480 } });
        if (isCleanup) { stream.getTracks().forEach(track => track.stop()); return; }
        videoRef.current.srcObject = stream;
        await new Promise((resolve, reject) => {
          videoRef.current.onloadedmetadata = () => { console.log(`[INIT_EFFECT] Video metadata loaded: ${videoRef.current.videoWidth}x${videoRef.current.videoHeight}`); resolve(); };
          videoRef.current.onerror = (e) => reject(new Error("Failed to load video stream."));
        });
        await videoRef.current.play();
        console.log("[INIT_EFFECT] Video playback started.");
        if (!navigator.gpu) throw new Error("WebGPU is not supported.");
        const { device, context, format } = await initWebGPU(canvasRef.current);
        renderState.device = device; renderState.context = context;
        console.log("[INIT_EFFECT] WebGPU device and context obtained.");
        device.lost.then((info) => {
          console.error(`[DEVICE_LOST_HANDLER] WebGPU device lost: ${info.message}`);
          setError(`WebGPU device lost: ${info.message}. Please refresh.`);
          setDebugMessage("Error: Device Lost.");
          if (renderState.renderRequestId) cancelAnimationFrame(renderState.renderRequestId);
          renderState.renderRequestId = null;
          renderState.device = null;
        });
        const { videoPipeline, lipstickPipeline, videoBindGroupLayout } = await createPipelines(device, format);
        renderState.videoPipeline = videoPipeline; renderState.lipstickPipeline = lipstickPipeline; renderState.videoBindGroupLayout = videoBindGroupLayout;
        console.log("[INIT_EFFECT] WebGPU Pipelines created.");
        renderState.videoSampler = device.createSampler({ label: 'Video Sampler', magFilter: 'linear', minFilter: 'linear', addressModeU: 'clamp-to-edge', addressModeV: 'clamp-to-edge' });
        console.log("[INIT_EFFECT] WebGPU Sampler created.");
        renderState.vertexBufferSize = 2048;
        renderState.vertexBuffer = device.createBuffer({ label: 'Lip Vertices Buffer', size: renderState.vertexBufferSize, usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST });
        console.log("[INIT_EFFECT] WebGPU Vertex Buffer created.");
        setDebugMessage("GPU/Video Init. Waiting for Landmarker.");
        console.log("[INIT_EFFECT] GPU/Video Initialization complete.");
      } catch (err) {
        console.error("[INIT_EFFECT] Initialization failed:", err);
        setError(`Setup failed: ${err.message}`);
        setDebugMessage("Error.");
      }
    };
    initGPUAndVideo();
    return () => {
      console.log("[INIT_EFFECT_CLEANUP] Cleaning up GPU/Video resources...");
      isCleanup = true;
      const stream = videoRef.current?.srcObject;
      if (stream?.getTracks) stream.getTracks().forEach(track => track.stop());
      if (videoRef.current) videoRef.current.srcObject = null;
      renderState.vertexBuffer?.destroy();
      renderState.device = null;
      console.log("[INIT_EFFECT_CLEANUP] GPU/Video cleanup finished.");
    };
  }, []);

  useEffect(() => {
    const allReady = landmarker && renderState.device && renderState.context &&
                     renderState.videoPipeline && renderState.lipstickPipeline &&
                     renderState.videoBindGroupLayout && renderState.videoSampler && renderState.vertexBuffer;

    if (allReady) {
      console.log("[RENDER_LOOP_EFFECT] All conditions met. Starting render loop.");
      // Set debug message ONCE when loop is about to start, not inside 'render'
      setDebugMessage("Live Tracking Active!");

      const render = async () => {
        frameCounter.current++;
        // console.log(`[RENDER ${frameCounter.current}] Loop start. Device: ${!!renderState.device}`);

        if (!renderState.device) {
          console.warn(`[RENDER ${frameCounter.current}] Exiting: Device is null/lost at loop start.`);
          // setDebugMessage("Render Error: Device lost."); // Avoid state update in render
          // setError("WebGPU Device lost. Please refresh."); // Avoid state update in render
          renderState.renderRequestId = null;
          return;
        }
        if (!videoRef.current || videoRef.current.readyState < videoRef.current.HAVE_ENOUGH_DATA) {
          renderState.renderRequestId = requestAnimationFrame(render); return;
        }

        const videoFrame = videoRef.current;
        let numLipVertices = 0;
        try {
          const now = performance.now();
          const results = landmarker.detectForVideo(videoFrame, now);
          if (results?.faceLandmarks?.length > 0) {
            const landmarks = results.faceLandmarks[0];
            const lips = lipTriangles.map(([a,b,c]) => [landmarks[a],landmarks[b],landmarks[c]]);
            const vertices = new Float32Array(lips.flat().map(pt => [(0.5 - pt.x) * 2, (0.5 - pt.y) * 2]).flat());
            numLipVertices = vertices.length / 2;
            if (vertices.byteLength > 0) {
              if (vertices.byteLength <= renderState.vertexBufferSize) renderState.device.queue.writeBuffer(renderState.vertexBuffer, 0, vertices);
              else { console.warn(`[RENDER ${frameCounter.current}] Vertex data too large.`); numLipVertices = 0; }
            } else numLipVertices = 0;
          } else numLipVertices = 0;
        } catch (err) { console.error(`[RENDER ${frameCounter.current}] Landmark/vertex error:`, err); numLipVertices = 0; }

        let videoTextureGPU;
        try { videoTextureGPU = renderState.device.importExternalTexture({ source: videoFrame }); }
        catch (err) { console.error(`[RENDER ${frameCounter.current}] Import texture error:`, err); renderState.renderRequestId = requestAnimationFrame(render); return; }

        let frameBindGroup;
        try { frameBindGroup = renderState.device.createBindGroup({ layout: renderState.videoBindGroupLayout, entries: [{ binding: 0, resource: renderState.videoSampler }, { binding: 1, resource: videoTextureGPU }] }); }
        catch (err) { console.error(`[RENDER ${frameCounter.current}] Create bind group error:`, err); renderState.renderRequestId = requestAnimationFrame(render); return; }
        
        const commandEncoder = renderState.device.createCommandEncoder({ label: `F${frameCounter.current}` });
        const canvasTextureView = renderState.context.getCurrentTexture().createView();
        const passEncoder = commandEncoder.beginRenderPass({ colorAttachments: [{ view: canvasTextureView, loadOp: 'clear', storeOp: 'store', clearValue: { r: 0.1, g: 0.1, b: 0.15, a: 1.0 }}]});
        passEncoder.setPipeline(renderState.videoPipeline); passEncoder.setBindGroup(0, frameBindGroup); passEncoder.draw(6, 1, 0, 0);
        if (numLipVertices > 0) { passEncoder.setPipeline(renderState.lipstickPipeline); passEncoder.setVertexBuffer(0, renderState.vertexBuffer); passEncoder.draw(numLipVertices, 1, 0, 0); }
        passEncoder.end();
        renderState.device.queue.submit([commandEncoder.finish()]);

        if (frameCounter.current === 1) { // Log this only once
          console.log(`[RENDER 1] First frame rendered successfully. Debug shader should be blue.`);
        }

        if (renderState.device) {
          // console.log(`[RENDER ${frameCounter.current}] Device OK. Scheduling next frame.`);
          renderState.renderRequestId = requestAnimationFrame(render);
        } else {
          console.warn(`[RENDER ${frameCounter.current}] Device became null AFTER submit. NOT scheduling next frame.`);
          // setDebugMessage("Device Lost Post-Submit"); // Avoid state update in render
          renderState.renderRequestId = null;
        }
      };
      console.log("[RENDER_LOOP_EFFECT] Requesting first animation frame.");
      frameCounter.current = 0;
      renderState.renderRequestId = requestAnimationFrame(render);
      return () => {
        console.log(`[RENDER_LOOP_EFFECT_CLEANUP] Stopping render loop (ID: ${renderState.renderRequestId}).`);
        if (renderState.renderRequestId) cancelAnimationFrame(renderState.renderRequestId);
        renderState.renderRequestId = null;
        // setDebugMessage("Render loop stopped."); // Avoid state update in cleanup if it causes issues
      };
    } else {
      console.log("[RENDER_LOOP_EFFECT] Conditions NOT MET for starting render loop:", {
        lm: !!landmarker, dev: !!renderState.device, ctx: !!renderState.context,
        vp: !!renderState.videoPipeline, lp: !!renderState.lipstickPipeline
      });
      if (renderState.renderRequestId) {
        console.log("[RENDER_LOOP_EFFECT] Conditions unmet, ensuring previous loop is stopped.");
        cancelAnimationFrame(renderState.renderRequestId);
        renderState.renderRequestId = null;
      }
    }
  }, [landmarker, renderState.device, renderState.context, renderState.videoPipeline, renderState.lipstickPipeline, renderState.videoBindGroupLayout, renderState.videoSampler, renderState.vertexBuffer]);

  return (
    <div style={{ width: '640px', height: '480px', margin: 'auto', border: '1px solid #ccc', position: 'relative', overflow: 'hidden' }}>
      <div style={{ position: 'absolute', top: '5px', left: '5px', background: 'rgba(0,0,0,0.7)', color: 'white', padding: '2px 5px', fontSize: '12px', zIndex: 10, pointerEvents: 'none' }}>
        {error ? `Error: ${error}` : debugMessage} (Frame: {frameCounter.current})
      </div>
      <video ref={videoRef} style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', objectFit: 'cover', opacity: 0, pointerEvents: 'none', zIndex: 1 }}
        width={640} height={480} autoPlay playsInline muted />
      <canvas ref={canvasRef} width={640} height={480} style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', zIndex: 2 }} />
    </div>
  );
}