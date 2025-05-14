// src/pages/LipstickMirrorLive.jsx (ULTIMATE SIMPLIFICATION - Clear Only Magenta)

import React, { useEffect, useRef, useState } from 'react';

export default function LipstickMirrorLive() {
  const canvasRef = useRef(null);
  const animationFrameIdRef = useRef(null);
  const frameCounter = useRef(0); // Only for UI debug message
  const resizeHandlerRef = useRef(null);

  const [error, setError] = useState(null);
  const [debugMessage, setDebugMessage] = useState('Initializing...');

  useEffect(() => {
    console.log("[LML_ULTRA_SIMPLE] useEffect running.");
    let device = null; 
    let context = null;
    let format = null;
    let resizeObserver = null;
    let renderLoopStarted = false;

    const canvas = canvasRef.current;
    if (!canvas) {
      console.error("[LML_ULTRA_SIMPLE] Canvas element not found.");
      setError("Canvas not found.");
      return;
    }

    const configureCanvas = (entries) => {
      if (!device || !context || !format || !canvasRef.current) { 
        console.warn("[LML_ULTRA_SIMPLE_configureCanvas] Prerequisites not met. Skipping."); return; 
      }
      const currentCanvas = canvasRef.current;
      if (entries) { console.log("[LML_ULTRA_SIMPLE_configureCanvas via RO]"); } 
      else { console.log("[LML_ULTRA_SIMPLE_configureCanvas direct call]"); }
      
      const dpr = window.devicePixelRatio || 1;
      const cw = currentCanvas.clientWidth; const ch = currentCanvas.clientHeight;
      if (cw === 0 || ch === 0) { console.warn(`[LML_ULTRA_SIMPLE_configureCanvas] Canvas clientW/H is zero.`); return; }
      const tw = Math.floor(cw * dpr); const th = Math.floor(ch * dpr);
      console.log(`[LML_ULTRA_SIMPLE_configureCanvas] DPR: ${dpr}, clientW: ${cw}, clientH: ${ch} => target phys: ${tw}x${th}`);

      if (currentCanvas.width !== tw || currentCanvas.height !== th) {
        currentCanvas.width = tw; currentCanvas.height = th;
        console.log(`[LML_ULTRA_SIMPLE_configureCanvas] Canvas buffer SET to: ${currentCanvas.width}x${currentCanvas.height}`);
      } else {
        console.log(`[LML_ULTRA_SIMPLE_configureCanvas] Canvas size ${currentCanvas.width}x${currentCanvas.height} OK.`);
      }
      try {
        context.configure({ device, format, alphaMode: 'opaque', size: [currentCanvas.width, currentCanvas.height] });
        console.log(`[LML_ULTRA_SIMPLE_configureCanvas] Context CONFIGURED. Size: ${currentCanvas.width}x${currentCanvas.height}`);
      } catch (e) { console.error("[LML_ULTRA_SIMPLE_configureCanvas] Error config context:", e); setError("Error config context."); }
    };
    resizeHandlerRef.current = configureCanvas;

    const render = () => {
      if (!device || !context || !canvasRef.current) {
        if (animationFrameIdRef.current) cancelAnimationFrame(animationFrameIdRef.current);
        animationFrameIdRef.current = null; return;
      }
      const currentCanvas = canvasRef.current;
      let currentGpuTexture, texView;
      try { currentGpuTexture = context.getCurrentTexture(); texView = currentGpuTexture.createView(); }
      catch(e) { console.error(`[LML_ULTRA_SIMPLE_RENDER ${frameCounter.current}] Error currentTex:`, e); if(resizeHandlerRef.current) resizeHandlerRef.current(); animationFrameIdRef.current = requestAnimationFrame(render); return; }
      
      frameCounter.current++;
      if (frameCounter.current < 5 || frameCounter.current % 240 === 1) { console.log(`[LML_ULTRA_SIMPLE_RENDER ${frameCounter.current}] Canvas: ${currentCanvas.width}x${currentCanvas.height}. GPU Tex: ${currentGpuTexture.width}x${currentGpuTexture.height}`); }

      const cmdEnc = device.createCommandEncoder();
      const passEnc = cmdEnc.beginRenderPass({colorAttachments:[{view:texView,clearValue:{r:1.0,g:0.0,b:1.0,a:1.0},loadOp:'clear',storeOp:'store'}]}); // MAGENTA
      passEnc.setViewport(0,0,currentGpuTexture.width,currentGpuTexture.height,0,1);
      passEnc.setScissorRect(0,0,currentGpuTexture.width,currentGpuTexture.height);
      passEnc.end();
      device.queue.submit([cmdEnc.finish()]);
      if(frameCounter.current === 1) { console.log(`[LML_ULTRA_SIMPLE_RENDER 1] First frame cleared to magenta.`); setDebugMessage("Diagnostic: LML Ultra Simple Magenta"); }
      animationFrameIdRef.current = requestAnimationFrame(render);
    };

    const initializeWebGPU = async () => {
      const localCanvas = canvasRef.current;
      if (!localCanvas) { console.error("LML_ULTRA_SIMPLE: Canvas ref null in init"); return; }
      if (!navigator.gpu) { console.error('LML_ULTRA_SIMPLE: WebGPU not supported.'); setError("WebGPU not supported."); return; }
      setDebugMessage("Initializing WebGPU (LML Ultra Simple)...");
      try {
        const adapter = await navigator.gpu.requestAdapter();
        if (!adapter) { console.error('LML_ULTRA_SIMPLE: No GPU adapter.'); setError("No GPU adapter."); return; }
        device = await adapter.requestDevice();
        console.log("[LML_ULTRA_SIMPLE] Device obtained.");
        device.lost.then((info) => { console.error(`LML_ULTRA_SIMPLE: Device lost: ${info.message}`); if (animationFrameIdRef.current) cancelAnimationFrame(animationFrameIdRef.current); setError("WebGPU Device Lost.");});
        context = localCanvas.getContext('webgpu');
        if (!context) { console.error("LML_ULTRA_SIMPLE: No WebGPU context."); setError("No WebGPU context."); return; }
        console.log("[LML_ULTRA_SIMPLE] Context obtained.");
        format = navigator.gpu.getPreferredCanvasFormat();
        console.log("[LML_ULTRA_SIMPLE] Preferred format:", format);
        
        resizeObserver = new ResizeObserver(resizeHandlerRef.current);
        resizeObserver.observe(localCanvas);
        console.log("[LML_ULTRA_SIMPLE] ResizeObserver observing canvas.");
        console.log("[LML_ULTRA_SIMPLE] Calling initial configureCanvas.");
        if(resizeHandlerRef.current) resizeHandlerRef.current();
        else console.error("resizeHandlerRef.current is null before initial call");
        
        if (!renderLoopStarted) { console.log("[LML_ULTRA_SIMPLE] Starting render loop."); render(); renderLoopStarted = true; }
        // setDebugMessage("LML Ultra Simple: Running"); // Set by UI effect
      } catch (error) { console.error('[LML_ULTRA_SIMPLE] Error initializing WebGPU:', error); setError(`WebGPU Init failed: ${error.message}`); }
    };
    initializeWebGPU();
    return () => {
      console.log("[LML_ULTRA_SIMPLE_CLEANUP].");
      if (animationFrameIdRef.current) cancelAnimationFrame(animationFrameIdRef.current);
      if (resizeObserver && canvasRef.current) resizeObserver.unobserve(canvasRef.current);
      if (resizeObserver) resizeObserver.disconnect();
    };
  }, []);

  useEffect(() => { // Separate effect for UI message based on error or basic readiness
    if (error) {
        setDebugMessage(`Error: ${error}`);
    } else if (deviceRef.current && contextRef.current) { // A very basic check for readiness
        // This message might flicker as frameCounter updates.
        // setDebugMessage(`LML Ultra Simple: OK (Frame: ${frameCounter.current})`);
    } else {
        setDebugMessage("LML Ultra Simple: Initializing...");
    }
  }, [error, deviceRef.current, contextRef.current, frameCounter.current]); // frameCounter will cause frequent updates here

  return (
    // Using the ORIGINAL parent div styling that LipstickMirrorLive uses
    <div style={{ width: '640px', height: '480px', margin: 'auto', border: '1px solid #ccc', position: 'relative', overflow: 'hidden' }}>
      <div style={{position:'absolute',top:'5px',left:'5px',background:'rgba(0,0,0,0.7)',color:'white',padding:'2px 5px',fontSize:'12px',zIndex:10,pointerEvents:'none'}}>
        {error ? `Error: ${error}` : debugMessage} (Frame: {frameCounter.current})
      </div>
      {/* Video element is in the DOM but not used */}
      <video ref={videoRef} style={{display:'none'}} width={640} height={480} autoPlay playsInline muted />
      <canvas 
        ref={canvasRef} 
        width={640} 
        height={480}
        style={{
          position:'absolute', top:0, left:0, 
          width:'100%', height:'100%', 
          zIndex:2, 
          display: 'block', 
          background: 'lightgray' // CSS background
        }} 
      />
    </div>
  );
}