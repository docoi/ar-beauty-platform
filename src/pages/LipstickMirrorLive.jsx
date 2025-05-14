// src/pages/LipstickMirrorLive.jsx (LITERALLY THE WORKING TestWebGPUCanvas CODE, RENAMED)

import React, { useEffect, useRef, useState } from 'react'; // useState added for error/debug, though not strictly needed for this test

// Renamed component
export default function LipstickMirrorLive() { // << RENAMED HERE
  const canvasRef = useRef(null);
  const animationFrameIdRef = useRef(null);
  const frameCounter = useRef(0); 
  const resizeHandlerRef = useRef(null);

  // Added for UI consistency with LML, though not essential for the core WebGPU clear test
  const [error, setError] = useState(null);
  const [debugMessage, setDebugMessage] = useState('Initializing...');


  useEffect(() => {
    // --- Start of code copied from the working TestWebGPUCanvas.jsx ---
    console.log("[LML as TestWebGPUCanvas] useEffect running."); // Log prefix changed
    let device = null; 
    let context = null;
    let format = null;
    let resizeObserver = null;
    let renderLoopStarted = false;

    const canvas = canvasRef.current;
    if (!canvas) {
      console.error("[LML as TestWebGPUCanvas] Canvas element not found.");
      setError("Canvas not found in LML Test"); // Use setError
      return;
    }

    const configureCanvas = (entries) => {
      const currentCanvas = canvasRef.current;
      if (!device || !context || !format || !currentCanvas) { 
        console.warn("[LML as TestWebGPUCanvas_configureCanvas] Prerequisites not met. Skipping."); return; 
      }
      if (entries) { console.log("[LML as TestWebGPUCanvas_configureCanvas via RO]"); } 
      else { console.log("[LML as TestWebGPUCanvas_configureCanvas direct call]"); }
      
      const dpr = window.devicePixelRatio || 1;
      const cw = currentCanvas.clientWidth; const ch = currentCanvas.clientHeight;
      if (cw === 0 || ch === 0) { console.warn(`[LML as TestWebGPUCanvas_configureCanvas] Canvas clientW/H is zero.`); return; }
      const tw = Math.floor(cw * dpr); const th = Math.floor(ch * dpr);
      console.log(`[LML as TestWebGPUCanvas_configureCanvas] DPR: ${dpr}, clientW: ${cw}, clientH: ${ch} => target phys: ${tw}x${th}`);

      if (currentCanvas.width !== tw || currentCanvas.height !== th) {
        currentCanvas.width = tw; currentCanvas.height = th;
        console.log(`[LML as TestWebGPUCanvas_configureCanvas] Canvas buffer SET to: ${currentCanvas.width}x${currentCanvas.height}`);
      } else {
        console.log(`[LML as TestWebGPUCanvas_configureCanvas] Canvas size ${currentCanvas.width}x${currentCanvas.height} OK.`);
      }
      try {
        context.configure({ device, format, alphaMode: 'opaque', size: [currentCanvas.width, currentCanvas.height] });
        console.log(`[LML as TestWebGPUCanvas_configureCanvas] Context CONFIGURED. Size: ${currentCanvas.width}x${currentCanvas.height}`);
      } catch (e) { console.error("[LML as TestWebGPUCanvas_configureCanvas] Error config context:", e); setError("Error config context in LML Test."); }
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
      catch(e) { console.error(`[LML as TestWebGPUCanvas_RENDER ${frameCounter.current}] Error currentTex:`, e); if(resizeHandlerRef.current) resizeHandlerRef.current(); animationFrameIdRef.current = requestAnimationFrame(render); return; }
      
      frameCounter.current++;
      if (frameCounter.current < 5 || frameCounter.current % 240 === 1) { console.log(`[LML as TestWebGPUCanvas_RENDER ${frameCounter.current}] Canvas: ${currentCanvas.width}x${currentCanvas.height}. GPU Tex: ${currentGpuTexture.width}x${currentGpuTexture.height}`); }

      const cmdEnc = device.createCommandEncoder({label: "LML_Test_ClearEncoder"});
      const passEnc = cmdEnc.beginRenderPass({colorAttachments:[{view:texView,clearValue:{r:1.0,g:0.0,b:1.0,a:1.0},loadOp:'clear',storeOp:'store'}]}); // MAGENTA
      passEnc.setViewport(0,0,currentGpuTexture.width,currentGpuTexture.height,0,1);
      passEnc.setScissorRect(0,0,currentGpuTexture.width,currentGpuTexture.height);
      passEnc.end();
      device.queue.submit([cmdEnc.finish()]);
      if(frameCounter.current === 1) { 
          console.log(`[LML as TestWebGPUCanvas_RENDER 1] First frame cleared to magenta.`); 
          setDebugMessage("LML Test: Magenta Clear"); // Use setDebugMessage
      }
      animationFrameIdRef.current = requestAnimationFrame(render);
    };

    const initializeWebGPU = async () => {
      const localCanvas = canvasRef.current;
      if (!localCanvas) { console.error("LML as TestWebGPUCanvas: Canvas ref null in init"); return; }
      if (!navigator.gpu) { console.error('LML as TestWebGPUCanvas: WebGPU not supported.'); setError("WebGPU not supported."); return; }
      setDebugMessage("Initializing LML as TestCanvas..."); // Use setDebugMessage

      try {
        const adapter = await navigator.gpu.requestAdapter();
        if (!adapter) { console.error('LML as TestWebGPUCanvas: No GPU adapter.'); setError("No GPU adapter."); return; }
        device = await adapter.requestDevice();
        console.log("[LML as TestWebGPUCanvas] Device obtained.");
        device.lost.then((info) => { console.error(`LML as TestWebGPUCanvas: Device lost: ${info.message}`); if (animationFrameIdRef.current) cancelAnimationFrame(animationFrameIdRef.current); setError("WebGPU Device Lost.");});
        context = localCanvas.getContext('webgpu');
        if (!context) { console.error("LML as TestWebGPUCanvas: No WebGPU context."); setError("No WebGPU context."); return; }
        console.log("[LML as TestWebGPUCanvas] Context obtained.");
        format = navigator.gpu.getPreferredCanvasFormat();
        console.log("[LML as TestWebGPUCanvas] Preferred format:", format);
        
        resizeObserver = new ResizeObserver(resizeHandlerRef.current);
        resizeObserver.observe(localCanvas);
        console.log("[LML as TestWebGPUCanvas] ResizeObserver observing canvas.");
        console.log("[LML as TestWebGPUCanvas] Calling initial configureCanvas.");
        if(resizeHandlerRef.current) resizeHandlerRef.current();
        else console.error("LML as TestWebGPUCanvas: resizeHandlerRef.current is null");
        
        if (!renderLoopStarted) { console.log("[LML as TestWebGPUCanvas] Starting render loop."); render(); renderLoopStarted = true; }
      } catch (error) { console.error('[LML as TestWebGPUCanvas] Error initializing WebGPU:', error); setError(`WebGPU Init failed: ${error.message}`); }
    };
    initializeWebGPU();
    return () => { /* ... cleanup as in TestWebGPUCanvas ... */
      console.log("[LML as TestWebGPUCanvas Cleanup].");
      if (animationFrameIdRef.current) cancelAnimationFrame(animationFrameIdRef.current);
      if (resizeObserver && canvasRef.current) resizeObserver.unobserve(canvasRef.current);
      if (resizeObserver) resizeObserver.disconnect();
    };
    // --- End of code copied from TestWebGPUCanvas.jsx ---
  }, []); 
  
  // UI message effect (can be simplified or use the one from TestWebGPUCanvas if preferred)
  useEffect(() => {
    if (error) {
        setDebugMessage(`Error: ${error}`);
    } else {
        // setDebugMessage(`LML Magenta Test (Frame: ${frameCounter.current})`);
        // Let the RENDER 1 log set the main message
    }
  }, [error]);


  return (
    // Using the ORIGINAL parent div styling for LipstickMirrorLive
    <div style={{ width: '640px', height: '480px', margin: 'auto', border: '1px solid #ccc', position: 'relative', overflow: 'hidden' }}>
      <div style={{position:'absolute',top:'5px',left:'5px',background:'rgba(0,0,0,0.7)',color:'white',padding:'2px 5px',fontSize:'12px',zIndex:10,pointerEvents:'none'}}>
        {error ? `Error: ${error}` : debugMessage} (Frame: {frameCounter.current})
      </div>
      {/* Video element remains for structural similarity if needed later, but display:none */}
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

// export default LipstickMirrorLive; // << ENSURE EXPORT MATCHES NEW NAME if you changed component name at top