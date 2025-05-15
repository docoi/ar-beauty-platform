// src/pages/LipstickMirrorLive_Clone.jsx
// Based on "DIAGNOSTIC: Clear Only BLACK, Video Resources Initialized but NOT Drawn"
// With MINIMAL changes to draw the video quad using a SIMPLE shader.

import React, { useEffect, useRef, useState } from 'react';
import createPipelines from '@/utils/createPipelines'; 
// lipTriangles and FaceLandmarker not used for this specific diagnostic's drawing part
// import lipTriangles from '@/utils/lipTriangles'; 
// import { FaceLandmarker, FilesetResolver } from '@mediapipe/tasks-vision';

export default function LipstickMirrorLive_Clone() {
  const canvasRef = useRef(null);
  const videoRef = useRef(null); 

  const deviceRef = useRef(null);
  const contextRef = useRef(null);
  const formatRef = useRef(null);
  const pipelineStateRef = useRef({
    videoPipeline: null, /* Other pipelines not strictly needed for this test if we simplify createPipelines */
    videoBindGroupLayout: null,
    // aspectRatio items NOT used for this simplified shader test
    videoSampler: null,
  });
  const animationFrameIdRef = useRef(null);
  const resizeHandlerRef = useRef(null);

  // const [landmarker, setLandmarker] = useState(null); // Keep for structure, but not used for drawing
  const [error, setError] = useState(null);
  const [debugMessage, setDebugMessage] = useState('Initializing...');
  const frameCounter = useRef(0); 
  
  useEffect(() => {
    console.log("[LML_Clone MIN_VIDEO_DRAW_DIAG] useEffect.");
    let device = null; let context = null; let format = null;
    let resizeObserver = null; let renderLoopStarted = false;
    const canvasElement = canvasRef.current; const videoElement = videoRef.current;
    if (!canvasElement || !videoElement) { /* ... */ return; }

    const configureCanvas = (entries) => { /* ... same as previous working version ... */ 
      if (!device || !context || !format || !canvasRef.current) { console.warn("MinVideoDraw: configureCanvas prereqs missing"); return; }
      const currentCanvas = canvasRef.current;
      if (entries) { /* RO call */ } else { /* direct call */ }
      const dpr = window.devicePixelRatio || 1;
      const cw = currentCanvas.clientWidth; const ch = currentCanvas.clientHeight;
      if (cw === 0 || ch === 0) { return; }
      const tw = Math.floor(cw * dpr); const th = Math.floor(ch * dpr);
      if (currentCanvas.width !== tw || currentCanvas.height !== th) { currentCanvas.width = tw; currentCanvas.height = th; }
      try { context.configure({ device, format, alphaMode: 'opaque', size: [currentCanvas.width, currentCanvas.height] }); }
      catch (e) { setError("Error config context."); }
      console.log(`[MinVideoDraw configureCanvas] Context CONFIG. Size:${currentCanvas.width}x${currentCanvas.height}`);
    };
    resizeHandlerRef.current = configureCanvas;

    const render = async () => {
      const currentDevice = deviceRef.current; const currentContext = contextRef.current;
      const currentVideoEl = videoRef.current; const pState = pipelineStateRef.current;
      if (!currentDevice || !currentContext || !pState.videoPipeline || !currentVideoEl) {
        animationFrameIdRef.current = requestAnimationFrame(render); return; 
      }
      frameCounter.current++;
      if (currentVideoEl.readyState < currentVideoEl.HAVE_ENOUGH_DATA || currentVideoEl.videoWidth === 0) {
        animationFrameIdRef.current = requestAnimationFrame(render); return;
      }
      
      let videoTextureGPU, frameBindGroupForTexture;
      try {
        videoTextureGPU = currentDevice.importExternalTexture({ source: currentVideoEl });
        if (pState.videoBindGroupLayout && pState.videoSampler) {
          frameBindGroupForTexture = currentDevice.createBindGroup({ layout: pState.videoBindGroupLayout, entries: [{binding:0,resource:pState.videoSampler},{binding:1,resource:videoTextureGPU}]});
        } else { animationFrameIdRef.current = requestAnimationFrame(render); return; }
      } catch (e) { animationFrameIdRef.current = requestAnimationFrame(render); return; }
      
      let currentGpuTexture, texView;
      try { currentGpuTexture = currentContext.getCurrentTexture(); texView = currentGpuTexture.createView(); }
      catch(e) { if(resizeHandlerRef.current) resizeHandlerRef.current(); animationFrameIdRef.current = requestAnimationFrame(render); return; }
      
      if (frameCounter.current === 1 || frameCounter.current % 240 === 1) { console.log(`[MinVideoDraw RENDER ${frameCounter.current}] Tex: ${currentGpuTexture.width}x${currentGpuTexture.height}`); }

      const cmdEnc = currentDevice.createCommandEncoder();
      const passEnc = cmdEnc.beginRenderPass({colorAttachments:[{view:texView,clearValue:{r:0.0,g:0.0,b:0.0,a:1.0},loadOp:'clear',storeOp:'store'}]});
      passEnc.setViewport(0,0,currentGpuTexture.width,currentGpuTexture.height,0,1);
      passEnc.setScissorRect(0,0,currentGpuTexture.width,currentGpuTexture.height);
      
      // --- MINIMAL VIDEO DRAW ---
      if (pState.videoPipeline && frameBindGroupForTexture) {
        passEnc.setPipeline(pState.videoPipeline);
        passEnc.setBindGroup(0, frameBindGroupForTexture); // Only group 0 for simple shader
        passEnc.draw(6);
      }
      // --- END MINIMAL VIDEO DRAW ---
      
      passEnc.end();
      currentDevice.queue.submit([cmdEnc.finish()]);
      if(frameCounter.current === 1) { setDebugMessage("Diag: Min Video Draw"); }
      animationFrameIdRef.current = requestAnimationFrame(render);
    };

    const initializeAll = async () => {
      if (!navigator.gpu) { setError("WebGPU not supported."); return; }
      setDebugMessage("Initializing Min Video Draw Test...");
      try {
        console.log("[MinVideoDraw initializeAll] SKIPPING FaceLandmarker.");
        const adapter = await navigator.gpu.requestAdapter();
        if (!adapter) { setError("No GPU adapter."); return; }
        device = await adapter.requestDevice(); deviceRef.current = device;
        device.lost.then((info) => { /* ... */ });
        context = canvasElement.getContext('webgpu'); contextRef.current = context;
        if (!context) { setError('No WebGPU context.'); return; }
        format = navigator.gpu.getPreferredCanvasFormat(); formatRef.current = format;
        console.log("[MinVideoDraw initializeAll] Device, Context, Format obtained.");

        // Use a simplified createPipelines call or inline a very simple video pipeline here
        // For this test, we assume createPipelines can create a videoPipeline that only needs group 0
        // (texture & sampler) and uses a very simple pass-through shader for UVs.
        const { videoPipeline, videoBindGroupLayout } = await createPipelines(device, format, true /* isSimpleVideoTest */);
        pipelineStateRef.current.videoPipeline = videoPipeline;
        pipelineStateRef.current.videoBindGroupLayout = videoBindGroupLayout;
        pipelineStateRef.current.videoSampler = device.createSampler({ magFilter: 'linear', minFilter: 'linear' });
        console.log("[MinVideoDraw initializeAll] Simple Video Pipeline and Sampler created.");
        
        console.log("[MinVideoDraw initializeAll] Setting up video element...");
        if (!navigator.mediaDevices?.getUserMedia) throw new Error("Camera not supported.");
        const stream = await navigator.mediaDevices.getUserMedia({ video: { width: 640, height: 480 } });
        videoElement.srcObject = stream;
        await new Promise((res, rej) => { /* ... onloadedmetadata ... */ 
            videoElement.onloadedmetadata = () => { console.log(`[MinVideoDraw initializeAll] Video metadata: ${videoElement.videoWidth}x${videoElement.videoHeight}`); res(); };
            videoElement.onerror = () => rej(new Error("Video load error."));
        });
        await videoElement.play(); console.log("[MinVideoDraw initializeAll] Video playback started.");
        
        resizeObserver = new ResizeObserver(resizeHandlerRef.current);
        resizeObserver.observe(canvasElement);
        if(resizeHandlerRef.current) resizeHandlerRef.current(); 
        
        console.log("[MinVideoDraw initializeAll] All sub-initializations complete.");
        if (!renderLoopStarted) { console.log("[MinVideoDraw initializeAll] Starting render loop."); render(); renderLoopStarted = true; }
      } catch (err) { console.error("[MinVideoDraw initializeAll] Major error:", err); setError(`Init failed: ${err.message}`);}
    };
    initializeAll();
    return () => { /* ... cleanup ... */ };
  }, []);

  useEffect(() => { /* ... UI Message Effect ... */ 
    if(deviceRef.current && contextRef.current && !error) { setDebugMessage("Diag: Min Video Draw Active"); }
    else if (error) { setDebugMessage(`Error`); } else { setDebugMessage("Initializing Min Video Draw..."); }
  }, [deviceRef.current, contextRef.current, error]);

  return ( /* ... JSX with original parent div, canvas background lightpink ... */
    <div style={{ width: '640px', height: '480px', margin: 'auto', border: '1px solid #ccc', position: 'relative', overflow: 'hidden', background: 'darkkhaki' }}>
      <div style={{position:'absolute',top:'5px',left:'5px',/*...*/fontSize:'12px',zIndex:10,pointerEvents:'none'}}>
        {debugMessage} (Frame: {frameCounter.current})
      </div>
      <video ref={videoRef} style={{display:'none'}} width={640} height={480} autoPlay playsInline muted />
      <canvas ref={canvasRef} width={640} height={480} style={{position:'absolute',top:0,left:0,width:'100%',height:'100%',zIndex:2, background: 'lightpink'}} />
    </div>
  );
}