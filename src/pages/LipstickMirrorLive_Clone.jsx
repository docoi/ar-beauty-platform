// src/pages/LipstickMirrorLive_Clone.jsx (ULTRA MINIMAL CLEAR - Round 2 - VERIFIED)

import React, { useEffect, useRef, useState } from 'react';

export default function LipstickMirrorLive_Clone() {
  const canvasRef = useRef(null);
  // videoRef is defined but NOT actively used by the JS logic in this version
  const videoRef = useRef(null); 
  
  const animationFrameIdRef = useRef(null);
  const frameCounter = useRef(0);
  const resizeHandlerRef = useRef(null); 

  const [error, setError] = useState(null);
  const [debugMessage, setDebugMessage] = useState('Initializing...');
  
  const deviceGRef = useRef(null); // Using different names to avoid confusion with local 'device'
  const contextGRef = useRef(null);
  const formatGRef = useRef(null);

  useEffect(() => {
    console.log("[LML_Clone UMC2-Verified] useEffect running.");
    // --- Local variables within useEffect's async scope ---
    let deviceInternal = null; 
    let contextInternal = null;
    let formatInternal = null; 
    let resizeObserverInternal = null; 
    let renderLoopStartedInternal = false;

    const canvas = canvasRef.current; // Get from ref
    if (!canvas) {
      console.error("[LML_Clone UMC2-Verified] Canvas element not available on mount.");
      setError("Canvas element not found.");
      return;
    }

    const configureCanvas = (entries) => {
      // Use local deviceInternal, contextInternal, formatInternal
      if (!deviceInternal || !contextInternal || !formatInternal) { 
        console.warn("[LML_Clone UMC2-Verified configureCanvas] Prerequisites not met. Skipping."); 
        return; 
      }
      if (!canvasRef.current) { console.error("[LML_Clone UMC2-Verified configureCanvas] CanvasRef is null!"); return; }

      const currentCanvas = canvasRef.current;
      if (entries) { console.log("[LML_Clone UMC2-Verified configureCanvas via RO]"); } 
      else { console.log("[LML_Clone UMC2-Verified configureCanvas direct]"); }
      
      const dpr = window.devicePixelRatio || 1;
      const currentClientWidth = currentCanvas.clientWidth;
      const currentClientHeight = currentCanvas.clientHeight;
      
      if (currentClientWidth === 0 || currentClientHeight === 0) {
        console.warn(`[LML_Clone UMC2-Verified configureCanvas] Canvas clientW/H is zero. W: ${currentClientWidth}, H: ${currentClientHeight}`);
        return; 
      }
      const targetWidth = Math.floor(currentClientWidth * dpr);
      const targetHeight = Math.floor(currentClientHeight * dpr);
      // console.log(`[LML_Clone UMC2-Verified configureCanvas] DPR:${dpr}, clientW/H:${currentClientWidth}x${currentClientHeight} => phys:${targetWidth}x${targetHeight}`);

      if (currentCanvas.width !== targetWidth || currentCanvas.height !== targetHeight) {
        currentCanvas.width = targetWidth; currentCanvas.height = targetHeight;
        console.log(`[LML_Clone UMC2-Verified configureCanvas] Canvas buffer SET:${targetWidth}x${targetHeight}`);
      } else { /* console.log(`[LML_Clone UMC2-Verified configureCanvas] Canvas size ${targetWidth}x${targetHeight} OK.`); */ }
      
      try {
        contextInternal.configure({ device: deviceInternal, format: formatInternal, alphaMode: 'opaque', size: [currentCanvas.width, currentCanvas.height] });
        // console.log(`[LML_Clone UMC2-Verified configureCanvas] Context CONFIG. Size:${currentCanvas.width}x${currentCanvas.height}`);
      } catch (e) { console.error("[LML_Clone UMC2-Verified configureCanvas] Error config context:", e); setError("Error config context.");}
    };
    resizeHandlerRef.current = configureCanvas; // Store the function

    const render = () => {
      // Use component-level refs for device/context in render, as they are set by initializeWebGPU
      const activeDevice = deviceRef.current; 
      const activeContext = contextRef.current;

      if (!activeDevice || !activeContext || !canvasRef.current ) {
        animationFrameIdRef.current = requestAnimationFrame(render); return; 
      }
      
      const currentCanvas = canvasRef.current;
      let currentGpuTexture;
      let textureView;

      try { 
        currentGpuTexture = activeContext.getCurrentTexture(); 
        textureView = currentGpuTexture.createView(); 
      } catch(e) { 
        console.error(`[LML_Clone UMC2-Verified RENDER ${frameCounter.current}] Error currentTex:`, e); 
        if(resizeHandlerRef.current) resizeHandlerRef.current(); 
        animationFrameIdRef.current = requestAnimationFrame(render); 
        return; 
      }
      
      frameCounter.current++;
      if (frameCounter.current === 1 || frameCounter.current % 240 === 1) { 
          console.log(`[LML_Clone UMC2-Verified RENDER ${frameCounter.current}] Canvas attr: ${currentCanvas.width}x${currentCanvas.height}. GPU Tex: ${currentGpuTexture.width}x${currentGpuTexture.height}`); 
      }

      const commandEncoder = activeDevice.createCommandEncoder({label: "LML_UMC2-Verified_Encoder"});
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
      activeDevice.queue.submit([commandEncoder.finish()]);

      if(frameCounter.current === 1) { 
        console.log(`[LML_Clone UMC2-Verified RENDER 1] First frame (magenta clear).`); 
        setDebugMessage("Diagnostic: UMC2 Active"); 
      }
      animationFrameIdRef.current = requestAnimationFrame(render);
    };

    const initializeWebGPU = async () => {
      const localCanvas = canvasRef.current;
      if (!localCanvas) { /* ... */ return; }
      if (!navigator.gpu) { /* ... */ return; }
      setDebugMessage("Initializing UMC2...");

      try {
        const adapter = await navigator.gpu.requestAdapter();
        if (!adapter) { /* ... */ return; }
        deviceInternal = await adapter.requestDevice(); deviceRef.current = deviceInternal; // Set local and ref
        console.log("[LML_Clone UMC2-Verified] Device obtained.");
        deviceInternal.lost.then((info) => { /* ... */ });
        
        contextInternal = localCanvas.getContext('webgpu'); contextRef.current = contextInternal; // Set local and ref
        if (!contextInternal) { /* ... */ return; }
        formatInternal = navigator.gpu.getPreferredCanvasFormat(); formatGRef.current = formatInternal; // Set local and ref
        console.log("[LML_Clone UMC2-Verified] Context and Format obtained.");
        
        resizeObserverInternal = new ResizeObserver(resizeHandlerRef.current); // Use the stored function
        resizeObserverInternal.observe(localCanvas);
        console.log("[LML_Clone UMC2-Verified] ResizeObserver observing canvas.");
        
        if(resizeHandlerRef.current) {
             console.log("[LML_Clone UMC2-Verified] Calling initial configureCanvas.");
             resizeHandlerRef.current(); 
        } else { console.error("[LML_Clone UMC2-Verified] resizeHandlerRef.current is null"); }
        
        console.log("[LML_Clone UMC2-Verified] Core WebGPU setup complete.");
        if (!renderLoopStartedInternal) { console.log("[LML_Clone UMC2-Verified] Starting render loop."); render(); renderLoopStartedInternal = true; }
      } catch (error) { console.error('[LML_Clone UMC2-Verified] Error initializing WebGPU:', error); setError(`Init failed: ${error.message}`);}
    };

    initializeWebGPU();

    return () => {
      console.log("[LML_Clone UMC2-Verified Cleanup]");
      if (animationFrameIdRef.current) cancelAnimationFrame(animationFrameIdRef.current);
      if (resizeObserverInternal && canvasRef.current) resizeObserverInternal.unobserve(canvasRef.current);
      if (resizeObserverInternal) resizeObserverInternal.disconnect();
      deviceRef.current = null; contextRef.current = null; formatGRef.current = null;
    };
  }, []);
  
  useEffect(() => {
    if (deviceRef.current && contextRef.current && !error) { setDebugMessage("Diagnostic: UMC2 Active"); }
    else if (error) { setDebugMessage("Error State"); }
    else { setDebugMessage("Initializing UMC2..."); }
  }, [deviceRef.current, contextRef.current, error]);

  return (
    <div style={{ width: '640px', height: '480px', margin: 'auto', border: '1px solid #ccc', position: 'relative', overflow: 'hidden', background: 'darkkhaki' }}>
      <div style={{position:'absolute',top:'5px',left:'5px',background:'rgba(0,0,0,0.7)',color:'white',padding:'2px 5px',fontSize:'12px',zIndex:10,pointerEvents:'none'}}>
        {debugMessage} (Frame: {frameCounter.current})
      </div>
      {/* videoRef is present in JSX but not actively used by JS in this version */}
      <video ref={videoRef} style={{display:'none'}} width={640} height={480} />
      <canvas 
        ref={canvasRef} 
        width={640} height={480}
        style={{ position:'absolute', top:0, left:0, width:'100%', height:'100%', zIndex:2, display: 'block', background: 'lightskyblue' }} 
      />
    </div>
  );
}