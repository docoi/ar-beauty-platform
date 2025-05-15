// src/pages/LipstickMirrorLive_Clone.jsx (ULTRA MINIMAL CLEAR - Round 2 - VERIFIED and FIXED deviceRef)

import React, { useEffect, useRef, useState } from 'react';

export default function LipstickMirrorLive_Clone() {
  const canvasRef = useRef(null);
  const videoRef = useRef(null); 
  
  const animationFrameIdRef = useRef(null);
  const frameCounter = useRef(0);
  const resizeHandlerRef = useRef(null); 

  const [error, setError] = useState(null);
  const [debugMessage, setDebugMessage] = useState('Initializing...');
  
  // Use these refs to store the main WebGPU objects once obtained
  const deviceActualRef = useRef(null); // CORRECTED NAME
  const contextActualRef = useRef(null); // CORRECTED NAME
  const formatActualRef = useRef(null); // CORRECTED NAME

  useEffect(() => {
    console.log("[LML_Clone UMC2-Fixed] useEffect running.");
    // --- Local variables within useEffect's async scope ---
    let deviceInternal = null; 
    let contextInternal = null;
    let formatInternal = null; 
    let resizeObserverInternal = null; 
    let renderLoopStartedInternal = false;

    const canvas = canvasRef.current;
    if (!canvas) {
      console.error("[LML_Clone UMC2-Fixed] Canvas element not available on mount.");
      setError("Canvas element not found.");
      return;
    }

    const configureCanvas = (entries) => {
      // Use local deviceInternal, contextInternal, formatInternal for configuration
      if (!deviceInternal || !contextInternal || !formatInternal) { 
        console.warn("[LML_Clone UMC2-Fixed configureCanvas] Prerequisites not met. Skipping."); 
        return; 
      }
      if (!canvasRef.current) { console.error("[LML_Clone UMC2-Fixed configureCanvas] CanvasRef is null!"); return; }

      const currentCanvas = canvasRef.current;
      if (entries) { console.log("[LML_Clone UMC2-Fixed configureCanvas via RO]"); } 
      else { console.log("[LML_Clone UMC2-Fixed configureCanvas direct]"); }
      
      const dpr = window.devicePixelRatio || 1;
      const currentClientWidth = currentCanvas.clientWidth;
      const currentClientHeight = currentCanvas.clientHeight;
      
      if (currentClientWidth === 0 || currentClientHeight === 0) {
        console.warn(`[LML_Clone UMC2-Fixed configureCanvas] Canvas clientW/H is zero. W: ${currentClientWidth}, H: ${currentClientHeight}`);
        return; 
      }
      const targetWidth = Math.floor(currentClientWidth * dpr);
      const targetHeight = Math.floor(currentClientHeight * dpr);
      // console.log(`[LML_Clone UMC2-Fixed configureCanvas] DPR:${dpr}, clientW/H:${currentClientWidth}x${currentClientHeight} => phys:${targetWidth}x${targetHeight}`);

      if (currentCanvas.width !== targetWidth || currentCanvas.height !== targetHeight) {
        currentCanvas.width = targetWidth; currentCanvas.height = targetHeight;
        console.log(`[LML_Clone UMC2-Fixed configureCanvas] Canvas buffer SET:${targetWidth}x${targetHeight}`);
      } else { /* console.log(`[LML_Clone UMC2-Fixed configureCanvas] Canvas size ${targetWidth}x${targetHeight} OK.`); */ }
      
      try {
        // Use local deviceInternal, contextInternal, formatInternal for configuration
        contextInternal.configure({ device: deviceInternal, format: formatInternal, alphaMode: 'opaque', size: [currentCanvas.width, currentCanvas.height] });
        // console.log(`[LML_Clone UMC2-Fixed configureCanvas] Context CONFIG. Size:${currentCanvas.width}x${currentCanvas.height}`);
      } catch (e) { console.error("[LML_Clone UMC2-Fixed configureCanvas] Error config context:", e); setError("Error config context.");}
    };
    resizeHandlerRef.current = configureCanvas; 

    const render = () => {
      // Use component-level refs for device/context in render, as they are set by initializeWebGPU
      const activeDevice = deviceActualRef.current; // Use CORRECTED ref name
      const activeContext = contextActualRef.current; // Use CORRECTED ref name

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
        console.error(`[LML_Clone UMC2-Fixed RENDER ${frameCounter.current}] Error currentTex:`, e); 
        if(resizeHandlerRef.current) resizeHandlerRef.current(); 
        animationFrameIdRef.current = requestAnimationFrame(render); 
        return; 
      }
      
      frameCounter.current++;
      if (frameCounter.current === 1 || frameCounter.current % 240 === 1) { 
          console.log(`[LML_Clone UMC2-Fixed RENDER ${frameCounter.current}] Canvas attr: ${currentCanvas.width}x${currentCanvas.height}. GPU Tex: ${currentGpuTexture.width}x${currentGpuTexture.height}`); 
      }

      const commandEncoder = activeDevice.createCommandEncoder({label: "LML_UMC2-Fixed_Encoder"});
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
        console.log(`[LML_Clone UMC2-Fixed RENDER 1] First frame (magenta clear).`); 
        setDebugMessage("Diagnostic: UMC2 Active (Fixed)"); 
      }
      animationFrameIdRef.current = requestAnimationFrame(render);
    };

    const initializeWebGPU = async () => {
      const localCanvas = canvasRef.current;
      if (!localCanvas) { /* ... */ return; }
      if (!navigator.gpu) { /* ... */ return; }
      setDebugMessage("Initializing UMC2 (Fixed)...");

      try {
        const adapter = await navigator.gpu.requestAdapter();
        if (!adapter) { /* ... */ return; }
        deviceInternal = await adapter.requestDevice(); 
        deviceActualRef.current = deviceInternal; // Set component-level ref
        console.log("[LML_Clone UMC2-Fixed] Device obtained.");
        
        deviceInternal.lost.then((info) => { 
            console.error(`[LML_Clone UMC2-Fixed Device lost] ${info.message}`); 
            if (animationFrameIdRef.current) cancelAnimationFrame(animationFrameIdRef.current);
            deviceActualRef.current = null; contextActualRef.current = null; formatActualRef.current = null;
            setError("WebGPU Device Lost."); setDebugMessage("Error: Device Lost");
        });
        
        contextInternal = localCanvas.getContext('webgpu'); 
        contextActualRef.current = contextInternal; // Set component-level ref
        if (!contextInternal) { /* ... */ return; }
        
        formatInternal = navigator.gpu.getPreferredCanvasFormat(); 
        formatActualRef.current = formatInternal; // Set component-level ref
        console.log("[LML_Clone UMC2-Fixed] Context and Format obtained.");
        
        resizeObserverInternal = new ResizeObserver(resizeHandlerRef.current);
        resizeObserverInternal.observe(localCanvas);
        console.log("[LML_Clone UMC2-Fixed] ResizeObserver observing canvas.");
        
        if(resizeHandlerRef.current) {
             console.log("[LML_Clone UMC2-Fixed] Calling initial configureCanvas.");
             resizeHandlerRef.current(); 
        } else { console.error("[LML_Clone UMC2-Fixed] resizeHandlerRef.current is null"); }
        
        console.log("[LML_Clone UMC2-Fixed] Core WebGPU setup complete.");
        if (!renderLoopStartedInternal) { console.log("[LML_Clone UMC2-Fixed] Starting render loop."); render(); renderLoopStartedInternal = true; }
      } catch (error) { console.error('[LML_Clone UMC2-Fixed] Error initializing WebGPU:', error); setError(`Init failed: ${error.message}`);}
    };

    initializeWebGPU();

    return () => {
      console.log("[LML_Clone UMC2-Fixed Cleanup]");
      if (animationFrameIdRef.current) cancelAnimationFrame(animationFrameIdRef.current);
      if (resizeObserverInternal && canvasRef.current) resizeObserverInternal.unobserve(canvasRef.current);
      if (resizeObserverInternal) resizeObserverInternal.disconnect();
      // Clear component-level refs
      deviceActualRef.current = null; 
      contextActualRef.current = null; 
      formatActualRef.current = null;
    };
  }, []);
  
  useEffect(() => {
    // Use component-level refs for UI effect dependency
    if (deviceActualRef.current && contextActualRef.current && !error) { 
        setDebugMessage("Diagnostic: UMC2 Active (Fixed)");
    } else if (error) {
        setDebugMessage("Error State");
    } else {
        setDebugMessage("Initializing UMC2 (Fixed)...");
    }
  }, [deviceActualRef.current, contextActualRef.current, error]); // Correct dependencies

  return (
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