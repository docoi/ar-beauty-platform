// src/pages/LipstickMirrorLive_Clone.jsx (Attempt at IDENTICAL logic to working TestWebGPUCanvas for clear)

import React, { useEffect, useRef, useState } from 'react'; // Added useState for error/debug

export default function LipstickMirrorLive_Clone() { // Renamed component
  const canvasRef = useRef(null);
  const animationFrameIdRef = useRef(null);
  const frameCounter = useRef(0); 
  //resizeHandlerRef was in my last attempt, but not in the TestWebGPUCanvas you provided back.
  //Let's stick to what you provided as working.
  //const resizeHandlerRef = useRef(null); 

  // Add state for error/debug messages, even if not heavily used by core logic here
  const [error, setError] = useState(null);
  const [debugMessage, setDebugMessage] = useState('Initializing LML_Clone (Exact Test)...');


  useEffect(() => {
    console.log("[LML_Clone_ExactTest] useEffect running."); // Changed prefix
    let device = null; 
    let context = null;
    let format = null;
    let resizeObserver = null; // Was in TestWebGPUCanvas
    let renderLoopStarted = false;

    // configureCanvas MUST be defined before initializeWebGPU if initializeWebGPU calls it directly
    // or if resizeObserver is set up with it before device/context/format are ready.
    // Let's define it so it closes over device, context, format from initializeWebGPU.
    let configureCanvasFunc = null; 

    const initializeWebGPU = async () => {
      const canvas = canvasRef.current;
      if (!canvas) { 
          console.error("[LML_Clone_ExactTest] Canvas ref null in initializeWebGPU"); 
          setError("Canvas not found"); // Set error state
          return; 
      }
      if (!navigator.gpu) { 
          console.error('[LML_Clone_ExactTest] WebGPU not supported.'); 
          setError("WebGPU not supported"); // Set error state
          return; 
      }
      setDebugMessage("Initializing WebGPU..."); // Update debug state

      try {
        const adapter = await navigator.gpu.requestAdapter();
        if (!adapter) { 
            console.error('[LML_Clone_ExactTest] Failed to get GPU adapter.'); 
            setError("No GPU adapter"); // Set error state
            return; 
        }
        console.log("[LML_Clone_ExactTest] Adapter obtained.");

        device = await adapter.requestDevice(); // Assign to useEffect-scoped variable
        console.log("[LML_Clone_ExactTest] Device obtained:", device);
        device.lost.then((info) => { 
            console.error(`[LML_Clone_ExactTest] Device lost: ${info.message}`); 
            if (animationFrameIdRef.current) cancelAnimationFrame(animationFrameIdRef.current);
            setError("WebGPU Device Lost"); // Set error state
        });

        context = canvas.getContext('webgpu'); // Assign to useEffect-scoped variable
        if (!context) { 
            console.error("[LML_Clone_ExactTest] Failed to get WebGPU context."); 
            setError("No WebGPU context"); // Set error state
            return; 
        }
        console.log("[LML_Clone_ExactTest] Context obtained:", context);

        format = navigator.gpu.getPreferredCanvasFormat(); // Assign to useEffect-scoped variable
        console.log("[LML_Clone_ExactTest] Preferred format:", format);
        
        // Define configureCanvas now that device, context, format are available
        configureCanvasFunc = (entries) => {
            const currentCanvas = canvasRef.current; // Use fresh ref inside
            if (!currentCanvas) { console.error("[LML_Clone_ExactTest configureCanvas] Canvas ref is null."); return; }
            // device, context, format are from the outer initializeWebGPU scope
            if (!device || !context || !format) { console.warn("[LML_Clone_ExactTest configureCanvas] Device/context/format not ready. Skipping."); return; }

            if (entries) { console.log("[LML_Clone_ExactTest configureCanvas via RO]"); } 
            else { console.log("[LML_Clone_ExactTest configureCanvas direct]"); }
            
            const dpr = window.devicePixelRatio || 1;
            const clientWidth = currentCanvas.clientWidth;
            const clientHeight = currentCanvas.clientHeight;
            if (clientWidth === 0 || clientHeight === 0) {
                console.warn(`[LML_Clone_ExactTest configureCanvas] clientWidth/Height is zero.`); return;
            }
            const targetWidth = Math.floor(clientWidth * dpr);
            const targetHeight = Math.floor(clientHeight * dpr);
            console.log(`[LML_Clone_ExactTest configureCanvas] DPR:${dpr}, clientW/H:${clientWidth}x${clientHeight} => phys:${targetWidth}x${targetHeight}`);

            if (currentCanvas.width !== targetWidth || currentCanvas.height !== targetHeight) {
                currentCanvas.width = targetWidth; currentCanvas.height = targetHeight;
                console.log(`[LML_Clone_ExactTest configureCanvas] Canvas buffer SET:${targetWidth}x${targetHeight}`);
            } else { console.log(`[LML_Clone_ExactTest configureCanvas] Canvas size ${targetWidth}x${targetHeight} OK.`); }
            
            try {
                context.configure({ device, format, alphaMode: 'opaque', size: [currentCanvas.width, currentCanvas.height] });
                console.log(`[LML_Clone_ExactTest configureCanvas] Context CONFIG. Size:${currentCanvas.width}x${currentCanvas.height}`);
            } catch (e) { console.error("[LML_Clone_ExactTest configureCanvas] Error config context:", e); setError("Error configuring context."); }
        };
        
        resizeObserver = new ResizeObserver(configureCanvasFunc); // Use the defined function
        resizeObserver.observe(canvas);
        console.log("[LML_Clone_ExactTest] ResizeObserver observing canvas.");

        console.log("[LML_Clone_ExactTest] Calling initial configureCanvas.");
        configureCanvasFunc(); // Call it

        const render = () => {
            // device and context are from the outer initializeWebGPU scope
            if (!device || !context || !canvasRef.current) { 
                if (animationFrameIdRef.current) cancelAnimationFrame(animationFrameIdRef.current);
                return;
            }
            const currentCanvas = canvasRef.current;
            let currentGpuTexture, textureView;
            try { currentGpuTexture = context.getCurrentTexture(); textureView = currentGpuTexture.createView(); } 
            catch (e) { console.error("[LML_Clone_ExactTest render] Error currentTex:", e); animationFrameIdRef.current = requestAnimationFrame(render); return; }

            frameCounter.current++;
            if (frameCounter.current < 5 || frameCounter.current % 120 === 1) {
                console.log(`[LML_Clone_ExactTest RENDER ${frameCounter.current}] Canvas attr: ${currentCanvas.width}x${currentCanvas.height}. GPUTexture: ${currentGpuTexture.width}x${currentGpuTexture.height}`);
            }
            const commandEncoder = device.createCommandEncoder();
            const renderPassDescriptor = {
                colorAttachments: [ { view: textureView, clearValue: { r: 1, g: 0, b: 1, a: 1 }, loadOp: 'clear', storeOp: 'store' } ], // MAGENTA
            };
            const passEncoder = commandEncoder.beginRenderPass(renderPassDescriptor);
            passEncoder.setViewport(0,0, currentGpuTexture.width, currentGpuTexture.height, 0, 1);
            passEncoder.setScissorRect(0,0, currentGpuTexture.width, currentGpuTexture.height);
            passEncoder.end();
            device.queue.submit([commandEncoder.finish()]);
            animationFrameIdRef.current = requestAnimationFrame(render);
        }; // End of render

        if (!renderLoopStarted) {
            console.log("[LML_Clone_ExactTest] Starting render loop.");
            render(); 
            renderLoopStarted = true;
            setDebugMessage("LML_Clone: Magenta Clear Active"); // Update UI message
        }
      } catch (error) { 
          console.error('[LML_Clone_ExactTest] Error initializing WebGPU:', error); 
          setError(`WebGPU Init Error: ${error.message}`); // Set error state
      }
    }; // End of initializeWebGPU

    initializeWebGPU();

    return () => {
      console.log("[LML_Clone_ExactTest] Cleanup.");
      if (animationFrameIdRef.current) cancelAnimationFrame(animationFrameIdRef.current);
      if (resizeObserver) resizeObserver.disconnect(); // Disconnect observer
      // No device.destroy() as per TestWebGPUCanvas pattern
    };
  }, []); // Empty dependency array means this runs once on mount

  return ( 
    // Using the original parent div styling for LipstickMirrorLive
    <div style={{ width: '640px', height: '480px', margin: 'auto', border: '1px solid #ccc', position: 'relative', overflow: 'hidden', background: 'darkkhaki' }}>
      <div style={{position:'absolute',top:'5px',left:'5px',background:'rgba(0,0,0,0.7)',color:'white',padding:'2px 5px',fontSize:'12px',zIndex:10,pointerEvents:'none'}}>
        {error ? `Error: ${error}` : debugMessage} (Frame: {frameCounter.current})
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