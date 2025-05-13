// src/components/TestWebGPUCanvas.jsx
import React, { useEffect, useRef } from 'react';

const TestWebGPUCanvas = () => {
  const canvasRef = useRef(null);
  // Refs to store WebGPU objects that persist across renders
  const deviceRef = useRef(null);
  const contextRef = useRef(null);
  const animationFrameIdRef = useRef(null);
  const resizeHandlerRef = useRef(null); // To store the resize handler for proper removal

  useEffect(() => {
    console.log("[TestWebGPUCanvas] useEffect running");
    const initializeWebGPU = async () => {
      const canvas = canvasRef.current;
      if (!canvas) {
        console.error("[TestWebGPUCanvas] Canvas element not found.");
        return;
      }
      console.log("[TestWebGPUCanvas] Canvas element found:", canvas);

      if (!navigator.gpu) {
        console.error('WebGPU not supported on this browser.');
        alert('WebGPU not supported on this browser.'); // User feedback
        return;
      }

      try {
        const adapter = await navigator.gpu.requestAdapter();
        if (!adapter) {
          console.error('Failed to get GPU adapter.');
          alert('Failed to get GPU adapter.');
          return;
        }
        console.log("[TestWebGPUCanvas] Adapter obtained.");

        const device = await adapter.requestDevice();
        deviceRef.current = device; // Store device in ref
        console.log("[TestWebGPUCanvas] Device obtained:", device);

        const context = canvas.getContext('webgpu');
        if (!context) {
            console.error("Failed to get WebGPU context from canvas.");
            alert("Failed to get WebGPU context from canvas.");
            return;
        }
        contextRef.current = context; // Store context in ref
        console.log("[TestWebGPUCanvas] Context obtained:", context);

        const format = navigator.gpu.getPreferredCanvasFormat();
        console.log("[TestWebGPUCanvas] Preferred format:", format);

        // Define configureCanvas within this scope to capture device, context, format
        const configureCanvas = () => {
          console.log("[configureCanvas] Called");
          const currentDevice = deviceRef.current;
          const currentContext = contextRef.current;
          const currentCanvas = canvasRef.current;

          if (!currentDevice || !currentContext || !currentCanvas) {
            console.error("[configureCanvas] Missing device, context, or canvas ref for configuration.");
            return;
          }

          const dpr = window.devicePixelRatio || 1;
          const displayWidth = Math.floor(currentCanvas.clientWidth * dpr);
          const displayHeight = Math.floor(currentCanvas.clientHeight * dpr);
          console.log(`[configureCanvas] DPR: ${dpr}, clientWidth: ${currentCanvas.clientWidth}, clientHeight: ${currentCanvas.clientHeight}`);


          // Only resize and reconfigure if necessary
          if (currentCanvas.width !== displayWidth || currentCanvas.height !== displayHeight) {
            currentCanvas.width = displayWidth;
            currentCanvas.height = displayHeight;
            console.log(`[configureCanvas] Canvas buffer size SET to: ${currentCanvas.width}x${currentCanvas.height}`);
            
            currentContext.configure({
              device: currentDevice,
              format,
              alphaMode: 'opaque',
              size: [currentCanvas.width, currentCanvas.height], // Use updated dimensions
            });
            console.log(`[configureCanvas] Context configured with size: ${currentCanvas.width}x${currentCanvas.height}`);
          } else {
            console.log(`[configureCanvas] Canvas size already correct: ${currentCanvas.width}x${currentCanvas.height}. Re-configuring context just in case.`);
             // It might be good to reconfigure even if size hasn't changed, if other params could
             // Or, only configure if size changed. For simplicity, let's reconfigure.
            currentContext.configure({
              device: currentDevice,
              format,
              alphaMode: 'opaque',
              size: [currentCanvas.width, currentCanvas.height],
            });
            console.log(`[configureCanvas] Context re-configured (size was same). Size: ${currentCanvas.width}x${currentCanvas.height}`);
          }
          // After configuring, if the render loop is active, it will pick up the new texture size.
          // If it's the initial setup, render will be called after this.
        };
        
        resizeHandlerRef.current = configureCanvas; // Store for removal

        configureCanvas(); // Initial configuration
        window.addEventListener('resize', resizeHandlerRef.current);
        console.log("[TestWebGPUCanvas] Initial configureCanvas done and resize listener added.");


        const render = () => {
          const currentDevice = deviceRef.current;
          const currentContext = contextRef.current;

          if (!currentDevice || !currentContext) {
            console.warn("[render] Device or context not available. Stopping render loop.");
            if (animationFrameIdRef.current) {
              cancelAnimationFrame(animationFrameIdRef.current);
              animationFrameIdRef.current = null;
            }
            return;
          }
          
          let textureView;
          try {
            textureView = currentContext.getCurrentTexture().createView();
          } catch (e) {
            console.error("[render] Error getting current texture. Canvas might be too small or context lost.", e);
            // Attempt to reconfigure, might help if canvas was temporarily 0x0
            configureCanvas(); 
            animationFrameIdRef.current = requestAnimationFrame(render); // Try rendering next frame
            return;
          }


          const commandEncoder = currentDevice.createCommandEncoder();
          const renderPassDescriptor = {
            colorAttachments: [
              {
                view: textureView,
                clearValue: { r: 0, g: 0, b: 1, a: 1 }, // Solid blue
                loadOp: 'clear',
                storeOp: 'store',
              },
            ],
          };

          const passEncoder = commandEncoder.beginRenderPass(renderPassDescriptor);
          passEncoder.end();

          currentDevice.queue.submit([commandEncoder.finish()]);
          animationFrameIdRef.current = requestAnimationFrame(render);
        };

        console.log("[TestWebGPUCanvas] Starting initial render.");
        render(); // Start the render loop

      } catch (error) {
        console.error('Error initializing WebGPU:', error);
        alert(`Error initializing WebGPU: ${error.message}`);
      }
    };

    initializeWebGPU();

    // Cleanup function for the useEffect hook
    return () => {
      console.log("[TestWebGPUCanvas] Cleanup: Cancelling animation frame and removing resize listener.");
      if (animationFrameIdRef.current) {
        cancelAnimationFrame(animationFrameIdRef.current);
        animationFrameIdRef.current = null;
      }
      if (resizeHandlerRef.current) { // Check if handler was stored
        window.removeEventListener('resize', resizeHandlerRef.current);
        console.log("[TestWebGPUCanvas] Resize listener removed.");
      }
      // Note: Device and context are not explicitly "destroyed" here.
      // Device loss is handled by its 'lost' promise. Context becomes invalid if device is lost.
      // If this component could be mounted/unmounted multiple times rapidly,
      // more robust device/context management might be needed.
    };
  }, []); // Empty dependency array ensures this runs once on mount

  return (
    <canvas
      ref={canvasRef}
      style={{ width: '100%', height: '100%', display: 'block', background: 'lightcoral' }} // Added background for visual debugging
    />
  );
};

export default TestWebGPUCanvas;