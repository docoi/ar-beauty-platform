// src/pages/LipstickMirrorLive.jsx (Aggressive re-config diagnostic)
// Full code below, key changes will be in the render function

import React, { useEffect, useRef, useState } from 'react';
import createPipelines from '@/utils/createPipelines';
import lipTriangles from '@/utils/lipTriangles';
import { FaceLandmarker, FilesetResolver } from '@mediapipe/tasks-vision';

export default function LipstickMirrorLive() {
  const canvasRef = useRef(null);
  const videoRef = useRef(null);

  const deviceRef = useRef(null);
  const contextRef = useRef(null);
  const formatRef = useRef(null);
  const pipelineStateRef = useRef({ /* ... as before ... */ 
    videoPipeline: null, lipstickPipeline: null, videoBindGroupLayout: null,
    aspectRatioGroupLayout: null, aspectRatioUniformBuffer: null, aspectRatioBindGroup: null,
    videoSampler: null, vertexBuffer: null, vertexBufferSize: 2048,
  });
  const animationFrameIdRef = useRef(null);
  const resizeHandlerRef = useRef(null); // To store the actual function instance

  const [landmarker, setLandmarker] = useState(null);
  const [isGpuReady, setIsGpuReady] = useState(false);
  const [error, setError] = useState(null);
  const [debugMessage, setDebugMessage] = useState('Initializing...');
  const frameCounter = useRef(0);

  // Effect 1: Initialize FaceLandmarker (no change from previous correct version)
  useEffect(() => {
    const initLandmarker = async () => {
      try {
        console.log("[LM_EFFECT] Initializing FaceLandmarker...");
        const vision = await FilesetResolver.forVisionTasks('https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm');
        const lm = await FaceLandmarker.createFromOptions(vision, {
          baseOptions: { modelAssetPath: '/models/face_landmarker.task', delegate: 'GPU' },
          outputFaceBlendshapes: false, runningMode: 'VIDEO', numFaces: 1,
        });
        setLandmarker(lm); console.log("[LM_EFFECT] FaceLandmarker ready.");
      } catch (err) { console.error("[LM_EFFECT] Error initializing FaceLandmarker:", err); setError(`LM init failed: ${err.message}`); setDebugMessage("Error."); }
    };
    initLandmarker();
  }, []);

  // Effect 2: Core WebGPU Initialization, Canvas Sizing, Context Config, Pipelines
  useEffect(() => {
    console.log("[CORE_GPU_EFFECT] useEffect running.");
    const canvas = canvasRef.current;
    if (!canvas) { console.error("[CORE_GPU_EFFECT] Canvas element not found."); return; }
    let currentDevice = null;

    const initializeWebGPUAndRun = async () => {
      if (!navigator.gpu) { console.error('WebGPU not supported.'); setError('WebGPU not supported.'); return; }
      try {
        const adapter = await navigator.gpu.requestAdapter();
        if (!adapter) { console.error('Failed to get GPU adapter.'); setError('No GPU adapter.'); return; }
        currentDevice = await adapter.requestDevice();
        deviceRef.current = currentDevice;
        console.log("[CORE_GPU_EFFECT] Device obtained:", currentDevice);
        currentDevice.lost.then((info) => {
          console.error(`[DEVICE_LOST_HANDLER] WebGPU device lost: ${info.message}`);
          setError(`Device lost: ${info.message}. Please refresh.`);
          if (animationFrameIdRef.current) cancelAnimationFrame(animationFrameIdRef.current);
          animationFrameIdRef.current = null; deviceRef.current = null; contextRef.current = null; setIsGpuReady(false);
        });
        
        const context = canvas.getContext('webgpu');
        if (!context) { console.error("Failed to get context."); setError('No WebGPU context.'); return; }
        contextRef.current = context;
        console.log("[CORE_GPU_EFFECT] Context obtained.");
        formatRef.current = navigator.gpu.getPreferredCanvasFormat();
        console.log("[CORE_GPU_EFFECT] Preferred format:", formatRef.current);

        // configureAndSizeCanvas will be called by resize listener and initially
        // It's also called at the start of each render frame in this diagnostic version
        resizeHandlerRef.current = () => { // Store the function itself
            console.log("[resizeHandlerRef.current - configureAndSizeCanvas] Called");
            const dvc = deviceRef.current; const ctx = contextRef.current; const fmt = formatRef.current; const cnvs = canvasRef.current;
            if (!dvc || !ctx || !fmt || !cnvs) { console.error("[configureAndSizeCanvas] Missing core refs for configuration."); return false; }
            const dpr = window.devicePixelRatio || 1;
            const displayWidth = Math.floor(cnvs.clientWidth * dpr);
            const displayHeight = Math.floor(cnvs.clientHeight * dpr);
            // console.log(`[configureAndSizeCanvas] DPR: ${dpr}, clientW/H: ${cnvs.clientWidth}x${cnvs.clientHeight} => physical: ${displayWidth}x${displayHeight}`);
            if (cnvs.width !== displayWidth || cnvs.height !== displayHeight) {
                cnvs.width = displayWidth; cnvs.height = displayHeight;
                console.log(`[configureAndSizeCanvas] Canvas buffer SET to: ${cnvs.width}x${cnvs.height}`);
            }
            try {
                ctx.configure({ device: dvc, format: fmt, alphaMode: 'opaque', size: [cnvs.width, cnvs.height] });
                console.log(`[configureAndSizeCanvas] Context CONFIGURED. Size: ${cnvs.width}x${cnvs.height}`);
                return true;
            } catch (e) { console.error("[configureAndSizeCanvas] Error configuring context:", e); setError("Error configuring context."); return false; }
        };
        
        if (!resizeHandlerRef.current()) { // Initial call
            console.error("[CORE_GPU_EFFECT] Initial canvas/context configuration failed."); return;
        }
        window.addEventListener('resize', resizeHandlerRef.current);
        console.log("[CORE_GPU_EFFECT] Initial canvas config done. Resize listener added.");

        const { videoPipeline, lipstickPipeline, videoBindGroupLayout, aspectRatioGroupLayout } = await createPipelines(currentDevice, formatRef.current);
        pipelineStateRef.current.videoPipeline = videoPipeline; pipelineStateRef.current.lipstickPipeline = lipstickPipeline;
        pipelineStateRef.current.videoBindGroupLayout = videoBindGroupLayout; pipelineStateRef.current.aspectRatioGroupLayout = aspectRatioGroupLayout;
        const uniformBufferSize = 4 * Float32Array.BYTES_PER_ELEMENT;
        pipelineStateRef.current.aspectRatioUniformBuffer = currentDevice.createBuffer({ size: uniformBufferSize, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST });
        if (pipelineStateRef.current.aspectRatioGroupLayout && pipelineStateRef.current.aspectRatioUniformBuffer) {
            pipelineStateRef.current.aspectRatioBindGroup = currentDevice.createBindGroup({ layout: pipelineStateRef.current.aspectRatioGroupLayout, entries: [{ binding: 0, resource: { buffer: pipelineStateRef.current.aspectRatioUniformBuffer }}]});
        }
        pipelineStateRef.current.videoSampler = currentDevice.createSampler({ magFilter: 'linear', minFilter: 'linear' });
        pipelineStateRef.current.vertexBuffer = currentDevice.createBuffer({ size: pipelineStateRef.current.vertexBufferSize, usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST });
        console.log("[CORE_GPU_EFFECT] Pipelines and device resources created.");
        setIsGpuReady(true);
        console.log("[CORE_GPU_EFFECT] GPU Core is Ready.");

        if (!videoRef.current) { console.error("Video ref missing"); return;}
        if (!navigator.mediaDevices?.getUserMedia) throw new Error("Camera not supported for video.");
        const stream = await navigator.mediaDevices.getUserMedia({ video: { width: 640, height: 480 } });
        videoRef.current.srcObject = stream;
        await new Promise((res, rej) => {
          videoRef.current.onloadedmetadata = () => { console.log(`[CORE_GPU_EFFECT] Video metadata: ${videoRef.current.videoWidth}x${videoRef.current.videoHeight}`); res(); };
          videoRef.current.onerror = () => rej(new Error("Video load error."));
        });
        await videoRef.current.play();
        console.log("[CORE_GPU_EFFECT] Video playback started.");

        // --- Render Loop ---
        const render = async () => {
          const dvc = deviceRef.current; const ctx = contextRef.current; const pState = pipelineStateRef.current; const lmrk = landmarker;
          if (!dvc || !ctx || !pState.videoPipeline || !videoRef.current || !resizeHandlerRef.current) {
            animationFrameIdRef.current = requestAnimationFrame(render); return;
          }
          frameCounter.current++;

          // **** DIAGNOSTIC: Force re-configure canvas size and context every frame ****
          // This is very inefficient but helps see if the state is lost.
          if (frameCounter.current < 5) { // Only for first few frames to avoid flooding
            console.log(`[RENDER ${frameCounter.current}] Attempting pre-render re-configuration...`);
            if (!resizeHandlerRef.current()) { // Call the stored configure function
                 console.error(`[RENDER ${frameCounter.current}] Pre-render re-configuration FAILED. Skipping frame.`);
                 animationFrameIdRef.current = requestAnimationFrame(render); return;
            }
          }
          // **** END DIAGNOSTIC ****

          if (videoRef.current.readyState < videoRef.current.HAVE_ENOUGH_DATA || videoRef.current.videoWidth === 0) {
            animationFrameIdRef.current = requestAnimationFrame(render); return;
          }
          const videoFrame = videoRef.current;
          // if (frameCounter.current % 120 === 1) { console.log(`[RENDER] Video dims: ${videoFrame.videoWidth}x${videoFrame.videoHeight}`); }

          if (pState.aspectRatioUniformBuffer && videoFrame.videoWidth > 0 && ctx.canvas.width > 0) {
            const aspectRatioData = new Float32Array([ videoFrame.videoWidth, videoFrame.videoHeight, ctx.canvas.width, ctx.canvas.height ]);
            dvc.queue.writeBuffer(pState.aspectRatioUniformBuffer, 0, aspectRatioData);
          }

          let numLipVertices = 0; /* ... landmark processing ... */
          if (lmrk) { try { const now = performance.now(); const results = lmrk.detectForVideo(videoFrame, now); if (results?.faceLandmarks?.length > 0) { const allLm = results.faceLandmarks[0]; const lips = lipTriangles.map(([a,b,c]) => [allLm[a],allLm[b],allLm[c]]); const v = new Float32Array(lips.flat().map(pt => [(0.5-pt.x)*2,(0.5-pt.y)*2]).flat()); numLipVertices=v.length/2; if(v.byteLength>0&&pState.vertexBuffer){if(v.byteLength<=pState.vertexBufferSize)dvc.queue.writeBuffer(pState.vertexBuffer,0,v);else numLipVertices=0;}else numLipVertices=0;} else numLipVertices=0;} catch(e){numLipVertices=0;}}

          let videoTextureGPU, frameBindGroupForTexture;
          try {
            videoTextureGPU = dvc.importExternalTexture({ source: videoFrame });
            if (pState.videoBindGroupLayout && pState.videoSampler) { frameBindGroupForTexture = dvc.createBindGroup({ layout: pState.videoBindGroupLayout, entries: [{binding:0,resource:pState.videoSampler},{binding:1,resource:videoTextureGPU}]});}
            else { animationFrameIdRef.current = requestAnimationFrame(render); return; }
          } catch (e) { animationFrameIdRef.current = requestAnimationFrame(render); return; }
          
          let currentTexture;
          try { currentTexture = ctx.getCurrentTexture(); }
          catch(e) { console.error(`[RENDER ${frameCounter.current}] Error getting current texture:`, e); animationFrameIdRef.current = requestAnimationFrame(render); return; }
          
          // **** DIAGNOSTIC: Log currentTexture dimensions ****
          if (frameCounter.current < 5 || frameCounter.current % 120 === 1) {
            console.log(`[RENDER ${frameCounter.current}] CurrentTexture got: width=${currentTexture.width}, height=${currentTexture.height}. Canvas physical: ${ctx.canvas.width}x${ctx.canvas.height}`);
          }
          // **** END DIAGNOSTIC ****

          const texView = currentTexture.createView();
          const cmdEnc = dvc.createCommandEncoder();
          const canvasPhysicalWidth = ctx.canvas.width; const canvasPhysicalHeight = ctx.canvas.height; // These should be correct after re-config
          const passEnc = cmdEnc.beginRenderPass({colorAttachments:[{view:texView,clearValue:{r:0.0,g:0.0,b:0.0,a:1.0},loadOp:'clear',storeOp:'store'}]});
          passEnc.setViewport(0,0,canvasPhysicalWidth,canvasPhysicalHeight,0,1);
          passEnc.setScissorRect(0,0,canvasPhysicalWidth,canvasPhysicalHeight);
          // if (frameCounter.current % 120 === 1) { console.log(`[RENDER] Viewport&Scissor: 0,0,${canvasPhysicalWidth},${canvasPhysicalHeight}`); }
          
          if (pState.videoPipeline && frameBindGroupForTexture && pState.aspectRatioBindGroup) {
            passEnc.setPipeline(pState.videoPipeline); passEnc.setBindGroup(0, frameBindGroupForTexture); passEnc.setBindGroup(1, pState.aspectRatioBindGroup); passEnc.draw(6);
          }
          if(numLipVertices>0 && pState.lipstickPipeline && pState.vertexBuffer){ passEnc.setPipeline(pState.lipstickPipeline); passEnc.setVertexBuffer(0,pState.vertexBuffer); passEnc.draw(numLipVertices); }
          passEnc.end();
          dvc.queue.submit([cmdEnc.finish()]);

          if(frameCounter.current === 1) { console.log(`[RENDER 1] First frame drawn.`); setDebugMessage("Live Tracking Active!"); }
          animationFrameIdRef.current = requestAnimationFrame(render);
        };
        console.log("[CORE_GPU_EFFECT] Starting render loop.");
        animationFrameIdRef.current = requestAnimationFrame(render);
      } catch (error) { console.error('[CORE_GPU_EFFECT] Error during WebGPU Init:', error); setError(`WebGPU Init failed: ${error.message}`); setIsGpuReady(false); }
    };
    initializeWebGPUAndRun();
    return () => { /* ... cleanup as before ... */
        console.log("[CORE_GPU_EFFECT_CLEANUP] Cleaning up.");
        if (animationFrameIdRef.current) cancelAnimationFrame(animationFrameIdRef.current);
        if (resizeHandlerRef.current) window.removeEventListener('resize', resizeHandlerRef.current);
        const stream = videoRef.current?.srcObject; if (stream?.getTracks) { stream.getTracks().forEach(track => track.stop()); }
        if(videoRef.current) videoRef.current.srcObject = null;
        const dvc = deviceRef.current; if (dvc) { pipelineStateRef.current.vertexBuffer?.destroy(); }
        deviceRef.current = null; contextRef.current = null; setIsGpuReady(false);
        console.log("[CORE_GPU_EFFECT_CLEANUP] Finished.");
    };
  }, []);

  useEffect(() => { /* ... UI Message Effect as before ... */
    if (isGpuReady && landmarker) { setDebugMessage("Live Tracking Active!"); console.log("[UI_MSG_EFFECT] All resources ready."); }
    else if (!isGpuReady && !landmarker) { setDebugMessage("Initializing All Systems..."); }
    else if (!isGpuReady) { setDebugMessage("Initializing GPU Systems..."); }
    else { setDebugMessage("Initializing Face Tracking..."); }
  }, [isGpuReady, landmarker]);

  // console.log('[COMPONENT_BODY_RENDER] ...'); // Optional: keep this for debugging React re-renders

  return ( /* ... JSX as before ... */
    <div style={{ width: '640px', height: '480px', margin: 'auto', border: '1px solid #ccc', position: 'relative', overflow: 'hidden' }}>
      <div style={{position:'absolute',top:'5px',left:'5px',background:'rgba(0,0,0,0.7)',color:'white',padding:'2px 5px',fontSize:'12px',zIndex:10,pointerEvents:'none'}}>
        {error ? `Error: ${error}` : debugMessage} (Frame: {frameCounter.current})
      </div>
      <video ref={videoRef} style={{position:'absolute',top:0,left:0,width:'100%',height:'100%',objectFit:'cover',opacity:0,pointerEvents:'none',zIndex:1}} width={640} height={480} autoPlay playsInline muted />
      <canvas ref={canvasRef} width={640} height={480} style={{position:'absolute',top:0,left:0,width:'100%',height:'100%',zIndex:2, background: 'lightpink'}} />
    </div>
  );
}