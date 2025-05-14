// src/pages/LipstickMirrorLive.jsx (Aspect ratio correction with uniforms)

import React, { useEffect, useRef, useState } from 'react';
import createPipelines from '@/utils/createPipelines'; // Ensure this is updated to return aspectRatioGroupLayout
import lipTriangles from '@/utils/lipTriangles';
import { FaceLandmarker, FilesetResolver } from '@mediapipe/tasks-vision';

export default function LipstickMirrorLive() {
  const canvasRef = useRef(null);
  const videoRef = useRef(null);

  // --- Refs to hold WebGPU and other persistent objects ---
  const deviceRef = useRef(null);
  const contextRef = useRef(null);
  const formatRef = useRef(null);
  const pipelineStateRef = useRef({
    videoPipeline: null,
    lipstickPipeline: null,
    videoBindGroupLayout: null,    // For texture/sampler
    aspectRatioGroupLayout: null, // For aspect ratio uniforms
    aspectRatioUniformBuffer: null,
    aspectRatioBindGroup: null,
    videoSampler: null,
    vertexBuffer: null,
    vertexBufferSize: 2048,
  });
  const animationFrameIdRef = useRef(null);
  const resizeHandlerRef = useRef(null);

  // --- React State ---
  const [landmarker, setLandmarker] = useState(null);
  const [isGpuReady, setIsGpuReady] = useState(false);
  const [error, setError] = useState(null);
  const [debugMessage, setDebugMessage] = useState('Initializing...');
  const frameCounter = useRef(0);

  // Effect 1: Initialize FaceLandmarker
  useEffect(() => {
    const initLandmarker = async () => {
      try {
        console.log("[LM_EFFECT] Initializing FaceLandmarker...");
        const vision = await FilesetResolver.forVisionTasks('https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm');
        const lm = await FaceLandmarker.createFromOptions(vision, {
          baseOptions: { modelAssetPath: '/models/face_landmarker.task', delegate: 'GPU' },
          outputFaceBlendshapes: false, runningMode: 'VIDEO', numFaces: 1,
        });
        setLandmarker(lm);
        console.log("[LM_EFFECT] FaceLandmarker ready.");
      } catch (err) { console.error("[LM_EFFECT] Error initializing FaceLandmarker:", err); setError(`LM init failed: ${err.message}`); setDebugMessage("Error."); }
    };
    initLandmarker();
  }, []);

  // Effect 2: Core WebGPU Initialization, Canvas Sizing, Context Config, Pipelines, and Render Loop Setup
  useEffect(() => {
    console.log("[CORE_GPU_EFFECT] useEffect running.");
    const canvas = canvasRef.current;
    if (!canvas) { console.error("[CORE_GPU_EFFECT] Canvas element not found."); return; }

    let currentDevice = null; // To use within this async function before setting ref

    const initializeWebGPUAndRun = async () => {
      if (!navigator.gpu) { console.error('WebGPU not supported.'); setError('WebGPU not supported.'); return; }
      try {
        const adapter = await navigator.gpu.requestAdapter();
        if (!adapter) { console.error('Failed to get GPU adapter.'); setError('No GPU adapter.'); return; }
        console.log("[CORE_GPU_EFFECT] Adapter obtained.");

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

        const configureAndSizeCanvas = () => {
          console.log("[configureAndSizeCanvas] Called");
          const dvc = deviceRef.current; const ctx = contextRef.current; const fmt = formatRef.current; const cnvs = canvasRef.current;
          if (!dvc || !ctx || !fmt || !cnvs) { console.error("[configureAndSizeCanvas] Missing core refs."); return; }
          const dpr = window.devicePixelRatio || 1;
          const displayWidth = Math.floor(cnvs.clientWidth * dpr);
          const displayHeight = Math.floor(cnvs.clientHeight * dpr);
          console.log(`[configureAndSizeCanvas] DPR: ${dpr}, clientW/H: ${cnvs.clientWidth}x${cnvs.clientHeight} => physical: ${displayWidth}x${displayHeight}`);
          if (cnvs.width !== displayWidth || cnvs.height !== displayHeight) {
            cnvs.width = displayWidth; cnvs.height = displayHeight;
            console.log(`[configureAndSizeCanvas] Canvas buffer SET to: ${cnvs.width}x${cnvs.height}`);
          } else { console.log(`[configureAndSizeCanvas] Canvas buffer size already matches: ${cnvs.width}x${cnvs.height}`); }
          try {
            ctx.configure({ device: dvc, format: fmt, alphaMode: 'opaque', size: [cnvs.width, cnvs.height] });
            console.log(`[configureAndSizeCanvas] Context CONFIGURED. Size: ${cnvs.width}x${cnvs.height}`);
          } catch (e) { console.error("[configureAndSizeCanvas] Error configuring context:", e); setError("Error configuring context."); }
        };
        
        resizeHandlerRef.current = configureAndSizeCanvas;
        configureAndSizeCanvas();
        window.addEventListener('resize', resizeHandlerRef.current);
        console.log("[CORE_GPU_EFFECT] Initial canvas config done. Resize listener added.");

        // Create pipelines and get layouts
        const { videoPipeline, lipstickPipeline, videoBindGroupLayout, aspectRatioGroupLayout } = await createPipelines(currentDevice, formatRef.current);
        pipelineStateRef.current.videoPipeline = videoPipeline;
        pipelineStateRef.current.lipstickPipeline = lipstickPipeline;
        pipelineStateRef.current.videoBindGroupLayout = videoBindGroupLayout;
        pipelineStateRef.current.aspectRatioGroupLayout = aspectRatioGroupLayout; // Store new layout
        console.log("[CORE_GPU_EFFECT] Pipelines and layouts created.");

        // Create aspect ratio uniform buffer
        const uniformBufferSize = 4 * Float32Array.BYTES_PER_ELEMENT; // videoW, videoH, canvasW, canvasH
        pipelineStateRef.current.aspectRatioUniformBuffer = currentDevice.createBuffer({
          size: uniformBufferSize,
          usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
        });
        console.log("[CORE_GPU_EFFECT] Aspect Ratio Uniform Buffer created.");
        
        // Create aspect ratio bind group (if layout is available)
        if (pipelineStateRef.current.aspectRatioGroupLayout && pipelineStateRef.current.aspectRatioUniformBuffer) {
            pipelineStateRef.current.aspectRatioBindGroup = currentDevice.createBindGroup({
            layout: pipelineStateRef.current.aspectRatioGroupLayout,
            entries: [{ binding: 0, resource: { buffer: pipelineStateRef.current.aspectRatioUniformBuffer }}],
          });
          console.log("[CORE_GPU_EFFECT] Aspect Ratio Bind Group created.");
        } else {
            console.error("[CORE_GPU_EFFECT] Could not create aspect ratio bind group: layout or buffer missing.");
        }

        pipelineStateRef.current.videoSampler = currentDevice.createSampler({ magFilter: 'linear', minFilter: 'linear' });
        pipelineStateRef.current.vertexBuffer = currentDevice.createBuffer({
          size: pipelineStateRef.current.vertexBufferSize,
          usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
        });
        console.log("[CORE_GPU_EFFECT] Sampler and Vertex Buffer created.");
        setIsGpuReady(true);
        console.log("[CORE_GPU_EFFECT] GPU Core is Ready. isGpuReady set to true.");

        if (!videoRef.current) { console.error("Video ref missing"); return;}
        if (!navigator.mediaDevices?.getUserMedia) throw new Error("Camera not supported for video.");
        const stream = await navigator.mediaDevices.getUserMedia({ video: { width: 640, height: 480 } });
        videoRef.current.srcObject = stream;
        await new Promise((res, rej) => {
          videoRef.current.onloadedmetadata = () => { console.log(`[CORE_GPU_EFFECT] Video metadata: ${videoRef.current.videoWidth}x${videoRef.current.videoHeight}`); res(); };
          videoRef.current.onerror = () => rej(new Error("Video load error in core effect."));
        });
        await videoRef.current.play();
        console.log("[CORE_GPU_EFFECT] Video playback started within core effect.");

        const render = async () => {
          const dvc = deviceRef.current; const ctx = contextRef.current; const pState = pipelineStateRef.current; const lmrk = landmarker;
          if (!dvc || !ctx || !pState.videoPipeline || !videoRef.current) {
            animationFrameIdRef.current = requestAnimationFrame(render); return;
          }
          frameCounter.current++;
          if (videoRef.current.readyState < videoRef.current.HAVE_ENOUGH_DATA || videoRef.current.videoWidth === 0) {
            animationFrameIdRef.current = requestAnimationFrame(render); return;
          }
          const videoFrame = videoRef.current;
          if (frameCounter.current % 120 === 1) { console.log(`[RENDER] Video dims: ${videoFrame.videoWidth}x${videoFrame.videoHeight}`); }

          // Update Aspect Ratio Uniform Buffer
          if (pState.aspectRatioUniformBuffer && videoFrame.videoWidth > 0 && ctx.canvas.width > 0) {
            const aspectRatioData = new Float32Array([ videoFrame.videoWidth, videoFrame.videoHeight, ctx.canvas.width, ctx.canvas.height ]);
            dvc.queue.writeBuffer(pState.aspectRatioUniformBuffer, 0, aspectRatioData);
          }

          let numLipVertices = 0;
          if (lmrk) {
            try {
              const now = performance.now(); const results = lmrk.detectForVideo(videoFrame, now);
              if (results?.faceLandmarks?.length > 0) {
                const allFaceLandmarks = results.faceLandmarks[0];
                // if (allFaceLandmarks && frameCounter.current % 120 === 1) { /* landmark spread log */ }
                const lips = lipTriangles.map(([a,b,c]) => [allFaceLandmarks[a],allFaceLandmarks[b],allFaceLandmarks[c]]);
                const v = new Float32Array(lips.flat().map(pt => [(0.5-pt.x)*2, (0.5-pt.y)*2]).flat());
                numLipVertices = v.length/2;
                if(v.byteLength > 0 && pState.vertexBuffer) { if(v.byteLength <= pState.vertexBufferSize) dvc.queue.writeBuffer(pState.vertexBuffer,0,v); else numLipVertices=0; } else numLipVertices=0;
              } else numLipVertices = 0;
            } catch (e) { numLipVertices = 0; }
          }

          let videoTextureGPU, frameBindGroupForTexture; // Renamed to avoid confusion with aspectRatioBindGroup
          try {
            videoTextureGPU = dvc.importExternalTexture({ source: videoFrame });
            if (pState.videoBindGroupLayout && pState.videoSampler) {
              frameBindGroupForTexture = dvc.createBindGroup({ layout: pState.videoBindGroupLayout, entries: [{binding:0,resource:pState.videoSampler},{binding:1,resource:videoTextureGPU}]});
            } else { console.warn("Texture bind group layout or sampler missing"); animationFrameIdRef.current = requestAnimationFrame(render); return; }
          } catch (e) { animationFrameIdRef.current = requestAnimationFrame(render); return; }
          
          let texView;
          try { texView = ctx.getCurrentTexture().createView(); }
          catch(e) { console.error("[RENDER] Error getting current texture:", e); configureAndSizeCanvas(); animationFrameIdRef.current = requestAnimationFrame(render); return; }

          const cmdEnc = dvc.createCommandEncoder();
          const canvasPhysicalWidth = ctx.canvas.width; const canvasPhysicalHeight = ctx.canvas.height;
          const passEnc = cmdEnc.beginRenderPass({colorAttachments:[{view:texView,clearValue:{r:0.0,g:0.0,b:0.0,a:1.0},loadOp:'clear',storeOp:'store'}]}); // Clear BLACK
          passEnc.setViewport(0,0,canvasPhysicalWidth,canvasPhysicalHeight,0,1);
          passEnc.setScissorRect(0,0,canvasPhysicalWidth,canvasPhysicalHeight);
          // if (frameCounter.current % 120 === 1) { console.log(`[RENDER] Viewport&Scissor: 0,0,${canvasPhysicalWidth},${canvasPhysicalHeight}`); }
          
          if (pState.videoPipeline && frameBindGroupForTexture && pState.aspectRatioBindGroup) {
            passEnc.setPipeline(pState.videoPipeline);
            passEnc.setBindGroup(0, frameBindGroupForTexture); // Group 0 for texture/sampler
            passEnc.setBindGroup(1, pState.aspectRatioBindGroup); // Group 1 for aspect ratios
            passEnc.draw(6);
          } else { if (frameCounter.current % 60 === 1) { console.warn(`[RENDER] Skip video draw: Resources missing`); } }

          if(numLipVertices>0 && pState.lipstickPipeline && pState.vertexBuffer){
            passEnc.setPipeline(pState.lipstickPipeline); passEnc.setVertexBuffer(0,pState.vertexBuffer); passEnc.draw(numLipVertices);
          }
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
    return () => {
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

  useEffect(() => {
    if (isGpuReady && landmarker) { setDebugMessage("Live Tracking Active!"); console.log("[UI_MSG_EFFECT] All resources ready."); }
    else if (!isGpuReady && !landmarker) { setDebugMessage("Initializing All Systems..."); }
    else if (!isGpuReady) { setDebugMessage("Initializing GPU Systems..."); }
    else { setDebugMessage("Initializing Face Tracking..."); }
  }, [isGpuReady, landmarker]);

  return (
    <div style={{ width: '640px', height: '480px', margin: 'auto', border: '1px solid #ccc', position: 'relative', overflow: 'hidden' }}>
      <div style={{position:'absolute',top:'5px',left:'5px',background:'rgba(0,0,0,0.7)',color:'white',padding:'2px 5px',fontSize:'12px',zIndex:10,pointerEvents:'none'}}>
        {error ? `Error: ${error}` : debugMessage} (Frame: {frameCounter.current})
      </div>
      <video ref={videoRef} style={{position:'absolute',top:0,left:0,width:'100%',height:'100%',objectFit:'cover',opacity:0,pointerEvents:'none',zIndex:1}} width={640} height={480} autoPlay playsInline muted />
      <canvas ref={canvasRef} width={640} height={480} style={{position:'absolute',top:0,left:0,width:'100%',height:'100%',zIndex:2, background: 'lightpink'}} />
    </div>
  );
}