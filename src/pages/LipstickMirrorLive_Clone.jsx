// src/pages/LipstickMirrorLive_Clone.jsx (ULTRA MINIMAL CLEAR - Round 2 - Fix canvasElement scope)

import React, { useEffect, useRef, useState } from 'react';

export default function LipstickMirrorLive_Clone() {
  const canvasRef = useRef(null);
  const videoRef = useRef(null); 
  
  const animationFrameIdRef = useRef(null);
  const frameCounter = useRef(0);
  const resizeHandlerRef = useRef(null); 

  const [error, setError] = useState(null);
  const [debugMessage, setDebugMessage] = useState('Initializing...');
  
  const deviceActualRef = useRef(null); 
  const contextActualRef = useRef(null); 
  const formatActualRef = useRef(null); 

  useEffect(() => {
    console.log("[LML_Clone UMC2-FixCanvasScope] useEffect running.");
    let deviceInternal = null; 
    let contextInternal = null;
    let formatInternal = null; 
    let resizeObserverInternal = null; 
    let renderLoopStartedInternal = false;

    // It's safer to get canvasRef.current inside functions that need it,
    // especially if they are async or callbacks, to ensure we get the latest.
    // const canvas = canvasRef.current; // Avoid defining here for use in async initializeWebGPU

    const configureCanvas = (entries) => {
      const currentCanvas = canvasRef.current; // Get fresh ref
      if (!currentCanvas) { console.error("[LML_Clone UMC2-FixCanvasScope configureCanvas] CanvasRef is null!"); return; }
      if (!deviceInternal || !contextInternal || !formatInternal) { 
        console.warn("[LML_Clone UMC2-FixCanvasScope configureCanvas] Prerequisites not met. Skipping."); return; 
      }
      // ... (rest of configureCanvas is the same, using currentCanvas) ...
      if (entries) { /* ... */ } else { /* ... */ }
      const dpr = window.devicePixelRatio || 1;
      const clientWidth = currentCanvas.clientWidth; const clientHeight = currentCanvas.clientHeight;
      if (clientWidth === 0 || clientHeight === 0) { /* ... */ return; }
      const targetWidth = Math.floor(clientWidth * dpr); const targetHeight = Math.floor(clientHeight * dpr);
      if (currentCanvas.width !== targetWidth || currentCanvas.height !== targetHeight) {
        currentCanvas.width = targetWidth; currentCanvas.height = targetHeight;
        console.log(`[LML_Clone UMC2-FixCanvasScope configureCanvas] Canvas buffer SET:${targetWidth}x${targetHeight}`);
      }
      try {
        contextInternal.configure({ device: deviceInternal, format: formatInternal, alphaMode: 'opaque', size: [currentCanvas.width, currentCanvas.height] });
        // console.log(`[LML_Clone UMC2-FixCanvasScope configureCanvas] Context CONFIG. Size:${currentCanvas.width}x${currentCanvas.height}`);
      } catch (e) { console.error("[LML_Clone UMC2-FixCanvasScope configureCanvas] Error config context:", e); setError("Error config context.");}
    };
    resizeHandlerRef.current = configureCanvas; 

    const render = () => { /* ... Render function (magenta clear) remains identical ... */
      const activeDevice = deviceActualRef.current; const activeContext = contextActualRef.current;
      if (!activeDevice || !activeContext || !canvasRef.current ) { animationFrameIdRef.current = requestAnimationFrame(render); return; }
      const currentCanvas = canvasRef.current;
      let currentGpuTexture, textureView;
      try { currentGpuTexture = activeContext.getCurrentTexture(); textureView = currentGpuTexture.createView(); } 
      catch(e) { console.error(`[LML_Clone UMC2-FixCanvasScope RENDER ${frameCounter.current}] Error currentTex:`, e); if(resizeHandlerRef.current) resizeHandlerRef.current(); animationFrameIdRef.current = requestAnimationFrame(render); return; }
      frameCounter.current++;
      if (frameCounter.current === 1 || frameCounter.current % 240 === 1) { console.log(`[LML_Clone UMC2-FixCanvasScope RENDER ${frameCounter.current}] Canvas attr: ${currentCanvas.width}x${currentCanvas.height}. GPU Tex: ${currentGpuTexture.width}x${currentGpuTexture.height}`); }
      const commandEncoder = activeDevice.createCommandEncoder();
      const renderPassDescriptor = { colorAttachments: [ { view: textureView, clearValue: { r: 1.0, g: 0.0, b: 1.0, a: 1.0 }, loadOp: 'clear', storeOp: 'store' } ], };
      const passEncoder = commandEncoder.beginRenderPass(renderPassDescriptor);
      passEncoder.setViewport(0,0, currentGpuTexture.width, currentGpuTexture.height, 0, 1);
      passEncoder.setScissorRect(0,0, currentGpuTexture.width, currentGpuTexture.height);
      passEncoder.end();
      activeDevice.queue.submit([commandEncoder.finish()]);
      if(frameCounter.current === 1) { setDebugMessage("Diagnostic: UMC2 Active (CanvasScope Fixed)"); }
      animationFrameIdRef.current = requestAnimationFrame(render);
    };

    const initializeWebGPU = async () => {
      const localCanvas = canvasRef.current; // Get current value of ref
      if (!localCanvas) { 
        console.error("LML_Clone UMC2-FixCanvasScope: Canvas ref is null AT START of initializeWebGPU. This should not happen if component is mounted."); 
        setError("Canvas not ready for init.");
        return; 
      }
      // Also check videoRef.current if it were to be used by this function
      const localVideoElement = videoRef.current;
      if (!localVideoElement) {
          console.error("LML_Clone UMC2-FixCanvasScope: Video ref is null AT START of initializeWebGPU.");
          // For this clear test, video isn't critical, but good to note.
      }


      if (!navigator.gpu) { console.error('LML_Clone UMC2-FixCanvasScope: WebGPU not supported.'); setError("WebGPU not supported."); return; }
      setDebugMessage("Initializing UMC2 (CanvasScope Fixed)...");

      try {
        const adapter = await navigator.gpu.requestAdapter();
        if (!adapter) { /* ... */ setError("No GPU adapter."); return; }
        deviceInternal = await adapter.requestDevice(); deviceActualRef.current = deviceInternal;
        console.log("[LML_Clone UMC2-FixCanvasScope] Device obtained.");
        deviceInternal.lost.then((info) => { /* ... */ });
        
        contextInternal = localCanvas.getContext('webgpu'); contextActualRef.current = contextInternal; // Use localCanvas
        if (!contextInternal) { /* ... */ setError("No WebGPU context."); return; }
        formatInternal = navigator.gpu.getPreferredCanvasFormat(); formatActualRef.current = formatInternal;
        console.log("[LML_Clone UMC2-FixCanvasScope] Context and Format obtained.");
        
        resizeObserverInternal = new ResizeObserver(resizeHandlerRef.current);
        resizeObserverInternal.observe(localCanvas); // Use localCanvas
        console.log("[LML_Clone UMC2-FixCanvasScope] ResizeObserver observing canvas.");
        
        if(resizeHandlerRef.current) {
             console.log("[LML_Clone UMC2-FixCanvasScope] Calling initial configureCanvas.");
             resizeHandlerRef.current(); 
        } else { console.error("[LML_Clone UMC2-FixCanvasScope] resizeHandlerRef.current is null"); }
        
        console.log("[LML_Clone UMC2-FixCanvasScope] Core WebGPU setup complete.");
        if (!renderLoopStartedInternal) { console.log("[LML_Clone UMC2-FixCanvasScope] Starting render loop."); render(); renderLoopStartedInternal = true; }
      } catch (error) { console.error('[LML_Clone UMC2-FixCanvasScope] Error initializing WebGPU:', error); setError(`Init failed: ${error.message}`);}
    };

    // Ensure canvasRef.current is populated before calling initializeWebGPU
    if (canvasRef.current && videoRef.current) { // Check both refs are available
        initializeWebGPU();
    } else {
        // This part is tricky. If refs aren't ready when useEffect runs,
        // initializeWebGPU might never be called.
        // However, for top-level refs in a component, they should be set by the time useEffect runs.
        // If not, a small timeout or another effect might be needed, but that adds complexity.
        // Let's assume they are ready. The initial check inside initializeWebGPU is a safeguard.
        console.warn("[LML_Clone UMC2-FixCanvasScope] useEffect: Canvas or Video ref not yet available for init. This might be an issue.");
        // Attempting init anyway, as the functions inside will re-check.
        initializeWebGPU(); 
    }


    return () => { /* ... cleanup (same as before) ... */
      console.log("[LML_Clone UMC2-FixCanvasScope Cleanup]");
      if (animationFrameIdRef.current) cancelAnimationFrame(animationFrameIdRef.current);
      if (resizeObserverInternal && canvasRef.current) resizeObserverInternal.unobserve(canvasRef.current);
      if (resizeObserverInternal) resizeObserverInternal.disconnect();
      if (videoRef.current && videoRef.current.srcObject) { videoRef.current.srcObject.getTracks().forEach(track => track.stop()); }
      if (videoRef.current) videoRef.current.srcObject = null;
      deviceActualRef.current = null; contextActualRef.current = null; formatActualRef.current = null;
    };
  }, []); // Empty dependency array
  
  useEffect(() => { /* ... UI Message Effect ... */ 
    if (deviceActualRef.current && contextActualRef.current && !error) { setDebugMessage("Diagnostic: UMC2 Active (CanvasScope Fixed)"); }
    else if (error) { setDebugMessage("Error State"); }
    else { setDebugMessage("Initializing UMC2 (CanvasScope Fixed)..."); }
  }, [deviceActualRef.current, contextActualRef.current, error]);

  return ( /* ... JSX remains the same ... */
    <div style={{ width: '640px', height: '480px', margin: 'auto', border: '1px solid #ccc', position: 'relative', overflow: 'hidden', background: 'darkkhaki' }}>
      <div style={{position:'absolute',top:'5px',left:'5px',background:'rgba(0,0,0,0.7)',color:'white',padding:'2px 5px',fontSize:'12px',zIndex:10,pointerEvents:'none'}}>
        {debugMessage} (Frame: {frameCounter.current})
      </div>
      <video ref={videoRef} style={{display:'none'}} width={640} height={480} />
      <canvas 
        ref={canvasRef} 
        width={640} height={480}
        style={{ position:'absolute', top:0, left:0, width:'100%', height:'100%', zIndex:2, display: 'block', background: 'lightskyblue' }} 
      />
    </div>
  );
}