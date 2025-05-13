// src/pages/LipstickMirrorLive.jsx (Explicit viewport and scissorRect, corrected log)

import React, { useEffect, useRef, useState } from 'react';
import initWebGPU from '@/utils/initWebGPU';
import createPipelines from '@/utils/createPipelines';
import lipTriangles from '@/utils/lipTriangles';
import { FaceLandmarker, FilesetResolver } from '@mediapipe/tasks-vision';

export default function LipstickMirrorLive() {
  const canvasRef = useRef(null);
  const videoRef = useRef(null);
  const [landmarker, setLandmarker] = useState(null);
  const [gpuResourcesReady, setGpuResourcesReady] = useState(false);
  const [error, setError] = useState(null);
  const [debugMessage, setDebugMessage] = useState('Initializing...');
  const frameCounter = useRef(0);

  const renderState = useRef({
    device: null, context: null, videoPipeline: null, lipstickPipeline: null,
    videoBindGroupLayout: null, videoSampler: null, vertexBuffer: null,
    vertexBufferSize: 0, renderRequestId: null,
  }).current;

  useEffect(() => {
    const initLandmarker = async () => {
      try {
        console.log("[LM_EFFECT] Initializing FaceLandmarker...");
        const vision = await FilesetResolver.forVisionTasks('https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm');
        const lm = await FaceLandmarker.createFromOptions(vision, {
          baseOptions: { modelAssetPath: '/models/face_landmarker.task', delegate: 'GPU' },
          outputFaceBlendshapes: false, runningMode: 'VIDEO', numFaces: 1,
        });
        setLandmarker(lm);
        console.log("[LM_EFFECT] FaceLandmarker ready.");
      } catch (err) { console.error("[LM_EFFECT] Error initializing FaceLandmarker:", err); setError(`FaceLandmarker init failed: ${err.message}`); setDebugMessage("Error."); }
    };
    initLandmarker();
  }, []);

  useEffect(() => {
    if (!canvasRef.current || !videoRef.current) { console.log("[INIT_EFFECT] Skipping: Canvas or Video ref not ready yet."); return; }
    let isCleanup = false;
    const initGPUAndVideo = async () => {
      try {
        console.log("[INIT_EFFECT] Initializing Camera and WebGPU...");
        if (!navigator.mediaDevices?.getUserMedia) throw new Error("Camera not supported.");
        const stream = await navigator.mediaDevices.getUserMedia({ video: { width: 640, height: 480 } });
        if (isCleanup) { stream.getTracks().forEach(t => t.stop()); return; }
        videoRef.current.srcObject = stream;
        await new Promise((res, rej) => {
          videoRef.current.onloadedmetadata = () => { console.log(`[INIT_EFFECT] Video metadata loaded: ${videoRef.current.videoWidth}x${videoRef.current.videoHeight}`); res(); };
          videoRef.current.onerror = () => rej(new Error("Video load error."));
        });
        await videoRef.current.play();
        console.log("[INIT_EFFECT] Video playback started.");
        if (!navigator.gpu) throw new Error("WebGPU not supported.");
        const { device, context, format } = await initWebGPU(canvasRef.current); // Calls updated initWebGPU
        renderState.device = device; renderState.context = context;
        console.log("[INIT_EFFECT] WebGPU device and context obtained.");
        device.lost.then((info) => {
          console.error(`[DEVICE_LOST_HANDLER] WebGPU device lost: ${info.message}`);
          setError(`Device lost: ${info.message}`); setDebugMessage("Error: Device Lost.");
          if (renderState.renderRequestId) cancelAnimationFrame(renderState.renderRequestId);
          renderState.renderRequestId = null; renderState.device = null; setGpuResourcesReady(false);
        });
        const pipes = await createPipelines(device, format);
        renderState.videoPipeline = pipes.videoPipeline; renderState.lipstickPipeline = pipes.lipstickPipeline; renderState.videoBindGroupLayout = pipes.videoBindGroupLayout;
        console.log("[INIT_EFFECT] WebGPU Pipelines created.");
        renderState.videoSampler = device.createSampler({ magFilter: 'linear', minFilter: 'linear' });
        console.log("[INIT_EFFECT] WebGPU Sampler created.");
        renderState.vertexBufferSize = 2048;
        renderState.vertexBuffer = device.createBuffer({ size: renderState.vertexBufferSize, usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST });
        console.log("[INIT_EFFECT] WebGPU Vertex Buffer created.");
        console.log("[INIT_EFFECT] GPU/Video Initialization complete.");
        setGpuResourcesReady(true);
      } catch (err) { console.error("[INIT_EFFECT] Initialization failed:", err); setError(`Setup failed: ${err.message}`); setDebugMessage("Error."); setGpuResourcesReady(false); }
    };
    initGPUAndVideo();
    return () => {
      console.log("[INIT_EFFECT_CLEANUP] Cleaning up GPU/Video resources..."); isCleanup = true;
      videoRef.current?.srcObject?.getTracks().forEach(t => t.stop()); if(videoRef.current) videoRef.current.srcObject = null;
      renderState.vertexBuffer?.destroy(); renderState.device = null; setGpuResourcesReady(false);
      console.log("[INIT_EFFECT_CLEANUP] GPU/Video cleanup finished.");
    };
  }, []);

  const allResourcesReady = !!(landmarker && gpuResourcesReady);

  console.log('[COMPONENT_BODY_RENDER] allResourcesReady:', allResourcesReady, { lm: !!landmarker, gpuRdy: gpuResourcesReady, dev: !!renderState.device });

  useEffect(() => {
    if (allResourcesReady) { setDebugMessage("Live Tracking Active!"); console.log("[UI_MSG_EFFECT] Resources ready. UI message set."); }
  }, [allResourcesReady]);

  useEffect(() => {
    if (!allResourcesReady) {
      console.log("[RENDER_LOOP_EFFECT] Conditions NOT YET MET (allResourcesReady is false).");
      if (renderState.renderRequestId) { console.log("[RENDER_LOOP_EFFECT] Resources no longer ready, stopping previous loop."); cancelAnimationFrame(renderState.renderRequestId); renderState.renderRequestId = null; }
      return;
    }
    if (!renderState.device || !renderState.context?.canvas) {
        console.error("[RENDER_LOOP_EFFECT] CRITICAL: Device or context.canvas is null. Aborting loop start.", {device: !!renderState.device, contextCanvas: !!renderState.context?.canvas});
        setError("GPU Device/Canvas unavailable for render loop.");
        return;
    }
    console.log("[RENDER_LOOP_EFFECT] All resources ready. Starting render loop mechanism.");
    const render = async () => {
      if (!renderState.device) { console.warn(`[RENDER ${frameCounter.current}] Loop aborted: Device lost.`); renderState.renderRequestId = null; return; }
      frameCounter.current++;
      // console.log(`[RENDER ${frameCounter.current}] Frame Start. Device: ${!!renderState.device}`);

      if (!videoRef.current || videoRef.current.readyState < videoRef.current.HAVE_ENOUGH_DATA || videoRef.current.videoWidth === 0) {
        renderState.renderRequestId = requestAnimationFrame(render); return;
      }
      const videoFrame = videoRef.current;
      if (frameCounter.current % 60 === 1) { console.log(`[RENDER ${frameCounter.current}] Video dims for MediaPipe: ${videoFrame.videoWidth}x${videoFrame.videoHeight}`); }

      let numLipVertices = 0;
      try {
        const now = performance.now();
        const results = landmarker.detectForVideo(videoFrame, now);
        if (results?.faceLandmarks?.length > 0) {
          const allFaceLandmarks = results.faceLandmarks[0];
          if (allFaceLandmarks && frameCounter.current % 60 === 1) {
            let minX = 1.0, maxX = 0.0, minY = 1.0, maxY = 0.0;
            allFaceLandmarks.forEach(lm => { minX = Math.min(minX, lm.x); maxX = Math.max(maxX, lm.x); minY = Math.min(minY, lm.y); maxY = Math.max(maxY, lm.y); });
            console.log(`[RENDER ${frameCounter.current}] Landmark Spread: X[${minX.toFixed(3)}-${maxX.toFixed(3)}] (span ${ (maxX-minX).toFixed(3) }), Y[${minY.toFixed(3)}-${maxY.toFixed(3)}] (span ${ (maxY-minY).toFixed(3) })`);
          }
          const lips = lipTriangles.map(([a, b, c]) => [allFaceLandmarks[a], allFaceLandmarks[b], allFaceLandmarks[c]]);
          const v = new Float32Array(lips.flat().map(pt => [(0.5 - pt.x) * 2, (0.5 - pt.y) * 2]).flat());
          numLipVertices = v.length / 2;
          if (v.byteLength > 0) {
            if (v.byteLength <= renderState.vertexBufferSize) renderState.device.queue.writeBuffer(renderState.vertexBuffer, 0, v);
            else { console.warn(`[RENDER ${frameCounter.current}] Vertex data too large.`); numLipVertices = 0; }
          } else numLipVertices = 0;
        } else numLipVertices = 0;
      } catch (e) { console.error(`[RENDER ${frameCounter.current}] Landmark/vertex error:`, e); numLipVertices = 0; }

      let videoTextureGPU, frameBindGroup;
      try {
        videoTextureGPU = renderState.device.importExternalTexture({ source: videoFrame });
        frameBindGroup = renderState.device.createBindGroup({ layout: renderState.videoBindGroupLayout, entries: [{ binding: 0, resource: renderState.videoSampler }, { binding: 1, resource: videoTextureGPU }] });
      } catch (e) { console.error(`[RENDER ${frameCounter.current}] Texture/BindGroup error:`, e); renderState.renderRequestId = requestAnimationFrame(render); return; }

      const cmdEnc = renderState.device.createCommandEncoder();
      const texView = renderState.context.getCurrentTexture().createView();
      
      const canvasPhysicalWidth = renderState.context.canvas.width;
      const canvasPhysicalHeight = renderState.context.canvas.height;

      const passEnc = cmdEnc.beginRenderPass({
        colorAttachments: [{ view: texView, loadOp: 'clear', storeOp: 'store', clearValue: { r: 0.1, g: 0.1, b: 0.15, a: 1.0 } }]
      });

      passEnc.setViewport(0, 0, canvasPhysicalWidth, canvasPhysicalHeight, 0, 1);
      // **** NEW: Explicitly set the scissor rectangle ****
      passEnc.setScissorRect(0, 0, canvasPhysicalWidth, canvasPhysicalHeight);

      if (frameCounter.current % 60 === 1) {
        console.log(`[RENDER ${frameCounter.current}] Viewport & ScissorRect set to: 0,0,${canvasPhysicalWidth},${canvasPhysicalHeight} (physical canvas dims)`);
      }

      passEnc.setPipeline(renderState.videoPipeline); passEnc.setBindGroup(0, frameBindGroup); passEnc.draw(6);
      if (numLipVertices > 0) { passEnc.setPipeline(renderState.lipstickPipeline); passEnc.setVertexBuffer(0, renderState.vertexBuffer); passEnc.draw(numLipVertices); }
      passEnc.end();
      renderState.device.queue.submit([cmdEnc.finish()]);

      if (frameCounter.current === 1) { console.log(`[RENDER 1] First frame drawn. Subsequent frames should follow.`); }
      if (renderState.device) { renderState.renderRequestId = requestAnimationFrame(render); }
      else { console.warn(`[RENDER ${frameCounter.current}] Device became null post-submit. Loop stopping.`); renderState.renderRequestId = null; }
    };
    console.log("[RENDER_LOOP_EFFECT] Requesting first animation frame for the loop.");
    frameCounter.current = 0; renderState.renderRequestId = requestAnimationFrame(render);
    return () => {
      console.log(`[RENDER_LOOP_EFFECT_CLEANUP] Stopping render loop (ID: ${renderState.renderRequestId}).`);
      if (renderState.renderRequestId) cancelAnimationFrame(renderState.renderRequestId); renderState.renderRequestId = null;
    };
  }, [allResourcesReady, landmarker]);

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