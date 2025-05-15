// src/pages/LipstickMirrorLive_Clone.jsx (ULTRA MINIMAL CLEAR - Round 2)

import React, { useEffect, useRef, useState } from 'react';
// NO other imports like createPipelines, FaceLandmarker, etc.

export default function LipstickMirrorLive_Clone() {
  const canvasRef = useRef(null);
  const animationFrameIdRef = useRef(null);
  const frameCounter = useRef(0);
  const resizeHandlerRef = useRef(null); 

  const [error, setError] = useState(null); // Keep for UI feedback
  const [debugMessage, setDebugMessage] = useState('Initializing...'); // Keep for UI feedback
  
  // Refs for device/context - essential for WebGPU
  const deviceRef = useRef(null);
  const contextRef = useRef(null);
  // formatRef not strictly needed if format is local to useEffect, but can keep
  const formatRef = useRef(null);


  useEffect(() => {
    console.log("[LML_Clone UMC2] useEffect running.");
    // --- Local variables within useEffect's async scope ---
    let device = null; 
    let context = null;
    let format = null; 
    let resizeObserver = null; 
    let renderLoopStarted = false;

    const canvas = canvasRef.current;
    if (!canvas) {
      console.error("[LML_Clone UMC2] Canvas element not available on mount.");
      setError("Canvas element not found."); // Use state for error
      return;
    }

    const configureCanvas = (entries) => {
      // Use device, context, format from the outer scope (will be set by initializeWebGPU)
      if (!device || !context || !format) { 
        console.warn("[LML_Clone UMC2 configureCanvas] Prerequisites (device, context, format) not met. Skipping."); 
        return; 
      }
      if (!canvasRef.current) { console.error("[LML_Clone UMC2 configureCanvas] CanvasRef is null!"); return; }

      const currentCanvas = canvasRef.current;
      if (entries) { console.log("[LML_Clone UMC2 configureCanvas via RO]"); } 
      else { console.log("[LML_Clone UMC2 configureCanvas direct]"); }
      
      const dpr = window.devicePixelRatio || 1;
      const currentClientWidth = currentCanvas.clientWidth;
      const currentClientHeight = currentCanvas.clientHeight;
      
      if (currentClientWidth === 0 || currentClientHeight === 0) {
        console.warn(`[LML_Clone UMC2 configureCanvas] Canvas clientW/H is zero. W: ${currentClientWidth}, H: ${currentClientHeight}`);
        return; 
      }
      const targetWidth = Math.floor(currentClientWidth * dpr);
      const targetHeight = Math.floor(currentClientHeight * dpr);
      console.log(`[LML_Clone UMC2 configureCanvas] DPR:${dpr}, clientW/H:${currentClientWidth}x${currentClientHeight} => phys:${targetWidth}x${targetHeight}`);

      if (currentCanvas.width !== targetWidth || currentCanvas.height !== targetHeight) {
        currentCanvas.width = targetWidth; currentCanvas.height = targetHeight;
        console.log(`[LML_Clone UMC2 configureCanvas] Canvas buffer SET:${targetWidth}x${targetHeight}`);
      } else { console.log(`[LML_Clone UMC2 configureCanvas] Canvas size ${targetWidth}x${targetHeight} OK.`); }
      
      try {
        context.configure({ device, format, alphaMode: 'opaque', size: [currentCanvas.width, currentCanvas.height] });
        console.log(`[LML_Clone UMC2 configureCanvas] Context CONFIG. Size:${currentCanvas.width}x${currentCanvas.height}`);
      } catch (e) { console.error("[LML_Clone UMC2 configureCanvas] Error config context:", e); setError("Error config context.");}
    };
    resizeHandlerRef.current = configureCanvas;

    const render = () => {
      const currentDevice = deviceRef.current; 
      const currentContext = contextRef.current;

      if (!currentDevice || !currentContext || !canvasRef.current ) {
        animationFrameIdRef.current = requestAnimationFrame(render); return; 
      }
      
      const currentCanvas = canvasRef.current;
      let currentGpuTexture;
      let textureView;

      try { 
        currentGpuTexture = currentContext.getCurrentTexture(); 
        textureView = currentGpuTexture.createView(); 
      } catch(e) { 
        console.error(`[LML_Clone UMC2 RENDER ${frameCounter.current}] Error currentTex:`, e); 
        if(resizeHandlerRef.current) resizeHandlerRef.current(); 
        animationFrameIdRef.current = requestAnimationFrame(render); 
        return; 
      }
      
      frameCounter.current++;
      if (frameCounter.current < 5 || frameCounter.current % 240 === 1) { 
          console.log(`[LML_Clone UMC2 RENDER ${frameCounter.current}] Canvas attr: ${currentCanvas.width}x${currentCanvas.height}. GPU Tex: ${currentGpuTexture.width}x${currentGpuTexture.height}`); 
      }

      const commandEncoder = currentDevice.createCommandEncoder({label: "LML_UMC2_Encoder"});
      const renderPassDescriptor = {
        colorAttachments: [ { 
            view: textureView, 
            clearValue: { r: 1.0, g: 0.0, b: 1.0, a: 1.0 }, // MAGENTA
            loadOp: 'clear', 
            storeOp: 'store' 
        } ],
      };
      const passEncoder = commandEncoder.beginRenderPass(renderPassDescriptor);
      passEncoder.setViewport(0,0, currentGpuTexture.width, currentGpuTexture.height, 0, 1);
      passEncoder.setScissorRect(0,0, currentGpuTexture.width, currentGpuTexture.height);
      passEncoder.end();
      currentDevice.queue.submit([commandEncoder.finish()]);

      if(frameCounter.current === 1) { 
        console.log(`[LML_Clone UMC2 RENDER 1] First frame (magenta clear).`); 
        setDebugMessage("Diagnostic: Ultra Minimal Clear v2"); 
      }
      animationFrameIdRef.current = requestAnimationFrame(render);
    };

    const initializeWebGPU = async () => {
      const localCanvas = canvasRef.current;
      if (!localCanvas) { console.error("LML_Clone UMC2: Canvas ref null"); return; }
      if (!navigator.gpu) { console.error('LML_Clone UMC2: WebGPU not supported.'); setError("WebGPU not supported."); return; }
      setDebugMessage("Initializing UMC2 Test...");

      try {
        const adapter = await navigator.gpu.requestAdapter();
        if (!adapter) { console.error('LML_Clone UMC2: No GPU adapter.'); setError("No GPU adapter."); return; }
        device = await adapter.requestDevice(); deviceRef.current = device;
        console.log("[LML_Clone UMC2] Device obtained.");
        device.lost.then((info) => { 
            console.error(`[LML_Clone UMC2 Device lost] ${info.message}`); 
            if (animationFrameIdRef.current) cancelAnimationFrame(animationFrameIdRef.current);
            deviceRef.current = null; contextRef.current = null; 
            setError("WebGPU Device Lost."); setDebugMessage("Error: Device Lost");
        });
        
        context = localCanvas.getContext('webgpu'); contextRef.current = context;
        if (!context) { console.error("LML_Clone UMC2: No WebGPU context."); setError("No WebGPU context."); return; }
        format = navigator.gpu.getPreferredCanvasFormat(); formatRef.current = format;
        console.log("[LML_Clone UMC2] Context and Format obtained.");
        
        // NO MediaPipe, NO Video Stream, NO Pipelines
        console.log("[LML_Clone UMC2] SKIPPING ALL EXTRA INITIALIZATIONS.");

        resizeObserver = new ResizeObserver(resizeHandlerRef.current);
        resizeObserver.observe(localCanvas);
        console.log("[LML_Clone UMC2] ResizeObserver observing canvas.");
        
        if(resizeHandlerRef.current) {
             console.log("[LML_Clone UMC2] Calling initial configureCanvas.");
             resizeHandlerRef.current(); 
        } else {
            console.error("[LML_Clone UMC2] resizeHandlerRef.current is null for initial call");
        }
        
        // setIsGpuReady(true); // Not strictly needed for this diagnostic as render loop checks device/context
        console.log("[LML_Clone UMC2] Core WebGPU setup complete.");
        if (!renderLoopStarted) { console.log("[LML_Clone UMC2] Starting render loop."); render(); renderLoopStarted = true; }
      } catch (error) { console.error('[LML_Clone UMC2] Error initializing WebGPU:', error); setError(`Init failed: ${error.message}`);}
    };

    initializeWebGPU();

    return () => {
      console.log("[LML_Clone UMC2 Cleanup]");
      if (animationFrameIdRef.current) cancelAnimationFrame(animationFrameIdRef.current);
      if (resizeObserver && canvasRef.current) resizeObserver.unobserve(canvasRef.current);
      if (resizeObserver) resizeObserver.disconnect();
      deviceRef.current = null; contextRef.current = null; formatRef.current = null;
    };
  }, []);
  
  // UI Message Effect simplified
  useEffect(() => {
    if (deviceRef.current && contextRef.current && !error) {
        setDebugMessage("Diagnostic: UMC2 Active");
    } else if (error) {
        setDebugMessage("Error State");
    } else {
        setDebugMessage("Initializing UMC2...");
    }
  }, [deviceRef.current, contextRef.current, error]);

  return (
    <div style={{ width: '640px', height: '480px', margin: 'auto', border: '1px solid #ccc', position: 'relative', overflow: 'hidden', background: 'darkkhaki' /* Parent BG */ }}>
      <div style={{position:'absolute',top:'5px',left:'5px',background:'rgba(0,0,0,0.7)',color:'white',padding:'2px 5px',fontSize:'12px',zIndex:10,pointerEvents:'none'}}>
        {debugMessage} (Frame: {frameCounter.current})
      </div>
      {/* Video element ref is present but video itself is not used/styled for display */}
      <video ref={videoRef} style={{display:'none'}} width={640} height={480} />
      <canvas 
        ref={canvasRef} 
        width={640} 
        height={480}
        style={{
          position:'absolute', top:0, left:0, 
          width:'100%', height:'100%', 
          zIndex:2, 
          display: 'block', 
          background: 'lightskyblue' // Canvas CSS background
        }} 
      />
    </div>
  );
}