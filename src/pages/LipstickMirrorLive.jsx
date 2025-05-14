// src/pages/LipstickMirrorLive.jsx (Adopting ChatGPT's Recommended Structure - Clear Only Diagnostic)

import React, { useEffect, useRef, useState } from 'react';
// createPipelines and other app-specific imports are not used in this immediate diagnostic version
// but would be added back once the clear works.
// import createPipelines from '@/utils/createPipelines';
// import lipTriangles from '@/utils/lipTriangles';
// import { FaceLandmarker, FilesetResolver } from '@mediapipe/tasks-vision';

export default function LipstickMirrorLive() {
  const canvasRef = useRef(null);
  // videoRef is not used in this clear-only diagnostic
  // const videoRef = useRef(null); 

  // We'll use local variables inside useEffect as much as possible,
  // and refs only for things that need to persist across render() calls or be accessed by cleanup.
  const animationFrameIdRef = useRef(null);
  const resizeHandlerRef = useRef(null); // To store the actual function for removal

  // State for UI feedback (error/debug messages)
  const [error, setError] = useState(null);
  const [debugMessage, setDebugMessage] = useState('Initializing...');
  const frameCounter = useRef(0); // For UI frame count display

  useEffect(() => {
    console.log("[MAIN_EFFECT] useEffect running.");
    // --- Local variables within useEffect ---
    let device = null; // GPUDevice
    let context = null; // GPUCanvasContext
    let format = null; // GPUCanvasFormat
    // No need for landmarker, video, or complex pipelineState for this clear test

    const canvas = canvasRef.current;
    if (!canvas) {
      console.error("[MAIN_EFFECT] Canvas element not available on mount.");
      setError("Canvas element not found.");
      return;
    }

    // This function will handle both initial setup and resize
    const configureCanvasAndContext = () => {
      if (!device || !context || !format || !canvas) {
        console.error("[configureCanvasAndContext] Prerequisites not met (device, context, format, canvas).");
        return false; // Indicate failure
      }
      console.log("[configureCanvasAndContext] Called.");
      const dpr = window.devicePixelRatio || 1;
      
      // Log measurements BEFORE setting canvas.width/height
      const currentClientWidth = canvas.clientWidth;
      const currentClientHeight = canvas.clientHeight;
      const rect = canvas.getBoundingClientRect();
      console.log(`[configureCanvasAndContext] Before resize - clientWidth: ${currentClientWidth}, clientHeight: ${currentClientHeight}, DPR: ${dpr}`);
      console.log(`[configureCanvasAndContext] Before resize - getBoundingClientRect: w=${rect.width}, h=${rect.height}`);

      const targetWidth = Math.floor(currentClientWidth * dpr);
      const targetHeight = Math.floor(currentClientHeight * dpr);

      if (canvas.width !== targetWidth || canvas.height !== targetHeight) {
        canvas.width = targetWidth;
        canvas.height = targetHeight;
        console.log(`[configureCanvasAndContext] Canvas buffer size SET to (physical pixels): ${canvas.width}x${canvas.height}`);
      } else {
        console.log(`[configureCanvasAndContext] Canvas buffer size ALREADY matches: ${canvas.width}x${canvas.height}.`);
      }
      
      try {
        context.configure({
          device,
          format,
          alphaMode: 'opaque', // As per successful examples
          size: [canvas.width, canvas.height],
        });
        console.log(`[configureCanvasAndContext] Context CONFIGURED. Size: ${canvas.width}x${canvas.height}`);
        return true; // Indicate success
      } catch (e) {
        console.error("[configureCanvasAndContext] Error configuring context:", e);
        setError("Error configuring WebGPU context.");
        return false; // Indicate failure
      }
    };
    
    resizeHandlerRef.current = configureCanvasAndContext; // Store for resize listener removal

    const renderLoop = () => {
      if (!device || !context) {
        console.warn(`[RENDER_LOOP] Device or context not available. Stopping.`);
        if (animationFrameIdRef.current) cancelAnimationFrame(animationFrameIdRef.current);
        animationFrameIdRef.current = null;
        return;
      }
      frameCounter.current++; // Update frame counter ref

      let currentTexture;
      try {
        currentTexture = context.getCurrentTexture();
      } catch (e) {
        console.error(`[RENDER_LOOP ${frameCounter.current}] Error getting current texture:`, e);
        // Attempt to reconfigure if texture acquisition fails (e.g., context lost or canvas size 0x0)
        if (resizeHandlerRef.current && !resizeHandlerRef.current()) {
            console.error(`[RENDER_LOOP ${frameCounter.current}] Re-configuration failed. Stopping loop.`);
            if (animationFrameIdRef.current) cancelAnimationFrame(animationFrameIdRef.current);
            animationFrameIdRef.current = null;
            return;
        }
        animationFrameIdRef.current = requestAnimationFrame(renderLoop); // Try next frame
        return;
      }

      // Log texture and canvas dimensions (for diagnostic)
      if (frameCounter.current < 5 || frameCounter.current % 120 === 1) {
          console.log(`[RENDER_LOOP ${frameCounter.current}] Canvas physical: ${canvas.width}x${canvas.height}. Texture to clear: ${currentTexture.width}x${currentTexture.height}`);
      }
      
      const commandEncoder = device.createCommandEncoder({ label: "ClearOnlyEncoder" });
      const textureView = currentTexture.createView();
      const renderPassDescriptor = {
        colorAttachments: [{
          view: textureView,
          clearValue: { r: 1.0, g: 0.0, b: 1.0, a: 1.0 }, // MAGENTA
          loadOp: 'clear',
          storeOp: 'store',
        }],
      };
      const passEncoder = commandEncoder.beginRenderPass(renderPassDescriptor);
      // For clear-only, viewport/scissor are often not strictly needed if clearing the whole attachment,
      // but for rigor, especially given our past issues:
      passEncoder.setViewport(0, 0, currentTexture.width, currentTexture.height, 0, 1);
      passEncoder.setScissorRect(0, 0, currentTexture.width, currentTexture.height);
      passEncoder.end();
      device.queue.submit([commandEncoder.finish()]);

      if (frameCounter.current === 1) {
        console.log(`[RENDER_LOOP 1] First frame cleared to magenta.`);
        setDebugMessage("Diagnostic: Clear Test (rAF)"); // Update UI after first successful frame
      }
      animationFrameIdRef.current = requestAnimationFrame(renderLoop);
    };

    const initializeAndStart = async () => {
      if (!navigator.gpu) {
        console.error("WebGPU not supported."); setError("WebGPU not supported."); return;
      }
      setDebugMessage("Initializing WebGPU...");
      try {
        const adapter = await navigator.gpu.requestAdapter();
        if (!adapter) { console.error("Failed to get GPU adapter."); setError("No GPU adapter."); return; }
        
        device = await adapter.requestDevice(); // Assign to local variable first
        if (!device) { console.error("Failed to get GPU device."); setError("No GPU device."); return; }
        console.log("[MAIN_EFFECT] Device obtained.");

        device.lost.then((info) => {
          console.error(`[DEVICE_LOST_HANDLER] WebGPU device lost: ${info.message}`);
          setError(`Device lost: ${info.message}.`); setDebugMessage("Error: Device Lost.");
          if (animationFrameIdRef.current) cancelAnimationFrame(animationFrameIdRef.current);
          animationFrameIdRef.current = null; device = null; context = null; // Clear local vars
        });

        context = canvas.getContext('webgpu'); // Assign to local variable
        if (!context) { console.error("Failed to get context."); setError('No WebGPU context.'); return; }
        console.log("[MAIN_EFFECT] Context obtained.");

        format = navigator.gpu.getPreferredCanvasFormat(); // Assign to local variable
        console.log("[MAIN_EFFECT] Preferred format obtained:", format);

        // Defer initial configuration and render loop start until the next animation frame
        // This is the key change suggested by ChatGPT to ensure layout is flushed.
        console.log("[MAIN_EFFECT] Requesting animation frame for initial canvas config and render start...");
        requestAnimationFrame(() => {
          console.log("[MAIN_EFFECT] rAF callback: Starting initial canvas config.");
          if (!configureCanvasAndContext()) { // Initial configuration
              console.error("[MAIN_EFFECT] rAF callback: Initial canvas/context configuration FAILED.");
              setError("Initial WebGPU canvas/context config failed.");
              return;
          }
          console.log("[MAIN_EFFECT] rAF callback: Initial canvas config successful. Starting render loop.");
          renderLoop(); // Start render loop only after successful initial config
        });

        window.addEventListener('resize', resizeHandlerRef.current); // Use stored handler
        console.log("[MAIN_EFFECT] Resize listener added.");

      } catch (err) {
        console.error("[MAIN_EFFECT] Error during initializeAndStart:", err);
        setError(`WebGPU main init failed: ${err.message}`);
      }
    };

    initializeAndStart();

    // Cleanup function for the main useEffect
    return () => {
      console.log("[MAIN_EFFECT_CLEANUP] Cleaning up.");
      if (animationFrameIdRef.current) {
        cancelAnimationFrame(animationFrameIdRef.current);
        animationFrameIdRef.current = null;
        console.log("[MAIN_EFFECT_CLEANUP] Animation frame cancelled.");
      }
      if (resizeHandlerRef.current) {
        window.removeEventListener('resize', resizeHandlerRef.current);
        console.log("[MAIN_EFFECT_CLEANUP] Resize listener removed.");
      }
      // Device and context are local to useEffect or managed by device.lost
      // No need to destroy device here unless managing it more globally
      console.log("[MAIN_EFFECT_CLEANUP] Finished.");
    };
  }, []); // Empty dependency array: runs once on mount

  return (
    <div style={{ width: '640px', height: '480px', margin: 'auto', border: '1px solid #ccc', position: 'relative', overflow: 'hidden' }}>
      <div style={{position:'absolute',top:'5px',left:'5px',background:'rgba(0,0,0,0.7)',color:'white',padding:'2px 5px',fontSize:'12px',zIndex:10,pointerEvents:'none'}}>
        {error ? `Error: ${error}` : debugMessage} (Frame: {frameCounter.current})
      </div>
      <canvas ref={canvasRef} width={640} height={480} style={{position:'absolute',top:0,left:0,width:'100%',height:'100%',zIndex:2, display: 'block', background: 'lightgray'}} />
    </div>
  );
}