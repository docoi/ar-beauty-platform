// src/pages/LipstickMirrorLive_Clone.jsx (Use useRef for landmarker in render loop)

import React, { useEffect, useRef, useState } from 'react';
import createPipelines from '@/utils/createPipelines'; 
import lipTriangles from '@/utils/lipTriangles'; 
import { FaceLandmarker, FilesetResolver } from '@mediapipe/tasks-vision';

export default function LipstickMirrorLive_Clone() {
  const canvasRef = useRef(null);
  const videoRef = useRef(null); 

  const animationFrameIdRef = useRef(null);
  const frameCounter = useRef(0);
  const resizeHandlerRef = useRef(null);
  
  const deviceRef = useRef(null); 
  const contextRef = useRef(null);
  const formatRef = useRef(null);
  const pipelineStateRef = useRef({ /* ... as before ... */ });
  const landmarkerRef = useRef(null); // NEW: Ref for landmarker instance

  const [landmarkerState, setLandmarkerState] = useState(null); // Keep state for triggering effects if needed
  const [error, setError] = useState(null);
  const [debugMessage, setDebugMessage] = useState('Initializing...');
  
  useEffect(() => {
    console.log("[LML_Clone S2_FixStaleLM] useEffect running.");
    let deviceInternal = null; let contextInternal = null; let formatInternal = null;
    let resizeObserverInternal = null; let renderLoopStartedInternal = false;
    const canvasElement = canvasRef.current; const videoElement = videoRef.current;
    if (!canvasElement || !videoElement) { /* ... */ return; }

    const configureCanvas = (entries) => { /* ... same as before ... */ };
    resizeHandlerRef.current = configureCanvas;

    const render = async () => {
      const currentDevice = deviceRef.current; 
      const currentContext = contextRef.current;
      const currentVideoEl = videoRef.current; 
      const pState = pipelineStateRef.current;
      const activeLandmarkerInstance = landmarkerRef.current; // Use landmarker from REF

      if (!currentDevice || !currentContext || !pState.videoPipeline || !pState.lipstickPipeline || !currentVideoEl) {
        animationFrameIdRef.current = requestAnimationFrame(render); return; 
      }
      frameCounter.current++;
      if (currentVideoEl.readyState < currentVideoEl.HAVE_ENOUGH_DATA || currentVideoEl.videoWidth === 0) {
        animationFrameIdRef.current = requestAnimationFrame(render); return;
      }
      
      if (pState.aspectRatioUniformBuffer) { /* ... update buffer ... */ }

      let numLipVertices = 0; 
      // Use activeLandmarkerInstance from ref now
      if (activeLandmarkerInstance && pState.vertexBuffer) { 
        if (frameCounter.current % 60 === 2 || frameCounter.current === 1) { 
            console.log(`[LML_Clone S2_FixStaleLM RENDER ${frameCounter.current}] Attempting landmark detection. LandmarkerRef ready: ${!!activeLandmarkerInstance}`);
        }
        try {
          const now = performance.now(); 
          // Use activeLandmarkerInstance for detection
          const results = activeLandmarkerInstance.detectForVideo(currentVideoEl, now); 
          
          if (results?.faceLandmarks?.length > 0) {
            // ... (rest of landmark processing and vertex buffer update is THE SAME) ...
            const allFaceLm = results.faceLandmarks[0];
            if ((frameCounter.current % 60 === 2 || frameCounter.current === 1) && allFaceLm) { console.log(`[LML_Clone S2_FixStaleLM RENDER ${frameCounter.current}] Face landmarks detected. Count: ${allFaceLm.length}`);}
            const lips = lipTriangles.map(([idxA, idxB, idxC]) => { /* ... bounds checking ... */ if (allFaceLm && idxA < allFaceLm.length && idxB < allFaceLm.length && idxC < allFaceLm.length && allFaceLm[idxA] && allFaceLm[idxB] && allFaceLm[idxC]) {return [allFaceLm[idxA], allFaceLm[idxB], allFaceLm[idxC]];} return null; }).filter(tri => tri !== null);
            if (lips.length > 0) { const lipVertexData = new Float32Array(lips.flat().map(pt => [(0.5 - pt.x) * 2, (0.5 - pt.y) * 2]).flat()); numLipVertices = lipVertexData.length / 2; if(lipVertexData.byteLength > 0){ if(lipVertexData.byteLength <= pState.vertexBufferSize) {currentDevice.queue.writeBuffer(pState.vertexBuffer, 0, lipVertexData);} else {numLipVertices = 0;}} else {numLipVertices = 0;}} else {numLipVertices = 0;}
          } else { if (frameCounter.current % 60 === 2 || frameCounter.current === 1) {console.log(`[LML_Clone S2_FixStaleLM RENDER ${frameCounter.current}] No face landmarks detected.`);} numLipVertices = 0; }
        } catch (e) { console.error(`[LML_Clone S2_FixStaleLM RENDER ${frameCounter.current}] Error landmarker processing:`, e); numLipVertices = 0; }
      } else {
          if (frameCounter.current % 60 === 2 || frameCounter.current === 1) {
              console.log(`[LML_Clone S2_FixStaleLM RENDER ${frameCounter.current}] Skipping landmark detection: LandmarkerRef not ready (${!!activeLandmarkerInstance}) or VertexBuffer not ready (${!!pState.vertexBuffer}).`);
          }
      }
      
      // ... (video texture, bind groups, getCurrentTexture, command encoder, render pass, viewport/scissor) ...
      // ... (video draw call) ...
      let videoTextureGPU, frameBindGroupForTexture; try { videoTextureGPU = currentDevice.importExternalTexture({ source: currentVideoEl }); if (pState.videoBindGroupLayout && pState.videoSampler) { frameBindGroupForTexture = currentDevice.createBindGroup({ layout: pState.videoBindGroupLayout, entries: [{binding:0,resource:pState.videoSampler},{binding:1,resource:videoTextureGPU}]}); } else { animationFrameIdRef.current = requestAnimationFrame(render); return; } } catch (e) { animationFrameIdRef.current = requestAnimationFrame(render); return; }
      let currentGpuTexture, texView; try { currentGpuTexture = currentContext.getCurrentTexture(); texView = currentGpuTexture.createView(); } catch(e) { if(resizeHandlerRef.current) resizeHandlerRef.current(); animationFrameIdRef.current = requestAnimationFrame(render); return; }
      const cmdEnc = currentDevice.createCommandEncoder(); const passEnc = cmdEnc.beginRenderPass({colorAttachments:[{view:texView,clearValue:{r:0.0,g:0.0,b:0.0,a:1.0},loadOp:'clear',storeOp:'store'}]});
      passEnc.setViewport(0,0,currentGpuTexture.width,currentGpuTexture.height,0,1); passEnc.setScissorRect(0,0,currentGpuTexture.width,currentGpuTexture.height);
      if (pState.videoPipeline && frameBindGroupForTexture && pState.aspectRatioBindGroup) { passEnc.setPipeline(pState.videoPipeline); passEnc.setBindGroup(0, frameBindGroupForTexture); passEnc.setBindGroup(1, pState.aspectRatioBindGroup); passEnc.draw(6); }
      
      // --- Draw Lipstick Overlay ---
      if(numLipVertices > 0 && pState.lipstickPipeline && pState.vertexBuffer){
        passEnc.setPipeline(pState.lipstickPipeline); 
        passEnc.setVertexBuffer(0, pState.vertexBuffer); 
        passEnc.draw(numLipVertices); 
        if (frameCounter.current % 60 === 2 || frameCounter.current === 1) console.log(`[LML_Clone S2_FixStaleLM RENDER ${frameCounter.current}] EXECUTED LIP DRAW CALL for ${numLipVertices} vertices.`);
      } else {
        if ((frameCounter.current % 60 === 2 || frameCounter.current === 1) && pState.lipstickPipeline && pState.vertexBuffer) {
             console.log(`[LML_Clone S2_FixStaleLM RENDER ${frameCounter.current}] SKIPPED LIP DRAW CALL. numLipVertices: ${numLipVertices}`);
        }
      }
      passEnc.end(); currentDevice.queue.submit([cmdEnc.finish()]);
      if(frameCounter.current === 1) { console.log(`[LML_Clone S2_FixStaleLM RENDER 1] First full frame attempt (video+lips).`); }
      animationFrameIdRef.current = requestAnimationFrame(render);
    }; 

    const initializeAll = async () => {
      if (!navigator.gpu) { setError("WebGPU not supported."); return; }
      setDebugMessage("Initializing Lipstick Try-On (S2 Fix)...");
      try {
        console.log("[LML_Clone S2_FixStaleLM initializeAll] Initializing FaceLandmarker...");
        const vision = await FilesetResolver.forVisionTasks('https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm');
        const lmInstance = await FaceLandmarker.createFromOptions(vision, { 
            baseOptions: { modelAssetPath: '/models/face_landmarker.task', delegate: 'GPU' },
            outputFaceBlendshapes: false, runningMode: 'VIDEO', numFaces: 1,
        });
        landmarkerRef.current = lmInstance; // Store in REF
        setLandmarkerState(lmInstance); // Also update state if other effects depend on it
        console.log("[LML_Clone S2_FixStaleLM initializeAll] FaceLandmarker ready and in ref.");

        // ... (Rest of initializeAll: WebGPU device, context, format, pipelines, video, ResizeObserver - REMAINS THE SAME) ...
        console.log("[LML_Clone S2_FixStaleLM initializeAll] Initializing WebGPU Device & Format...");
        const adapter = await navigator.gpu.requestAdapter(); if (!adapter) { setError("No GPU adapter."); return; }
        deviceInternal = await adapter.requestDevice(); deviceRef.current = deviceInternal; console.log("[LML_Clone S2_FixStaleLM initializeAll] Device obtained.");
        deviceInternal.lost.then((info) => { /* ... */ });
        contextInternal = canvasElement.getContext('webgpu'); contextRef.current = contextInternal; if (!contextInternal) { setError('No WebGPU context.'); return; }
        formatInternal = navigator.gpu.getPreferredCanvasFormat(); formatRef.current = formatInternal; console.log("[LML_Clone S2_FixStaleLM initializeAll] Context and Format obtained.");
        console.log("[LML_Clone S2_FixStaleLM initializeAll] Creating pipelines and GPU resources...");
        const { videoPipeline, lipstickPipeline, videoBindGroupLayout, aspectRatioGroupLayout } = await createPipelines(deviceInternal, formatInternal);
        pipelineStateRef.current = { ...pipelineStateRef.current, videoPipeline, lipstickPipeline, videoBindGroupLayout, aspectRatioGroupLayout };
        const uniformBufferSize = 4 * Float32Array.BYTES_PER_ELEMENT;
        pipelineStateRef.current.aspectRatioUniformBuffer = deviceInternal.createBuffer({ size: uniformBufferSize, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST });
        if (aspectRatioGroupLayout && pipelineStateRef.current.aspectRatioUniformBuffer) { pipelineStateRef.current.aspectRatioBindGroup = deviceInternal.createBindGroup({ layout: aspectRatioGroupLayout, entries: [{ binding: 0, resource: { buffer: pipelineStateRef.current.aspectRatioUniformBuffer }}]});}
        pipelineStateRef.current.videoSampler = deviceInternal.createSampler({ magFilter: 'linear', minFilter: 'linear' });
        pipelineStateRef.current.vertexBuffer = deviceInternal.createBuffer({ size: pipelineStateRef.current.vertexBufferSize, usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST });
        console.log("[LML_Clone S2_FixStaleLM initializeAll] All Pipelines and GPU resources created.");
        console.log("[LML_Clone S2_FixStaleLM initializeAll] Setting up video element...");
        if (!navigator.mediaDevices?.getUserMedia) throw new Error("Camera not supported.");
        const stream = await navigator.mediaDevices.getUserMedia({ video: { width: 640, height: 480 } });
        videoElement.srcObject = stream;
        await new Promise((res, rej) => { videoElement.onloadedmetadata = () => { console.log(`[LML_Clone S2_FixStaleLM initializeAll] Video metadata: ${videoElement.videoWidth}x${videoElement.videoHeight}`); res(); }; videoElement.onerror = () => rej(new Error("Video load error."));});
        await videoElement.play(); console.log("[LML_Clone S2_FixStaleLM initializeAll] Video playback started.");
        resizeObserverInternal = new ResizeObserver(resizeHandlerRef.current); resizeObserverInternal.observe(canvasElement);
        console.log("[LML_Clone S2_FixStaleLM initializeAll] ResizeObserver observing canvas.");
        if(resizeHandlerRef.current) resizeHandlerRef.current(); else console.error("[LML_Clone S2_FixStaleLM initializeAll] resizeHandlerRef.current is null");
        console.log("[LML_Clone S2_FixStaleLM initializeAll] All sub-initializations complete.");
        if (!renderLoopStartedInternal) { console.log("[LML_Clone S2_FixStaleLM initializeAll] Starting render loop."); render(); renderLoopStartedInternal = true; }
      } catch (err) { console.error("[LML_Clone S2_FixStaleLM initializeAll] Major error:", err); setError(`Init S2_FixStaleLM failed: ${err.message}`); }
    };
    initializeAll();
    return () => { /* ... cleanup (same as before, ensure landmarkerRef.current = null;) ... */
      console.log("[LML_Clone S2_FixStaleLM MAIN_EFFECT_CLEANUP] Cleaning up.");
      if (animationFrameIdRef.current) cancelAnimationFrame(animationFrameIdRef.current);
      if (resizeObserverInternal && canvasRef.current) resizeObserverInternal.unobserve(canvasRef.current);
      if (resizeObserverInternal) resizeObserverInternal.disconnect();
      videoRef.current?.srcObject?.getTracks().forEach(track => track.stop()); if(videoRef.current) videoRef.current.srcObject = null;
      const dvc = deviceRef.current; if (dvc) { pipelineStateRef.current.vertexBuffer?.destroy(); pipelineStateRef.current.aspectRatioUniformBuffer?.destroy(); }
      deviceRef.current = null; contextRef.current = null; formatRef.current = null; 
      landmarkerRef.current = null; setLandmarkerState(null); // Clear ref and state
    };
  }, []);

  useEffect(() => { 
    // UI Message depends on landmarkerState for reactivity
    if(landmarkerState && deviceRef.current && contextRef.current && pipelineStateRef.current.lipstickPipeline && !error) { 
        setDebugMessage("Live Lipstick Try-On (S2 FixedLM)");
    } else if (error) {
        setDebugMessage(`Error: ${String(error).substring(0,30)}...`);
    } else {
        setDebugMessage("Initializing Lipstick Try-On (S2 FixedLM)...");
    }
  }, [landmarkerState, deviceRef.current, contextRef.current, pipelineStateRef.current.lipstickPipeline, error]);

  return ( /* ... JSX (same as before) ... */
    <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, overflow: 'hidden', margin: 0, padding: 0, background: 'darkslateblue' }}>
      <div style={{ position:'absolute',top:'5px',left:'5px',background:'rgba(0,0,0,0.7)',color:'white',padding:'2px 5px',fontSize:'12px',zIndex:10,pointerEvents:'none'}}>
        {debugMessage} (Frame: {frameCounter.current})
      </div>
      <video ref={videoRef} style={{ display: 'none' }} width={640} height={480} autoPlay playsInline muted />
      <canvas ref={canvasRef} width={640} height={480} style={{ width: '100%', height: '100%', display: 'block', background: 'lightpink' }} />
    </div>
  );
}