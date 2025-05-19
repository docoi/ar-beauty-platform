// src/pages/LipstickMirrorLive_Clone.jsx (ULTRA MINIMAL CLEAR - Round 2 - Fix videoRef error)

import React, { useEffect, useRef, useState } from 'react';

export default function LipstickMirrorLive_Clone() {
  const canvasRef = useRef(null);
  const videoRef = useRef(null); // videoRef is defined here
  
  const animationFrameIdRef = useRef(null);
  const frameCounter = useRef(0);
  const resizeHandlerRef = useRef(null); 

  const [error, setError] = useState(null);
  const [debugMessage, setDebugMessage] = useState('Initializing...');
  
  const deviceActualRef = useRef(null); 
  const contextActualRef = useRef(null); 
  const formatActualRef = useRef(null); 

  useEffect(() => {
    console.log("[LML_Clone UMC2-FixVideoRef] useEffect running.");
    let deviceInternal = null; 
    let contextInternal = null;
    let formatInternal = null; 
    let resizeObserverInternal = null; 
    let renderLoopStartedInternal = false;

    const canvas = canvasRef.current; // Get from ref
    // Get videoElement from ref early, check its existence with canvas
    const videoElement = videoRef.current; 

    if (!canvas || !videoElement) { // Check both refs
      console.error("[LML_Clone UMC2-FixVideoRef] Canvas or Video element not available on mount.");
      setError("Canvas or Video element not found.");
      return;
    }

    const configureCanvas = (entries) => {
      if (!deviceInternal || !contextInternal || !formatInternal) { 
        console.warn("[LML_Clone UMC2-FixVideoRef configureCanvas] Prerequisites not met. Skipping."); 
        return; 
      }
      if (!canvasRef.current) { console.error("[LML_Clone UMC2-FixVideoRef configureCanvas] CanvasRef is null!"); return; }
      const currentCanvas = canvasRef.current;
      if (entries) { /* ... RO log ... */ } else { /* ... direct call log ... */ }
      const dpr = window.devicePixelRatio || 1;
      const clientWidth = currentCanvas.clientWidth; const clientHeight = currentCanvas.clientHeight;
      if (clientWidth === 0 || clientHeight === 0) { /* ... zero size log ... */ return; }
      const targetWidth = Math.floor(clientWidth * dpr); const targetHeight = Math.floor(clientHeight * dpr);
      if (currentCanvas.width !== targetWidth || currentCanvas.height !== targetHeight) {
        currentCanvas.width = targetWidth; currentCanvas.height = targetHeight;
        console.log(`[LML_Clone UMC2-FixVideoRef configureCanvas] Canvas buffer SET:${targetWidth}x${targetHeight}`);
      }
      try {
        contextInternal.configure({ device: deviceInternal, format: formatInternal, alphaMode: 'opaque', size: [currentCanvas.width, currentCanvas.height] });
      } catch (e) { console.error("[LML_Clone UMC2-FixVideoRef configureCanvas] Error config context:", e); setError("Error config context.");}
    };
    resizeHandlerRef.current = configureCanvas; 

    const render = () => { /* ... Render function (magenta clear) remains identical to the previous "VERIFIED and FIXED" version ... */
      const activeDevice = deviceActualRef.current; 
      const activeContext = contextActualRef.current;
      if (!activeDevice || !activeContext || !canvasRef.current ) { animationFrameIdRef.current = requestAnimationFrame(render); return; }
      const currentCanvas = canvasRef.current;
      let currentGpuTexture, textureView;
      try { currentGpuTexture = activeContext.getCurrentTexture(); textureView = currentGpuTexture.createView(); } 
      catch(e) { console.error(`[LML_Clone UMC2-FixVideoRef RENDER ${frameCounter.current}] Error currentTex:`, e); if(resizeHandlerRef.current) resizeHandlerRef.current(); animationFrameIdRef.current = requestAnimationFrame(render); return; }
      frameCounter.current++;
      if (frameCounter.current === 1 || frameCounter.current % 240 === 1) { console.log(`[LML_Clone UMC2-FixVideoRef RENDER ${frameCounter.current}] Canvas attr: ${currentCanvas.width}x${currentCanvas.height}. GPU Tex: ${currentGpuTexture.width}x${currentGpuTexture.height}`); }
      const commandEncoder = activeDevice.createCommandEncoder();
      const renderPassDescriptor = { colorAttachments: [ { view: textureView, clearValue: { r: 1.0, g: 0.0, b: 1.0, a: 1.0 }, loadOp: 'clear', storeOp: 'store' } ], };
      const passEncoder = commandEncoder.beginRenderPass(renderPassDescriptor);
      passEncoder.setViewport(0,0, currentGpuTexture.width, currentGpuTexture.height, 0, 1);
      passEncoder.setScissorRect(0,0, currentGpuTexture.width, currentGpuTexture.height);
      passEncoder.end();
      activeDevice.queue.submit([commandEncoder.finish()]);
      if(frameCounter.current === 1) { setDebugMessage("Diagnostic: UMC2 Active (Fixed vRef)"); }
      animationFrameIdRef.current = requestAnimationFrame(render);
    };

    const initializeWebGPU = async () => {
      // canvasElement is canvasRef.current, already checked
      if (!navigator.gpu) { /* ... */ return; }
      setDebugMessage("Initializing UMC2 (Fixed vRef)...");
      try {
        const adapter = await navigator.gpu.requestAdapter();
        if (!adapter) { /* ... */ return; }
        deviceInternal = await adapter.requestDevice(); deviceActualRef.current = deviceInternal;
        console.log("[LML_Clone UMC2-FixVideoRef] Device obtained.");
        deviceInternal.lost.then((info) => { /* ... */ });
        contextInternal = canvasElement.getContext('webgpu'); contextActualRef.current = contextInternal;
        if (!contextInternal) { /* ... */ return; }
        formatInternal = navigator.gpu.getPreferredCanvasFormat(); formatActualRef.current = formatInternal;
        console.log("[LML_Clone UMC2-FixVideoRef] Context and Format obtained.");
        
        resizeObserverInternal = new ResizeObserver(resizeHandlerRef.current);
        resizeObserverInternal.observe(canvasElement); // Use canvasElement here
        console.log("[LML_Clone UMC2-FixVideoRef] ResizeObserver observing canvas.");
        
        if(resizeHandlerRef.current) { resizeHandlerRef.current(); } 
        else { console.error("[LML_Clone UMC2-FixVideoRef] resizeHandlerRef.current is null"); }
        
        console.log("[LML_Clone UMC2-FixVideoRef] Core WebGPU setup complete.");
        if (!renderLoopStartedInternal) { console.log("[LML_Clone UMC2-FixVideoRef] Starting render loop."); render(); renderLoopStartedInternal = true; }
      } catch (error) { console.error('[LML_Clone UMC2-FixVideoRef] Error initializing WebGPU:', error); setError(`Init failed: ${error.message}`);}
    };

    initializeWebGPU();

    return () => { // Cleanup
      console.log("[LML_Clone UMC2-FixVideoRef Cleanup]");
      if (animationFrameIdRef.current) cancelAnimationFrame(animationFrameIdRef.current);
      if (resizeObserverInternal && canvasRef.current) resizeObserverInternal.unobserve(canvasRef.current);
      if (resizeObserverInternal) resizeObserverInternal.disconnect();
      // No active video stream to stop in this version.
      // videoRef.current.srcObject?.getTracks().forEach(track => track.stop()); // This line would cause error if videoRef.current.srcObject is null
      if (videoRef.current && videoRef.current.srcObject) { // Check if srcObject exists
        videoRef.current.srcObject.getTracks().forEach(track => track.stop());
      }
      if (videoRef.current) videoRef.current.srcObject = null; // Clear srcObject

      deviceActualRef.current = null; contextActualRef.current = null; formatActualRef.current = null;
    };
  }, []); // Empty dependency array
  
  useEffect(() => { /* ... UI Message Effect ... */ 
    if (deviceActualRef.current && contextActualRef.current && !error) { setDebugMessage("Diagnostic: UMC2 Active (Fixed vRef)"); }
    else if (error) { setDebugMessage("Error State"); }
    else { setDebugMessage("Initializing UMC2 (Fixed vRef)..."); }
  }, [deviceActualRef.current, contextActualRef.current, error]);

  return ( /* ... JSX remains the same, including the video element with ref={videoRef} ... */
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