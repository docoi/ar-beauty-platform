// src/pages/LipstickMirrorLive_Clone.jsx (Stage 1.C: Full Viewport Video)

import React, { useEffect, useRef, useState } from 'react';
import createPipelines from '@/utils/createPipelines'; // Ensure this returns aspectRatioGroupLayout
// lipTriangles not used for drawing in this stage
// import lipTriangles from '@/utils/lipTriangles'; 
import { FaceLandmarker, FilesetResolver } from '@mediapipe/tasks-vision'; // For landmarker state

export default function LipstickMirrorLive_Clone() {
  const canvasRef = useRef(null);
  const videoRef = useRef(null); 

  const animationFrameIdRef = useRef(null);
  const frameCounter = useRef(0);
  const resizeHandlerRef = useRef(null);
  
  const deviceRef = useRef(null); 
  const contextRef = useRef(null);
  const formatRef = useRef(null);

  const pipelineStateRef = useRef({ 
    videoPipeline: null,
    lipstickPipeline: null, 
    videoBindGroupLayout: null,
    aspectRatioGroupLayout: null,
    aspectRatioUniformBuffer: null,
    aspectRatioBindGroup: null,
    videoSampler: null,
    vertexBuffer: null, 
    vertexBufferSize: 2048,
  });

  const [landmarker, setLandmarker] = useState(null); 
  const [error, setError] = useState(null);
  const [debugMessage, setDebugMessage] = useState('Initializing...');
  
  useEffect(() => {
    console.log("[LML_Clone S1C_FullVideo] useEffect running.");
    let deviceInternal = null; let contextInternal = null; let formatInternal = null;
    let currentLandmarkerInstance = null; // Local instance
    let resizeObserverInternal = null; let renderLoopStartedInternal = false;
    
    const canvasElement = canvasRef.current; 
    const videoElement = videoRef.current;

    if (!canvasElement || !videoElement) {
      console.error("[LML_Clone S1C_FullVideo] Canvas or Video element not available.");
      setError("Canvas or Video element not found.");
      return;
    }

    const configureCanvas = (entries) => {
      if (!deviceInternal || !contextInternal || !formatInternal || !canvasRef.current) { console.warn("[LML_Clone S1C configureCanvas] Prerequisites not met."); return; }
      const currentCanvas = canvasRef.current;
      if (entries) { console.log("[LML_Clone S1C configureCanvas via RO]"); } else { console.log("[LML_Clone S1C configureCanvas direct]"); }
      const dpr = window.devicePixelRatio || 1;
      const cw = currentCanvas.clientWidth; const ch = currentCanvas.clientHeight;
      if (cw === 0 || ch === 0) { console.warn(`[LML_Clone S1C configureCanvas] Canvas clientW/H is zero.`); return; }
      const tw = Math.floor(cw * dpr); const th = Math.floor(ch * dpr);
      console.log(`[LML_Clone S1C configureCanvas] DPR:${dpr}, clientW/H:${cw}x${ch} => phys:${tw}x${th}`);
      if (currentCanvas.width !== tw || currentCanvas.height !== th) { currentCanvas.width = tw; currentCanvas.height = th; console.log(`[LML_Clone S1C configureCanvas] Canvas buffer SET:${tw}x${th}`); }
      else { /* console.log(`[LML_Clone S1C configureCanvas] Canvas size ${tw}x${th} OK.`); */ }
      try { 
          contextInternal.configure({ device: deviceInternal, format: formatInternal, alphaMode: 'opaque', size: [currentCanvas.width, currentCanvas.height] }); 
          console.log(`[LML_Clone S1C configureCanvas] Context CONFIG. Size:${currentCanvas.width}x${currentCanvas.height}`); 
      }
      catch (e) { console.error("[LML_Clone S1C configureCanvas] Error config context:", e); setError("Error config context."); }
    };
    resizeHandlerRef.current = configureCanvas;

    const render = async () => {
      const currentDevice = deviceRef.current; 
      const currentContext = contextRef.current;
      const currentVideoEl = videoRef.current; 
      const pState = pipelineStateRef.current;
      const activeLandmarker = landmarker; 

      if (!currentDevice || !currentContext || !pState.videoPipeline || !currentVideoEl) {
        animationFrameIdRef.current = requestAnimationFrame(render); return; 
      }
      frameCounter.current++;
      if (currentVideoEl.readyState < currentVideoEl.HAVE_ENOUGH_DATA || currentVideoEl.videoWidth === 0) {
        animationFrameIdRef.current = requestAnimationFrame(render); return;
      }
      
      if (pState.aspectRatioUniformBuffer && currentVideoEl.videoWidth > 0 && currentContext.canvas.width > 0) {
        const aspectRatioData = new Float32Array([ currentVideoEl.videoWidth, currentVideoEl.videoHeight, currentContext.canvas.width, currentContext.canvas.height ]);
        currentDevice.queue.writeBuffer(pState.aspectRatioUniformBuffer, 0, aspectRatioData);
      }

      // Lip processing will be added later
      // let numLipVertices = 0; if (activeLandmarker) { /* ... */ }

      let videoTextureGPU, frameBindGroupForTexture;
      try {
        videoTextureGPU = currentDevice.importExternalTexture({ source: currentVideoEl });
        if (pState.videoBindGroupLayout && pState.videoSampler) {
          frameBindGroupForTexture = currentDevice.createBindGroup({ layout: pState.videoBindGroupLayout, entries: [{binding:0,resource:pState.videoSampler},{binding:1,resource:videoTextureGPU}]});
        } else { animationFrameIdRef.current = requestAnimationFrame(render); return; }
      } catch (e) { console.error(`[RENDER LML_Clone S1C ${frameCounter.current}] Error import/bind texture:`, e); animationFrameIdRef.current = requestAnimationFrame(render); return; }
      
      let currentGpuTexture, texView;
      try { currentGpuTexture = currentContext.getCurrentTexture(); texView = currentGpuTexture.createView(); }
      catch(e) { console.error(`[RENDER LML_Clone S1C ${frameCounter.current}] Error currentTex:`, e); if(resizeHandlerRef.current) resizeHandlerRef.current(); animationFrameIdRef.current = requestAnimationFrame(render); return; }
      
      if (frameCounter.current === 1 || frameCounter.current % 240 === 1) { console.log(`[RENDER LML_Clone S1C ${frameCounter.current}] Canvas: ${canvasRef.current.width}x${canvasRef.current.height}. GPU Tex: ${currentGpuTexture.width}x${currentGpuTexture.height}`); }

      const cmdEnc = currentDevice.createCommandEncoder({label: "LML_Clone_S1C_Encoder"});
      const passEnc = cmdEnc.beginRenderPass({colorAttachments:[{view:texView,clearValue:{r:0.0,g:0.0,b:0.0,a:1.0},loadOp:'clear',storeOp:'store'}]}); // Clear BLACK
      passEnc.setViewport(0,0,currentGpuTexture.width,currentGpuTexture.height,0,1);
      passEnc.setScissorRect(0,0,currentGpuTexture.width,currentGpuTexture.height);
      
      // --- Draw Video Background ---
      if (pState.videoPipeline && frameBindGroupForTexture && pState.aspectRatioBindGroup) {
        passEnc.setPipeline(pState.videoPipeline);
        passEnc.setBindGroup(0, frameBindGroupForTexture); 
        passEnc.setBindGroup(1, pState.aspectRatioBindGroup);
        passEnc.draw(6);
      } else { 
         if (frameCounter.current % 60 === 1) { console.warn(`[RENDER LML_Clone S1C ${frameCounter.current}] Skipping video draw: Missing resources.`); }
      }
      // --- End Video Background ---
      
      // No lipstick drawing yet
      passEnc.end();
      currentDevice.queue.submit([cmdEnc.finish()]);

      if(frameCounter.current === 1) { console.log(`[RENDER LML_Clone S1C 1] First frame with video drawn.`); }
      animationFrameIdRef.current = requestAnimationFrame(render);
    };

    const initializeAll = async () => {
      if (!navigator.gpu) { setError("WebGPU not supported."); return; }
      setDebugMessage("Initializing Full Video (S1C)...");
      try {
        console.log("[LML_Clone S1C initializeAll] Initializing FaceLandmarker...");
        const vision = await FilesetResolver.forVisionTasks('https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm');
        const lmInstance = await FaceLandmarker.createFromOptions(vision, { 
            baseOptions: { modelAssetPath: '/models/face_landmarker.task', delegate: 'GPU' },
            outputFaceBlendshapes: false, runningMode: 'VIDEO', numFaces: 1,
        });
        setLandmarker(lmInstance); // Set landmarker state
        console.log("[LML_Clone S1C initializeAll] FaceLandmarker ready.");

        console.log("[LML_Clone S1C initializeAll] Initializing WebGPU Device & Format...");
        const adapter = await navigator.gpu.requestAdapter();
        if (!adapter) { setError("No GPU adapter."); return; }
        deviceInternal = await adapter.requestDevice(); deviceRef.current = deviceInternal;
        console.log("[LML_Clone S1C initializeAll] Device obtained.");
        deviceInternal.lost.then((info) => { /* ... */ });
        
        contextInternal = canvasElement.getContext('webgpu'); contextRef.current = contextInternal;
        if (!contextInternal) { setError('No WebGPU context.'); return; }
        formatInternal = navigator.gpu.getPreferredCanvasFormat(); formatRef.current = formatInternal;
        console.log("[LML_Clone S1C initializeAll] Context and Format obtained.");

        console.log("[LML_Clone S1C initializeAll] Creating pipelines and GPU resources...");
        const { videoPipeline, lipstickPipeline, videoBindGroupLayout, aspectRatioGroupLayout } = await createPipelines(deviceInternal, formatInternal);
        pipelineStateRef.current = { ...pipelineStateRef.current, videoPipeline, lipstickPipeline, videoBindGroupLayout, aspectRatioGroupLayout };
        const uniformBufferSize = 4 * Float32Array.BYTES_PER_ELEMENT;
        pipelineStateRef.current.aspectRatioUniformBuffer = deviceInternal.createBuffer({ size: uniformBufferSize, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST });
        if (aspectRatioGroupLayout && pipelineStateRef.current.aspectRatioUniformBuffer) {
            pipelineStateRef.current.aspectRatioBindGroup = deviceInternal.createBindGroup({ layout: aspectRatioGroupLayout, entries: [{ binding: 0, resource: { buffer: pipelineStateRef.current.aspectRatioUniformBuffer }}]});
        } else { console.warn("[LML_Clone S1C initializeAll] AspectRatioGroupLayout or UniformBuffer missing for bind group."); }
        pipelineStateRef.current.videoSampler = deviceInternal.createSampler({ magFilter: 'linear', minFilter: 'linear' });
        pipelineStateRef.current.vertexBuffer = deviceInternal.createBuffer({ size: pipelineStateRef.current.vertexBufferSize, usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST });
        console.log("[LML_Clone S1C initializeAll] All Pipelines and GPU resources created.");
        
        console.log("[LML_Clone S1C initializeAll] Setting up video element...");
        if (!navigator.mediaDevices?.getUserMedia) throw new Error("Camera not supported.");
        const stream = await navigator.mediaDevices.getUserMedia({ video: { width: 640, height: 480 } });
        videoElement.srcObject = stream;
        await new Promise((res, rej) => { 
            videoElement.onloadedmetadata = () => { console.log(`[LML_Clone S1C initializeAll] Video metadata: ${videoElement.videoWidth}x${videoElement.videoHeight}`); res(); };
            videoElement.onerror = () => rej(new Error("Video load error."));
        });
        await videoElement.play(); console.log("[LML_Clone S1C initializeAll] Video playback started.");
        
        resizeObserverInternal = new ResizeObserver(resizeHandlerRef.current);
        resizeObserverInternal.observe(canvasElement);
        console.log("[LML_Clone S1C initializeAll] ResizeObserver observing canvas.");
        if(resizeHandlerRef.current) resizeHandlerRef.current(); 
        else console.error("[LML_Clone S1C initializeAll] resizeHandlerRef.current is null");
        
        console.log("[LML_Clone S1C initializeAll] All sub-initializations complete.");
        if (!renderLoopStartedInternal) { console.log("[LML_Clone S1C initializeAll] Starting render loop."); render(); renderLoopStartedInternal = true; }
      } catch (err) { console.error("[LML_Clone S1C initializeAll] Major error:", err); setError(`Init S1C failed: ${err.message}`); }
    };
    initializeAll();
    return () => { /* ... cleanup ... */
      console.log("[LML_Clone S1C MAIN_EFFECT_CLEANUP] Cleaning up.");
      if (animationFrameIdRef.current) cancelAnimationFrame(animationFrameIdRef.current);
      if (resizeObserverInternal && canvasRef.current) resizeObserverInternal.unobserve(canvasRef.current);
      if (resizeObserverInternal) resizeObserverInternal.disconnect();
      videoRef.current?.srcObject?.getTracks().forEach(track => track.stop());
      if(videoRef.current) videoRef.current.srcObject = null;
      const dvc = deviceRef.current; if (dvc) { pipelineStateRef.current.vertexBuffer?.destroy(); pipelineStateRef.current.aspectRatioUniformBuffer?.destroy(); }
      deviceRef.current = null; contextRef.current = null; formatRef.current = null; 
      setLandmarker(null); 
    };
  }, []);

  useEffect(() => { 
    if(landmarker && deviceRef.current && contextRef.current && pipelineStateRef.current.videoPipeline && !error) { 
        setDebugMessage("Live Video Active (FullVP S1C)");
    } else if (error) {
        setDebugMessage(`Error: ${String(error).substring(0,30)}...`);
    } else {
        setDebugMessage("Initializing Full Video (S1C)...");
    }
  }, [landmarker, deviceRef.current, contextRef.current, pipelineStateRef.current.videoPipeline, error]);

  return (
    // Using the full viewport parent div styling
    <div style={{
      position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
      overflow: 'hidden', margin: 0, padding: 0,
      background: 'darkslateblue' 
    }}>
      <div style={{ /* ... UI message div styling ... */ zIndex:10, position:'absolute', top:'5px', left:'5px', background:'rgba(0,0,0,0.7)', color:'white', padding:'2px 5px', fontSize:'12px', pointerEvents:'none'}}>
        {debugMessage} (Frame: {frameCounter.current})
      </div>
      <video ref={videoRef} style={{ display: 'none' }} width={640} height={480} autoPlay playsInline muted />
      <canvas 
        ref={canvasRef} 
        width={640} height={480} // Nominal, JS sets actual buffer
        style={{ width: '100%', height: '100%', display: 'block', background: 'lightpink' }} 
      />
    </div>
  );
}