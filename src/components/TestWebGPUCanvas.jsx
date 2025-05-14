// src/components/TestWebGPUCanvas.jsx (Corrected: Define frameCounter, remove alerts)
import React, { useEffect, useRef } from 'react';

const TestWebGPUCanvas = () => {
  const canvasRef = useRef(null);
  const animationFrameIdRef = useRef(null);
  const frameCounter = useRef(0); // <<< --- ADDED THIS LINE

  useEffect(() => {
    console.log("[TestWebGPUCanvas_ResizeObserver] useEffect running.");
    let device = null; 
    let context = null;
    let format = null;
    let resizeObserver = null;

    const initializeWebGPU = async () => {
      const canvas = canvasRef.current;
      if (!canvas) {
        console.error("[TestWebGPUCanvas_ResizeObserver] Canvas element not found.");
        return;
      }
      console.log("[TestWebGPUCanvas_ResizeObserver] Canvas element found:", canvas);

      if (!navigator.gpu) {
        console.error('WebGPU not supported on this browser.');
        // alert('WebGPU not supported on this browser.'); // Removed alert
        return;
      }

      try {
        const adapter = await navigator.gpu.requestAdapter();
        if (!adapter) {
          console.error('Failed to get GPU adapter.');
          // alert('Failed to get GPU adapter.'); // Removed alert
          return;
        }
        console.log("[TestWebGPUCanvas_ResizeObserver] Adapter obtained.");

        device = await adapter.requestDevice();
        console.log("[TestWebGPUCanvas_ResizeObserver] Device obtained:", device);

        device.lost.then((info) => {
            console.error(`[TestWebGPUCanvas_ResizeObserver] WebGPU device lost: ${info.message}`);
            if (animationFrameIdRef.current) cancelAnimationFrame(animationFrameIdRef.current);
        });

        context = canvas.getContext('webgpu');
        if (!context) {
            console.error("Failed to get WebGPU context from canvas.");
            // alert("Failed to get WebGPU context from canvas."); // Removed alert
            return;
        }
        console.log("[TestWebGPUCanvas_ResizeObserver] Context obtained:", context);

        format = navigator.gpu.getPreferredCanvasFormat();
        console.log("[TestWebGPUCanvas_ResizeObserver] Preferred format:", format);

        const configureCanvas = (entries) => {
          if (entries) { 
            console.log("[configureCanvas via ResizeObserver] Called. Entry rect:", entries[0].contentRect);
          } else {
            console.log("[configureCanvas direct call] Called.");
          }
          
          const dpr = window.devicePixelRatio || 1;
          const currentClientWidth = canvas.clientWidth;
          const currentClientHeight = canvas.clientHeight;
          const targetWidth = Math.floor(currentClientWidth * dpr);
          const targetHeight = Math.floor(currentClientHeight * dpr);

          console.log(`[configureCanvas] DPR: ${dpr}, clientWidth: ${currentClientWidth}, clientHeight: ${currentClientHeight}`);

          if (canvas.width !== targetWidth || canvas.height !== targetHeight) {
            canvas.width = targetWidth;
            canvas.height = targetHeight;
            console.log(`[configureCanvas] Canvas buffer size SET to: ${canvas.width}x${canvas.height}`);
            
            context.configure({ device, format, alphaMode: 'opaque', size: [canvas.width, canvas.height] });
            console.log(`[configureCanvas] Context configured with size: ${canvas.width}x${canvas.height}`);
          } else {
            console.log(`[configureCanvas] Canvas size ${canvas.width}x${canvas.height} already correct. Re-configuring context.`);
            context.configure({ device, format, alphaMode: 'opaque', size: [canvas.width, canvas.height] });
            console.log(`[configureCanvas] Context re-configured (size was same).`);
          }
        };
        
        resizeObserver = new ResizeObserver(configureCanvas);
        resizeObserver.observe(canvas);
        console.log("[TestWebGPUCanvas_ResizeObserver] ResizeObserver observing canvas.");

        console.log("[TestWebGPUCanvas_ResizeObserver] Calling initial configureCanvas directly.");
        configureCanvas(); 

        const render = () => {
          if (!device || !context) {
            console.warn("[render] Device or context not available. Stopping render loop.");
            if (animationFrameIdRef.current) cancelAnimationFrame(animationFrameIdRef.current);
            return;
          }
          
          let textureView;
          try {
            textureView = context.getCurrentTexture().createView();
          } catch (e) {
            console.error("[render] Error getting current texture:", e);
            animationFrameIdRef.current = requestAnimationFrame(render);
            return;
          }

          frameCounter.current++; // Increment frameCounter
          if (frameCounter.current < 5 || frameCounter.current % 120 === 1) {
              // Use textureView.texture.width/height for actual texture dimensions
              console.log(`[RENDER ${frameCounter.current}] Canvas physical: ${canvas.width}x${canvas.height}. Texture to clear: ${textureView.texture.width}x${textureView.texture.height}`);
          }

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
          passEncoder.setViewport(0,0, textureView.texture.width, textureView.texture.height, 0, 1);
          passEncoder.setScissorRect(0,0, textureView.texture.width, textureView.texture.height);
          passEncoder.end();
          device.queue.submit([commandEncoder.finish()]);
          animationFrameIdRef.current = requestAnimationFrame(render);
        };

        console.log("[TestWebGPUCanvas_ResizeObserver] Starting initial render.");
        render();

      } catch (error) {
        console.error('[TestWebGPUCanvas_ResizeObserver] Error initializing WebGPU:', error);
        // alert(`Error initializing WebGPU: ${error.message}`); // Removed alert
      }
    };

    initializeWebGPU();

    return () => {
      console.log("[TestWebGPUCanvas_ResizeObserver] Cleanup: Cancelling RAF, disconnecting ResizeObserver.");
      if (animationFrameIdRef.current) {
        cancelAnimationFrame(animationFrameIdRef.current);
      }
      if (resizeObserver) {
        resizeObserver.disconnect();
      }
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      style={{ width: '100%', height: '100%', display: 'block', background: 'lightgoldenrodyellow' }}
    />
  );
};

export default TestWebGPUCanvas;