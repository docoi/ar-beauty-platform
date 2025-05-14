// src/pages/LipstickMirrorLive.jsx (STAGE 1: Re-integrate Video Background)

import React, { useEffect, useRef, useState } from 'react';
import createPipelines from '@/utils/createPipelines'; // Make sure this returns aspectRatioGroupLayout
import lipTriangles from '@/utils/lipTriangles'; // Not used yet in Stage 1 drawing
import { FaceLandmarker, FilesetResolver } from '@mediapipe/tasks-vision'; // Initialized but not yet used for drawing

export default function LipstickMirrorLive() {
  const canvasRef = useRef(null);
  const videoRef = useRef(null); 

  const deviceRef = useRef(null);
  const contextRef = useRef(null);
  const formatRef = useRef(null);
  const pipelineStateRef = useRef({ 
    videoPipeline: null,
    lipstickPipeline: null, // Will be created but not used for drawing yet
    videoBindGroupLayout: null,
    aspectRatioGroupLayout: null,
    aspectRatioUniformBuffer: null,
    aspectRatioBindGroup: null,
    videoSampler: null,
    vertexBuffer: null, // Will be created but not used for drawing yet
    vertexBufferSize: 2048,
  });
  const animationFrameIdRef = useRef(null);
  const resizeHandlerRef = useRef(null);

  const [landmarker, setLandmarker] = useState(null); // Landmarker will be initialized
  const [isGpuReady, setIsGpuReady] = useState(false);
  const [error, setError] = useState(null);
  const [debugMessage, setDebugMessage] = useState('Initializing...');
  const frameCounter = useRef(0);

  useEffect(() => {
    console.log("[MAIN_EFFECT] LipstickMirrorLive useEffect running (Stage 1: Video Background).");
    let device = null; let context = null; let format = null;
    let currentLandmarker = null; // For initializing landmarker
    let resizeObserver = null; let renderLoopStarted = false;
    const canvas = canvasRef.current;
    const videoElement = videoRef.current; // Get video element ref

    if (!canvas || !videoElement) { console.error("Canvas or Video element not found."); return; }

    const configureCanvas = (entries) => {
      if (!device || !context || !format) { console.warn("[configureCanvas] Prerequisites not met."); return; }
      if (entries) { console.log("[configureCanvas via ResizeObserver] Called."); } 
      else { console.log("[configureCanvas direct call] Called."); }
      const dpr = window.devicePixelRatio || 1;
      const cw = canvas.clientWidth; const ch = canvas.clientHeight;
      if (cw === 0 || ch === 0) { console.warn(`[configureCanvas] Canvas clientWidth/Height is zero.`); return; }
      const tw = Math.floor(cw * dpr); const th = Math.floor(ch * dpr);
      console.log(`[configureCanvas] DPR: ${dpr}, clientW: ${cw}, clientH: ${ch} => target phys: ${tw}x${th}`);
      if (canvas.width !== tw || canvas.height !== th) { canvas.width = tw; canvas.height = th; console.log(`[configureCanvas] Canvas buffer SET to: ${tw}x${th}`); }
      else { console.log(`[configureCanvas] Canvas size ${tw}x${th} already correct.`); }
      try { context.configure({ device, format, alphaMode: 'opaque', size: [canvas.width, canvas.height] }); console.log(`[configureCanvas] Context CONFIGURED. Size: ${canvas.width}x${canvas.height}`); }
      catch (e) { console.error("[configureCanvas] Error configuring context:", e); setError("Error configuring context."); }
    };
    resizeHandlerRef.current = configureCanvas;

    const render = () => {
      if (!device || !context || !pipelineStateRef.current.videoPipeline || !videoElement) { 
        animationFrameIdRef.current = requestAnimationFrame(render); return; 
      }
      frameCounter.current++;
      if (videoElement.readyState < videoElement.HAVE_ENOUGH_DATA || videoElement.videoWidth === 0) {
        animationFrameIdRef.current = requestAnimationFrame(render); return;
      }
      
      if (pipelineStateRef.current.aspectRatioUniformBuffer && videoElement.videoWidth > 0 && context.canvas.width > 0) {
        const aspectRatioData = new Float32Array([ videoElement.videoWidth, videoElement.videoHeight, context.canvas.width, context.canvas.height ]);
        device.queue.writeBuffer(pipelineStateRef.current.aspectRatioUniformBuffer, 0, aspectRatioData);
      }

      let videoTextureGPU, frameBindGroupForTexture;
      try {
        videoTextureGPU = device.importExternalTexture({ source: videoElement });
        if (pipelineStateRef.current.videoBindGroupLayout && pipelineStateRef.current.videoSampler) {
          frameBindGroupForTexture = device.createBindGroup({ layout: pipelineStateRef.current.videoBindGroupLayout, entries: [{binding:0,resource:pipelineStateRef.current.videoSampler},{binding:1,resource:videoTextureGPU}]});
        } else { animationFrameIdRef.current = requestAnimationFrame(render); return; }
      } catch (e) { console.error(`[RENDER ${frameCounter.current}] Error importing texture or creating bind group:`, e); animationFrameIdRef.current = requestAnimationFrame(render); return; }
      
      let currentGpuTexture, texView;
      try { currentGpuTexture = context.getCurrentTexture(); texView = currentGpuTexture.createView(); }
      catch(e) { console.error(`[RENDER ${frameCounter.current}] Error getting current texture:`, e); if(resizeHandlerRef.current) resizeHandlerRef.current(); animationFrameIdRef.current = requestAnimationFrame(render); return; }
      
      if (frameCounter.current < 5 || frameCounter.current % 120 === 1) { console.log(`[RENDER ${frameCounter.current}] Canvas attr: ${canvas.width}x${canvas.height}. GPUTexture: ${currentGpuTexture.width}x${currentGpuTexture.height}`); }
      
      const cmdEnc = device.createCommandEncoder({label: "MainRenderEncoder"});
      const passEnc = cmdEnc.beginRenderPass({ colorAttachments:[{ view: texView, clearValue: {r:0.0,g:0.0,b:0.0,a:1.0}, loadOp:'clear', storeOp:'store' }]}); // BLACK CLEAR
      passEnc.setViewport(0,0,currentGpuTexture.width, currentGpuTexture.height,0,1);
      passEnc.setScissorRect(0,0,currentGpuTexture.width, currentGpuTexture.height);
      
      // Draw video background
      if (pipelineStateRef.current.videoPipeline && frameBindGroupForTexture && pipelineStateRef.current.aspectRatioBindGroup) {
        passEnc.setPipeline(pipelineStateRef.current.videoPipeline);
        passEnc.setBindGroup(0, frameBindGroupForTexture); 
        passEnc.setBindGroup(1, pipelineStateRef.current.aspectRatioBindGroup);
        passEnc.draw(6);
      } else {
         if (frameCounter.current % 60 === 1) console.warn(`[RENDER ${frameCounter.current}] Skipping video draw: Missing resources.`);
      }
      
      // Lipstick drawing will be added in Stage 2
      passEnc.end();
      device.queue.submit([cmdEnc.finish()]);

      if(frameCounter.current === 1) { console.log(`[RENDER 1] First frame with video attempt.`); setDebugMessage("Live Video Active"); }
      animationFrameIdRef.current = requestAnimationFrame(render);
    };

    const initializeAll = async () => {
      if (!navigator.gpu) { console.error("WebGPU not supported."); setError("WebGPU not supported."); return; }
      setDebugMessage("Initializing All Systems...");
      try {
        // --- FaceLandmarker (Initialize but not used for drawing yet) ---
        console.log("[initializeAll] Initializing FaceLandmarker...");
        const vision = await FilesetResolver.forVisionTasks('https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm');
        const lm = await FaceLandmarker.createFromOptions(vision, {
          baseOptions: { modelAssetPath: '/models/face_landmarker.task', delegate: 'GPU' },
          outputFaceBlendshapes: false, runningMode: 'VIDEO', numFaces: 1,
        });
        currentLandmarker = lm; setLandmarker(lm);
        console.log("[initializeAll] FaceLandmarker ready.");

        // --- WebGPU Device & Format ---
        console.log("[initializeAll] Initializing WebGPU Device & Format...");
        const adapter = await navigator.gpu.requestAdapter();
        if (!adapter) { console.error("Failed to get GPU adapter."); setError("No GPU adapter."); return; }
        device = await adapter.requestDevice(); deviceRef.current = device;
        console.log("[initializeAll] Device obtained.");
        device.lost.then((info) => { console.error(`Device lost: ${info.message}`); setError("Device lost."); if(animationFrameIdRef.current) cancelAnimationFrame(animationFrameIdRef.current); deviceRef.current=null; contextRef.current=null; setIsGpuReady(false); setLandmarker(null);});
        context = canvas.getContext('webgpu'); contextRef.current = context;
        if (!context) { console.error("Failed to get context."); setError('No WebGPU context.'); return; }
        format = navigator.gpu.getPreferredCanvasFormat(); formatRef.current = format;
        console.log("[initializeAll] Context and Format obtained.");

        // --- Pipelines and GPU Resources ---
        console.log("[initializeAll] Creating pipelines and GPU resources...");
        const { videoPipeline, lipstickPipeline, videoBindGroupLayout, aspectRatioGroupLayout } = await createPipelines(device, format);
        pipelineStateRef.current.videoPipeline = videoPipeline;
        pipelineStateRef.current.lipstickPipeline = lipstickPipeline; // Created for Stage 2
        pipelineStateRef.current.videoBindGroupLayout = videoBindGroupLayout;
        pipelineStateRef.current.aspectRatioGroupLayout = aspectRatioGroupLayout;
        const uniformBufferSize = 4 * Float32Array.BYTES_PER_ELEMENT;
        pipelineStateRef.current.aspectRatioUniformBuffer = device.createBuffer({ size: uniformBufferSize, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST });
        if (aspectRatioGroupLayout && pipelineStateRef.current.aspectRatioUniformBuffer) {
            pipelineStateRef.current.aspectRatioBindGroup = device.createBindGroup({ layout: aspectRatioGroupLayout, entries: [{ binding: 0, resource: { buffer: pipelineStateRef.current.aspectRatioUniformBuffer }}]});
        }
        pipelineStateRef.current.videoSampler = device.createSampler({ magFilter: 'linear', minFilter: 'linear' });
        pipelineStateRef.current.vertexBuffer = device.createBuffer({ size: pipelineStateRef.current.vertexBufferSize, usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST }); // Created for Stage 2
        console.log("[initializeAll] Pipelines and GPU resources created.");
        
        // --- Video Element Setup ---
        console.log("[initializeAll] Setting up video element...");
        if (!navigator.mediaDevices?.getUserMedia) throw new Error("Camera not supported for video.");
        const stream = await navigator.mediaDevices.getUserMedia({ video: { width: 640, height: 480 } });
        videoElement.srcObject = stream;
        await new Promise((res, rej) => {
          videoElement.onloadedmetadata = () => { console.log(`[initializeAll] Video metadata: ${videoElement.videoWidth}x${videoElement.videoHeight}`); res(); };
          videoElement.onerror = () => rej(new Error("Video load error."));
        });
        await videoElement.play();
        console.log("[initializeAll] Video playback started.");
        
        resizeObserver = new ResizeObserver(resizeHandlerRef.current);
        resizeObserver.observe(canvas);
        console.log("[initializeAll] ResizeObserver observing canvas.");
        console.log("[initializeAll] Calling initial configureCanvas.");
        resizeHandlerRef.current(); 
        
        setIsGpuReady(true);
        console.log("[initializeAll] All systems Initialized. GPU Core is Ready.");

        if (!renderLoopStarted) { console.log("[initializeAll] Starting render loop."); render(); renderLoopStarted = true; }
        // setDebugMessage("Live Tracking Active!"); // Set by UI_MSG_EFFECT
      } catch (err) { console.error("[initializeAll] Major error during initialization:", err); setError(`Init failed: ${err.message}`); setDebugMessage("Initialization Error."); setIsGpuReady(false);}
    };
    initializeAll();
    return () => { /* ... cleanup as before ... */
        console.log("[MAIN_EFFECT_CLEANUP] Cleaning up.");
        if (animationFrameIdRef.current) cancelAnimationFrame(animationFrameIdRef.current);
        if (resizeObserver && canvasRef.current) resizeObserver.unobserve(canvasRef.current);
        videoRef.current?.srcObject?.getTracks().forEach(track => track.stop());
        if(videoRef.current) videoRef.current.srcObject = null;
        const dvc = deviceRef.current;
        if (dvc) {
            pipelineStateRef.current.vertexBuffer?.destroy();
            pipelineStateRef.current.aspectRatioUniformBuffer?.destroy();
        }
        deviceRef.current = null; contextRef.current = null; formatRef.current = null; 
        setLandmarker(null); setIsGpuReady(false);
        console.log("[MAIN_EFFECT_CLEANUP] Finished.");
    };
  }, []);

  const allResourcesReady = !!(landmarker && isGpuReady && deviceRef.current && contextRef.current && pipelineStateRef.current.videoPipeline);

  useEffect(() => {
    if(allResourcesReady) { console.log("[UI_MSG_EFFECT] All resources ready for video."); setDebugMessage("Live Video Feed");}
    else { setDebugMessage("Initializing Video Feed...");}
  }, [allResourcesReady]);

  return (
    <div style={{ width: '640px', height: '480px', margin: 'auto', border: '1px solid #ccc', position: 'relative', overflow: 'hidden' }}> {/* Restored original parent div */}
      <div style={{position:'absolute',top:'5px',left:'5px',background:'rgba(0,0,0,0.7)',color:'white',padding:'2px 5px',fontSize:'12px',zIndex:10,pointerEvents:'none'}}>
        {error ? `Error: ${error}` : debugMessage} (Frame: {frameCounter.current})
      </div>
      <video ref={videoRef} style={{position:'absolute',top:0,left:0,width:'100%',height:'100%',objectFit:'cover',opacity:0,pointerEvents:'none',zIndex:1}} width={640} height={480} autoPlay playsInline muted />
      <canvas ref={canvasRef} width={640} height={480} style={{position:'absolute',top:0,left:0,width:'100%',height:'100%',zIndex:2, background: 'lightpink'}} />
    </div>
  );
}