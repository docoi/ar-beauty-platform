// src/pages/LipstickMirrorLive.jsx (Applying successful TestWebGPUCanvas pattern)

import React, { useEffect, useRef, useState } from 'react';
import createPipelines from '@/utils/createPipelines'; // Assumes this returns aspectRatioGroupLayout
import lipTriangles from '@/utils/lipTriangles';
import { FaceLandmarker, FilesetResolver } from '@mediapipe/tasks-vision';

export default function LipstickMirrorLive() {
  const canvasRef = useRef(null);
  const videoRef = useRef(null);

  // --- Refs for WebGPU objects and other persistent data ---
  const deviceRef = useRef(null);
  const contextRef = useRef(null);
  const formatRef = useRef(null);
  const pipelineStateRef = useRef({
    videoPipeline: null,
    lipstickPipeline: null,
    videoBindGroupLayout: null,
    aspectRatioGroupLayout: null,
    aspectRatioUniformBuffer: null,
    aspectRatioBindGroup: null,
    videoSampler: null,
    vertexBuffer: null,
    vertexBufferSize: 2048,
  });
  const animationFrameIdRef = useRef(null);
  const resizeHandlerRef = useRef(null); // To store the configureCanvas function for removeEventListener

  // --- React State ---
  const [landmarker, setLandmarker] = useState(null); // For MediaPipe
  const [error, setError] = useState(null);
  const [debugMessage, setDebugMessage] = useState('Initializing...');
  const frameCounter = useRef(0); // For UI display and occasional logging

  useEffect(() => {
    console.log("[MAIN_EFFECT] LipstickMirrorLive useEffect running.");

    // --- Local variables within useEffect's async setup ---
    // These are assigned during initialization and then copied to refs if needed by render/configure closures.
    // However, render and configureCanvas will be defined within initializeAll's scope,
    // so they can close over these directly.
    let device = null; 
    let context = null;
    let format = null;
    let currentLandmarker = null; // Local landmarker instance
    let resizeObserver = null;
    let renderLoopStarted = false;

    const canvas = canvasRef.current;
    const videoElement = videoRef.current;

    if (!canvas || !videoElement) {
      console.error("[MAIN_EFFECT] Canvas or Video element not available on mount.");
      setError("Canvas or Video element not found.");
      return;
    }

    // --- Canvas Sizing and Context Configuration ---
    const configureCanvas = (entries) => {
      if (!device || !context || !format) { // Use local device, context, format
        console.warn("[configureCanvas] Prerequisites (device, context, format) not met. Skipping.");
        return;
      }
      if (!canvasRef.current) { // Should always exist if effect runs
          console.error("[configureCanvas] CanvasRef.current is null!"); return;
      }

      if (entries) { console.log("[configureCanvas via ResizeObserver] Called."); } 
      else { console.log("[configureCanvas direct call] Called."); }
      
      const dpr = window.devicePixelRatio || 1;
      const currentClientWidth = canvasRef.current.clientWidth;
      const currentClientHeight = canvasRef.current.clientHeight;

      if (currentClientWidth === 0 || currentClientHeight === 0) {
        console.warn(`[configureCanvas] Canvas clientWidth/Height is zero. W: ${currentClientWidth}, H: ${currentClientHeight}. Deferring config.`);
        return; // Avoid configuring with 0x0 size, ResizeObserver will try again
      }
      const targetWidth = Math.floor(currentClientWidth * dpr);
      const targetHeight = Math.floor(currentClientHeight * dpr);
      console.log(`[configureCanvas] DPR: ${dpr}, clientW: ${currentClientWidth}, clientH: ${currentClientHeight} => target phys: ${targetWidth}x${targetHeight}`);

      if (canvasRef.current.width !== targetWidth || canvasRef.current.height !== targetHeight) {
        canvasRef.current.width = targetWidth;
        canvasRef.current.height = targetHeight;
        console.log(`[configureCanvas] Canvas buffer size SET to: ${canvasRef.current.width}x${canvasRef.current.height}`);
      } else {
        console.log(`[configureCanvas] Canvas size ${canvasRef.current.width}x${canvasRef.current.height} already correct.`);
      }
      
      try {
        context.configure({ device, format, alphaMode: 'opaque', size: [canvasRef.current.width, canvasRef.current.height] });
        console.log(`[configureCanvas] Context configured with size: ${canvasRef.current.width}x${canvasRef.current.height}`);
      } catch (e) { console.error("[configureCanvas] Error configuring context:", e); setError("Error configuring WebGPU context."); }
    };
    resizeHandlerRef.current = configureCanvas; // Store for removal by cleanup


    // --- Render Loop ---
    const render = async () => {
      // Use device, context, landmarker directly from the closure of initializeAll
      if (!device || !context || !pipelineStateRef.current.videoPipeline || !videoElement) {
        animationFrameIdRef.current = requestAnimationFrame(render); return;
      }
      frameCounter.current++;

      if (videoElement.readyState < videoElement.HAVE_ENOUGH_DATA || videoElement.videoWidth === 0) {
        animationFrameIdRef.current = requestAnimationFrame(render); return;
      }
      
      // Update Aspect Ratio Uniform Buffer
      if (pipelineStateRef.current.aspectRatioUniformBuffer && videoElement.videoWidth > 0 && context.canvas.width > 0) {
        const aspectRatioData = new Float32Array([ videoElement.videoWidth, videoElement.videoHeight, context.canvas.width, context.canvas.height ]);
        device.queue.writeBuffer(pipelineStateRef.current.aspectRatioUniformBuffer, 0, aspectRatioData);
      }

      let numLipVertices = 0;
      if (currentLandmarker) { // Use local currentLandmarker
        try {
          const now = performance.now(); const results = currentLandmarker.detectForVideo(videoElement, now);
          if (results?.faceLandmarks?.length > 0) {
            const allFaceLm = results.faceLandmarks[0];
            // if (allFaceLm && frameCounter.current % 120 === 1) { /* landmark spread log */ }
            const lips = lipTriangles.map(([a,b,c]) => [allFaceLm[a],allFaceLm[b],allFaceLm[c]]);
            const v = new Float32Array(lips.flat().map(pt => [(0.5-pt.x)*2, (0.5-pt.y)*2]).flat());
            numLipVertices = v.length/2;
            if(v.byteLength > 0 && pipelineStateRef.current.vertexBuffer){ if(v.byteLength <= pipelineStateRef.current.vertexBufferSize) device.queue.writeBuffer(pipelineStateRef.current.vertexBuffer,0,v); else numLipVertices=0;} else numLipVertices=0;
          } else numLipVertices = 0;
        } catch (e) { numLipVertices = 0; }
      }

      let videoTextureGPU, frameBindGroupForTexture;
      try {
        videoTextureGPU = device.importExternalTexture({ source: videoElement });
        if (pipelineStateRef.current.videoBindGroupLayout && pipelineStateRef.current.videoSampler) {
          frameBindGroupForTexture = device.createBindGroup({ layout: pipelineStateRef.current.videoBindGroupLayout, entries: [{binding:0,resource:pipelineStateRef.current.videoSampler},{binding:1,resource:videoTextureGPU}]});
        } else { animationFrameIdRef.current = requestAnimationFrame(render); return; }
      } catch (e) { animationFrameIdRef.current = requestAnimationFrame(render); return; }
      
      let currentGpuTexture, texView;
      try { currentGpuTexture = context.getCurrentTexture(); texView = currentGpuTexture.createView(); }
      catch(e) { console.error(`[RENDER ${frameCounter.current}] Error getting current texture:`, e); if(resizeHandlerRef.current) resizeHandlerRef.current(); animationFrameIdRef.current = requestAnimationFrame(render); return; }
      
      // if (frameCounter.current < 5 || frameCounter.current % 120 === 1) { console.log(`[RENDER ${frameCounter.current}] Canvas attr: ${canvas.width}x${canvas.height}. GPUTexture: ${currentGpuTexture.width}x${currentGpuTexture.height}`); }

      const cmdEnc = device.createCommandEncoder();
      const passEnc = cmdEnc.beginRenderPass({colorAttachments:[{view:texView,clearValue:{r:0.0,g:0.0,b:0.0,a:1.0},loadOp:'clear',storeOp:'store'}]}); // Clear BLACK
      passEnc.setViewport(0,0,currentGpuTexture.width,currentGpuTexture.height,0,1);
      passEnc.setScissorRect(0,0,currentGpuTexture.width,currentGpuTexture.height);
      // if (frameCounter.current % 120 === 1) { console.log(`[RENDER] Viewport&Scissor set to full texture`); }
      
      if (pipelineStateRef.current.videoPipeline && frameBindGroupForTexture && pipelineStateRef.current.aspectRatioBindGroup) {
        passEnc.setPipeline(pipelineStateRef.current.videoPipeline);
        passEnc.setBindGroup(0, frameBindGroupForTexture); passEnc.setBindGroup(1, pipelineStateRef.current.aspectRatioBindGroup);
        passEnc.draw(6);
      }
      if(numLipVertices>0 && pipelineStateRef.current.lipstickPipeline && pipelineStateRef.current.vertexBuffer){
        passEnc.setPipeline(pipelineStateRef.current.lipstickPipeline); passEnc.setVertexBuffer(0,pipelineStateRef.current.vertexBuffer); passEnc.draw(numLipVertices);
      }
      passEnc.end();
      device.queue.submit([cmdEnc.finish()]);

      if(frameCounter.current === 1) { console.log(`[RENDER 1] First full frame drawn (video+lips).`); }
      animationFrameIdRef.current = requestAnimationFrame(render);
    }; // End of render function


    // --- Main Initialization Function ---
    const initializeAll = async () => {
      if (!navigator.gpu) { console.error("WebGPU not supported."); setError("WebGPU not supported."); return; }
      setDebugMessage("Initializing Systems...");
      try {
        // --- MediaPipe Landmarker ---
        console.log("[initializeAll] Initializing FaceLandmarker...");
        const vision = await FilesetResolver.forVisionTasks('https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm');
        const lm = await FaceLandmarker.createFromOptions(vision, {
          baseOptions: { modelAssetPath: '/models/face_landmarker.task', delegate: 'GPU' },
          outputFaceBlendshapes: false, runningMode: 'VIDEO', numFaces: 1,
        });
        currentLandmarker = lm; // Assign to local variable
        setLandmarker(lm); // Also update state for any UI dependent on it
        console.log("[initializeAll] FaceLandmarker ready.");

        // --- WebGPU Device & Format ---
        console.log("[initializeAll] Initializing WebGPU Device & Format...");
        const adapter = await navigator.gpu.requestAdapter();
        if (!adapter) { console.error("Failed to get GPU adapter."); setError("No GPU adapter."); return; }
        device = await adapter.requestDevice(); // Assign to local `device`
        deviceRef.current = device; // Store in ref for potential access outside this effect's async flow (e.g. cleanup)
        console.log("[initializeAll] Device obtained.");
        device.lost.then((info) => {
            console.error(`[DEVICE_LOST_HANDLER] WebGPU device lost: ${info.message}`);
            setError(`Device lost.`); setDebugMessage("Error: Device Lost.");
            if (animationFrameIdRef.current) cancelAnimationFrame(animationFrameIdRef.current);
            deviceRef.current = null; contextRef.current = null; currentLandmarker = null; setLandmarker(null);
        });
        context = canvas.getContext('webgpu'); // Assign to local `context`
        if (!context) { console.error("Failed to get context."); setError('No WebGPU context.'); return; }
        contextRef.current = context;
        format = navigator.gpu.getPreferredCanvasFormat(); // Assign to local `format`
        formatRef.current = format;
        console.log("[initializeAll] Context and Format obtained.");

        // --- Pipelines and GPU Resources ---
        console.log("[initializeAll] Creating pipelines and GPU resources...");
        const { videoPipeline, lipstickPipeline, videoBindGroupLayout, aspectRatioGroupLayout } = await createPipelines(device, format);
        pipelineStateRef.current.videoPipeline = videoPipeline;
        pipelineStateRef.current.lipstickPipeline = lipstickPipeline;
        pipelineStateRef.current.videoBindGroupLayout = videoBindGroupLayout;
        pipelineStateRef.current.aspectRatioGroupLayout = aspectRatioGroupLayout;
        const uniformBufferSize = 4 * Float32Array.BYTES_PER_ELEMENT;
        pipelineStateRef.current.aspectRatioUniformBuffer = device.createBuffer({ size: uniformBufferSize, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST });
        if (aspectRatioGroupLayout && pipelineStateRef.current.aspectRatioUniformBuffer) {
            pipelineStateRef.current.aspectRatioBindGroup = device.createBindGroup({ layout: aspectRatioGroupLayout, entries: [{ binding: 0, resource: { buffer: pipelineStateRef.current.aspectRatioUniformBuffer }}]});
        }
        pipelineStateRef.current.videoSampler = device.createSampler({ magFilter: 'linear', minFilter: 'linear' });
        pipelineStateRef.current.vertexBuffer = device.createBuffer({ size: pipelineStateRef.current.vertexBufferSize, usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST });
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

        // --- Setup ResizeObserver and Initial Canvas/Context Configuration ---
        resizeObserver = new ResizeObserver(resizeHandlerRef.current); // Use stored handler
        resizeObserver.observe(canvas);
        console.log("[initializeAll] ResizeObserver observing canvas.");
        console.log("[initializeAll] Calling initial configureCanvas.");
        resizeHandlerRef.current(); // Call the stored configureCanvas

        // --- Start Render Loop ---
        if (!renderLoopStarted) {
            console.log("[initializeAll] Starting render loop.");
            render(); 
            renderLoopStarted = true;
        }
        setDebugMessage("Live Tracking Active!"); // Set after all init is successful

      } catch (err) {
        console.error("[initializeAll] Major error during initialization:", err);
        setError(`Initialization failed: ${err.message}`);
        setDebugMessage("Initialization Error.");
      }
    };

    initializeAll(); // Call the main async setup function

    // Cleanup for the main useEffect
    return () => {
      console.log("[MAIN_EFFECT_CLEANUP] Cleaning up all resources.");
      if (animationFrameIdRef.current) cancelAnimationFrame(animationFrameIdRef.current);
      if (resizeObserver && canvasRef.current) resizeObserver.unobserve(canvasRef.current); // More specific
      if (resizeHandlerRef.current) window.removeEventListener('resize', resizeHandlerRef.current); // Though ResizeObserver is primary

      videoRef.current?.srcObject?.getTracks().forEach(track => track.stop());
      if(videoRef.current) videoRef.current.srcObject = null;
      
      const dvc = deviceRef.current; // Use ref for cleanup
      if (dvc) {
        pipelineStateRef.current.vertexBuffer?.destroy();
        pipelineStateRef.current.aspectRatioUniformBuffer?.destroy();
        // Other resources like pipelines, layouts, samplers are typically not destroyed explicitly.
        // device.destroy(); // Optionally destroy device if component is truly unmounting permanently
      }
      deviceRef.current = null; contextRef.current = null; formatRef.current = null;
      currentLandmarker = null; setLandmarker(null); // Clear local and state landmarker
      console.log("[MAIN_EFFECT_CLEANUP] Finished.");
    };
  }, []); // Main effect runs once on mount

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