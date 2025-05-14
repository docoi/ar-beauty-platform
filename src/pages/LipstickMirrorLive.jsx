// src/pages/LipstickMirrorLive.jsx (DIAGNOSTIC - Render Pass with CLEAR ONLY to MAGENTA)

import React, { useEffect, useRef, useState } from 'react';
// createPipelines is not strictly needed for this diagnostic, but keep import for structure
import createPipelines from '@/utils/createPipelines'; 
import lipTriangles from '@/utils/lipTriangles'; // Not used in this diagnostic pass
import { FaceLandmarker, FilesetResolver } from '@mediapipe/tasks-vision'; // Not used in this diagnostic pass

export default function LipstickMirrorLive() {
  const canvasRef = useRef(null);
  const videoRef = useRef(null); // Not used in this diagnostic pass

  const deviceRef = useRef(null);
  const contextRef = useRef(null);
  const formatRef = useRef(null);
  // pipelineStateRef fields won't be used for drawing in this diagnostic
  const pipelineStateRef = useRef({ 
    videoPipeline: null, lipstickPipeline: null, videoBindGroupLayout: null,
    aspectRatioGroupLayout: null, aspectRatioUniformBuffer: null, aspectRatioBindGroup: null,
    videoSampler: null, vertexBuffer: null, vertexBufferSize: 2048,
  });
  const animationFrameIdRef = useRef(null);
  const resizeHandlerRef = useRef(null);

  const [landmarker, setLandmarker] = useState(null); // Landmarker state kept for effect structure
  const [isGpuReady, setIsGpuReady] = useState(false);
  const [error, setError] = useState(null);
  const [debugMessage, setDebugMessage] = useState('Initializing...');
  const frameCounter = useRef(0);

  // Effect 1: Initialize FaceLandmarker (kept for structural consistency with previous state)
  useEffect(() => {
    const initLandmarker = async () => {
      try {
        console.log("[LM_EFFECT] Initializing FaceLandmarker (skipped for clear diagnostic, but effect runs)...");
        // To speed up, we can comment out actual landmarker loading for this specific test
        // const vision = await FilesetResolver.forVisionTasks('https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm');
        // const lm = await FaceLandmarker.createFromOptions(vision, { /* ... */ });
        // setLandmarker(lm); 
        setLandmarker({}); // Set to a dummy object to satisfy `allResourcesReady` if it checks landmarker
        console.log("[LM_EFFECT] FaceLandmarker placeholder set.");
      } catch (err) { console.error("[LM_EFFECT] Error (during placeholder):", err); setError(`LM init placeholder failed: ${err.message}`); }
    };
    initLandmarker();
  }, []);

  // Effect 2: Core WebGPU Initialization, Canvas Sizing, Context Config
  useEffect(() => {
    console.log("[CORE_GPU_EFFECT] Diagnostic - useEffect running.");
    const canvas = canvasRef.current;
    if (!canvas) { console.error("[CORE_GPU_EFFECT] Canvas element not found."); return; }
    let currentDevice = null;

    const initializeWebGPUForClearTest = async () => {
      if (!navigator.gpu) { console.error('WebGPU not supported.'); setError('WebGPU not supported.'); return; }
      try {
        const adapter = await navigator.gpu.requestAdapter();
        if (!adapter) { console.error('Failed to get GPU adapter.'); setError('No GPU adapter.'); return; }
        currentDevice = await adapter.requestDevice();
        deviceRef.current = currentDevice;
        console.log("[CORE_GPU_EFFECT] Device obtained:", currentDevice);
        currentDevice.lost.then((info) => {
          console.error(`[DEVICE_LOST_HANDLER] WebGPU device lost: ${info.message}`);
          setError(`Device lost: ${info.message}.`); if (animationFrameIdRef.current) cancelAnimationFrame(animationFrameIdRef.current);
          animationFrameIdRef.current = null; deviceRef.current = null; contextRef.current = null; setIsGpuReady(false);
        });
        
        const context = canvas.getContext('webgpu');
        if (!context) { console.error("Failed to get context."); setError('No WebGPU context.'); return; }
        contextRef.current = context;
        console.log("[CORE_GPU_EFFECT] Context obtained.");
        formatRef.current = navigator.gpu.getPreferredCanvasFormat();
        console.log("[CORE_GPU_EFFECT] Preferred format:", formatRef.current);

        resizeHandlerRef.current = () => {
            console.log("[resizeHandlerRef.current - configureAndSizeCanvas] Called");
            const dvc = deviceRef.current; const ctx = contextRef.current; const fmt = formatRef.current; const cnvs = canvasRef.current;
            if (!dvc || !ctx || !fmt || !cnvs) { console.error("[configureAndSizeCanvas] Missing core refs."); return false; }
            const dpr = window.devicePixelRatio || 1;
            const displayWidth = Math.floor(cnvs.clientWidth * dpr);
            const displayHeight = Math.floor(cnvs.clientHeight * dpr);
            if (cnvs.width !== displayWidth || cnvs.height !== displayHeight) {
                cnvs.width = displayWidth; cnvs.height = displayHeight;
                console.log(`[configureAndSizeCanvas] Canvas buffer SET to: ${cnvs.width}x${cnvs.height}. DPR: ${dpr}`);
            } else { console.log(`[configureAndSizeCanvas] Canvas buffer size already matches: ${cnvs.width}x${cnvs.height}.`); }
            try {
                ctx.configure({ device: dvc, format: fmt, alphaMode: 'opaque', size: [cnvs.width, cnvs.height] });
                console.log(`[configureAndSizeCanvas] Context CONFIGURED. Size: ${cnvs.width}x${cnvs.height}`);
                return true;
            } catch (e) { console.error("[configureAndSizeCanvas] Error configuring context:", e); setError("Error configuring context."); return false; }
        };
        
        if (!resizeHandlerRef.current()) { console.error("[CORE_GPU_EFFECT] Initial canvas/context configuration failed."); return; }
        window.addEventListener('resize', resizeHandlerRef.current);
        console.log("[CORE_GPU_EFFECT] Initial canvas config done. Resize listener added.");
        
        // Pipeline creation is skipped for this diagnostic
        console.log("[CORE_GPU_EFFECT] Pipeline creation SKIPPED for clear diagnostic.");
        pipelineStateRef.current.videoPipeline = true; // Dummy value to satisfy allResourcesReady
        
        setIsGpuReady(true);
        console.log("[CORE_GPU_EFFECT] GPU Core is Ready (for clear diagnostic).");

        // Video stream setup is skipped for this diagnostic
        console.log("[CORE_GPU_EFFECT] Video stream setup SKIPPED for clear diagnostic.");

        // --- Render Loop (Clear Only) ---
        const render = async () => {
          const dvc = deviceRef.current; const ctx = contextRef.current;
          if (!dvc || !ctx) {
            console.warn(`[RENDER ${frameCounter.current}] Loop waiting: No Device/Context.`);
            animationFrameIdRef.current = requestAnimationFrame(render); return;
          }
          frameCounter.current++;

          // Optional: Aggressive re-config for first few frames (can be removed if initial config is trusted)
          if (frameCounter.current < 5) {
            // console.log(`[RENDER ${frameCounter.current}] Attempting pre-render re-configuration...`);
            if (resizeHandlerRef.current && !resizeHandlerRef.current()) {
                 console.error(`[RENDER ${frameCounter.current}] Pre-render re-configuration FAILED. Skipping frame.`);
                 animationFrameIdRef.current = requestAnimationFrame(render); return;
            }
          }

          let currentTexture;
          try {
            currentTexture = ctx.getCurrentTexture();
          } catch(e) {
            console.error(`[RENDER ${frameCounter.current}] Error getting current texture for clear:`, e);
            if (resizeHandlerRef.current) { resizeHandlerRef.current(); }
            animationFrameIdRef.current = requestAnimationFrame(render); 
            return;
          }
          
          if (frameCounter.current < 5 || frameCounter.current % 120 === 1) {
            console.log(`[RENDER ${frameCounter.current}] DIAGNOSTIC CLEAR: Canvas physical ${ctx.canvas.width}x${ctx.canvas.height}. Texture to clear: ${currentTexture.width}x${currentTexture.height}, format: ${currentTexture.format}`);
          }

          const texView = currentTexture.createView();
          const cmdEnc = dvc.createCommandEncoder({label: "ClearOnlyEncoder"});
          
          const passEnc = cmdEnc.beginRenderPass({
            colorAttachments:[{
              view: texView,
              clearValue: { r: 1.0, g: 0.0, b: 1.0, a: 1.0 }, // MAGENTA
              loadOp: 'clear',
              storeOp: 'store'
            }]
          });
          passEnc.end(); // End pass immediately after clear
          dvc.queue.submit([cmdEnc.finish()]);

          if(frameCounter.current === 1) { console.log(`[RENDER 1] DIAGNOSTIC: First frame cleared to magenta.`); setDebugMessage("Diagnostic: Clear Test"); }
          if(dvc) { animationFrameIdRef.current = requestAnimationFrame(render); }
          else { animationFrameIdRef.current = null; }
        };
        console.log("[CORE_GPU_EFFECT] Starting render loop (Clear Only Diagnostic).");
        animationFrameIdRef.current = requestAnimationFrame(render);
      } catch (error) { console.error('[CORE_GPU_EFFECT] Error during WebGPU Init (Clear Diagnostic):', error); setError(`WebGPU Init failed: ${error.message}`); setIsGpuReady(false); }
    };
    initializeWebGPUForClearTest();
    return () => {
        console.log("[CORE_GPU_EFFECT_CLEANUP] Cleaning up (Clear Diagnostic).");
        if (animationFrameIdRef.current) cancelAnimationFrame(animationFrameIdRef.current);
        if (resizeHandlerRef.current) window.removeEventListener('resize', resizeHandlerRef.current);
        // No video stream or pipelines to clean up in this specific diagnostic version
        deviceRef.current = null; contextRef.current = null; setIsGpuReady(false);
        console.log("[CORE_GPU_EFFECT_CLEANUP] Finished (Clear Diagnostic).");
    };
  }, []);

  // Derived state for starting render loop
  const allResourcesReady = !!(landmarker && isGpuReady && pipelineStateRef.current.videoPipeline); // videoPipeline is now a dummy true value

  useEffect(() => { // UI Message Effect
    if (allResourcesReady) { setDebugMessage("Diagnostic: Clear Test Active"); console.log("[UI_MSG_EFFECT] Resources ready for clear test."); }
    else { setDebugMessage("Initializing for Clear Test..."); }
  }, [allResourcesReady]); // landmarker is just a placeholder here

  return (
    <div style={{ width: '640px', height: '480px', margin: 'auto', border: '1px solid #ccc', position: 'relative', overflow: 'hidden' }}>
      <div style={{position:'absolute',top:'5px',left:'5px',background:'rgba(0,0,0,0.7)',color:'white',padding:'2px 5px',fontSize:'12px',zIndex:10,pointerEvents:'none'}}>
        {error ? `Error: ${error}` : debugMessage} (Frame: {frameCounter.current})
      </div>
      {/* Video element not strictly needed for clear test but kept for structural similarity */}
      <video ref={videoRef} style={{position:'absolute',top:0,left:0,width:'100%',height:'100%',objectFit:'cover',opacity:0,pointerEvents:'none',zIndex:1}} width={640} height={480} autoPlay playsInline muted />
      <canvas ref={canvasRef} width={640} height={480} style={{position:'absolute',top:0,left:0,width:'100%',height:'100%',zIndex:2, background: 'lightgray'}} /> {/* Lightgray background */}
    </div>
  );
}