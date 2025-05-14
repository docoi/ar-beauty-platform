// src/pages/LipstickMirrorLive.jsx (Corrected - Direct copy of working TestWebGPUCanvas logic, renamed)

import React, { useEffect, useRef, useState } from 'react';

export default function LipstickMirrorLive() {
  const canvasRef = useRef(null);
  const videoRef = useRef(null); // videoRef is defined but NOT USED in this clear-only diagnostic

  const animationFrameIdRef = useRef(null);
  const frameCounter = useRef(0); 
  const resizeHandlerRef = useRef(null);

  const [error, setError] = useState(null);
  const [debugMessage, setDebugMessage] = useState('Initializing...');

  useEffect(() => {
    console.log("[LML as TestWebGPUCanvas] useEffect running.");
    let device = null; 
    let context = null;
    let format = null;
    let resizeObserver = null;
    let renderLoopStarted = false;

    // Always use canvasRef.current to get the DOM element within this effect or its functions
    // const canvas = canvasRef.current; // Get it once if it won't change, or get it fresh

    const configureCanvas = (entries) => {
      const currentCanvas = canvasRef.current; // Get fresh instance
      if (!currentCanvas) { console.error("[configureCanvas] CanvasRef is null!"); return; }
      if (!device || !context || !format) { 
        console.warn("[configureCanvas] Prerequisites (device, context, format) not met. Skipping."); return; 
      }
      
      if (entries) { console.log("[configureCanvas via RO]"); } 
      else { console.log("[configureCanvas direct]"); }
      
      const dpr = window.devicePixelRatio || 1;
      const cw = currentCanvas.clientWidth; const ch = currentCanvas.clientHeight;
      if (cw === 0 || ch === 0) { console.warn(`[configureCanvas] Canvas clientW/H is zero.`); return; }
      const tw = Math.floor(cw * dpr); const th = Math.floor(ch * dpr);
      console.log(`[configureCanvas] DPR: ${dpr}, clientW: ${cw}, clientH: ${ch} => target phys: ${tw}x${th}`);

      if (currentCanvas.width !== tw || currentCanvas.height !== th) {
        currentCanvas.width = tw; currentCanvas.height = th;
        console.log(`[configureCanvas] Canvas buffer SET to: ${currentCanvas.width}x${currentCanvas.height}`);
      } else {
        console.log(`[configureCanvas] Canvas size ${currentCanvas.width}x${currentCanvas.height} OK.`);
      }
      try {
        context.configure({ device, format, alphaMode: 'opaque', size: [currentCanvas.width, currentCanvas.height] });
        console.log(`[configureCanvas] Context CONFIGURED. Size: ${currentCanvas.width}x${currentCanvas.height}`);
      } catch (e) { console.error("[configureCanvas] Error config context:", e); setError("Error config context."); }
    };
    resizeHandlerRef.current = configureCanvas;

    const render = () => {
      const currentDevice = device; // Use device from initializeWebGPU's closure
      const currentContext = context; // Use context from initializeWebGPU's closure
      const currentCanvas = canvasRef.current; // Get fresh canvas ref

      if (!currentDevice || !currentContext || !currentCanvas) {
        if (animationFrameIdRef.current) cancelAnimationFrame(animationFrameIdRef.current);
        animationFrameIdRef.current = null; return;
      }
      
      let currentGpuTexture, texView;
      try { currentGpuTexture = currentContext.getCurrentTexture(); texView = currentGpuTexture.createView(); }
      catch(e) { console.error(`[LML_RENDER ${frameCounter.current}] Error currentTex:`, e); if(resizeHandlerRef.current) resizeHandlerRef.current(); animationFrameIdRef.current = requestAnimationFrame(render); return; }
      
      frameCounter.current++;
      if (frameCounter.current < 5 || frameCounter.current % 240 === 1) { console.log(`[LML_RENDER ${frameCounter.current}] Canvas: ${currentCanvas.width}x${currentCanvas.height}. GPU Tex: ${currentGpuTexture.width}x${currentGpuTexture.height}`); }

      const cmdEnc = currentDevice.createCommandEncoder({label: "LML_ClearEncoder"});
      const passEnc = cmdEnc.beginRenderPass({colorAttachments:[{view:texView,clearValue:{r:1.0,g:0.0,b:1.0,a:1.0},loadOp:'clear',storeOp:'store'}]}); // MAGENTA
      passEnc.setViewport(0,0,currentGpuTexture.width,currentGpuTexture.height,0,1);
      passEnc.setScissorRect(0,0,currentGpuTexture.width,currentGpuTexture.height);
      passEnc.end();
      currentDevice.queue.submit([cmdEnc.finish()]);
      if(frameCounter.current === 1) { 
          console.log(`[LML_RENDER 1] First frame cleared to magenta.`); 
          setDebugMessage("LML Magenta Clear (Test)"); 
      }
      animationFrameIdRef.current = requestAnimationFrame(render);
    };

    const initializeWebGPU = async () => {
      const localCanvas = canvasRef.current; // Ensure we use .current
      if (!localCanvas) { console.error("LML: Canvas ref.current is null in initializeWebGPU"); setError("Canvas not found."); return; }
      if (!navigator.gpu) { console.error('LML: WebGPU not supported.'); setError("WebGPU not supported."); return; }
      setDebugMessage("Initializing LML (Magenta Test)...");

      try {
        const adapter = await navigator.gpu.requestAdapter();
        if (!adapter) { console.error('LML: No GPU adapter.'); setError("No GPU adapter."); return; }
        // Assign to local variables device, context, format within this async function's scope
        // These will be closed over by configureCanvas and render
        device = await adapter.requestDevice(); 
        console.log("[LML] Device obtained.");
        device.lost.then((info) => { console.error(`LML: Device lost: ${info.message}`); if (animationFrameIdRef.current) cancelAnimationFrame(animationFrameIdRef.current); setError("WebGPU Device Lost.");});
        
        context = localCanvas.getContext('webgpu');
        if (!context) { console.error("LML: No WebGPU context."); setError("No WebGPU context."); return; }
        console.log("[LML] Context obtained.");

        format = navigator.gpu.getPreferredCanvasFormat();
        console.log("[LML] Preferred format:", format);
        
        resizeObserver = new ResizeObserver(resizeHandlerRef.current); // resizeHandlerRef.current is configureCanvas
        resizeObserver.observe(localCanvas);
        console.log("[LML] ResizeObserver observing canvas.");
        
        console.log("[LML] Calling initial configureCanvas.");
        if(resizeHandlerRef.current) {
            resizeHandlerRef.current(); // Call the stored configureCanvas function
        } else {
            console.error("LML: resizeHandlerRef.current is null before initial call to configureCanvas");
        }
        
        if (!renderLoopStarted) { console.log("[LML] Starting render loop."); render(); renderLoopStarted = true; }
      } catch (error) { console.error('[LML] Error initializing WebGPU:', error); setError(`WebGPU Init failed: ${error.message}`); }
    };

    initializeWebGPU();

    return () => {
      console.log("[LML Cleanup].");
      if (animationFrameIdRef.current) cancelAnimationFrame(animationFrameIdRef.current);
      if (resizeObserver && canvasRef.current) resizeObserver.unobserve(canvasRef.current);
      if (resizeObserver) resizeObserver.disconnect(); // Disconnect observer
    };
  }, []); 
  
  useEffect(() => {
    if (error) {
        setDebugMessage(`Error: ${error}`);
    }
    // Simple UI message update logic for this test.
    // It will be updated by the render() function after frame 1.
  }, [error]);


  return (
    <div style={{ width: '640px', height: '480px', margin: 'auto', border: '1px solid #ccc', position: 'relative', overflow: 'hidden' }}>
      <div style={{position:'absolute',top:'5px',left:'5px',background:'rgba(0,0,0,0.7)',color:'white',padding:'2px 5px',fontSize:'12px',zIndex:10,pointerEvents:'none'}}>
        {error ? `Error: ${error}` : debugMessage} (Frame: {frameCounter.current})
      </div>
      <video ref={videoRef} style={{display:'none'}} width={640} height={480} autoPlay playsInline muted /> {/* Kept for structure, not used */}
      <canvas 
        ref={canvasRef} 
        width={640} 
        height={480}
        style={{
          position:'absolute', top:0, left:0, 
          width:'100%', height:'100%', 
          zIndex:2, 
          display: 'block', 
          background: 'lightgray'
        }} 
      />
    </div>
  );
}