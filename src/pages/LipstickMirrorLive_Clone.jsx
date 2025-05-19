// src/pages/LipstickMirrorLive_Clone.jsx (Fix createBuffer 'size' error)

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
  const landmarkerRef = useRef(null); 

  // Ensure vertexBufferSize is part of the initial state
  const pipelineStateRef = useRef({ 
    videoPipeline: null,
    lipstickPipeline: null, 
    videoBindGroupLayout: null,
    aspectRatioGroupLayout: null,
    aspectRatioUniformBuffer: null,
    aspectRatioBindGroup: null,
    videoSampler: null,
    vertexBuffer: null, 
    vertexBufferSize: 2048, // Explicitly ensure this is here
  });

  const [landmarkerState, setLandmarkerState] = useState(null); 
  const [error, setError] = useState(null);
  const [debugMessage, setDebugMessage] = useState('Initializing...');
  
  useEffect(() => {
    console.log("[LML_Clone S2_FixBufferSize] useEffect running.");
    let deviceInternal = null; let contextInternal = null; let formatInternal = null;
    let resizeObserverInternal = null; let renderLoopStartedInternal = false;
    
    const canvasElement = canvasRef.current; 
    const videoElement = videoRef.current;

    if (!canvasElement || !videoElement) { /* ... error handling ... */ return; }

    const configureCanvas = (entries) => { /* ... same as your last working version ... */ 
        if (!deviceInternal || !contextInternal || !formatInternal || !canvasRef.current) { return; }
        const currentCanvas = canvasRef.current;
        // ... (DPR and size calculations) ...
        const dpr = window.devicePixelRatio || 1;
        const cw = currentCanvas.clientWidth; const ch = currentCanvas.clientHeight;
        if (cw === 0 || ch === 0) { return; }
        const tw = Math.floor(cw * dpr); const th = Math.floor(ch * dpr);
        if (currentCanvas.width !== tw || currentCanvas.height !== th) { currentCanvas.width = tw; currentCanvas.height = th; }
        try { contextInternal.configure({ device: deviceInternal, format: formatInternal, alphaMode: 'opaque', size: [currentCanvas.width, currentCanvas.height] }); 
        } catch (e) { setError("Error config context."); }
        if (frameCounter.current < 2) console.log(`[LML_Clone S2_FixBufferSize configureCanvas] Context CONFIG. Size:${currentCanvas.width}x${currentCanvas.height}`);
    };
    resizeHandlerRef.current = configureCanvas;

    const render = async () => { /* ... render function mostly the same as your last working version for Stage 2 ... */
                               /* ... ensure all refs are deviceRef.current, contextRef.current, etc. ... */
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
            const lips = lipTriangles.map(([idxA, idxB, idxC]) => { if (allFaceLm && idxA < allFaceLm.length && idxB < allFaceLm.length && idxC < allFaceLm.length && allFaceLm[idxA] && allFaceLm[idxB] && allFaceLm[idxC]) {return [allFaceLm[idxA], allFaceLm[idxB], allFaceLm[idxC]];} return null; }).filter(tri => tri !== null);
            if (lips.length > 0) { const lipVertexData = new Float32Array(lips.flat().map(pt => [(0.5 - pt.x) * 2, (0.5 - pt.y) * 2]).flat()); numLipVertices = lipVertexData.length / 2; if(lipVertexData.byteLength > 0){ if(lipVertexData.byteLength <= pState.vertexBufferSize) {currentDevice.queue.writeBuffer(pState.vertexBuffer, 0, lipVertexData);} else {numLipVertices = 0;}} else {numLipVertices = 0;}} else {numLipVertices = 0;}
          } else { numLipVertices = 0; }
        } catch (e) { numLipVertices = 0; }
      }
      let videoTextureGPU, frameBindGroupForTexture; try { videoTextureGPU = currentDevice.importExternalTexture({ source: currentVideoEl }); if (pState.videoBindGroupLayout && pState.videoSampler) { frameBindGroupForTexture = currentDevice.createBindGroup({ layout: pState.videoBindGroupLayout, entries: [{binding:0,resource:pState.videoSampler},{binding:1,resource:videoTextureGPU}]}); } else { animationFrameIdRef.current = requestAnimationFrame(render); return; } } catch (e) { animationFrameIdRef.current = requestAnimationFrame(render); return; }
      let currentGpuTexture, texView; try { currentGpuTexture = currentContext.getCurrentTexture(); texView = currentGpuTexture.createView(); } catch(e) { if(resizeHandlerRef.current) resizeHandlerRef.current(); animationFrameIdRef.current = requestAnimationFrame(render); return; }
      if (frameCounter.current < 2) { console.log(`[LML_Clone S2_FixBufferSize RENDER ${frameCounter.current}] Canvas: ${canvasRef.current.width}x${canvasRef.current.height}. GPU Tex: ${currentGpuTexture.width}x${currentGpuTexture.height}`); }
      const cmdEnc = currentDevice.createCommandEncoder(); const passEnc = cmdEnc.beginRenderPass({colorAttachments:[{view:texView,clearValue:{r:0.0,g:0.0,b:0.0,a:1.0},loadOp:'clear',storeOp:'store'}]});
      passEnc.setViewport(0,0,currentGpuTexture.width,currentGpuTexture.height,0,1); passEnc.setScissorRect(0,0,currentGpuTexture.width,currentGpuTexture.height);
      if (pState.videoPipeline && frameBindGroupForTexture && pState.aspectRatioBindGroup) { passEnc.setPipeline(pState.videoPipeline); passEnc.setBindGroup(0, frameBindGroupForTexture); passEnc.setBindGroup(1, pState.aspectRatioBindGroup); passEnc.draw(6); }
      if(numLipVertices>0 && pState.lipstickPipeline && pState.vertexBuffer){ passEnc.setPipeline(pState.lipstickPipeline); passEnc.setVertexBuffer(0,pState.vertexBuffer); passEnc.draw(numLipVertices); if (frameCounter.current < 5) console.log(`[LML_Clone S2_FixBufferSize RENDER ${frameCounter.current}] EXECUTED LIP DRAW for ${numLipVertices} verts.`);}
      passEnc.end(); currentDevice.queue.submit([cmdEnc.finish()]);
      if(frameCounter.current === 1) { console.log(`[LML_Clone S2_FixBufferSize RENDER 1] First full frame (video+lips).`); }
      animationFrameIdRef.current = requestAnimationFrame(render);
    }; 

    const initializeAll = async () => {
      if (!navigator.gpu) { setError("WebGPU not supported."); return; }
      setDebugMessage("Initializing Lipstick Try-On (S2 FixBuffer)...");
      try {
        console.log("[LML_Clone S2_FixBufferSize initializeAll] Initializing FaceLandmarker...");
        const vision = await FilesetResolver.forVisionTasks('https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm');
        const lmInstance = await FaceLandmarker.createFromOptions(vision, { 
            baseOptions: { modelAssetPath: '/models/face_landmarker.task', delegate: 'GPU' },
            outputFaceBlendshapes: false, runningMode: 'VIDEO', numFaces: 1,
        });
        landmarkerRef.current = lmInstance; 
        setLandmarkerState(lmInstance); 
        console.log("[LML_Clone S2_FixBufferSize initializeAll] FaceLandmarker ready and in ref.");

        console.log("[LML_Clone S2_FixBufferSize initializeAll] Initializing WebGPU Device & Format...");
        const adapter = await navigator.gpu.requestAdapter();
        if (!adapter) { setError("No GPU adapter."); return; }
        deviceInternal = await adapter.requestDevice(); deviceRef.current = deviceInternal;
        console.log("[LML_Clone S2_FixBufferSize initializeAll] Device obtained.");
        deviceInternal.lost.then((info) => { /* ... device lost handling ... */ });
        
        contextInternal = canvasElement.getContext('webgpu'); contextRef.current = contextInternal;
        if (!contextInternal) { setError('No WebGPU context.'); return; }
        formatInternal = navigator.gpu.getPreferredCanvasFormat(); formatRef.current = formatInternal;
        console.log("[LML_Clone S2_FixBufferSize initializeAll] Context and Format obtained.");

        console.log("[LML_Clone S2_FixBufferSize initializeAll] Creating pipelines and GPU resources...");
        const { videoPipeline, lipstickPipeline, videoBindGroupLayout, aspectRatioGroupLayout } = await createPipelines(deviceInternal, formatInternal);
        
        // Explicitly define vertexBufferSize before spreading into pipelineStateRef.current
        const currentVertexBufferSize = pipelineStateRef.current.vertexBufferSize || 2048; // Fallback just in case

        pipelineStateRef.current = { 
            ...pipelineStateRef.current, // Keep existing vertexBufferSize from initial ref state
            videoPipeline, 
            lipstickPipeline, 
            videoBindGroupLayout, 
            aspectRatioGroupLayout 
        };
        const uniformBufferSize = 4 * Float32Array.BYTES_PER_ELEMENT;
        pipelineStateRef.current.aspectRatioUniformBuffer = deviceInternal.createBuffer({ size: uniformBufferSize, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST });
        if (aspectRatioGroupLayout && pipelineStateRef.current.aspectRatioUniformBuffer) {
            pipelineStateRef.current.aspectRatioBindGroup = deviceInternal.createBindGroup({ layout: aspectRatioGroupLayout, entries: [{ binding: 0, resource: { buffer: pipelineStateRef.current.aspectRatioUniformBuffer }}]});
        }
        pipelineStateRef.current.videoSampler = deviceInternal.createSampler({ magFilter: 'linear', minFilter: 'linear' });
        
        // Use the explicitly defined/retrieved currentVertexBufferSize
        console.log(`[LML_Clone S2_FixBufferSize initializeAll] Creating vertexBuffer with size: ${currentVertexBufferSize}`);
        pipelineStateRef.current.vertexBuffer = deviceInternal.createBuffer({ 
            size: currentVertexBufferSize, // Use definite size
            usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST 
        });
        console.log("[LML_Clone S2_FixBufferSize initializeAll] All Pipelines and GPU resources created.");
        
        console.log("[LML_Clone S2_FixBufferSize initializeAll] Setting up video element...");
        if (!navigator.mediaDevices?.getUserMedia) throw new Error("Camera not supported.");
        const stream = await navigator.mediaDevices.getUserMedia({ video: { width: 640, height: 480 } });
        videoElement.srcObject = stream;
        await new Promise((res, rej) => { /* ... onloadedmetadata ... */ });
        await videoElement.play(); console.log("[LML_Clone S2_FixBufferSize initializeAll] Video playback started.");
        
        resizeObserverInternal = new ResizeObserver(resizeHandlerRef.current);
        resizeObserverInternal.observe(canvasElement);
        if(resizeHandlerRef.current) resizeHandlerRef.current(); 
        
        console.log("[LML_Clone S2_FixBufferSize initializeAll] All sub-initializations complete.");
        if (!renderLoopStartedInternal) { console.log("[LML_Clone S2_FixBufferSize initializeAll] Starting render loop."); render(); renderLoopStartedInternal = true; }
      } catch (err) { console.error("[LML_Clone S2_FixBufferSize initializeAll] Major error:", err); setError(`Init S2_FixBuffer failed: ${err.message}`); }
    };
    initializeAll();
    return () => { /* ... cleanup ... */ };
  }, []);

  useEffect(() => { /* ... UI Message Effect ... */ 
    if(landmarkerState && deviceRef.current && contextRef.current && pipelineStateRef.current.lipstickPipeline && !error) { 
        setDebugMessage("Live Lipstick Try-On (S2 FixBuffer)");
    } else if (error) {
        setDebugMessage(`Error: ${String(error).substring(0,40)}...`);
    } else {
        setDebugMessage("Initializing Lipstick Try-On (S2 FixBuffer)...");
    }
  }, [landmarkerState, deviceRef.current, contextRef.current, pipelineStateRef.current.lipstickPipeline, error]);

  return ( /* ... JSX with Full Viewport Parent ... */
    <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, overflow: 'hidden', margin: 0, padding: 0, background: 'darkslateblue' }}>
      <div style={{position:'absolute',top:'5px',left:'5px',background:'rgba(0,0,0,0.7)',color:'white',padding:'2px 5px',fontSize:'12px',zIndex:10,pointerEvents:'none'}}>
        {debugMessage} (Frame: {frameCounter.current})
      </div>
      <video ref={videoRef} style={{ display: 'none' }} width={640} height={480} autoPlay playsInline muted />
      <canvas ref={canvasRef} width={640} height={480} style={{ width: '100%', height: '100%', display: 'block', background: 'lightpink' }} />
    </div>
  );
}