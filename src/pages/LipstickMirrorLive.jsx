// src/pages/LipstickMirrorLive.jsx (Diagnostic: Clear Only to BLACK)

import React, { useEffect, useRef, useState } from 'react';
// createPipelines and lipTriangles not used in this specific diagnostic step
// import createPipelines from '@/utils/createPipelines';
// import lipTriangles from '@/utils/lipTriangles';
// FaceLandmarker not used in this specific diagnostic step
// import { FaceLandmarker, FilesetResolver } from '@mediapipe/tasks-vision';

export default function LipstickMirrorLive() {
  const canvasRef = useRef(null);
  const videoRef = useRef(null); // Kept for structure, but video stream won't be used

  const deviceRef = useRef(null);
  const contextRef = useRef(null);
  const formatRef = useRef(null);
  // pipelineStateRef not used for drawing in this diagnostic
  // const pipelineStateRef = useRef({ /* ... */ });
  const animationFrameIdRef = useRef(null);
  const resizeHandlerRef = useRef(null);

  const [landmarker, setLandmarker] = useState(true); // Dummy true to satisfy allResourcesReady
  const [isGpuReady, setIsGpuReady] = useState(false); // Will be set by core GPU init
  const [error, setError] = useState(null);
  const [debugMessage, setDebugMessage] = useState('Initializing...');
  const frameCounter = useRef(0);

  useEffect(() => {
    console.log("[MAIN_EFFECT] LipstickMirrorLive useEffect running (Clear Only Diagnostic).");
    let device = null; let context = null; let format = null;
    let resizeObserver = null; let renderLoopStarted = false;
    const canvas = canvasRef.current;
    if (!canvas) { console.error("Canvas element not found."); return; }

    const configureCanvas = (entries) => {
      if (!device || !context || !format) { console.warn("[configureCanvas] Prerequisites not met."); return; }
      if (entries) { console.log("[configureCanvas via ResizeObserver] Called."); } else { console.log("[configureCanvas direct call] Called."); }
      const dpr = window.devicePixelRatio || 1;
      const cw = canvas.clientWidth; const ch = canvas.clientHeight;
      if (cw === 0 || ch === 0) { console.warn(`[configureCanvas] Canvas clientWidth/Height is zero.`); return; }
      const tw = Math.floor(cw * dpr); const th = Math.floor(ch * dpr);
      if (canvas.width !== tw || canvas.height !== th) { canvas.width = tw; canvas.height = th; console.log(`[configureCanvas] Canvas buffer SET to: ${tw}x${th}`); }
      else { console.log(`[configureCanvas] Canvas size ${tw}x${th} already correct.`); }
      try { context.configure({ device, format, alphaMode: 'opaque', size: [canvas.width, canvas.height] }); console.log(`[configureCanvas] Context CONFIGURED. Size: ${canvas.width}x${canvas.height}`); }
      catch (e) { console.error("[configureCanvas] Error configuring context:", e); setError("Error configuring context."); }
    };
    resizeHandlerRef.current = configureCanvas;

    const render = () => {
      if (!device || !context) { animationFrameIdRef.current = requestAnimationFrame(render); return; }
      frameCounter.current++;
      let currentGpuTexture, texView;
      try { currentGpuTexture = context.getCurrentTexture(); texView = currentGpuTexture.createView(); }
      catch(e) { console.error(`[RENDER ${frameCounter.current}] Error getting current texture:`, e); if(resizeHandlerRef.current) resizeHandlerRef.current(); animationFrameIdRef.current = requestAnimationFrame(render); return; }
      if (frameCounter.current < 5 || frameCounter.current % 120 === 1) { console.log(`[RENDER ${frameCounter.current}] Canvas attr: ${canvas.width}x${canvas.height}. GPUTexture: ${currentGpuTexture.width}x${currentGpuTexture.height}`); }
      
      const cmdEnc = device.createCommandEncoder({label: "ClearOnlyBlackEncoder"});
      const passEnc = cmdEnc.beginRenderPass({ colorAttachments:[{ view: texView, clearValue: {r:0.0,g:0.0,b:0.0,a:1.0}, loadOp:'clear', storeOp:'store' }]}); // BLACK CLEAR
      passEnc.setViewport(0,0,currentGpuTexture.width, currentGpuTexture.height,0,1);
      passEnc.setScissorRect(0,0,currentGpuTexture.width, currentGpuTexture.height);
      passEnc.end();
      device.queue.submit([cmdEnc.finish()]);
      if(frameCounter.current === 1) { console.log(`[RENDER 1] First frame (black clear).`); setDebugMessage("Diagnostic: Black Clear Test"); }
      animationFrameIdRef.current = requestAnimationFrame(render);
    };

    const initializeAll = async () => {
      if (!navigator.gpu) { console.error("WebGPU not supported."); setError("WebGPU not supported."); return; }
      setDebugMessage("Initializing Systems (Clear Test)...");
      try {
        console.log("[initializeAll] Skipping FaceLandmarker for clear test.");
        // setLandmarker({}); // Already set with dummy true

        console.log("[initializeAll] Initializing WebGPU Device & Format...");
        const adapter = await navigator.gpu.requestAdapter();
        if (!adapter) { console.error("Failed to get GPU adapter."); setError("No GPU adapter."); return; }
        device = await adapter.requestDevice(); deviceRef.current = device;
        console.log("[initializeAll] Device obtained.");
        device.lost.then((info) => { console.error(`Device lost: ${info.message}`); setError("Device lost."); if(animationFrameIdRef.current) cancelAnimationFrame(animationFrameIdRef.current); deviceRef.current=null; contextRef.current=null; setIsGpuReady(false);});
        context = canvas.getContext('webgpu'); contextRef.current = context;
        if (!context) { console.error("Failed to get context."); setError('No WebGPU context.'); return; }
        format = navigator.gpu.getPreferredCanvasFormat(); formatRef.current = format;
        console.log("[initializeAll] Context and Format obtained.");
        console.log("[initializeAll] Skipping pipeline creation for clear test.");
        
        // Video element setup is skipped for clear test
        console.log("[initializeAll] Skipping video setup for clear test.");
        
        resizeObserver = new ResizeObserver(resizeHandlerRef.current);
        resizeObserver.observe(canvas);
        console.log("[initializeAll] ResizeObserver observing canvas.");
        console.log("[initializeAll] Calling initial configureCanvas.");
        resizeHandlerRef.current(); 
        
        setIsGpuReady(true); // Mark GPU as ready for allResourcesReady check
        console.log("[initializeAll] GPU Core is Ready (for clear test).");

        if (!renderLoopStarted) { console.log("[initializeAll] Starting render loop."); render(); renderLoopStarted = true; }
        // setDebugMessage("Diagnostic: Black Clear Active"); // Set by UI_MSG_EFFECT
      } catch (err) { console.error("[initializeAll] Major error during initialization:", err); setError(`Init failed: ${err.message}`); setDebugMessage("Initialization Error."); setIsGpuReady(false);}
    };
    initializeAll();
    return () => { /* ... cleanup ... */
        console.log("[MAIN_EFFECT_CLEANUP] Cleaning up (Clear Test).");
        if (animationFrameIdRef.current) cancelAnimationFrame(animationFrameIdRef.current);
        if (resizeObserver && canvasRef.current) resizeObserver.unobserve(canvasRef.current);
        if (resizeHandlerRef.current) window.removeEventListener('resize', resizeHandlerRef.current); // Should be unobserve for RO
        deviceRef.current = null; contextRef.current = null; formatRef.current = null; setLandmarker(null); setIsGpuReady(false);
    };
  }, []);

  const allResourcesReady = !!(landmarker && isGpuReady && deviceRef.current && contextRef.current);

  useEffect(() => {
    if(allResourcesReady) { console.log("[UI_MSG_EFFECT] Resources ready for Black Clear Test."); setDebugMessage("Diagnostic: Black Clear");}
    else { setDebugMessage("Initializing for Black Clear Test...");}
  }, [allResourcesReady]);

  return (
    <div style={{ width: '640px', height: '480px', margin: 'auto', border: '1px solid #ccc', position: 'relative', overflow: 'hidden' }}>
      <div style={{position:'absolute',top:'5px',left:'5px',background:'rgba(0,0,0,0.7)',color:'white',padding:'2px 5px',fontSize:'12px',zIndex:10,pointerEvents:'none'}}>
        {error ? `Error: ${error}` : debugMessage} (Frame: {frameCounter.current})
      </div>
      <video ref={videoRef} style={{position:'absolute',top:0,left:0,width:'100%',height:'100%',objectFit:'cover',opacity:0,pointerEvents:'none',zIndex:1}} width={640} height={480} autoPlay playsInline muted />
      <canvas ref={canvasRef} width={640} height={480} style={{position:'absolute',top:0,left:0,width:'100%',height:'100%',zIndex:2, background: 'lightgray'}} />
    </div>
  );
}