// src/pages/LipstickMirrorLive.jsx (Reactive canvas sizing and context configuration)

import React, { useEffect, useRef, useState, useCallback } from 'react';
// Updated import name:
import initWebGPUEssentials from '@/utils/initWebGPUEssentials';
import createPipelines from '@/utils/createPipelines';
import lipTriangles from '@/utils/lipTriangles';
import { FaceLandmarker, FilesetResolver } from '@mediapipe/tasks-vision';

export default function LipstickMirrorLive() {
  const canvasRef = useRef(null);
  const videoRef = useRef(null);

  // State
  const [landmarker, setLandmarker] = useState(null);
  const [webGPUDevice, setWebGPUDevice] = useState(null); // Stores the GPUDevice
  const [webGPUFormat, setWebGPUFormat] = useState(null); // Stores the GPUCanvasFormat
  const [error, setError] = useState(null);
  const [debugMessage, setDebugMessage] = useState('Initializing...');
  const frameCounter = useRef(0);

  // Ref for WebGPU objects that don't trigger re-renders on their own modification
  const renderState = useRef({
    context: null, // GPUCanvasContext will be stored here
    videoPipeline: null, lipstickPipeline: null, videoBindGroupLayout: null,
    videoSampler: null, vertexBuffer: null, vertexBufferSize: 0,
    renderRequestId: null,
  }).current;


  // Effect 1: Initialize FaceLandmarker (no change)
  useEffect(() => {
    const initLandmarker = async () => {
      try {
        console.log("[LM_EFFECT] Initializing FaceLandmarker...");
        const vision = await FilesetResolver.forVisionTasks('https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm');
        const lm = await FaceLandmarker.createFromOptions(vision, {
          baseOptions: { modelAssetPath: '/models/face_landmarker.task', delegate: 'GPU' },
          outputFaceBlendshapes: false, runningMode: 'VIDEO', numFaces: 1,
        });
        setLandmarker(lm); console.log("[LM_EFFECT] FaceLandmarker ready.");
      } catch (err) { console.error("[LM_EFFECT] Error initializing FaceLandmarker:", err); setError(`FaceLandmarker init failed: ${err.message}`); setDebugMessage("Error."); }
    };
    initLandmarker();
  }, []);

  // Effect 2: Initialize WebGPU Device and Format, Video Stream
  useEffect(() => {
    if (!canvasRef.current || !videoRef.current) { console.log("[DEVICE_INIT_EFFECT] Skipping: Canvas or Video ref not ready."); return; }
    let isCleanup = false;
    const initEssentials = async () => {
      try {
        console.log("[DEVICE_INIT_EFFECT] Initializing Camera, WebGPU Device & Format...");
        // Video Setup
        if (!navigator.mediaDevices?.getUserMedia) throw new Error("Camera not supported.");
        const stream = await navigator.mediaDevices.getUserMedia({ video: { width: 640, height: 480 } });
        if (isCleanup) { stream.getTracks().forEach(t => t.stop()); return; }
        videoRef.current.srcObject = stream;
        await new Promise((res, rej) => {
          videoRef.current.onloadedmetadata = () => { console.log(`[DEVICE_INIT_EFFECT] Video metadata loaded: ${videoRef.current.videoWidth}x${videoRef.current.videoHeight}`); res(); };
          videoRef.current.onerror = () => rej(new Error("Video load error."));
        });
        await videoRef.current.play(); console.log("[DEVICE_INIT_EFFECT] Video playback started.");

        // WebGPU Device and Format
        if (!navigator.gpu) throw new Error("WebGPU not supported.");
        const { device, format } = await initWebGPUEssentials(canvasRef.current); // Calls updated util
        setWebGPUDevice(device); // Set state
        setWebGPUFormat(format); // Set state
        console.log("[DEVICE_INIT_EFFECT] WebGPU Device and Format obtained and set in state.");

        device.lost.then((info) => {
          console.error(`[DEVICE_LOST_HANDLER] WebGPU device lost: ${info.message}`);
          setError(`Device lost: ${info.message}`); setDebugMessage("Error: Device Lost.");
          if (renderState.renderRequestId) cancelAnimationFrame(renderState.renderRequestId);
          renderState.renderRequestId = null; setWebGPUDevice(null); // Clear device state
        });

        // Pipelines and other resources that depend only on device and format
        // Note: context is not available yet here.
        const pipes = await createPipelines(device, format); // createPipelines needs device and format
        renderState.videoPipeline = pipes.videoPipeline; renderState.lipstickPipeline = pipes.lipstickPipeline;
        renderState.videoBindGroupLayout = pipes.videoBindGroupLayout;
        console.log("[DEVICE_INIT_EFFECT] WebGPU Pipelines created.");
        renderState.videoSampler = device.createSampler({ magFilter: 'linear', minFilter: 'linear' });
        console.log("[DEVICE_INIT_EFFECT] WebGPU Sampler created.");
        renderState.vertexBufferSize = 2048;
        renderState.vertexBuffer = device.createBuffer({ size: renderState.vertexBufferSize, usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST });
        console.log("[DEVICE_INIT_EFFECT] WebGPU Vertex Buffer created.");
        console.log("[DEVICE_INIT_EFFECT] GPU/Video Device, Format, and dependent resources initialized.");
      } catch (err) { console.error("[DEVICE_INIT_EFFECT] Initialization failed:", err); setError(`Setup failed: ${err.message}`); setDebugMessage("Error."); setWebGPUDevice(null); }
    };
    initEssentials();
    return () => {
      console.log("[DEVICE_INIT_EFFECT_CLEANUP] Cleaning up..."); isCleanup = true;
      videoRef.current?.srcObject?.getTracks().forEach(t => t.stop()); if(videoRef.current) videoRef.current.srcObject = null;
      renderState.vertexBuffer?.destroy(); 
      // Device object itself is not destroyed by us, browser handles it or device.destroy() if needed
      setWebGPUDevice(null); // Clear device from state
      renderState.context = null; // Clear context from ref
      console.log("[DEVICE_INIT_EFFECT_CLEANUP] Cleanup finished.");
    };
  }, []); // Runs once

  // Effect 3: Handle Canvas Sizing and WebGPU Context Configuration (Reactive to device/format)
  useEffect(() => {
    if (!webGPUDevice || !webGPUFormat || !canvasRef.current) {
      console.log("[CONTEXT_CONFIG_EFFECT] Waiting for device, format, or canvas ref.");
      return;
    }
    const canvas = canvasRef.current;
    const device = webGPUDevice;
    const format = webGPUFormat;
    let currentContext = canvas.getContext('webgpu'); // Get or re-get context

    const resizeAndConfigureCanvas = () => {
      if (!currentContext) { // If context was lost or not yet obtained
          currentContext = canvas.getContext('webgpu');
          if(!currentContext) {
              console.error("[resizeAndConfigureCanvas] Failed to get context inside resize handler.");
              setError("Failed to get WebGPU context for resize.");
              return;
          }
      }
      const dpr = window.devicePixelRatio || 1;
      const displayWidth = Math.floor(canvas.clientWidth * dpr);
      const displayHeight = Math.floor(canvas.clientHeight * dpr);

      if (canvas.width !== displayWidth || canvas.height !== displayHeight) {
        canvas.width = displayWidth;
        canvas.height = displayHeight;
        console.log(`[resizeAndConfigureCanvas] Canvas buffer UPDATED to: ${canvas.width}x${canvas.height}. DPR: ${dpr}`);
      }
      
      try {
        currentContext.configure({
          device,
          format,
          alphaMode: 'opaque', // Match successful example
          size: [canvas.width, canvas.height] // Use current canvas physical dimensions
        });
        renderState.context = currentContext; // Store the configured context
        console.log(`[resizeAndConfigureCanvas] Context configured. Size: ${canvas.width}x${canvas.height}`);
      } catch (e) {
        console.error("[resizeAndConfigureCanvas] Error configuring context:", e);
        setError("Error configuring WebGPU context.");
        renderState.context = null; // Ensure context is null on error
      }
    };

    resizeAndConfigureCanvas(); // Initial call for this effect

    window.addEventListener('resize', resizeAndConfigureCanvas);
    console.log("[CONTEXT_CONFIG_EFFECT] Initial canvas size and context config done. Resize listener added.");

    return () => {
      window.removeEventListener('resize', resizeAndConfigureCanvas);
      console.log("[CONTEXT_CONFIG_EFFECT_CLEANUP] Resize listener removed.");
      // renderState.context = null; // Optionally nullify context here
    };
  }, [webGPUDevice, webGPUFormat]); // Runs when device or format changes


  // Derived state to check if everything is ready for rendering
  const allResourcesReady = !!(
    landmarker &&
    webGPUDevice &&         // Check GPUDevice from state
    renderState.context &&  // Check GPUCanvasContext from ref (set by Effect 3)
    renderState.videoPipeline // And other pipeline resources
  );

  console.log('[COMPONENT_BODY_RENDER] allResourcesReady:', allResourcesReady, {
    lm: !!landmarker, device: !!webGPUDevice, ctx: !!renderState.context, pipe:!!renderState.videoPipeline
  });

  // Effect 4: Update UI Message (no change)
  useEffect(() => {
    if (allResourcesReady) { setDebugMessage("Live Tracking Active!"); console.log("[UI_MSG_EFFECT] Resources ready. UI message set."); }
    else { setDebugMessage("Initializing resources..."); }
  }, [allResourcesReady]);

  // Effect 5: Manage the Render Loop
  useEffect(() => {
    if (!allResourcesReady) {
      // console.log("[RENDER_LOOP_EFFECT] Conditions NOT YET MET (allResourcesReady is false).");
      if (renderState.renderRequestId) { /* console.log("[RENDER_LOOP_EFFECT] Stopping previous loop."); */ cancelAnimationFrame(renderState.renderRequestId); renderState.renderRequestId = null; }
      return;
    }
    // Double check device and context directly before starting render function
    if (!webGPUDevice || !renderState.context?.canvas) {
        console.error("[RENDER_LOOP_EFFECT] CRITICAL: Device or context.canvas is null despite allResourcesReady. Aborting.", {device: !!webGPUDevice, contextCanvas: !!renderState.context?.canvas});
        return;
    }
    console.log("[RENDER_LOOP_EFFECT] All resources ready. Starting render loop.");
    
    const render = async () => {
      if (!webGPUDevice || !renderState.context) { console.warn(`[RENDER ${frameCounter.current}] Loop aborted: Device or Context lost.`); renderState.renderRequestId = null; return; }
      frameCounter.current++;

      if (!videoRef.current || videoRef.current.readyState < videoRef.current.HAVE_ENOUGH_DATA || videoRef.current.videoWidth === 0) {
        renderState.renderRequestId = requestAnimationFrame(render); return;
      }
      // ... (rest of the render function: landmark detection, buffer updates, draw calls - REMAINS THE SAME including setViewport and setScissorRect)
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
            // console.log(`[RENDER ${frameCounter.current}] Landmark Spread: X[${minX.toFixed(3)}-${maxX.toFixed(3)}], Y[${minY.toFixed(3)}-${maxY.toFixed(3)}]`);
          }
          const lips = lipTriangles.map(([a, b, c]) => [allFaceLandmarks[a], allFaceLandmarks[b], allFaceLandmarks[c]]);
          const v = new Float32Array(lips.flat().map(pt => [(0.5 - pt.x) * 2, (0.5 - pt.y) * 2]).flat());
          numLipVertices = v.length / 2;
          if (v.byteLength > 0) {
            if (v.byteLength <= renderState.vertexBufferSize) webGPUDevice.queue.writeBuffer(renderState.vertexBuffer, 0, v);
            else { /* console.warn(`[RENDER ${frameCounter.current}] Vertex data too large.`); */ numLipVertices = 0; }
          } else numLipVertices = 0;
        } else numLipVertices = 0;
      } catch (e) { /* console.error(`[RENDER ${frameCounter.current}] Landmark/vertex error:`, e); */ numLipVertices = 0; }

      let videoTextureGPU, frameBindGroup;
      try {
        videoTextureGPU = webGPUDevice.importExternalTexture({ source: videoFrame });
        frameBindGroup = webGPUDevice.createBindGroup({ layout: renderState.videoBindGroupLayout, entries: [{ binding: 0, resource: renderState.videoSampler }, { binding: 1, resource: videoTextureGPU }] });
      } catch (e) { /* console.error(`[RENDER ${frameCounter.current}] Texture/BindGroup error:`, e); */ renderState.renderRequestId = requestAnimationFrame(render); return; }

      const cmdEnc = webGPUDevice.createCommandEncoder();
      const texView = renderState.context.getCurrentTexture().createView();
      
      const canvasPhysicalWidth = renderState.context.canvas.width;
      const canvasPhysicalHeight = renderState.context.canvas.height;

      const passEnc = cmdEnc.beginRenderPass({
        colorAttachments: [{ view: texView, loadOp: 'clear', storeOp: 'store', clearValue: { r: 0.0, g: 0.0, b: 1.0, a: 1.0 } }] // Blue clear
      });

      passEnc.setViewport(0, 0, canvasPhysicalWidth, canvasPhysicalHeight, 0, 1);
      passEnc.setScissorRect(0, 0, canvasPhysicalWidth, canvasPhysicalHeight);
      if (frameCounter.current % 60 === 1) { console.log(`[RENDER ${frameCounter.current}] Viewport & ScissorRect set to: 0,0,${canvasPhysicalWidth},${canvasPhysicalHeight}`); }

      passEnc.setPipeline(renderState.videoPipeline); passEnc.setBindGroup(0, frameBindGroup); passEnc.draw(6);
      if (numLipVertices > 0) { passEnc.setPipeline(renderState.lipstickPipeline); passEnc.setVertexBuffer(0, renderState.vertexBuffer); passEnc.draw(numLipVertices); }
      passEnc.end();
      webGPUDevice.queue.submit([cmdEnc.finish()]);

      if (frameCounter.current === 1) { console.log(`[RENDER 1] First frame drawn. Subsequent frames should follow.`); }
      if (webGPUDevice) { renderState.renderRequestId = requestAnimationFrame(render); }
      else { /* console.warn(`[RENDER ${frameCounter.current}] Device became null post-submit.`); */ renderState.renderRequestId = null; }
    };
    console.log("[RENDER_LOOP_EFFECT] Requesting first animation frame for the loop.");
    frameCounter.current = 0; renderState.renderRequestId = requestAnimationFrame(render);
    return () => {
      console.log(`[RENDER_LOOP_EFFECT_CLEANUP] Stopping render loop (ID: ${renderState.renderRequestId}).`);
      if (renderState.renderRequestId) cancelAnimationFrame(renderState.renderRequestId); renderState.renderRequestId = null;
    };
  }, [allResourcesReady, landmarker, webGPUDevice]); // Added webGPUDevice to deps

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