// src/components/TestWebGPUCanvas.jsx (Ensure device/context/format exist before first configureCanvas)
import React, { useEffect, useRef } from 'react';

const TestWebGPUCanvas = () => {
  const canvasRef = useRef(null);
  const animationFrameIdRef = useRef(null);
  const frameCounter = useRef(0);

  useEffect(() => {
    console.log("[TestWebGPUCanvas_ResizeObserver] useEffect running.");
    let device = null; 
    let context = null;
    let format = null;
    let resizeObserver = null;
    let renderLoopStarted = false; // Flag to ensure render loop starts only once

    // Define configureCanvas here, it will close over device, context, format
    const configureCanvas = (entries) => {
      const canvas = canvasRef.current; // Always get fresh canvas ref
      if (!canvas) {
        console.error("[configureCanvas] Canvas ref is null during configure call.");
        return;
      }
      // Ensure device, context, and format are populated before proceeding
      if (!device || !context || !format) {
        console.warn("[configureCanvas] Attempted to configure before device/context/format were ready. Skipping.");
        return;
      }

      if (entries) { 
        console.log("[configureCanvas via ResizeObserver] Called. Entry rect:", entries[0].contentRect);
      } else {
        console.log("[configureCanvas direct call] Called.");
      }
      
      const dpr = window.devicePixelRatio || 1;
      const currentClientWidth = canvas.clientWidth;
      const currentClientHeight = canvas.clientHeight;
      
      if (currentClientWidth === 0 || currentClientHeight === 0) {
        console.warn(`[configureCanvas] Canvas clientWidth/Height is zero. Skipping configure. W: ${currentClientWidth}, H: ${currentClientHeight}`);
        return; // Avoid configuring with 0x0 size
      }

      const targetWidth = Math.floor(currentClientWidth * dpr);
      const targetHeight = Math.floor(currentClientHeight * dpr);
      console.log(`[configureCanvas] DPR: ${dpr}, clientWidth: ${currentClientWidth}, clientHeight: ${currentClientHeight}`);

      if (canvas.width !== targetWidth || canvas.height !== targetHeight) {
        canvas.width = targetWidth;
        canvas.height = targetHeight;
        console.log(`[configureCanvas] Canvas buffer size SET to: ${canvas.width}x${canvas.height}`);
      } else {
        console.log(`[configureCanvas] Canvas size ${canvas.width}x${canvas.height} already correct.`);
      }
      
      try {
        context.configure({ device, format, alphaMode: 'opaque', size: [canvas.width, canvas.height] });
        console.log(`[configureCanvas] Context configured with size: ${canvas.width}x${canvas.height}`);
      } catch (e) {
        console.error("[configureCanvas] Error configuring context:", e);
      }
    };

    const render = () => {
      if (!device || !context) {
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

      frameCounter.current++;
      if (frameCounter.current < 5 || frameCounter.current % 120 === 1) {
          console.log(`[RENDER ${frameCounter.current}] Canvas physical: ${canvasRef.current?.width}x${canvasRef.current?.height}. Texture: ${textureView.texture.width}x${textureView.texture.height}`);
      }

      const commandEncoder = device.createCommandEncoder();
      const renderPassDescriptor = { /* ... magenta clear ... */ 
        colorAttachments: [ { view: textureView, clearValue: { r: 1, g: 0, b: 1, a: 1 }, loadOp: 'clear', storeOp: 'store' } ],
      };
      const passEncoder = commandEncoder.beginRenderPass(renderPassDescriptor);
      passEncoder.setViewport(0,0, textureView.texture.width, textureView.texture.height, 0, 1);
      passEncoder.setScissorRect(0,0, textureView.texture.width, textureView.texture.height);
      passEncoder.end();
      device.queue.submit([commandEncoder.finish()]);
      animationFrameIdRef.current = requestAnimationFrame(render);
    };

    const initializeWebGPU = async () => {
      const canvas = canvasRef.current; // Get it once
      if (!canvas) { console.error("Canvas ref null in initializeWebGPU"); return; }

      if (!navigator.gpu) { console.error('WebGPU not supported.'); return; }

      try {
        const adapter = await navigator.gpu.requestAdapter();
        if (!adapter) { console.error('Failed to get GPU adapter.'); return; }
        console.log("[TestWebGPUCanvas_ResizeObserver] Adapter obtained.");

        device = await adapter.requestDevice(); // Assign to module-scoped let
        console.log("[TestWebGPUCanvas_ResizeObserver] Device obtained:", device);
        device.lost.then((info) => { /* ... device lost handling ... */ });

        context = canvas.getContext('webgpu'); // Assign to module-scoped let
        if (!context) { console.error("Failed to get WebGPU context."); return; }
        console.log("[TestWebGPUCanvas_ResizeObserver] Context obtained:", context);

        format = navigator.gpu.getPreferredCanvasFormat(); // Assign to module-scoped let
        console.log("[TestWebGPUCanvas_ResizeObserver] Preferred format:", format);
        
        // Now that device, context, and format are initialized, set up ResizeObserver
        resizeObserver = new ResizeObserver(configureCanvas);
        resizeObserver.observe(canvas);
        console.log("[TestWebGPUCanvas_ResizeObserver] ResizeObserver observing canvas.");

        // Perform the first configureCanvas call *after* device, context, and format are ready
        console.log("[TestWebGPUCanvas_ResizeObserver] Calling initial configureCanvas.");
        configureCanvas(); // This should now have valid device, context, format

        if (!renderLoopStarted) { // Ensure render loop is started only once
            console.log("[TestWebGPUCanvas_ResizeObserver] Starting render loop.");
            render(); 
            renderLoopStarted = true;
        }

      } catch (error) {
        console.error('[TestWebGPUCanvas_ResizeObserver] Error initializing WebGPU:', error);
      }
    };

    initializeWebGPU();

    return () => { /* ... cleanup ... */
      console.log("[TestWebGPUCanvas_ResizeObserver] Cleanup.");
      if (animationFrameIdRef.current) cancelAnimationFrame(animationFrameIdRef.current);
      if (resizeObserver) resizeObserver.disconnect();
    };
  }, []);

  return ( <canvas ref={canvasRef} style={{ width: '100%', height: '100%', display: 'block', background: 'lightgoldenrodyellow' }} /> );
};

export default TestWebGPUCanvas;