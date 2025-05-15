// src/pages/LipstickMirrorLive_Clone.jsx (ULTRA MINIMAL CLEAR - Diagnostic)

import React, { useEffect, useRef, useState } from 'react';

export default function LipstickMirrorLive_Clone() {
  const canvasRef = useRef(null);
  const animationFrameIdRef = useRef(null);
  const frameCounter = useRef(0);
  const resizeHandlerRef = useRef(null); // To store the actual function instance for removeEventListener

  const [error, setError] = useState(null);
  const [debugMessage, setDebugMessage] = useState('Initializing...');
  
  // Refs to store device/context (primarily for cleanup or if other functions needed them)
  const deviceRef = useRef(null);
  const contextRef = useRef(null);

  useEffect(() => {
    console.log("[LML_Clone UMC] useEffect running.");
    // --- Local variables within useEffect's async scope ---
    let device = null; 
    let context = null;
    let format = null; 
    let resizeObserver = null; 
    let renderLoopStarted = false;

    const canvas = canvasRef.current;
    if (!canvas) {
      console.error("[LML_Clone UMC] Canvas element not available on mount.");
      setError("Canvas element not found.");
      return;
    }

    const configureCanvas = (entries) => {
      if (!device || !context || !format) { 
        console.warn("[LML_Clone UMC configureCanvas] Prerequisites (device, context, format) not met. Skipping."); 
        return; 
      }
      if (!canvasRef.current) { console.error("[LML_Clone UMC configureCanvas] CanvasRef is null!"); return; }

      if (entries) { console.log("[LML_Clone UMC configureCanvas via RO]"); } 
      else { console.log("[LML_Clone UMC configureCanvas direct]"); }
      
      const dpr = window.devicePixelRatio || 1;
      const currentClientWidth = canvasRef.current.clientWidth;
      const currentClientHeight = canvasRef.current.clientHeight;
      
      if (currentClientWidth === 0 || currentClientHeight === 0) {
        console.warn(`[LML_Clone UMC configureCanvas] Canvas clientWidth/Height is zero. W: ${currentClientWidth}, H: ${currentClientHeight}`);
        return; 
      }
      const targetWidth = Math.floor(currentClientWidth * dpr);
      const targetHeight = Math.floor(currentClientHeight * dpr);
      console.log(`[LML_Clone UMC configureCanvas] DPR:${dpr}, clientW/H:${currentClientWidth}x${currentClientHeight} => phys:${targetWidth}x${targetHeight}`);

      if (canvasRef.current.width !== targetWidth || canvasRef.current.height !== targetHeight) {
        canvasRef.current.width = targetWidth; canvasRef.current.height = targetHeight;
        console.log(`[LML_Clone UMC configureCanvas] Canvas buffer SET:${targetWidth}x${targetHeight}`);
      } else { console.log(`[LML_Clone UMC configureCanvas] Canvas size ${targetWidth}x${targetHeight} OK.`); }
      
      try {
        context.configure({ device, format, alphaMode: 'opaque', size: [canvasRef.current.width, canvasRef.current.height] });
        console.log(`[LML_Clone UMC configureCanvas] Context CONFIG. Size:${canvasRef.current.width}x${canvasRef.current.height}`);
      } catch (e) { console.error("[LML_Clone UMC configureCanvas] Error config context:", e); setError("Error config context.");}
    };
    resizeHandlerRef.current = configureCanvas; // Store the function for add/removeEventListener

    const render = () => {
      const currentDevice = deviceRef.current; // Use refs here
      const currentContext = contextRef.current;

      if (!currentDevice || !currentContext) {
        animationFrameIdRef.current = requestAnimationFrame(render); return; 
      }
      frameCounter.current++;
      
      let currentGpuTexture, texView;
      try { 
        currentGpuTexture = currentContext.getCurrentTexture(); 
        texView = currentGpuTexture.createView(); 
      } catch(e) { 
        console.error(`[LML_Clone UMC RENDER ${frameCounter.current}] Error currentTex:`, e); 
        if(resizeHandlerRef.current) resizeHandlerRef.current(); 
        animationFrameIdRef.current = requestAnimationFrame(render); 
        return; 
      }
      
      if (frameCounter.current < 5 || frameCounter.current % 240 === 1) { 
          console.log(`[LML_Clone UMC RENDER ${frameCounter.current}] Canvas attr: ${canvasRef.current.width}x${canvasRef.current.height}. GPU Tex: ${currentGpuTexture.width}x${currentGpuTexture.height}`); 
      }

      const commandEncoder = currentDevice.createCommandEncoder({label: "LML_UMC_Encoder"});
      const renderPassDescriptor = {
        colorAttachments: [ { 
            view: texView, 
            clearValue: { r: 1.0, g: 0.0, b: 1.0, a: 1.0 }, // MAGENTA
            loadOp: 'clear', 
            storeOp: 'store' 
        } ],
      };
      const passEncoder = commandEncoder.beginRenderPass(renderPassDescriptor);
      // NO explicit setViewport or setScissorRect. Let WebGPU default.
      // The default should be the full size of the colorAttachment's view (our full texture).
      passEncoder.end();
      currentDevice.queue.submit([commandEncoder.finish()]);

      if(frameCounter.current === 1) { 
        console.log(`[LML_Clone UMC RENDER 1] First frame (magenta clear).`); 
        setDebugMessage("Diagnostic: Ultra Minimal Clear"); 
      }
      animationFrameIdRef.current = requestAnimationFrame(render);
    };

    const initializeWebGPU = async () => {
      const localCanvas = canvasRef.current;
      if (!localCanvas) { console.error("LML_Clone UMC: Canvas ref null"); return; }
      if (!navigator.gpu) { console.error('LML_Clone UMC: WebGPU not supported.'); setError("WebGPU not supported."); return; }
      setDebugMessage("Initializing UMC Test...");

      try {
        const adapter = await navigator.gpu.requestAdapter();
        if (!adapter) { console.error('LML_Clone UMC: No GPU adapter.'); setError("No GPU adapter."); return; }
        device = await adapter.requestDevice(); deviceRef.current = device; // Assign to local and ref
        console.log("[LML_Clone UMC] Device obtained.");
        device.lost.then((info) => { 
            console.error(`[LML_Clone UMC Device lost] ${info.message}`); 
            if (animationFrameIdRef.current) cancelAnimationFrame(animationFrameIdRef.current);
            // Clear refs and potentially state to indicate lost device
            deviceRef.current = null; contextRef.current = null; 
            setError("WebGPU Device Lost."); setDebugMessage("Error: Device Lost");
        });
        
        context = localCanvas.getContext('webgpu'); contextRef.current = context; // Assign to local and ref
        if (!context) { console.error("LML_Clone UMC: No WebGPU context."); setError("No WebGPU context."); return; }
        format = navigator.gpu.getPreferredCanvasFormat(); // Assign to local var
        console.log("[LML_Clone UMC] Context and Format obtained.");
        
        resizeObserver = new ResizeObserver(resizeHandlerRef.current); // Use the stored function
        resizeObserver.observe(localCanvas);
        console.log("[LML_Clone UMC] ResizeObserver observing canvas.");
        
        if(resizeHandlerRef.current) {
             console.log("[LML_Clone UMC] Calling initial configureCanvas.");
             resizeHandlerRef.current(); 
        } else {
            console.error("[LML_Clone UMC] resizeHandlerRef.current is null for initial call");
        }
        
        console.log("[LML_Clone UMC] All sub-initializations complete.");
        if (!renderLoopStarted) { console.log("[LML_Clone UMC] Starting render loop."); render(); renderLoopStarted = true; }
      } catch (error) { console.error('[LML_Clone UMC] Error initializing WebGPU:', error); setError(`Init failed: ${error.message}`);}
    };

    initializeWebGPU();

    return () => {
      console.log("[LML_Clone UMC Cleanup]");
      if (animationFrameIdRef.current) cancelAnimationFrame(animationFrameIdRef.current);
      if (resizeObserver && canvasRef.current) resizeObserver.unobserve(canvasRef.current); // Important
      if (resizeObserver) resizeObserver.disconnect(); // Ensure full cleanup
      deviceRef.current = null; contextRef.current = null; // Clear refs
    };
  }, []);

  // Simplified UI effect for this diagnostic
  useEffect(() => {
    if (deviceRef.current && contextRef.current) { // Check if basic GPU setup is done
        setDebugMessage("Diagnostic: UMC Active");
    } else if (error) {
        setDebugMessage("Error State");
    }
    else {
        setDebugMessage("Initializing UMC...");
    }
  }, [deviceRef.current, contextRef.current, error]); // Depend on refs and error state

  return (
    // Using the original parent div styling for LipstickMirrorLive
    <div style={{ width: '640px', height: '480px', margin: 'auto', border: '1px solid #ccc', position: 'relative', overflow: 'hidden', background: 'darkkhaki' /* Parent BG */ }}>
      <div style={{position:'absolute',top:'5px',left:'5px',background:'rgba(0,0,0,0.7)',color:'white',padding:'2px 5px',fontSize:'12px',zIndex:10,pointerEvents:'none'}}>
        {error ? `Error: ${error}` : debugMessage} (Frame: {frameCounter.current})
      </div>
      {/* Video element not used, can be removed entirely for this diagnostic if desired */}
      {/* <video ref={videoRef} style={{display:'none'}} width={640} height={480} autoPlay playsInline muted /> */}
      <canvas 
        ref={canvasRef} 
        width={640} 
        height={480}
        style={{
          position:'absolute', top:0, left:0, 
          width:'100%', height:'100%', 
          zIndex:2, 
          display: 'block', 
          background: 'lightskyblue' // Canvas CSS background to see if magenta covers it
        }} 
      />
    </div>
  );
}