// src/pages/LipstickMirrorLive.jsx (Final attempt to mirror minimal example's canvas/context setup)

import React, { useEffect, useRef, useState } from 'react';
import initWebGPUEssentials from '@/utils/initWebGPUEssentials';
import createPipelines from '@/utils/createPipelines';
import lipTriangles from '@/utils/lipTriangles';
import { FaceLandmarker, FilesetResolver } from '@mediapipe/tasks-vision';

export default function LipstickMirrorLive() {
  const canvasRef = useRef(null);
  const videoRef = useRef(null);

  const [landmarker, setLandmarker] = useState(null);
  const [webGPUDevice, setWebGPUDevice] = useState(null);
  const [webGPUFormat, setWebGPUFormat] = useState(null);
  const [error, setError] = useState(null);
  const [debugMessage, setDebugMessage] = useState('Initializing...');
  const frameCounter = useRef(0);

  const renderState = useRef({
    context: null, videoPipeline: null, lipstickPipeline: null, videoBindGroupLayout: null,
    videoSampler: null, vertexBuffer: null, vertexBufferSize: 0, renderRequestId: null,
  }).current;

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
        setLandmarker(lm); console.log("[LM_EFFECT] FaceLandmarker ready.");
      } catch (err) { console.error("[LM_EFFECT] Error initializing FaceLandmarker:", err); setError(`LM init failed: ${err.message}`); setDebugMessage("Error."); }
    };
    initLandmarker();
  }, []);

  // Effect 2: Initialize WebGPU Device, Format, Video, and Device-dependent resources
  useEffect(() => {
    if (!canvasRef.current || !videoRef.current) { console.log("[DEVICE_INIT_EFFECT] Skipping: Canvas/Video ref missing."); return; }
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
          videoRef.current.onloadedmetadata = () => { console.log(`[DEVICE_INIT_EFFECT] Video metadata: ${videoRef.current.videoWidth}x${videoRef.current.videoHeight}`); res(); };
          videoRef.current.onerror = () => rej(new Error("Video load error."));
        });
        await videoRef.current.play(); console.log("[DEVICE_INIT_EFFECT] Video playback started.");

        // WebGPU Device and Format
        if (!navigator.gpu) throw new Error("WebGPU not supported.");
        const { device, format } = await initWebGPUEssentials(canvasRef.current);
        setWebGPUDevice(device); setWebGPUFormat(format);
        console.log("[DEVICE_INIT_EFFECT] WebGPU Device & Format obtained.");

        device.lost.then((info) => {
          console.error(`[DEVICE_LOST_HANDLER] WebGPU device lost: ${info.message}`);
          setError(`Device lost: ${info.message}`); setDebugMessage("Error: Device Lost.");
          if (renderState.renderRequestId) cancelAnimationFrame(renderState.renderRequestId);
          renderState.renderRequestId = null; setWebGPUDevice(null); renderState.context = null;
        });

        const pipes = await createPipelines(device, format);
        renderState.videoPipeline = pipes.videoPipeline; renderState.lipstickPipeline = pipes.lipstickPipeline;
        renderState.videoBindGroupLayout = pipes.videoBindGroupLayout;
        renderState.videoSampler = device.createSampler({ magFilter: 'linear', minFilter: 'linear' });
        renderState.vertexBufferSize = 2048;
        renderState.vertexBuffer = device.createBuffer({ size: renderState.vertexBufferSize, usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST });
        console.log("[DEVICE_INIT_EFFECT] Device-dependent resources created.");
      } catch (err) { console.error("[DEVICE_INIT_EFFECT] Init failed:", err); setError(`Setup failed: ${err.message}`); setDebugMessage("Error."); setWebGPUDevice(null); }
    };
    initEssentials();
    return () => {
      console.log("[DEVICE_INIT_EFFECT_CLEANUP] Cleaning up..."); isCleanup = true;
      videoRef.current?.srcObject?.getTracks().forEach(t => t.stop()); if(videoRef.current) videoRef.current.srcObject = null;
      renderState.vertexBuffer?.destroy(); setWebGPUDevice(null); renderState.context = null;
      console.log("[DEVICE_INIT_EFFECT_CLEANUP] Cleanup finished.");
    };
  }, []);

  // Effect 3: Handle Canvas Sizing and WebGPU Context Configuration
  useEffect(() => {
    const canvas = canvasRef.current; // Get canvas element from ref
    if (!webGPUDevice || !webGPUFormat || !canvas) {
      console.log("[CONTEXT_CONFIG_EFFECT] Waiting for device, format, or canvas DOM element.");
      // If context existed, it might now be invalid if device changed, so clear it
      if (renderState.context) {
          console.log("[CONTEXT_CONFIG_EFFECT] Device/format changed, clearing old context from ref.");
          renderState.context = null;
      }
      return;
    }

    const device = webGPUDevice; // Use device from state
    const format = webGPUFormat; // Use format from state
    
    // This function now closely mimics ChatGPT's successful resizeCanvas
    const configureCanvasContext = () => {
      console.log("[configureCanvasContext] Attempting to configure canvas context.");
      const ctx = canvas.getContext('webgpu'); // Get context freshly
      if (!ctx) {
        console.error("[configureCanvasContext] Failed to get 'webgpu' context from canvas.");
        setError("Failed to get WebGPU context.");
        renderState.context = null; // Ensure it's null
        return;
      }

      const dpr = window.devicePixelRatio || 1;
      // Ensure clientWidth/Height are read after canvas is in DOM and styled
      const displayWidth = Math.floor(canvas.clientWidth * dpr);
      const displayHeight = Math.floor(canvas.clientHeight * dpr);

      if (canvas.width !== displayWidth || canvas.height !== displayHeight) {
        canvas.width = displayWidth;
        canvas.height = displayHeight;
        console.log(`[configureCanvasContext] Canvas buffer size SET to (physical pixels): ${canvas.width}x${canvas.height}. DPR: ${dpr}, ClientW/H: ${canvas.clientWidth}x${canvas.clientHeight}`);
      } else {
        console.log(`[configureCanvasContext] Canvas buffer size ALREADY matches: ${canvas.width}x${canvas.height}.`);
      }
      
      try {
        ctx.configure({
          device,
          format,
          alphaMode: 'opaque', // Match successful example
          size: [canvas.width, canvas.height] // Use current canvas physical dimensions
        });
        renderState.context = ctx; // Store the successfully configured context
        console.log(`[configureCanvasContext] Context CONFIGURED. Size: ${canvas.width}x${canvas.height}`);
        // Trigger a single render if the loop isn't running yet, or just let the loop pick it up.
        // This could also be a good place to trigger the very first render if the main loop depends on context.
      } catch (e) {
        console.error("[configureCanvasContext] Error configuring context:", e);
        setError("Error configuring WebGPU context.");
        renderState.context = null;
      }
    };

    configureCanvasContext(); // Initial configuration attempt for this effect run

    window.addEventListener('resize', configureCanvasContext);
    console.log("[CONTEXT_CONFIG_EFFECT] Initial config done. Resize listener added.");

    return () => {
      window.removeEventListener('resize', configureCanvasContext);
      console.log("[CONTEXT_CONFIG_EFFECT_CLEANUP] Resize listener removed.");
      // renderState.context = null; // Context might be lost if device is lost, handled by device.lost
    };
  }, [webGPUDevice, webGPUFormat]); // Re-run if device/format changes (e.g. device lost and reacquired)


  const allResourcesReady = !!(landmarker && webGPUDevice && renderState.context && renderState.videoPipeline);
  console.log('[COMPONENT_BODY_RENDER] allResourcesReady:', allResourcesReady, { lm: !!landmarker, dev: !!webGPUDevice, ctx: !!renderState.context, pipe:!!renderState.videoPipeline});

  useEffect(() => {
    if (allResourcesReady) { setDebugMessage("Live Tracking Active!"); console.log("[UI_MSG_EFFECT] Resources ready. UI message set."); }
    else { setDebugMessage("Initializing..."); } // Simplified fallback message
  }, [allResourcesReady]);

  // Effect for Render Loop
  useEffect(() => {
    if (!allResourcesReady) {
      if (renderState.renderRequestId) { cancelAnimationFrame(renderState.renderRequestId); renderState.renderRequestId = null; }
      return;
    }
    if (!webGPUDevice || !renderState.context?.canvas) {
        console.error("[RENDER_LOOP_EFFECT] CRITICAL: Device or context.canvas missing despite allResourcesReady. Aborting."); return;
    }
    console.log("[RENDER_LOOP_EFFECT] Starting render loop.");
    const render = async () => {
      if (!webGPUDevice || !renderState.context) { console.warn(`[RENDER ${frameCounter.current}] Loop aborted: No Device/Context.`); renderState.renderRequestId = null; return; }
      frameCounter.current++;
      if (!videoRef.current || videoRef.current.readyState < videoRef.current.HAVE_ENOUGH_DATA || videoRef.current.videoWidth === 0) {
        renderState.renderRequestId = requestAnimationFrame(render); return;
      }
      const videoFrame = videoRef.current;
      if (frameCounter.current % 120 === 1) { console.log(`[RENDER ${frameCounter.current}] Video dims: ${videoFrame.videoWidth}x${videoFrame.videoHeight}`); }

      let numLipVertices = 0;
      try {
        const now = performance.now();
        const results = landmarker.detectForVideo(videoFrame, now);
        if (results?.faceLandmarks?.length > 0) {
          // ... (landmark processing remains the same)
          const allFaceLandmarks = results.faceLandmarks[0];
          if (allFaceLandmarks && frameCounter.current % 120 === 1) { /* landmark spread log */ }
          const lips = lipTriangles.map(([a,b,c]) => [allFaceLandmarks[a],allFaceLandmarks[b],allFaceLandmarks[c]]);
          const v = new Float32Array(lips.flat().map(pt => [(0.5-pt.x)*2, (0.5-pt.y)*2]).flat());
          numLipVertices = v.length/2;
          if(v.byteLength > 0) { if(v.byteLength <= renderState.vertexBufferSize) webGPUDevice.queue.writeBuffer(renderState.vertexBuffer,0,v); else numLipVertices=0; } else numLipVertices=0;
        } else numLipVertices = 0;
      } catch (e) { numLipVertices = 0; }

      let videoTextureGPU, frameBindGroup;
      try {
        videoTextureGPU = webGPUDevice.importExternalTexture({ source: videoFrame });
        frameBindGroup = webGPUDevice.createBindGroup({ layout: renderState.videoBindGroupLayout, entries: [{binding:0,resource:renderState.videoSampler},{binding:1,resource:videoTextureGPU}]});
      } catch (e) { renderState.renderRequestId = requestAnimationFrame(render); return; }

      const cmdEnc = webGPUDevice.createCommandEncoder();
      const texView = renderState.context.getCurrentTexture().createView();
      const canvasPhysicalWidth = renderState.context.canvas.width;
      const canvasPhysicalHeight = renderState.context.canvas.height;
      const passEnc = cmdEnc.beginRenderPass({colorAttachments:[{view:texView,clearValue:{r:0.0,g:0.0,b:1.0,a:1.0},loadOp:'clear',storeOp:'store'}]});
      passEnc.setViewport(0,0,canvasPhysicalWidth,canvasPhysicalHeight,0,1);
      passEnc.setScissorRect(0,0,canvasPhysicalWidth,canvasPhysicalHeight);
      if (frameCounter.current % 120 === 1) { console.log(`[RENDER ${frameCounter.current}] Viewport&Scissor: 0,0,${canvasPhysicalWidth},${canvasPhysicalHeight}`); }
      passEnc.setPipeline(renderState.videoPipeline); passEnc.setBindGroup(0,frameBindGroup); passEnc.draw(6);
      if(numLipVertices>0){passEnc.setPipeline(renderState.lipstickPipeline); passEnc.setVertexBuffer(0,renderState.vertexBuffer); passEnc.draw(numLipVertices);}
      passEnc.end();
      webGPUDevice.queue.submit([cmdEnc.finish()]);

      if(frameCounter.current === 1) { console.log(`[RENDER 1] First frame drawn.`); }
      if(webGPUDevice) { renderState.renderRequestId = requestAnimationFrame(render); }
      else { renderState.renderRequestId = null; }
    };
    frameCounter.current = 0; renderState.renderRequestId = requestAnimationFrame(render);
    return () => {
      console.log(`[RENDER_LOOP_EFFECT_CLEANUP] Stopping render loop.`);
      if (renderState.renderRequestId) cancelAnimationFrame(renderState.renderRequestId);
      renderState.renderRequestId = null;
    };
  }, [allResourcesReady, landmarker, webGPUDevice]); // webGPUDevice is a dependency

  return (
    <div style={{ width: '640px', height: '480px', margin: 'auto', border: '1px solid #ccc', position: 'relative', overflow: 'hidden' }}>
      <div style={{position:'absolute',top:'5px',left:'5px',background:'rgba(0,0,0,0.7)',color:'white',padding:'2px 5px',fontSize:'12px',zIndex:10,pointerEvents:'none'}}>
        {error ? `Error: ${error}` : debugMessage} (Frame: {frameCounter.current})
      </div>
      <video ref={videoRef} style={{position:'absolute',top:0,left:0,width:'100%',height:'100%',objectFit:'cover',opacity:0,pointerEvents:'none',zIndex:1}} width={640} height={480} autoPlay playsInline muted />
      <canvas ref={canvasRef} width={640} height={480} style={{position:'absolute',top:0,left:0,width:'100%',height:'100%',zIndex:2}} />
    </div>
  );
}