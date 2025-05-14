// src/components/TestWebGPUCanvas.jsx (Using ResizeObserver)
import React, { useEffect, useRef } from 'react';

const TestWebGPUCanvas = () => {
  const canvasRef = useRef(null);
  // Refs to store WebGPU objects that persist across renders
  const animationFrameIdRef = useRef(null);
  // No need for deviceRef/contextRef if they are local to useEffect's async function
  // and render/configureCanvas are defined within that scope.

  useEffect(() => {
    console.log("[TestWebGPUCanvas_ResizeObserver] useEffect running.");
    // --- Local variables within useEffect's async scope ---
    let device = null; 
    let context = null;
    let format = null;
    let resizeObserver = null; // To store the ResizeObserver instance for cleanup

    const initializeWebGPU = async () => {
      const canvas = canvasRef.current;
      if (!canvas) {
        console.error("[TestWebGPUCanvas_ResizeObserver] Canvas element not found.");
        return;
      }
      console.log("[TestWebGPUCanvas_ResizeObserver] Canvas element found:", canvas);

      if (!navigator.gpu) {
        console.error('WebGPU not supported on this browser.');
        alert('WebGPU not supported on this browser.');
        return;
      }

      try {
        const adapter = await navigator.gpu.requestAdapter();
        if (!adapter) {
          console.error('Failed to get GPU adapter.');
          alert('Failed to get GPU adapter.');
          return;
        }
        console.log("[TestWebGPUCanvas_ResizeObserver] Adapter obtained.");

        device = await adapter.requestDevice(); // Assign to local variable
        console.log("[TestWebGPUCanvas_ResizeObserver] Device obtained:", device);

        device.lost.then((info) => {
            console.error(`[TestWebGPUCanvas_ResizeObserver] WebGPU device lost: ${info.message}`);
            if (animationFrameIdRef.current) cancelAnimationFrame(animationFrameIdRef.current);
            // Further cleanup or state updates for device loss would go here
        });

        context = canvas.getContext('webgpu'); // Assign to local variable
        if (!context) {
            console.error("Failed to get WebGPU context from canvas.");
            alert("Failed to get WebGPU context from canvas.");
            return;
        }
        console.log("[TestWebGPUCanvas_ResizeObserver] Context obtained:", context);

        format = navigator.gpu.getPreferredCanvasFormat(); // Assign to local variable
        console.log("[TestWebGPUCanvas_ResizeObserver] Preferred format:", format);

        // Define configureCanvas within this scope
        const configureCanvas = (entries) => { // entries can be from ResizeObserver
          if (entries) { // Log if called by ResizeObserver
            // entries[0].contentRect contains width/height, or use clientWidth/Height
            console.log("[configureCanvas via ResizeObserver] Called. Entry rect:", entries[0].contentRect);
          } else {
            console.log("[configureCanvas direct call] Called.");
          }
          
          const dpr = window.devicePixelRatio || 1;
          // Ensure canvas.clientWidth/Height are read *now*
          const currentClientWidth = canvas.clientWidth;
          const currentClientHeight = canvas.clientHeight;
          const targetWidth = Math.floor(currentClientWidth * dpr);
          const targetHeight = Math.floor(currentClientHeight * dpr);

          console.log(`[configureCanvas] DPR: ${dpr}, clientWidth: ${currentClientWidth}, clientHeight: ${currentClientHeight}`);

          // Only resize and reconfigure if necessary
          if (canvas.width !== targetWidth || canvas.height !== targetHeight) {
            canvas.width = targetWidth;
            canvas.height = targetHeight;
            console.log(`[configureCanvas] Canvas buffer size SET to: ${canvas.width}x${canvas.height}`);
            
            context.configure({ // context is from the outer scope
              device, // device is from the outer scope
              format, // format is from the outer scope
              alphaMode: 'opaque',
              size: [canvas.width, canvas.height],
            });
            console.log(`[configureCanvas] Context configured with size: ${canvas.width}x${canvas.height}`);
          } else {
            console.log(`[configureCanvas] Canvas size ${canvas.width}x${canvas.height} already correct. Context might not need reconfigure unless other params change.`);
            // For robustness, reconfigure anyway if called, or add logic to skip if truly unchanged
            context.configure({
              device, format, alphaMode: 'opaque', size: [canvas.width, canvas.height],
            });
            console.log(`[configureCanvas] Context re-configured (size was same).`);
          }
        };
        
        // Use ResizeObserver to handle dynamic resizing
        resizeObserver = new ResizeObserver(configureCanvas); // Pass the function directly
        resizeObserver.observe(canvas);
        console.log("[TestWebGPUCanvas_ResizeObserver] ResizeObserver observing canvas.");

        // Initial configuration
        // ChatGPT's example calls configureCanvas() directly here.
        // This relies on the browser firing the ResizeObserver callback quickly for the initial size,
        // OR that clientWidth/Height are stable enough at this point.
        // Let's explicitly call it to ensure it happens before the first render,
        // ResizeObserver will also fire.
        console.log("[TestWebGPUCanvas_ResizeObserver] Calling initial configureCanvas directly.");
        configureCanvas(); 

        const render = () => {
          if (!device || !context) { // Check local variables
            console.warn("[render] Device or context not available. Stopping render loop.");
            if (animationFrameIdRef.current) cancelAnimationFrame(animationFrameIdRef.current);
            return;
          }
          
          let textureView;
          try {
            textureView = context.getCurrentTexture().createView();
          } catch (e) {
            console.error("[render] Error getting current texture:", e);
            // If context is lost or canvas size is invalid, this might fail.
            // configureCanvas might be called by ResizeObserver or we could try calling it.
            animationFrameIdRef.current = requestAnimationFrame(render);
            return;
          }

          // Log texture and canvas dimensions
          if (frameCounter.current < 5 || frameCounter.current % 120 === 1) {
              console.log(`[RENDER ${frameCounter.current}] Canvas physical: ${canvas.width}x${canvas.height}. Texture to clear: ${textureView.texture.width}x${textureView.texture.height}`);
          }
          frameCounter.current++;

          const commandEncoder = device.createCommandEncoder();
          const renderPassDescriptor = {
            colorAttachments: [ {
                view: textureView,
                clearValue: { r: 1, g: 0, b: 1, a: 1 }, // Magenta
                loadOp: 'clear',
                storeOp: 'store',
            } ],
          };
          const passEncoder = commandEncoder.beginRenderPass(renderPassDescriptor);
          passEncoder.setViewport(0,0, textureView.texture.width, textureView.texture.height, 0, 1); // Use actual texture size for viewport
          passEncoder.setScissorRect(0,0, textureView.texture.width, textureView.texture.height);   // and scissor
          passEncoder.end();
          device.queue.submit([commandEncoder.finish()]);
          animationFrameIdRef.current = requestAnimationFrame(render);
        };

        console.log("[TestWebGPUCanvas_ResizeObserver] Starting initial render.");
        render(); // Start the render loop

      } catch (error) {
        console.error('[TestWebGPUCanvas_ResizeObserver] Error initializing WebGPU:', error);
        alert(`Error initializing WebGPU: ${error.message}`);
      }
    };

    initializeWebGPU();

    // Cleanup function for the useEffect hook
    return () => {
      console.log("[TestWebGPUCanvas_ResizeObserver] Cleanup: Cancelling RAF, disconnecting ResizeObserver.");
      if (animationFrameIdRef.current) {
        cancelAnimationFrame(animationFrameIdRef.current);
      }
      if (resizeObserver) { // Check if observer was created
        resizeObserver.disconnect();
      }
      // No explicit device.destroy() here, let browser manage or handle via device.lost
    };
  }, []); // Empty dependency array: runs once on mount

  return (
    <canvas
      ref={canvasRef}
      style={{ width: '100%', height: '100%', display: 'block', background: 'lightgoldenrodyellow' }} // Different bg for this test
    />
  );
};

export default TestWebGPUCanvas;