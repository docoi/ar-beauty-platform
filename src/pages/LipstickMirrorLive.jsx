// src/pages/LipstickMirrorLive.jsx (DIAGNOSTIC - Clear Only to BLACK, with SIMPLIFIED PARENT STYLING)

import React, { useEffect, useRef, useState } from 'react';
// createPipelines and lipTriangles not used in this specific diagnostic step
// import createPipelines from '@/utils/createPipelines';
// import lipTriangles from '@/utils/lipTriangles';
// FaceLandmarker not used in this specific diagnostic step
// import { FaceLandmarker, FilesetResolver } from '@mediapipe/tasks-vision';

export default function LipstickMirrorLive() {
  const canvasRef = useRef(null);
  const videoRef = useRef(null); 

  const deviceRef = useRef(null);
  const contextRef = useRef(null);
  const formatRef = useRef(null);
  const animationFrameIdRef = useRef(null);
  const resizeHandlerRef = useRef(null);

  const [landmarker, setLandmarker] = useState(true); // Dummy true for allResourcesReady
  const [isGpuReady, setIsGpuReady] = useState(false);
  const [error, setError] = useState(null);
  const [debugMessage, setDebugMessage] = useState('Initializing...');
  const frameCounter = useRef(0);

  useEffect(() => {
    console.log("[MAIN_EFFECT] LipstickMirrorLive useEffect running (Clear Only Diagnostic with simplified parent).");
    let device = null; let context = null; let format = null;
    let resizeObserver = null; let renderLoopStarted = false;
    const canvas = canvasRef.current;
    if (!canvas) { console.error("Canvas element not found."); return; }

    const configureCanvas = (entries) => {
      if (!device || !context || !format) { console.warn("[configureCanvas] Prerequisites not met."); return; }
      if (entries) { console.log("[configureCanvas via ResizeObserver] Called."); } 
      else { console.log("[configureCanvas direct call] Called."); }
      const dpr = window.devicePixelRatio || 1;
      const cw = canvas.clientWidth; const ch = canvas.clientHeight;
      if (cw === 0 || ch === 0) { console.warn(`[configureCanvas] Canvas clientWidth/Height is zero. W: ${cw}, H: ${ch}`); return; }
      const tw = Math.floor(cw * dpr); const th = Math.floor(ch * dpr);
      console.log(`[configureCanvas] DPR: ${dpr}, clientW: ${cw}, clientH: ${ch} => target phys: ${tw}x${th}`);
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
      if(frameCounter.current === 1) { console.log(`[RENDER 1] First frame (black clear).`); setDebugMessage("Diagnostic: Black Clear (FullVP Parent)"); }
      animationFrameIdRef.current = requestAnimationFrame(render);
    };

    const initializeAll = async () => {
      if (!navigator.gpu) { console.error("WebGPU not supported."); setError("WebGPU not supported."); return; }
      setDebugMessage("Initializing Systems (Clear Test FullVP)...");
      try {
        console.log("[initializeAll] Skipping FaceLandmarker for clear test.");
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
        console.log("[initializeAll] Skipping video setup for clear test.");
        
        resizeObserver = new ResizeObserver(resizeHandlerRef.current);
        resizeObserver.observe(canvas);
        console.log("[initializeAll] ResizeObserver observing canvas.");
        console.log("[initializeAll] Calling initial configureCanvas.");
        resizeHandlerRef.current(); 
        
        setIsGpuReady(true);
        console.log("[initializeAll] GPU Core is Ready (for clear test).");

        if (!renderLoopStarted) { console.log("[initializeAll] Starting render loop."); render(); renderLoopStarted = true; }
      } catch (err) { console.error("[initializeAll] Major error during initialization:", err); setError(`Init failed: ${err.message}`); setDebugMessage("Initialization Error."); setIsGpuReady(false);}
    };
    initializeAll();
    return () => {
        console.log("[MAIN_EFFECT_CLEANUP] Cleaning up (Clear Test FullVP).");
        if (animationFrameIdRef.current) cancelAnimationFrame(animationFrameIdRef.current);
        if (resizeObserver && canvasRef.current) resizeObserver.unobserve(canvasRef.current);
        // No need to remove 'resize' listener if it's the same function instance as used by RO and RO handles it.
        // However, if we had a separate window.addEventListener('resize', resizeHandlerRef.current), we would remove it.
        deviceRef.current = null; contextRef.current = null; formatRef.current = null; setLandmarker(null); setIsGpuReady(false);
    };
  }, []);

  const allResourcesReady = !!(landmarker && isGpuReady && deviceRef.current && contextRef.current);

  useEffect(() => {
    if(allResourcesReady) { console.log("[UI_MSG_EFFECT] Resources ready for Black Clear Test (FullVP)."); setDebugMessage("Diagnostic: Black Clear (FullVP Parent)");}
    else { setDebugMessage("Initializing for Black Clear Test (FullVP)...");}
  }, [allResourcesReady]);

  return (
    // MODIFIED Parent Div Styling for this diagnostic:
    <div style={{ width: '100vw', height: '100vh', margin: 0, padding: 0, background: 'darkseagreen' }}>
      <div style={{position:'absolute',top:'5px',left:'5px',background:'rgba(0,0,0,0.7)',color:'white',padding:'2px 5px',fontSize:'12px',zIndex:10,pointerEvents:'none'}}>
        {error ? `Error: ${error}` : debugMessage} (Frame: {frameCounter.current})
      </div>
      {/* Video element is not used by this diagnostic but kept in DOM for structural similarity */}
      <video ref={videoRef} style={{display:'none'}} width={640} height={480} autoPlay playsInline muted />
      
      <canvas 
        ref={canvasRef} 
        width={640} /* Nominal HTML attributes, JS+CSS control actual size */
        height={480}
        style={{
          display: 'block', 
          width: '100%', 
          height: '100%', 
          background: 'lightgray' // CSS background for the canvas element itself
        }} 
      />
    </div>
  );
}