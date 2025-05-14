// src/pages/LipstickMirrorLive.jsx (SUPER CLEAR ONLY Diagnostic - No Video/MediaPipe)

import React, { useEffect, useRef, useState } from 'react';
// createPipelines, lipTriangles, FaceLandmarker NOT USED
// import createPipelines from '@/utils/createPipelines';
// import lipTriangles from '@/utils/lipTriangles';
// import { FaceLandmarker, FilesetResolver } from '@mediapipe/tasks-vision';

export default function LipstickMirrorLive() {
  const canvasRef = useRef(null);
  const videoRef = useRef(null); // Ref kept, but element won't be used

  const deviceRef = useRef(null);
  const contextRef = useRef(null);
  const formatRef = useRef(null);
  const animationFrameIdRef = useRef(null);
  const resizeHandlerRef = useRef(null);

  // const [landmarker, setLandmarker] = useState(null); // Not used
  const [isGpuReady, setIsGpuReady] = useState(false);
  const [error, setError] = useState(null);
  const [debugMessage, setDebugMessage] = useState('Initializing...');
  const frameCounter = useRef(0);

  useEffect(() => {
    console.log("[MAIN_EFFECT] SUPER CLEAR ONLY Diagnostic.");
    let device = null; let context = null; let format = null;
    let resizeObserver = null; let renderLoopStarted = false;
    const canvas = canvasRef.current;
    if (!canvas) { console.error("Canvas element not found."); return; }

    const configureCanvas = (entries) => {
      // ... (configureCanvas function remains exactly the same as your last working version)
      if (!device || !context || !format) { console.warn("[configureCanvas] Prerequisites not met."); return; }
      if (entries) { console.log("[configureCanvas via ResizeObserver] Called."); } 
      else { console.log("[configureCanvas direct call] Called."); }
      const dpr = window.devicePixelRatio || 1;
      const cw = canvas.clientWidth; const ch = canvas.clientHeight;
      if (cw === 0 || ch === 0) { console.warn(`[configureCanvas] Canvas clientWidth/Height is zero.`); return; }
      const tw = Math.floor(cw * dpr); const th = Math.floor(ch * dpr);
      console.log(`[configureCanvas] DPR: ${dpr}, clientW: ${cw}, clientH: ${ch} => target phys: ${tw}x${th}`);
      if (canvas.width !== tw || canvas.height !== th) { canvas.width = tw; canvas.height = th; console.log(`[configureCanvas] Canvas buffer SET to: ${tw}x${th}`); }
      else { console.log(`[configureCanvas] Canvas size ${tw}x${th} already correct.`); }
      try { context.configure({ device, format, alphaMode: 'opaque', size: [canvas.width, canvas.height] }); console.log(`[configureCanvas] Context CONFIGURED. Size: ${canvas.width}x${canvas.height}`); }
      catch (e) { console.error("[configureCanvas] Error configuring context:", e); setError("Error configuring context."); }
    };
    resizeHandlerRef.current = configureCanvas;

    const render = () => {
      // ... (render function from "Clear Only to Black" diagnostic - BUT CLEAR TO MAGENTA)
      // It should only get current texture, begin pass, clear to MAGENTA, set viewport/scissor, end pass, submit.
      if (!device || !context) { animationFrameIdRef.current = requestAnimationFrame(render); return; }
      frameCounter.current++;
      let currentGpuTexture, texView;
      try { currentGpuTexture = context.getCurrentTexture(); texView = currentGpuTexture.createView(); }
      catch(e) { console.error(`[RENDER ${frameCounter.current}] Error getting current texture:`, e); if(resizeHandlerRef.current) resizeHandlerRef.current(); animationFrameIdRef.current = requestAnimationFrame(render); return; }
      if (frameCounter.current < 5 || frameCounter.current % 120 === 1) { console.log(`[RENDER ${frameCounter.current}] Canvas attr: ${canvas.width}x${canvas.height}. GPUTexture: ${currentGpuTexture.width}x${currentGpuTexture.height}`); }
      
      const cmdEnc = device.createCommandEncoder({label: "SuperClearMagentaEncoder"});
      const passEnc = cmdEnc.beginRenderPass({ colorAttachments:[{ view: texView, clearValue: {r:1.0,g:0.0,b:1.0,a:1.0}, loadOp:'clear', storeOp:'store' }]}); // MAGENTA CLEAR
      passEnc.setViewport(0,0,currentGpuTexture.width, currentGpuTexture.height,0,1);
      passEnc.setScissorRect(0,0,currentGpuTexture.width, currentGpuTexture.height);
      passEnc.end();
      device.queue.submit([cmdEnc.finish()]);
      if(frameCounter.current === 1) { console.log(`[RENDER 1] First frame (magenta clear).`); setDebugMessage("Diagnostic: Super Clear Magenta"); }
      animationFrameIdRef.current = requestAnimationFrame(render);
    };

    const initializeAll = async () => {
      if (!navigator.gpu) { console.error("WebGPU not supported."); setError("WebGPU not supported."); return; }
      setDebugMessage("Initializing Systems (Super Clear Test)...");
      try {
        console.log("[initializeAll] SKIPPING FaceLandmarker for Super Clear test.");
        // setLandmarker(true); // No landmarker state needed for this

        console.log("[initializeAll] Initializing WebGPU Device & Format...");
        const adapter = await navigator.gpu.requestAdapter();
        if (!adapter) { console.error("Failed to get GPU adapter."); setError("No GPU adapter."); return; }
        device = await adapter.requestDevice(); deviceRef.current = device;
        console.log("[initializeAll] Device obtained.");
        device.lost.then((info) => { /* ... */ });
        context = canvas.getContext('webgpu'); contextRef.current = context;
        if (!context) { console.error("Failed to get context."); setError('No WebGPU context.'); return; }
        format = navigator.gpu.getPreferredCanvasFormat(); formatRef.current = format;
        console.log("[initializeAll] Context and Format obtained.");
        
        console.log("[initializeAll] SKIPPING pipeline, video, and MediaPipe setup for Super Clear test.");
        
        resizeObserver = new ResizeObserver(resizeHandlerRef.current);
        resizeObserver.observe(canvas);
        console.log("[initializeAll] ResizeObserver observing canvas.");
        console.log("[initializeAll] Calling initial configureCanvas.");
        resizeHandlerRef.current(); 
        
        setIsGpuReady(true); // Mark as ready since we only need device/context for clear
        console.log("[initializeAll] GPU Core is Ready (for Super clear test).");

        if (!renderLoopStarted) { console.log("[initializeAll] Starting render loop."); render(); renderLoopStarted = true; }
      } catch (err) { console.error("[initializeAll] Major error:", err); setError(`Init failed: ${err.message}`); setIsGpuReady(false);}
    };
    initializeAll();
    return () => { /* ... cleanup ... */
        console.log("[MAIN_EFFECT_CLEANUP] Cleaning up (Super Clear Test).");
        if (animationFrameIdRef.current) cancelAnimationFrame(animationFrameIdRef.current);
        if (resizeObserver && canvasRef.current) resizeObserver.unobserve(canvasRef.current);
        deviceRef.current = null; contextRef.current = null; formatRef.current = null; setIsGpuReady(false);
    };
  }, []);

  // Simplified allResourcesReady for this diagnostic
  const allResourcesReady = !!(isGpuReady && deviceRef.current && contextRef.current);

  useEffect(() => {
    if(allResourcesReady) { console.log("[UI_MSG_EFFECT] Resources ready for Super Clear Test."); setDebugMessage("Diagnostic: Super Clear Magenta");}
    else { setDebugMessage("Initializing Super Clear Test...");}
  }, [allResourcesReady]);

  return ( // Using original parent div styling
    <div style={{ width: '640px', height: '480px', margin: 'auto', border: '1px solid #ccc', position: 'relative', overflow: 'hidden' }}>
      <div style={{position:'absolute',top:'5px',left:'5px',background:'rgba(0,0,0,0.7)',color:'white',padding:'2px 5px',fontSize:'12px',zIndex:10,pointerEvents:'none'}}>
        {error ? `Error: ${error}` : debugMessage} (Frame: {frameCounter.current})
      </div>
      <video ref={videoRef} style={{display:'none'}} width={640} height={480} autoPlay playsInline muted />
      <canvas ref={canvasRef} width={640} height={480} style={{position:'absolute',top:0,left:0,width:'100%',height:'100%',zIndex:2, background: 'lightgray'}} />
    </div>
  );
}