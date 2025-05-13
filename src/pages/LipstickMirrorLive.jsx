// src/pages/LipstickMirrorLive.jsx (Refactored based on successful TestWebGPUCanvas pattern)

import React, { useEffect, useRef, useState } from 'react';
// We will no longer use a separate initWebGPU util for core setup, to mirror TestWebGPUCanvas more closely
import createPipelines from '@/utils/createPipelines';
import lipTriangles from '@/utils/lipTriangles';
import { FaceLandmarker, FilesetResolver } from '@mediapipe/tasks-vision';

export default function LipstickMirrorLive() {
  const canvasRef = useRef(null);
  const videoRef = useRef(null);

  // --- Refs to hold WebGPU and other persistent objects ---
  const deviceRef = useRef(null);
  const contextRef = useRef(null);
  const formatRef = useRef(null); // To store preferred canvas format
  const pipelineStateRef = useRef({ // For pipelines and related resources
    videoPipeline: null,
    lipstickPipeline: null,
    videoBindGroupLayout: null,
    videoSampler: null,
    vertexBuffer: null,
    vertexBufferSize: 2048, // Initial size
  });
  const animationFrameIdRef = useRef(null);
  const resizeHandlerRef = useRef(null); // For storing the resize handler function

  // --- React State ---
  const [landmarker, setLandmarker] = useState(null);
  const [isGpuReady, setIsGpuReady] = useState(false); // True when device, context, pipelines are ready
  const [error, setError] = useState(null);
  const [debugMessage, setDebugMessage] = useState('Initializing...');
  const frameCounter = useRef(0);


  // Effect 1: Initialize FaceLandmarker (Runs once)
  useEffect(() => {
    const initLandmarker = async () => {
      try {
        console.log("[LM_EFFECT] Initializing FaceLandmarker...");
        const vision = await FilesetResolver.forVisionTasks('https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm');
        const lm = await FaceLandmarker.createFromOptions(vision, {
          baseOptions: { modelAssetPath: '/models/face_landmarker.task', delegate: 'GPU' },
          outputFaceBlendshapes: false, runningMode: 'VIDEO', numFaces: 1,
        });
        setLandmarker(lm); // Triggers re-render, allResourcesReady will be checked
        console.log("[LM_EFFECT] FaceLandmarker ready.");
      } catch (err) { console.error("[LM_EFFECT] Error initializing FaceLandmarker:", err); setError(`LM init failed: ${err.message}`); setDebugMessage("Error."); }
    };
    initLandmarker();
  }, []);


  // Effect 2: Core WebGPU Initialization, Canvas Sizing, Context Config, Pipelines, and Render Loop Setup
  useEffect(() => {
    console.log("[CORE_GPU_EFFECT] useEffect running.");
    const canvas = canvasRef.current;
    if (!canvas) {
      console.error("[CORE_GPU_EFFECT] Canvas element not found at effect run.");
      return; // Should not happen if ref is attached
    }

    let currentDevice = null; // Temp var for setup

    const initializeWebGPUAndRun = async () => {
      if (!navigator.gpu) {
        console.error('WebGPU not supported.'); setError('WebGPU not supported.'); return;
      }
      try {
        const adapter = await navigator.gpu.requestAdapter();
        if (!adapter) { console.error('Failed to get GPU adapter.'); setError('No GPU adapter.'); return; }
        console.log("[CORE_GPU_EFFECT] Adapter obtained.");

        currentDevice = await adapter.requestDevice();
        deviceRef.current = currentDevice; // Store in ref
        console.log("[CORE_GPU_EFFECT] Device obtained:", currentDevice);

        currentDevice.lost.then((info) => {
          console.error(`[DEVICE_LOST_HANDLER] WebGPU device lost: ${info.message}`);
          setError(`Device lost: ${info.message}. Please refresh.`);
          if (animationFrameIdRef.current) cancelAnimationFrame(animationFrameIdRef.current);
          animationFrameIdRef.current = null; deviceRef.current = null; contextRef.current = null; setIsGpuReady(false);
        });
        
        const context = canvas.getContext('webgpu');
        if (!context) { console.error("Failed to get context."); setError('No WebGPU context.'); return; }
        contextRef.current = context; // Store in ref
        console.log("[CORE_GPU_EFFECT] Context obtained.");

        formatRef.current = navigator.gpu.getPreferredCanvasFormat();
        console.log("[CORE_GPU_EFFECT] Preferred format:", formatRef.current);

        // Define configureAndSizeCanvas within this scope
        const configureAndSizeCanvas = () => {
          console.log("[configureAndSizeCanvas] Called.");
          const dvc = deviceRef.current; // Use from ref
          const ctx = contextRef.current; // Use from ref
          const fmt = formatRef.current; // Use from ref
          const cnvs = canvasRef.current; // Use from ref

          if (!dvc || !ctx || !fmt || !cnvs) {
            console.error("[configureAndSizeCanvas] Missing core refs for configuration."); return;
          }
          const dpr = window.devicePixelRatio || 1;
          const displayWidth = Math.floor(cnvs.clientWidth * dpr);
          const displayHeight = Math.floor(cnvs.clientHeight * dpr);
          console.log(`[configureAndSizeCanvas] DPR: ${dpr}, clientW/H: ${cnvs.clientWidth}x${cnvs.clientHeight} => physical: ${displayWidth}x${displayHeight}`);

          if (cnvs.width !== displayWidth || cnvs.height !== displayHeight) {
            cnvs.width = displayWidth; cnvs.height = displayHeight;
            console.log(`[configureAndSizeCanvas] Canvas buffer SET to: ${cnvs.width}x${cnvs.height}`);
          } else {
            console.log(`[configureAndSizeCanvas] Canvas buffer size already matches: ${cnvs.width}x${cnvs.height}`);
          }
          try {
            ctx.configure({ device: dvc, format: fmt, alphaMode: 'opaque', size: [cnvs.width, cnvs.height] });
            console.log(`[configureAndSizeCanvas] Context CONFIGURED. Size: ${cnvs.width}x${cnvs.height}`);
          } catch (e) { console.error("[configureAndSizeCanvas] Error configuring context:", e); setError("Error configuring context."); }
        };
        
        resizeHandlerRef.current = configureAndSizeCanvas; // Store for removal
        configureAndSizeCanvas(); // Initial call
        window.addEventListener('resize', resizeHandlerRef.current);
        console.log("[CORE_GPU_EFFECT] Initial canvas config done. Resize listener added.");

        // Create pipelines and other resources
        const pipes = await createPipelines(currentDevice, formatRef.current);
        pipelineStateRef.current.videoPipeline = pipes.videoPipeline;
        pipelineStateRef.current.lipstickPipeline = pipes.lipstickPipeline;
        pipelineStateRef.current.videoBindGroupLayout = pipes.videoBindGroupLayout;
        console.log("[CORE_GPU_EFFECT] Pipelines created and stored in ref.");

        pipelineStateRef.current.videoSampler = currentDevice.createSampler({ magFilter: 'linear', minFilter: 'linear' });
        pipelineStateRef.current.vertexBuffer = currentDevice.createBuffer({
          size: pipelineStateRef.current.vertexBufferSize,
          usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
        });
        console.log("[CORE_GPU_EFFECT] Sampler and Vertex Buffer created.");

        setIsGpuReady(true); // Signal that core GPU setup is complete
        console.log("[CORE_GPU_EFFECT] GPU Core is Ready. isGpuReady set to true.");

        // --- Start Video Stream ---
        if (!videoRef.current) { console.error("Video ref missing for stream setup"); return;}
        if (!navigator.mediaDevices?.getUserMedia) throw new Error("Camera not supported for video.");
        const stream = await navigator.mediaDevices.getUserMedia({ video: { width: 640, height: 480 } });
        videoRef.current.srcObject = stream;
        await new Promise((res, rej) => {
          videoRef.current.onloadedmetadata = () => { console.log(`[CORE_GPU_EFFECT] Video metadata: ${videoRef.current.videoWidth}x${videoRef.current.videoHeight}`); res(); };
          videoRef.current.onerror = () => rej(new Error("Video load error in core effect."));
        });
        await videoRef.current.play();
        console.log("[CORE_GPU_EFFECT] Video playback started within core effect.");


        // --- Render Loop ---
        const render = async () => {
          const dvc = deviceRef.current;
          const ctx = contextRef.current;
          const pState = pipelineStateRef.current;
          const lmrk = landmarker; // Use landmarker from state captured by this outer scope

          if (!dvc || !ctx || !pState.videoPipeline || !videoRef.current) {
            // console.warn(`[RENDER ${frameCounter.current}] Missing critical resources. Device: ${!!dvc}, Context: ${!!ctx}, VideoPipe: ${!!pState.videoPipeline}, VideoRef: ${!!videoRef.current}`);
            animationFrameIdRef.current = requestAnimationFrame(render); // Keep trying
            return;
          }
          frameCounter.current++;

          if (videoRef.current.readyState < videoRef.current.HAVE_ENOUGH_DATA || videoRef.current.videoWidth === 0) {
            animationFrameIdRef.current = requestAnimationFrame(render); return;
          }
          const videoFrame = videoRef.current;
          if (frameCounter.current % 120 === 1) { console.log(`[RENDER] Video dims for MediaPipe: ${videoFrame.videoWidth}x${videoFrame.videoHeight}`); }

          let numLipVertices = 0;
          if (lmrk) { // Check if landmarker is ready
            try {
              const now = performance.now();
              const results = lmrk.detectForVideo(videoFrame, now);
              if (results?.faceLandmarks?.length > 0) {
                // ... (landmark processing)
                const allFaceLandmarks = results.faceLandmarks[0];
                // if (allFaceLandmarks && frameCounter.current % 120 === 1) { /* landmark spread log */ }
                const lips = lipTriangles.map(([a,b,c]) => [allFaceLandmarks[a],allFaceLandmarks[b],allFaceLandmarks[c]]);
                const v = new Float32Array(lips.flat().map(pt => [(0.5-pt.x)*2, (0.5-pt.y)*2]).flat());
                numLipVertices = v.length/2;
                if(v.byteLength > 0 && pState.vertexBuffer) { if(v.byteLength <= pState.vertexBufferSize) dvc.queue.writeBuffer(pState.vertexBuffer,0,v); else numLipVertices=0; } else numLipVertices=0;
              } else numLipVertices = 0;
            } catch (e) { numLipVertices = 0; }
          }

          let videoTextureGPU, frameBindGroup;
          try {
            videoTextureGPU = dvc.importExternalTexture({ source: videoFrame });
            if (pState.videoBindGroupLayout && pState.videoSampler) {
              frameBindGroup = dvc.createBindGroup({ layout: pState.videoBindGroupLayout, entries: [{binding:0,resource:pState.videoSampler},{binding:1,resource:videoTextureGPU}]});
            } else { console.warn("Bind group layout or sampler missing"); animationFrameIdRef.current = requestAnimationFrame(render); return; }
          } catch (e) { animationFrameIdRef.current = requestAnimationFrame(render); return; }
          
          let texView;
          try {
            texView = ctx.getCurrentTexture().createView();
          } catch(e) {
            console.error("[RENDER] Error getting current texture, attempting reconfigure:", e);
            configureAndSizeCanvas(); // Attempt to recover
            animationFrameIdRef.current = requestAnimationFrame(render); return;
          }

          const cmdEnc = dvc.createCommandEncoder();
          const canvasPhysicalWidth = ctx.canvas.width;
          const canvasPhysicalHeight = ctx.canvas.height;
          const passEnc = cmdEnc.beginRenderPass({colorAttachments:[{view:texView,clearValue:{r:0.0,g:0.0,b:1.0,a:1.0},loadOp:'clear',storeOp:'store'}]});
          passEnc.setViewport(0,0,canvasPhysicalWidth,canvasPhysicalHeight,0,1);
          passEnc.setScissorRect(0,0,canvasPhysicalWidth,canvasPhysicalHeight);
          // if (frameCounter.current % 120 === 1) { console.log(`[RENDER] Viewport&Scissor: 0,0,${canvasPhysicalWidth},${canvasPhysicalHeight}`); }
          
          if (pState.videoPipeline && frameBindGroup) {
            passEnc.setPipeline(pState.videoPipeline); passEnc.setBindGroup(0,frameBindGrup); passEnc.draw(6);
          }
          if(numLipVertices>0 && pState.lipstickPipeline && pState.vertexBuffer){
            passEnc.setPipeline(pState.lipstickPipeline); passEnc.setVertexBuffer(0,pState.vertexBuffer); passEnc.draw(numLipVertices);
          }
          passEnc.end();
          dvc.queue.submit([cmdEnc.finish()]);

          if(frameCounter.current === 1) { console.log(`[RENDER 1] First frame drawn (blue screen).`); setDebugMessage("Live Tracking Active!"); }
          animationFrameIdRef.current = requestAnimationFrame(render);
        }; // End of render function

        console.log("[CORE_GPU_EFFECT] Starting render loop.");
        animationFrameIdRef.current = requestAnimationFrame(render); // Start the loop

      } catch (error) {
        console.error('[CORE_GPU_EFFECT] Error during WebGPU Initialization:', error);
        setError(`WebGPU Init failed: ${error.message}`);
        setIsGpuReady(false);
      }
    };

    initializeWebGPUAndRun();

    // Cleanup for the CORE_GPU_EFFECT
    return () => {
      console.log("[CORE_GPU_EFFECT_CLEANUP] Cleaning up core GPU resources, animation frame, and listener.");
      if (animationFrameIdRef.current) {
        cancelAnimationFrame(animationFrameIdRef.current);
        animationFrameIdRef.current = null;
      }
      if (resizeHandlerRef.current) {
        window.removeEventListener('resize', resizeHandlerRef.current);
        resizeHandlerRef.current = null;
      }
      // Stop video tracks
      const stream = videoRef.current?.srcObject;
      if (stream?.getTracks) { stream.getTracks().forEach(track => track.stop()); }
      if(videoRef.current) videoRef.current.srcObject = null;

      // Destroy device-specific resources if device exists
      const dvc = deviceRef.current;
      if (dvc) {
        pipelineStateRef.current.vertexBuffer?.destroy();
        // Pipelines, samplers, layouts don't have explicit destroy methods usually
      }
      deviceRef.current = null;
      contextRef.current = null;
      setIsGpuReady(false); // Reset readiness state
      console.log("[CORE_GPU_EFFECT_CLEANUP] Cleanup finished.");
    };
  }, []); // Main effect runs once on mount


  // UI Message Effect (triggered by isGpuReady and landmarker)
  useEffect(() => {
    if (isGpuReady && landmarker) {
      setDebugMessage("Live Tracking Active!");
      console.log("[UI_MSG_EFFECT] All resources ready. UI message set to 'Live Tracking Active!'.");
    } else if (!isGpuReady && !landmarker) {
      setDebugMessage("Initializing All Systems...");
    } else if (!isGpuReady) {
      setDebugMessage("Initializing GPU Systems...");
    } else { // !landmarker
      setDebugMessage("Initializing Face Tracking...");
    }
  }, [isGpuReady, landmarker]);

  // Log allResourcesReady for debugging (optional)
  // const allResourcesReadyForRender = isGpuReady && landmarker;
  // console.log('[COMPONENT_BODY_RENDER] allResourcesReadyForRender:', allResourcesReadyForRender);

  return (
    <div style={{ width: '640px', height: '480px', margin: 'auto', border: '1px solid #ccc', position: 'relative', overflow: 'hidden' }}>
      <div style={{position:'absolute',top:'5px',left:'5px',background:'rgba(0,0,0,0.7)',color:'white',padding:'2px 5px',fontSize:'12px',zIndex:10,pointerEvents:'none'}}>
        {error ? `Error: ${error}` : debugMessage} (Frame: {frameCounter.current})
      </div>
      <video ref={videoRef} style={{position:'absolute',top:0,left:0,width:'100%',height:'100%',objectFit:'cover',opacity:0,pointerEvents:'none',zIndex:1}} width={640} height={480} autoPlay playsInline muted />
      <canvas ref={canvasRef} width={640} height={480} style={{position:'absolute',top:0,left:0,width:'100%',height:'100%',zIndex:2, background: 'lightpink'}} /> {/* Added lightpink for canvas visibility */}
    </div>
  );
}