// src/components/TestWebGPUCanvas.jsx (Corrected texture dimension access for viewport/scissor)
import React, { useEffect, useRef } from 'react';

const LipstickMirrorLive_Clone = () => {
  const canvasRef = useRef(null);
  const animationFrameIdRef = useRef(null);
  const frameCounter = useRef(0);

  useEffect(() => {
    console.log("[LML_Clone] useEffect running.");
    let device = null; 
    let context = null;
    let format = null;
    let resizeObserver = null;
    let renderLoopStarted = false;

    const configureCanvas = (entries) => {
      const canvas = canvasRef.current;
      if (!canvas) { console.error("[configureCanvas] Canvas ref is null."); return; }
      if (!device || !context || !format) { console.warn("[configureCanvas] Device/context/format not ready. Skipping."); return; }

      if (entries) { console.log("[configureCanvas via ResizeObserver] Called."); } 
      else { console.log("[configureCanvas direct call] Called."); }
      
      const dpr = window.devicePixelRatio || 1;
      const currentClientWidth = canvas.clientWidth;
      const currentClientHeight = canvas.clientHeight;
      if (currentClientWidth === 0 || currentClientHeight === 0) {
        console.warn(`[configureCanvas] Canvas clientWidth/Height is zero. W: ${currentClientWidth}, H: ${currentClientHeight}`);
        return;
      }
      const targetWidth = Math.floor(currentClientWidth * dpr);
      const targetHeight = Math.floor(currentClientHeight * dpr);
      console.log(`[configureCanvas] DPR: ${dpr}, clientW: ${currentClientWidth}, clientH: ${currentClientHeight} => target phys: ${targetWidth}x${targetHeight}`);

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
      } catch (e) { console.error("[configureCanvas] Error configuring context:", e); }
    };

    const render = () => {
      if (!device || !context || !canvasRef.current) { // Added canvasRef.current check
        if (animationFrameIdRef.current) cancelAnimationFrame(animationFrameIdRef.current);
        return;
      }
      
      const canvas = canvasRef.current; // Use current canvas ref
      let currentGpuTexture;
      let textureView;

      try {
        currentGpuTexture = context.getCurrentTexture(); // Get the GPUTexture
        textureView = currentGpuTexture.createView();   // Then create its view
      } catch (e) {
        console.error("[render] Error getting current texture/view:", e);
        animationFrameIdRef.current = requestAnimationFrame(render);
        return;
      }

      frameCounter.current++;
      if (frameCounter.current < 5 || frameCounter.current % 120 === 1) {
          // Log dimensions from the GPUTexture and the canvas element's attributes
          console.log(`[RENDER ${frameCounter.current}] Canvas attr: ${canvas.width}x${canvas.height}. GPUTexture: ${currentGpuTexture.width}x${currentGpuTexture.height}`);
      }

      const commandEncoder = device.createCommandEncoder();
      const renderPassDescriptor = {
        colorAttachments: [ { view: textureView, clearValue: { r: 0, g: 0.5, b: 0, a: 1 }, loadOp: 'clear', storeOp: 'store' } ],
      };
      const passEncoder = commandEncoder.beginRenderPass(renderPassDescriptor);
      
      // Use dimensions from the GPUTexture for viewport and scissor, as this is the actual drawing surface
      passEncoder.setViewport(0,0, currentGpuTexture.width, currentGpuTexture.height, 0, 1);
      passEncoder.setScissorRect(0,0, currentGpuTexture.width, currentGpuTexture.height);
      
      passEncoder.end();
      device.queue.submit([commandEncoder.finish()]);
      animationFrameIdRef.current = requestAnimationFrame(render);
    };

    const initializeWebGPU = async () => {
      const canvas = canvasRef.current;
      if (!canvas) { console.error("Canvas ref null in initializeWebGPU"); return; }
      if (!navigator.gpu) { console.error('WebGPU not supported.'); return; }

      try {
        const adapter = await navigator.gpu.requestAdapter();
        if (!adapter) { console.error('Failed to get GPU adapter.'); return; }
        console.log("[LML_Clone] Adapter obtained.");

        device = await adapter.requestDevice();
        console.log("[LML_Clone] Device obtained:", device);
        device.lost.then((info) => { console.error(`[LML_Clone] Device lost: ${info.message}`); if (animationFrameIdRef.current) cancelAnimationFrame(animationFrameIdRef.current);});

        context = canvas.getContext('webgpu');
        if (!context) { console.error("Failed to get WebGPU context."); return; }
        console.log("[LML_Clone] Context obtained:", context);

        format = navigator.gpu.getPreferredCanvasFormat();
        console.log("[LML_Clone] Preferred format:", format);
        
        resizeObserver = new ResizeObserver(configureCanvas);
        resizeObserver.observe(canvas);
        console.log("[LML_Clone] ResizeObserver observing canvas.");

        console.log("[LML_Clone] Calling initial configureCanvas.");
        configureCanvas(); 

        if (!renderLoopStarted) {
            console.log("[LML_Clone] Starting render loop.");
            render(); 
            renderLoopStarted = true;
        }
      } catch (error) { console.error('[LML_Clone] Error initializing WebGPU:', error); }
    };

    initializeWebGPU();

    return () => {
      console.log("[LML_Clone] Cleanup.");
      if (animationFrameIdRef.current) cancelAnimationFrame(animationFrameIdRef.current);
      if (resizeObserver) resizeObserver.disconnect();
    };
  }, []);

  return ( <canvas ref={canvasRef} style={{ width: '100%', height: '100%', display: 'block', background: 'lightblue' }} /> );
};

export default LipstickMirrorLive_Clone;