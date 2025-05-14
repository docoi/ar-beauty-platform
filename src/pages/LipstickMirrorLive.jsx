// src/pages/LipstickMirrorLive.jsx (Super Clear Only - Mirroring successful TestWebGPUCanvas structure)

import React, { useEffect, useRef, useState } from 'react';
// No other app-specific imports needed for this diagnostic

export default function LipstickMirrorLive() {
  const canvasRef = useRef(null);
  // videoRef not used in this clear-only diagnostic
  // const videoRef = useRef(null); 

  const animationFrameIdRef = useRef(null);
  const frameCounter = useRef(0); // For UI display
  const resizeHandlerRef = useRef(null); // To store the configureCanvas function for removeEventListener

  // State for UI feedback (error/debug messages)
  const [error, setError] = useState(null);
  const [debugMessage, setDebugMessage] = useState('Initializing...');
  
  // Dummy landmarker state to match one of the conditions if allResourcesReady was more complex
  // For a pure clear test, this isn't strictly necessary for WebGPU readiness itself.
  const [landmarker, setLandmarker] = useState(null); 

  useEffect(() => {
    console.log("[LipstickMirrorLive - ClearTestAsTestCanvas] useEffect running.");
    // --- Local variables within useEffect's async scope ---
    let device = null; 
    let context = null;
    let format = null;
    let resizeObserver = null; 
    let renderLoopStarted = false;

    const canvas = canvasRef.current;
    if (!canvas) {
      console.error("[LipstickMirrorLive - ClearTestAsTestCanvas] Canvas element not available on mount.");
      setError("Canvas element not found.");
      return;
    }

    // --- configureCanvas function (should be identical to TestWebGPUCanvas's) ---
    const configureCanvas = (entries) => {
      if (!device || !context || !format) { 
        console.warn("[configureCanvas] Prerequisites (device, context, format) not met in LML. Skipping.");
        return; 
      }
      if (!canvasRef.current) {
          console.error("[configureCanvas] CanvasRef.current is null in LML!"); return;
      }

      if (entries) { console.log("[configureCanvas via ResizeObserver in LML] Called."); } 
      else { console.log("[configureCanvas direct call in LML] Called."); }
      
      const dpr = window.devicePixelRatio || 1;
      const currentClientWidth = canvasRef.current.clientWidth;
      const currentClientHeight = canvasRef.current.clientHeight;
      
      if (currentClientWidth === 0 || currentClientHeight === 0) {
        console.warn(`[configureCanvas in LML] Canvas clientWidth/Height is zero. W: ${currentClientWidth}, H: ${currentClientHeight}`);
        return;
      }
      const targetWidth = Math.floor(currentClientWidth * dpr);
      const targetHeight = Math.floor(currentClientHeight * dpr);
      console.log(`[configureCanvas in LML] DPR: ${dpr}, clientW: ${currentClientWidth}, clientH: ${currentClientHeight} => target phys: ${targetWidth}x${targetHeight}`);

      if (canvasRef.current.width !== targetWidth || canvasRef.current.height !== targetHeight) {
        canvasRef.current.width = targetWidth;
        canvasRef.current.height = targetHeight;
        console.log(`[configureCanvas in LML] Canvas buffer size SET to: ${canvasRef.current.width}x${canvasRef.current.height}`);
      } else {
        console.log(`[configureCanvas in LML] Canvas size ${canvasRef.current.width}x${canvasRef.current.height} already correct.`);
      }
      
      try {
        context.configure({ device, format, alphaMode: 'opaque', size: [canvasRef.current.width, canvasRef.current.height] });
        console.log(`[configureCanvas in LML] Context configured with size: ${canvasRef.current.width}x${canvasRef.current.height}`);
      } catch (e) { console.error("[configureCanvas in LML] Error configuring context:", e); setError("Error configuring WebGPU context.");}
    };
    resizeHandlerRef.current = configureCanvas; // Store for removal


    // --- Render Loop (identical to TestWebGPUCanvas's clear-only render) ---
    const render = () => {
      if (!device || !context || !canvasRef.current) {
        if (animationFrameIdRef.current) cancelAnimationFrame(animationFrameIdRef.current);
        animationFrameIdRef.current = null; // Stop loop if prerequisites are lost
        return;
      }
      
      const currentCanvas = canvasRef.current; // Ensure we use the current ref
      let currentGpuTexture;
      let textureView;

      try {
        currentGpuTexture = context.getCurrentTexture();
        textureView = currentGpuTexture.createView();
      } catch (e) {
        console.error(`[RENDER LML ${frameCounter.current}] Error getting current texture/view:`, e);
        // Attempt to reconfigure if texture acquisition fails
        if (resizeHandlerRef.current) {
            console.log(`[RENDER LML ${frameCounter.current}] Attempting reconfigure due to texture error.`);
            resizeHandlerRef.current();
        }
        animationFrameIdRef.current = requestAnimationFrame(render);
        return;
      }

      frameCounter.current++;
      if (frameCounter.current < 5 || frameCounter.current % 120 === 1) {
          console.log(`[RENDER LML ${frameCounter.current}] Canvas attr: ${currentCanvas.width}x${currentCanvas.height}. GPUTexture: ${currentGpuTexture.width}x${currentGpuTexture.height}`);
      }

      const commandEncoder = device.createCommandEncoder({label: "LML_ClearOnlyEncoder"});
      const renderPassDescriptor = {
        colorAttachments: [ { view: textureView, clearValue: { r: 1, g: 0, b: 1, a: 1 }, loadOp: 'clear', storeOp: 'store' } ], // MAGENTA
      };
      const passEncoder = commandEncoder.beginRenderPass(renderPassDescriptor);
      passEncoder.setViewport(0,0, currentGpuTexture.width, currentGpuTexture.height, 0, 1);
      passEncoder.setScissorRect(0,0, currentGpuTexture.width, currentGpuTexture.height);
      passEncoder.end();
      device.queue.submit([commandEncoder.finish()]);
      animationFrameIdRef.current = requestAnimationFrame(render);
    };


    // --- Main Initialization Async Function (like in TestWebGPUCanvas) ---
    const initializeWebGPU = async () => {
      const localCanvas = canvasRef.current; // Use local var for checks in this async function
      if (!localCanvas) { console.error("LML: Canvas ref null in initializeWebGPU"); return; }
      if (!navigator.gpu) { console.error('LML: WebGPU not supported.'); setError("WebGPU not supported."); return; }
      setDebugMessage("Initializing WebGPU (LML Clear Test)...");

      try {
        const adapter = await navigator.gpu.requestAdapter();
        if (!adapter) { console.error('LML: Failed to get GPU adapter.'); setError("No GPU adapter."); return; }
        console.log("[LML - ClearTestAsTestCanvas] Adapter obtained.");

        device = await adapter.requestDevice(); // Assign to useEffect-scoped variable
        console.log("[LML - ClearTestAsTestCanvas] Device obtained:", device);
        device.lost.then((info) => { 
            console.error(`[LML CTATC] Device lost: ${info.message}`); 
            if (animationFrameIdRef.current) cancelAnimationFrame(animationFrameIdRef.current); 
            setError("WebGPU Device Lost."); 
            setDebugMessage("Error: Device Lost");
        });

        context = localCanvas.getContext('webgpu'); // Assign to useEffect-scoped variable
        if (!context) { console.error("LML: Failed to get WebGPU context."); setError("No WebGPU context."); return; }
        console.log("[LML - ClearTestAsTestCanvas] Context obtained:", context);

        format = navigator.gpu.getPreferredCanvasFormat(); // Assign to useEffect-scoped variable
        console.log("[LML - ClearTestAsTestCanvas] Preferred format:", format);
        
        // --- Setup ResizeObserver and Initial Config (like in TestWebGPUCanvas) ---
        resizeObserver = new ResizeObserver(resizeHandlerRef.current); // Uses the stored function
        resizeObserver.observe(localCanvas);
        console.log("[LML - ClearTestAsTestCanvas] ResizeObserver observing canvas.");

        console.log("[LML - ClearTestAsTestCanvas] Calling initial configureCanvas.");
        resizeHandlerRef.current(); // Call the stored configureCanvas function

        // --- Initialize Landmarker (placeholder for this test) ---
        console.log("[LML - ClearTestAsTestCanvas] Setting placeholder landmarker state.");
        setLandmarker({}); // Dummy value to satisfy allResourcesReady if it depended on it.

        // --- Start Render Loop ---
        if (!renderLoopStarted) {
            console.log("[LML - ClearTestAsTestCanvas] Starting render loop.");
            render(); 
            renderLoopStarted = true;
        }
        // setDebugMessage will be handled by the separate useEffect based on allResourcesReady

      } catch (error) {
        console.error('[LML - ClearTestAsTestCanvas] Error initializing WebGPU:', error);
        setError(`WebGPU Init failed: ${error.message}`);
      }
    };

    initializeWebGPU();

    // Cleanup for the main useEffect
    return () => {
      console.log("[LML - ClearTestAsTestCanvas] Cleanup.");
      if (animationFrameIdRef.current) cancelAnimationFrame(animationFrameIdRef.current);
      if (resizeObserver && canvasRef.current) resizeObserver.unobserve(canvasRef.current); // unobserve
      // If resizeHandlerRef.current was directly added to window.resize, remove it:
      // window.removeEventListener('resize', resizeHandlerRef.current); 
      // But ResizeObserver handles its own listener removal via unobserve/disconnect.
      if (resizeObserver) resizeObserver.disconnect(); // More thorough cleanup for RO
    };
  }, []); // Empty dependency array: runs once on mount

  // Simplified allResourcesReady for this clear test.
  // The render loop itself checks for device and context.
  // This state is primarily for the UI message.
  const allResourcesReady = !!(landmarker && deviceRef.current && contextRef.current); 

  useEffect(() => {
    if(allResourcesReady) { 
        console.log("[LML UI_MSG_EFFECT] Resources ready for LML Clear Test."); 
        setDebugMessage("Diagnostic: LML Magenta Clear");
    } else { 
        setDebugMessage("Initializing LML Clear Test...");
    }
  }, [allResourcesReady]);

  return (
    // Using the original parent div styling for LipstickMirrorLive
    <div style={{ width: '640px', height: '480px', margin: 'auto', border: '1px solid #ccc', position: 'relative', overflow: 'hidden' }}>
      <div style={{position:'absolute',top:'5px',left:'5px',background:'rgba(0,0,0,0.7)',color:'white',padding:'2px 5px',fontSize:'12px',zIndex:10,pointerEvents:'none'}}>
        {error ? `Error: ${error}` : debugMessage} (Frame: {frameCounter.current})
      </div>
      {/* Video element remains for structural similarity, but display:none */}
      <video ref={videoRef} style={{display:'none'}} width={640} height={480} autoPlay playsInline muted />
      <canvas 
        ref={canvasRef} 
        width={640} 
        height={480}
        style={{
          position:'absolute', top:0, left:0, 
          width:'100%', height:'100%', 
          zIndex:2, 
          display: 'block', // Added from TestWebGPUCanvas
          background: 'lightgray'
        }} 
      />
    </div>
  );
}