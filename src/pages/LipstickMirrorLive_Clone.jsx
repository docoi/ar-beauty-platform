// src/pages/LipstickMirrorLive_Clone.jsx (Stage 2: Add Lips Overlay - With Video Setup Error Handling)

import React, { useEffect, useRef, useState } from 'react'; // Ensure all hooks are imported
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
  const landmarkerRef = useRef(null); 

  const pipelineStateRef = useRef({ 
    videoPipeline: null, lipstickPipeline: null, videoBindGroupLayout: null,
    aspectRatioGroupLayout: null, aspectRatioUniformBuffer: null, aspectRatioBindGroup: null,
    videoSampler: null, vertexBuffer: null, vertexBufferSize: 2048,
  });

  const [landmarkerState, setLandmarkerState] = useState(null); 
  const [error, setError] = useState(null);
  const [debugMessage, setDebugMessage] = useState('Initializing...');
  
  useEffect(() => {
    console.log("[LML_Clone S2_VidSetupDebug] useEffect running.");
    // --- Local variables within useEffect's async scope ---
    let deviceInternal = null; 
    let contextInternal = null;
    let formatInternal = null; 
    let resizeObserverInternal = null; 
    let renderLoopStartedInternal = false;
    
    const canvasElement = canvasRef.current; 
    const videoElement = videoRef.current;

    if (!canvasElement || !videoElement) {
      console.error("[LML_Clone S2_VidSetupDebug] Canvas or Video element not available.");
      setError("Canvas or Video element not found.");
      return;
    }

    const configureCanvas = (entries) => {
      if (!deviceInternal || !contextInternal || !formatInternal || !canvasRef.current) { console.warn("[LML_Clone S2_VidSetupDebug configureCanvas] Prerequisites not met."); return; }
      const currentCanvas = canvasRef.current;
      // ... (rest of configureCanvas is the same) ...
      if (entries) { /* RO call */ } else { /* direct call */ }
      const dpr = window.devicePixelRatio || 1;
      const cw = currentCanvas.clientWidth; const ch = currentCanvas.clientHeight;
      if (cw === 0 || ch === 0) { return; }
      const tw = Math.floor(cw * dpr); const th = Math.floor(ch * dpr);
      if (currentCanvas.width !== tw || currentCanvas.height !== th) { currentCanvas.width = tw; currentCanvas.height = th; console.log(`[LML_Clone S2_VidSetupDebug configureCanvas] Canvas buffer SET:${tw}x${th}`); }
      try { contextInternal.configure({ device: deviceInternal, format: formatInternal, alphaMode: 'opaque', size: [currentCanvas.width, currentCanvas.height] }); 
            console.log(`[LML_Clone S2_VidSetupDebug configureCanvas] Context CONFIG. Size:${currentCanvas.width}x${currentCanvas.height}`); 
      } catch (e) { console.error("[LML_Clone S2_VidSetupDebug configureCanvas] Error config context:", e); setError("Error configuring context."); }
    };
    resizeHandlerRef.current = configureCanvas;

    const render = async () => { /* ... Render function (with lip drawing) is the same as the last full Stage 2 version ... */ 
      const currentDevice = deviceRef.current; const currentContext = contextRef.current;
      const currentVideoEl = videoRef.current; const pState = pipelineStateRef.current;
      const activeLandmarkerInstance = landmarkerRef.current; 
      if (!currentDevice || !currentContext || !pState.videoPipeline || !pState.lipstickPipeline || !currentVideoEl) { animationFrameIdRef.current = requestAnimationFrame(render); return; }
      frameCounter.current++;
      if (currentVideoEl.readyState < currentVideoEl.HAVE_ENOUGH_DATA || currentVideoEl.videoWidth === 0) { animationFrameIdRef.current = requestAnimationFrame(render); return; }
      if (pState.aspectRatioUniformBuffer) { const aspectRatioData = new Float32Array([ currentVideoEl.videoWidth, currentVideoEl.videoHeight, currentContext.canvas.width, currentContext.canvas.height ]); currentDevice.queue.writeBuffer(pState.aspectRatioUniformBuffer, 0, aspectRatioData); }
      let numLipVertices = 0; 
      if (activeLandmarkerInstance && pState.vertexBuffer) { 
        try { const now = performance.now(); const results = activeLandmarkerInstance.detectForVideo(currentVideoEl, now); 
          if (results?.faceLandmarks?.length > 0) {
            const allFaceLm = results.faceLandmarks[0];
            // if (frameCounter.current % 120 === 1 && allFaceLm) { /* landmark spread log */ }
            const lips = lipTriangles.map(([idxA, idxB, idxC]) => { if (allFaceLm && idxA < allFaceLm.length && idxB < allFaceLm.length && idxC < allFaceLm.length && allFaceLm[idxA] && allFaceLm[idxB] && allFaceLm[idxC]) {return [allFaceLm[idxA], allFaceLm[idxB], allFaceLm[idxC]];} return null; }).filter(tri => tri !== null);
            if (lips.length > 0) { const lipVertexData = new Float32Array(lips.flat().map(pt => [(0.5 - pt.x) * 2, (0.5 - pt.y) * 2]).flat()); numLipVertices = lipVertexData.length / 2; if(lipVertexData.byteLength > 0){ if(lipVertexData.byteLength <= pState.vertexBufferSize) {currentDevice.queue.writeBuffer(pState.vertexBuffer, 0, lipVertexData);} else {numLipVertices = 0;}} else {numLipVertices = 0;}} else {numLipVertices = 0;}
          } else { numLipVertices = 0; }
        } catch (e) { numLipVertices = 0; }
      }
      let videoTextureGPU, frameBindGroupForTexture; try { videoTextureGPU = currentDevice.importExternalTexture({ source: currentVideoEl }); if (pState.videoBindGroupLayout && pState.videoSampler) { frameBindGroupForTexture = currentDevice.createBindGroup({ layout: pState.videoBindGroupLayout, entries: [{binding:0,resource:pState.videoSampler},{binding:1,resource:videoTextureGPU}]}); } else { animationFrameIdRef.current = requestAnimationFrame(render); return; } } catch (e) { animationFrameIdRef.current = requestAnimationFrame(render); return; }
      let currentGpuTexture, texView; try { currentGpuTexture = currentContext.getCurrentTexture(); texView = currentGpuTexture.createView(); } catch(e) { if(resizeHandlerRef.current) resizeHandlerRef.current(); animationFrameIdRef.current = requestAnimationFrame(render); return; }
      // if (frameCounter.current === 1 || frameCounter.current % 240 === 1) { console.log(`[RENDER LML_Clone S2_VidSetupDebug ${frameCounter.current}] Canvas: ${canvasRef.current.width}x${canvasRef.current.height}. GPU Tex: ${currentGpuTexture.width}x${currentGpuTexture.height}`); }
      const cmdEnc = currentDevice.createCommandEncoder(); const passEnc = cmdEnc.beginRenderPass({colorAttachments:[{view:texView,clearValue:{r:0.0,g:0.0,b:0.0,a:1.0},loadOp:'clear',storeOp:'store'}]});
      passEnc.setViewport(0,0,currentGpuTexture.width,currentGpuTexture.height,0,1); passEnc.setScissorRect(0,0,currentGpuTexture.width,currentGpuTexture.height);
      if (pState.videoPipeline && frameBindGroupForTexture && pState.aspectRatioBindGroup) { passEnc.setPipeline(pState.videoPipeline); passEnc.setBindGroup(0, frameBindGroupForTexture); passEnc.setBindGroup(1, pState.aspectRatioBindGroup); passEnc.draw(6); }
      if(numLipVertices>0 && pState.lipstickPipeline && pState.vertexBuffer){ passEnc.setPipeline(pState.lipstickPipeline); passEnc.setVertexBuffer(0,pState.vertexBuffer); passEnc.draw(numLipVertices); /* if (frameCounter.current < 5) console.log(`LML_Clone S2_VidSetupDebug RENDER LIP DRAW`); */ }
      passEnc.end(); currentDevice.queue.submit([cmdEnc.finish()]);
      if(frameCounter.current === 1) { console.log(`[LML_Clone S2_VidSetupDebug RENDER 1] First full frame (video+lips).`); }
      animationFrameIdRef.current = requestAnimationFrame(render);
    }; 

    const initializeAll = async () => {
      if (!navigator.gpu) { setError("WebGPU not supported."); return; }
      setDebugMessage("Initializing S2_VidSetupDebug...");
      try {
        console.log("[LML_Clone S2_VidSetupDebug initializeAll] Initializing FaceLandmarker...");
        const vision = await FilesetResolver.forVisionTasks('https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm');
        const lmInstance = await FaceLandmarker.createFromOptions(vision, { 
            baseOptions: { modelAssetPath: '/models/face_landmarker.task', delegate: 'GPU' },
            outputFaceBlendshapes: false, runningMode: 'VIDEO', numFaces: 1,
        });
        landmarkerRef.current = lmInstance; setLandmarkerState(lmInstance); 
        console.log("[LML_Clone S2_VidSetupDebug initializeAll] FaceLandmarker ready.");

        console.log("[LML_Clone S2_VidSetupDebug initializeAll] Initializing WebGPU Device & Format...");
        const adapter = await navigator.gpu.requestAdapter();
        if (!adapter) { setError("No GPU adapter."); return; }
        deviceInternal = await adapter.requestDevice(); deviceRef.current = deviceInternal;
        console.log("[LML_Clone S2_VidSetupDebug initializeAll] Device obtained.");
        deviceInternal.lost.then((info) => { /* ... */ });
        contextInternal = canvasElement.getContext('webgpu'); contextRef.current = contextInternal;
        if (!contextInternal) { setError('No WebGPU context.'); return; }
        formatInternal = navigator.gpu.getPreferredCanvasFormat(); formatRef.current = formatInternal;
        console.log("[LML_Clone S2_VidSetupDebug initializeAll] Context and Format obtained.");

        console.log("[LML_Clone S2_VidSetupDebug initializeAll] Creating pipelines and GPU resources...");
        const { videoPipeline, lipstickPipeline, videoBindGroupLayout, aspectRatioGroupLayout } = await createPipelines(deviceInternal, formatInternal);
        const currentVertexBufferSize = pipelineStateRef.current.vertexBufferSize || 2048;
        pipelineStateRef.current = { ...pipelineStateRef.current, videoPipeline, lipstickPipeline, videoBindGroupLayout, aspectRatioGroupLayout };
        const uniformBufferSize = 4 * Float32Array.BYTES_PER_ELEMENT;
        pipelineStateRef.current.aspectRatioUniformBuffer = deviceInternal.createBuffer({ size: uniformBufferSize, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST });
        if (aspectRatioGroupLayout && pipelineStateRef.current.aspectRatioUniformBuffer) { pipelineStateRef.current.aspectRatioBindGroup = deviceInternal.createBindGroup({ layout: aspectRatioGroupLayout, entries: [{ binding: 0, resource: { buffer: pipelineStateRef.current.aspectRatioUniformBuffer }}]}); }
        pipelineStateRef.current.videoSampler = deviceInternal.createSampler({ magFilter: 'linear', minFilter: 'linear' });
        pipelineStateRef.current.vertexBuffer = deviceInternal.createBuffer({ size: currentVertexBufferSize, usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST });
        console.log("[LML_Clone S2_VidSetupDebug initializeAll] All Pipelines and GPU resources created.");
        
        // --- Video Element Setup with its own try-catch ---
        console.log("[LML_Clone S2_VidSetupDebug initializeAll] Setting up video element...");
        try {
            if (!videoElement) throw new Error("videoRef.current (videoElement) is null at video setup point.");
            if (!navigator.mediaDevices?.getUserMedia) throw new Error("Camera API (getUserMedia) not supported.");
            
            console.log("[LML_Clone S2_VidSetupDebug initializeAll] Requesting media stream...");
            const stream = await navigator.mediaDevices.getUserMedia({ video: { width: 640, height: 480 } });
            console.log("[LML_Clone S2_VidSetupDebug initializeAll] Media stream obtained.");
            
            videoElement.srcObject = stream; 
            console.log("[LML_Clone S2_VidSetupDebug initializeAll] srcObject assigned.");
            
            await new Promise((resolve, reject) => { 
                videoElement.onloadedmetadata = () => { 
                    console.log(`[LML_Clone S2_VidSetupDebug initializeAll] Video metadata: ${videoElement.videoWidth}x${videoElement.videoHeight}`); 
                    resolve(); 
                };
                videoElement.onerror = (e) => {
                    console.error("[LML_Clone S2_VidSetupDebug initializeAll] videoElement.onerror triggered:", e);
                    reject(new Error("Video element error during metadata loading."));
                };
            });
            console.log("[LML_Clone S2_VidSetupDebug initializeAll] onloadedmetadata resolved.");
            
            await videoElement.play(); 
            console.log("[LML_Clone S2_VidSetupDebug initializeAll] Video playback started.");
        } catch (videoError) {
            console.error("[LML_Clone S2_VidSetupDebug initializeAll] ERROR DURING VIDEO SETUP:", videoError);
            setError(`Video Setup Failed: ${String(videoError.message).substring(0, 50)}...`);
            throw videoError; 
        }
        // --- End Video Element Setup ---
        
        resizeObserverInternal = new ResizeObserver(resizeHandlerRef.current);
        resizeObserverInternal.observe(canvasElement);
        console.log("[LML_Clone S2_VidSetupDebug initializeAll] ResizeObserver observing canvas.");
        if(resizeHandlerRef.current) resizeHandlerRef.current(); 
        else console.error("[LML_Clone S2_VidSetupDebug initializeAll] resizeHandlerRef.current is null");
        
        console.log("[LML_Clone S2_VidSetupDebug initializeAll] All sub-initializations complete.");
        if (!renderLoopStartedInternal) { console.log("[LML_Clone S2_VidSetupDebug initializeAll] Starting render loop."); render(); renderLoopStartedInternal = true; }
      } catch (err) { 
          console.error("[LML_Clone S2_VidSetupDebug initializeAll] Main try-catch error:", err); 
          setError(`Init S2_VidSetupDebug failed: ${String(err.message).substring(0,50)}...`); 
          setDebugMessage(`Error: ${String(err.message).substring(0,30)}...`);
      }
    }; 
    initializeAll();
    return () => { /* ... cleanup (same as before) ... */ };
  }, []);

  useEffect(() => { /* ... UI Message Effect ... */ }, [landmarkerState, deviceRef.current, contextRef.current, pipelineStateRef.current.lipstickPipeline, error]);

  return ( /* ... JSX (Full Viewport Parent) ... */ 
    <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, overflow: 'hidden', margin: 0, padding: 0, background: 'darkslateblue' }}>
      <div style={{position:'absolute',top:'5px',left:'5px',background:'rgba(0,0,0,0.7)',color:'white',padding:'2px 5px',fontSize:'12px',zIndex:10,pointerEvents:'none'}}>
        {debugMessage} (Frame: {frameCounter.current})
      </div>
      <video ref={videoRef} style={{ display: 'none' }} width={640} height={480} autoPlay playsInline muted />
      <canvas ref={canvasRef} width={640} height={480} style={{ width: '100%', height: '100%', display: 'block', background: 'lightpink' }} />
    </div>
  );
}