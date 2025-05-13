// src/pages/LipstickMirrorLive.jsx (Diagnose allResourcesReady)

import React, { useEffect, useRef, useState } from 'react';
import initWebGPU from '@/utils/initWebGPU';
import createPipelines from '@/utils/createPipelines';
import lipTriangles from '@/utils/lipTriangles';
import { FaceLandmarker, FilesetResolver } from '@mediapipe/tasks-vision';

export default function LipstickMirrorLive() {
  const canvasRef = useRef(null);
  const videoRef = useRef(null);
  const [landmarker, setLandmarker] = useState(null); // React state
  const [error, setError] = useState(null);         // React state
  const [debugMessage, setDebugMessage] = useState('Initializing...'); // React state
  const frameCounter = useRef(0);                   // Ref

  // Ref to hold WebGPU objects that don't need to trigger re-renders on change
  const renderState = useRef({
    device: null, context: null, videoPipeline: null, lipstickPipeline: null,
    videoBindGroupLayout: null, videoSampler: null, vertexBuffer: null,
    vertexBufferSize: 0, renderRequestId: null,
  }).current; // .current gives the mutable object

  // Effect 1: Initialize FaceLandmarker
  useEffect(() => {
    const initLandmarker = async () => {
      try {
        console.log("[LM_EFFECT] Initializing FaceLandmarker...");
        const vision = await FilesetResolver.forVisionTasks('https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm');
        const lm = await FaceLandmarker.createFromOptions(vision, {
          baseOptions: { modelAssetPath: '/models/face_landmarker.task', delegate: 'GPU' },
          outputFaceBlendshapes: false, runningMode: 'VIDEO', numFaces: 1,
        });
        setLandmarker(lm); // State update, will trigger re-render
        console.log("[LM_EFFECT] FaceLandmarker ready.");
      } catch (err) {
        console.error("[LM_EFFECT] Error initializing FaceLandmarker:", err);
        setError(`FaceLandmarker init failed: ${err.message}`); setDebugMessage("Error.");
      }
    };
    initLandmarker();
  }, []); // Empty dependency array: runs once on mount

  // Effect 2: Initialize WebGPU and Video
  useEffect(() => {
    if (!canvasRef.current || !videoRef.current) {
        console.log("[INIT_EFFECT] Skipping: Canvas or Video ref not ready yet.");
        return;
    }
    let isCleanup = false;
    const initGPUAndVideo = async () => {
      try {
        console.log("[INIT_EFFECT] Initializing Camera and WebGPU...");
        if (!navigator.mediaDevices?.getUserMedia) throw new Error("Camera not supported.");
        const stream = await navigator.mediaDevices.getUserMedia({ video: { width: 640, height: 480 } });
        if (isCleanup) { stream.getTracks().forEach(t => t.stop()); return; }
        videoRef.current.srcObject = stream;
        await new Promise((res, rej) => {
          videoRef.current.onloadedmetadata = () => { console.log("[INIT_EFFECT] Video metadata loaded."); res(); };
          videoRef.current.onerror = () => rej(new Error("Video load error."));
        });
        await videoRef.current.play();
        console.log("[INIT_EFFECT] Video playback started.");

        if (!navigator.gpu) throw new Error("WebGPU not supported.");
        const { device, context, format } = await initWebGPU(canvasRef.current);
        renderState.device = device; renderState.context = context; // Assign to ref
        console.log("[INIT_EFFECT] WebGPU device and context obtained.");
        device.lost.then((info) => {
          console.error(`[DEVICE_LOST_HANDLER] WebGPU device lost: ${info.message}`);
          setError(`Device lost: ${info.message}`); setDebugMessage("Error: Device Lost.");
          if (renderState.renderRequestId) cancelAnimationFrame(renderState.renderRequestId);
          renderState.renderRequestId = null; renderState.device = null; // Modify ref
        });
        const pipes = await createPipelines(device, format);
        renderState.videoPipeline = pipes.videoPipeline; renderState.lipstickPipeline = pipes.lipstickPipeline; // Assign to ref
        renderState.videoBindGroupLayout = pipes.videoBindGroupLayout; // Assign to ref
        console.log("[INIT_EFFECT] WebGPU Pipelines created.");
        renderState.videoSampler = device.createSampler({ magFilter: 'linear', minFilter: 'linear' }); // Assign to ref
        console.log("[INIT_EFFECT] WebGPU Sampler created.");
        renderState.vertexBufferSize = 2048;
        renderState.vertexBuffer = device.createBuffer({ size: renderState.vertexBufferSize, usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST }); // Assign to ref
        console.log("[INIT_EFFECT] WebGPU Vertex Buffer created.");
        console.log("[INIT_EFFECT] GPU/Video Initialization complete.");
      } catch (err) {
        console.error("[INIT_EFFECT] Initialization failed:", err);
        setError(`Setup failed: ${err.message}`); setDebugMessage("Error.");
      }
    };
    initGPUAndVideo();
    return () => { // Cleanup for Effect 2
      console.log("[INIT_EFFECT_CLEANUP] Cleaning up GPU/Video resources...");
      isCleanup = true;
      videoRef.current?.srcObject?.getTracks().forEach(t => t.stop());
      if(videoRef.current) videoRef.current.srcObject = null;
      renderState.vertexBuffer?.destroy(); // Modify ref's property
      renderState.device = null; // Modify ref
      console.log("[INIT_EFFECT_CLEANUP] GPU/Video cleanup finished.");
    };
  }, []); // Empty dependency array: runs once on mount

  // THIS IS THE NEW DIAGNOSTIC LOG
  const allResourcesReady = !!(
    landmarker &&
    renderState.device &&
    renderState.context &&
    renderState.videoPipeline &&
    renderState.lipstickPipeline &&
    renderState.videoBindGroupLayout &&
    renderState.videoSampler &&
    renderState.vertexBuffer
  );

  console.log('[COMPONENT_BODY_RENDER] allResourcesReady:', allResourcesReady, {
    landmarker: !!landmarker,
    device: !!renderState.device,
    context: !!renderState.context,
    videoPipeline: !!renderState.videoPipeline,
    lipstickPipeline: !!renderState.lipstickPipeline,
    videoBindGroupLayout: !!renderState.videoBindGroupLayout,
    videoSampler: !!renderState.videoSampler,
    vertexBuffer: !!renderState.vertexBuffer,
  });
  // END OF NEW DIAGNOSTIC LOG

  // Effect 3: Update UI Message when all resources are ready
  useEffect(() => {
    if (allResourcesReady) {
      setDebugMessage("Live Tracking Active!"); // State update, will trigger re-render
      console.log("[UI_MSG_EFFECT] Resources ready. UI message set to 'Live Tracking Active!'.");
    }
  }, [allResourcesReady]); // Depends only on the derived boolean

  // Effect 4: Manage the Render Loop
  useEffect(() => {
    if (!allResourcesReady) {
      // This log will now also benefit from the detailed breakdown above
      console.log("[RENDER_LOOP_EFFECT] Conditions NOT YET MET for starting render loop.");
      if (renderState.renderRequestId) {
        console.log("[RENDER_LOOP_EFFECT] Resources no longer ready, stopping previous loop.");
        cancelAnimationFrame(renderState.renderRequestId);
        renderState.renderRequestId = null;
      }
      return;
    }

    console.log("[RENDER_LOOP_EFFECT] All resources ready. Starting render loop mechanism.");
    
    const render = async () => {
      if (!renderState.device) {
        console.warn(`[RENDER ${frameCounter.current}] Loop aborted: Device lost.`);
        renderState.renderRequestId = null; return;
      }
      frameCounter.current++;
      if (!videoRef.current || videoRef.current.readyState < videoRef.current.HAVE_ENOUGH_DATA) {
        renderState.renderRequestId = requestAnimationFrame(render); return;
      }
      const videoFrame = videoRef.current;
      let numLipVertices = 0;
      try {
        const now = performance.now();
        const results = landmarker.detectForVideo(videoFrame, now);
        if (results?.faceLandmarks?.length > 0) {
          const lm = results.faceLandmarks[0];
          const lips = lipTriangles.map(([a, b, c]) => [lm[a], lm[b], lm[c]]);
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
      const passEnc = cmdEnc.beginRenderPass({ colorAttachments: [{ view: texView, loadOp: 'clear', storeOp: 'store', clearValue: { r: 0.1, g: 0.1, b: 0.15, a: 1.0 } }] });
      passEnc.setPipeline(renderState.videoPipeline); passEnc.setBindGroup(0, frameBindGroup); passEnc.draw(6);
      if (numLipVertices > 0) { passEnc.setPipeline(renderState.lipstickPipeline); passEnc.setVertexBuffer(0, renderState.vertexBuffer); passEnc.draw(numLipVertices); }
      passEnc.end();
      renderState.device.queue.submit([cmdEnc.finish()]);

      if (frameCounter.current === 1) {
        console.log(`[RENDER 1] First frame drawn. Expect blue debug screen. Subsequent frames should follow.`);
      }
      if (renderState.device) {
        renderState.renderRequestId = requestAnimationFrame(render);
      } else {
        console.warn(`[RENDER ${frameCounter.current}] Device became null post-submit. Loop stopping.`);
        renderState.renderRequestId = null;
      }
    };
    console.log("[RENDER_LOOP_EFFECT] Requesting first animation frame for the loop.");
    frameCounter.current = 0;
    renderState.renderRequestId = requestAnimationFrame(render);
    return () => { // Cleanup for Effect 4
      console.log(`[RENDER_LOOP_EFFECT_CLEANUP] Stopping render loop (ID: ${renderState.renderRequestId}).`);
      if (renderState.renderRequestId) cancelAnimationFrame(renderState.renderRequestId);
      renderState.renderRequestId = null;
    };
  }, [allResourcesReady, landmarker]); // landmarker is included as render() uses it directly.

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