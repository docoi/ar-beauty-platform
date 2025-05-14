// src/pages/LipstickMirrorLive.jsx (ULTIMATE SIMPLIFICATION - Corrected deviceRef/contextRef scope)

import React, { useEffect, useRef, useState } from 'react';

export default function LipstickMirrorLive() {
  const canvasRef = useRef(null);
  const videoRef = useRef(null); 

  // --- Refs defined at component scope ---
  const deviceRef = useRef(null);
  const contextRef = useRef(null);
  const formatRef = useRef(null); // Keep for consistency, though not directly in error path
  const animationFrameIdRef = useRef(null);
  const frameCounter = useRef(0);
  const resizeHandlerRef = useRef(null);

  const [landmarker, setLandmarker] = useState(true);
  const [error, setError] = useState(null);
  const [debugMessage, setDebugMessage] = useState('Initializing...');
  
  // Main useEffect for WebGPU setup
  useEffect(() => {
    console.log("[LML_ULTRA_SIMPLE] useEffect running.");
    // Local variables for async setup; will be assigned to refs
    let localDevice = null; 
    let localContext = null;
    let localFormat = null;
    let resizeObserver = null;
    let renderLoopStarted = false;

    const canvas = canvasRef.current;
    if (!canvas) {
      console.error("[LML_ULTRA_SIMPLE] Canvas element not available.");
      setError("Canvas not found.");
      return;
    }

    const configureCanvas = (entries) => {
      // Use refs here as they are now reliably set at component scope
      // and updated by initializeWebGPU
      if (!deviceRef.current || !contextRef.current || !formatRef.current || !canvasRef.current) { 
        console.warn("[configureCanvas] Prerequisites (device, context, format, canvas refs) not met. Skipping."); return; 
      }
      const currentCanvas = canvasRef.current;
      if (entries) { console.log("[configureCanvas via RO]"); } else { console.log("[configureCanvas direct]"); }
      
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
        contextRef.current.configure({ device: deviceRef.current, format: formatRef.current, alphaMode: 'opaque', size: [currentCanvas.width, currentCanvas.height] });
        console.log(`[configureCanvas] Context CONFIGURED. Size: ${currentCanvas.width}x${currentCanvas.height}`);
      } catch (e) { console.error("[configureCanvas] Error config context:", e); setError("Error config context."); }
    };
    resizeHandlerRef.current = configureCanvas;

    const render = () => {
      if (!deviceRef.current || !contextRef.current || !canvasRef.current) {
        if (animationFrameIdRef.current) cancelAnimationFrame(animationFrameIdRef.current);
        animationFrameIdRef.current = null; return;
      }
      const currentDevice = deviceRef.current;
      const currentContext = contextRef.current;
      const currentCanvas = canvasRef.current;
      let currentGpuTexture, texView;
      try { currentGpuTexture = currentContext.getCurrentTexture(); texView = currentGpuTexture.createView(); }
      catch(e) { console.error(`[LML_ULTRA_SIMPLE_RENDER ${frameCounter.current}] Error currentTex:`, e); if(resizeHandlerRef.current) resizeHandlerRef.current(); animationFrameIdRef.current = requestAnimationFrame(render); return; }
      
      frameCounter.current++;
      if (frameCounter.current < 5 || frameCounter.current % 240 === 1) { console.log(`[LML_ULTRA_SIMPLE_RENDER ${frameCounter.current}] Canvas: ${currentCanvas.width}x${currentCanvas.height}. GPU Tex: ${currentGpuTexture.width}x${currentGpuTexture.height}`); }

      const cmdEnc = currentDevice.createCommandEncoder({label: "LML_ClearOnlyEncoder"});
      const passEnc = cmdEnc.beginRenderPass({colorAttachments:[{view:texView,clearValue:{r:1.0,g:0.0,b:1.0,a:1.0},loadOp:'clear',storeOp:'store'}]}); // MAGENTA
      passEnc.setViewport(0,0,currentGpuTexture.width,currentGpuTexture.height,0,1);
      passEnc.setScissorRect(0,0,currentGpuTexture.width,currentGpuTexture.height);
      passEnc.end();
      currentDevice.queue.submit([cmdEnc.finish()]);
      if(frameCounter.current === 1) { console.log(`[LML_ULTRA_SIMPLE_RENDER 1] First frame cleared to magenta.`); /* setDebugMessage moved to separate effect */ }
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
        localDevice = await adapter.requestDevice(); // Assign to local variable
        deviceRef.current = localDevice; // THEN update the ref
        console.log("[LML_ULTRA_SIMPLE] Device obtained.");
        localDevice.lost.then((info) => { console.error(`LML_ULTRA_SIMPLE: Device lost: ${info.message}`); if (animationFrameIdRef.current) cancelAnimationFrame(animationFrameIdRef.current); setError("WebGPU Device Lost."); deviceRef.current = null; contextRef.current = null;});
        
        localContext = localCanvas.getContext('webgpu'); // Assign to local variable
        contextRef.current = localContext; // THEN update the ref
        if (!localContext) { console.error("LML_ULTRA_SIMPLE: No WebGPU context."); setError("No WebGPU context."); return; }
        console.log("[LML_ULTRA_SIMPLE] Context obtained.");

        localFormat = navigator.gpu.getPreferredCanvasFormat(); // Assign to local variable
        formatRef.current = localFormat; // THEN update the ref
        console.log("[LML_ULTRA_SIMPLE] Preferred format:", localFormat);
        
        resizeObserver = new ResizeObserver(resizeHandlerRef.current);
        resizeObserver.observe(localCanvas);
        console.log("[LML_ULTRA_SIMPLE] ResizeObserver observing canvas.");
        console.log("[LML_ULTRA_SIMPLE] Calling initial configureCanvas.");
        if(resizeHandlerRef.current) resizeHandlerRef.current();
        else console.error("resizeHandlerRef.current is null before initial call");
        
        if (!renderLoopStarted) { console.log("[LML_ULTRA_SIMPLE] Starting render loop."); render(); renderLoopStarted = true; }
      } catch (error) { console.error('[LML_ULTRA_SIMPLE] Error initializing WebGPU:', error); setError(`WebGPU Init failed: ${error.message}`); }
    };
    initializeWebGPU();
    return () => { /* ... cleanup as before ... */
        console.log("[LML_ULTRA_SIMPLE_CLEANUP].");
        if (animationFrameIdRef.current) cancelAnimationFrame(animationFrameIdRef.current);
        if (resizeObserver && canvasRef.current) resizeObserver.unobserve(canvasRef.current);
        if (resizeObserver) resizeObserver.disconnect();
        deviceRef.current = null; contextRef.current = null; formatRef.current = null; // Clear refs on cleanup
    };
  }, []);

  // This useEffect now correctly uses the component-scoped refs
  useEffect(() => {
    if (error) {
        setDebugMessage(`Error: ${error}`);
    } else if (deviceRef.current && contextRef.current && landmarker) { // landmarker is still dummy true
        setDebugMessage(`Diagnostic: LML Magenta Clear (Frame: ${frameCounter.current})`);
    } else {
        setDebugMessage("LML Ultra Simple: Initializing...");
    }
  }, [error, landmarker, deviceRef, contextRef, frameCounter.current]); // Rerun if error, landmarker, or if refs conceptually change (though .current is what matters)
                                                                        // Adding frameCounter.current to update UI, though it's a bit of a hack for ref display

  return (
    <div style={{ width: '640px', height: '480px', margin: 'auto', border: '1px solid #ccc', position: 'relative', overflow: 'hidden' }}>
      <div style={{position:'absolute',top:'5px',left:'5px',background:'rgba(0,0,0,0.7)',color:'white',padding:'2px 5px',fontSize:'12px',zIndex:10,pointerEvents:'none'}}>
        {error ? `Error: ${error}` : debugMessage} {/* Removed direct frameCounter.current here, let setDebugMessage handle it */}
      </div>
      <video ref={videoRef} style={{display:'none'}} width={640} height={480} autoPlay playsInline muted />
      <canvas ref={canvasRef} width={640} height={480} style={{ position:'absolute', top:0, left:0, width:'100%', height:'100%', zIndex:2, display: 'block', background: 'lightgray' }} />
    </div>
  );
}