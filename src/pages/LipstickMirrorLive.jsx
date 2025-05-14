// src/pages/LipstickMirrorLive.jsx (Corrected FaceLandmarker options, aiming for full video)

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
  const pipelineStateRef = useRef({
    videoPipeline: null, lipstickPipeline: null, videoBindGroupLayout: null,
    aspectRatioGroupLayout: null, aspectRatioUniformBuffer: null, aspectRatioBindGroup: null,
    videoSampler: null, vertexBuffer: null, vertexBufferSize: 2048,
  });
  const animationFrameIdRef = useRef(null);
  const resizeHandlerRef = useRef(null);

  const [landmarker, setLandmarker] = useState(null);
  const [error, setError] = useState(null);
  const [debugMessage, setDebugMessage] = useState('Initializing...');
  const frameCounter = useRef(0);

  useEffect(() => {
    console.log("[MAIN_EFFECT] LipstickMirrorLive useEffect running (Full Video Goal).");
    let device = null; let context = null; let format = null;
    let currentLandmarkerInstance = null; // Local instance for use within initializeAll
    let resizeObserver = null; let renderLoopStarted = false;
    
    const canvasElement = canvasRef.current; 
    const videoElement = videoRef.current;

    if (!canvasElement || !videoElement) {
      console.error("[MAIN_EFFECT] Canvas or Video element not available on mount.");
      setError("Canvas or Video element not found.");
      return;
    }

    const configureCanvas = (entries) => {
      const currentCanvas = canvasRef.current;
      if (!device || !context || !format || !currentCanvas) { console.warn("[configureCanvas] Prerequisites not met."); return; }
      if (entries) { console.log("[configureCanvas via RO]"); } else { console.log("[configureCanvas direct]"); }
      const dpr = window.devicePixelRatio || 1;
      const cw = currentCanvas.clientWidth; const ch = currentCanvas.clientHeight;
      if (cw === 0 || ch === 0) { console.warn(`[configureCanvas] Canvas clientWidth/Height is zero.`); return; }
      const tw = Math.floor(cw * dpr); const th = Math.floor(ch * dpr);
      console.log(`[configureCanvas] DPR: ${dpr}, clientW: ${cw}, clientH: ${ch} => target phys: ${tw}x${th}`);
      if (currentCanvas.width !== tw || currentCanvas.height !== th) { currentCanvas.width = tw; currentCanvas.height = th; console.log(`[configureCanvas] Canvas buffer SET: ${tw}x${th}`); }
      else { console.log(`[configureCanvas] Canvas size ${tw}x${th} OK.`); }
      try { context.configure({ device, format, alphaMode: 'opaque', size: [currentCanvas.width, currentCanvas.height] }); console.log(`[configureCanvas] Context CONFIG. Size: ${currentCanvas.width}x${currentCanvas.height}`); }
      catch (e) { console.error("[configureCanvas] Error config context:", e); setError("Error config WebGPU context."); }
    };
    resizeHandlerRef.current = configureCanvas;

    const render = async () => {
      const currentDevice = deviceRef.current; 
      const currentContext = contextRef.current;
      const currentVideoEl = videoRef.current; // Use .current for video element

      if (!currentDevice || !currentContext || !pipelineStateRef.current.videoPipeline || !currentVideoEl) {
        animationFrameIdRef.current = requestAnimationFrame(render); return; 
      }
      frameCounter.current++;
      if (currentVideoEl.readyState < currentVideoEl.HAVE_ENOUGH_DATA || currentVideoEl.videoWidth === 0) {
        animationFrameIdRef.current = requestAnimationFrame(render); return;
      }
      
      if (pipelineStateRef.current.aspectRatioUniformBuffer && currentVideoEl.videoWidth > 0 && currentContext.canvas.width > 0) {
        const aspectRatioData = new Float32Array([ currentVideoEl.videoWidth, currentVideoEl.videoHeight, currentContext.canvas.width, currentContext.canvas.height ]);
        currentDevice.queue.writeBuffer(pipelineStateRef.current.aspectRatioUniformBuffer, 0, aspectRatioData);
      }

      let numLipVertices = 0;
      if (landmarker) { // Use landmarker from state (which was set from currentLandmarkerInstance)
        try {
          const now = performance.now(); const results = landmarker.detectForVideo(currentVideoEl, now);
          if (results?.faceLandmarks?.length > 0) {
            const allFaceLm = results.faceLandmarks[0];
            // if (allFaceLm && frameCounter.current % 120 === 1) { /* landmark spread log */ }
            const lips = lipTriangles.map(([a,b,c]) => [allFaceLm[a],allFaceLm[b],allFaceLm[c]]);
            const v = new Float32Array(lips.flat().map(pt => [(0.5-pt.x)*2, (0.5-pt.y)*2]).flat());
            numLipVertices = v.length/2;
            if(v.byteLength > 0 && pipelineStateRef.current.vertexBuffer){ if(v.byteLength <= pipelineStateRef.current.vertexBufferSize) currentDevice.queue.writeBuffer(pipelineStateRef.current.vertexBuffer,0,v); else numLipVertices=0;} else numLipVertices=0;
          } else numLipVertices = 0;
        } catch (e) { numLipVertices = 0; }
      }

      let videoTextureGPU, frameBindGroupForTexture;
      try {
        videoTextureGPU = currentDevice.importExternalTexture({ source: currentVideoEl });
        if (pipelineStateRef.current.videoBindGroupLayout && pipelineStateRef.current.videoSampler) {
          frameBindGroupForTexture = currentDevice.createBindGroup({ layout: pipelineStateRef.current.videoBindGroupLayout, entries: [{binding:0,resource:pipelineStateRef.current.videoSampler},{binding:1,resource:videoTextureGPU}]});
        } else { animationFrameIdRef.current = requestAnimationFrame(render); return; }
      } catch (e) { animationFrameIdRef.current = requestAnimationFrame(render); return; }
      
      let currentGpuTexture, texView;
      try { currentGpuTexture = currentContext.getCurrentTexture(); texView = currentGpuTexture.createView(); }
      catch(e) { console.error(`[RENDER ${frameCounter.current}] Error currentTex:`, e); if(resizeHandlerRef.current) resizeHandlerRef.current(); animationFrameIdRef.current = requestAnimationFrame(render); return; }
      
      if (frameCounter.current < 2 || frameCounter.current % 240 === 1) { console.log(`[RENDER ${frameCounter.current}] Canvas: ${canvasRef.current.width}x${canvasRef.current.height}. GPU Tex: ${currentGpuTexture.width}x${currentGpuTexture.height}`); }

      const cmdEnc = currentDevice.createCommandEncoder();
      const passEnc = cmdEnc.beginRenderPass({colorAttachments:[{view:texView,clearValue:{r:0.0,g:0.0,b:0.0,a:1.0},loadOp:'clear',storeOp:'store'}]});
      passEnc.setViewport(0,0,currentGpuTexture.width,currentGpuTexture.height,0,1);
      passEnc.setScissorRect(0,0,currentGpuTexture.width,currentGpuTexture.height);
      
      if (pipelineStateRef.current.videoPipeline && frameBindGroupForTexture && pipelineStateRef.current.aspectRatioBindGroup) {
        passEnc.setPipeline(pipelineStateRef.current.videoPipeline);
        passEnc.setBindGroup(0, frameBindGroupForTexture); passEnc.setBindGroup(1, pipelineStateRef.current.aspectRatioBindGroup);
        passEnc.draw(6);
      }
      if(numLipVertices>0 && pipelineStateRef.current.lipstickPipeline && pipelineStateRef.current.vertexBuffer){
        passEnc.setPipeline(pipelineStateRef.current.lipstickPipeline); passEnc.setVertexBuffer(0,pipelineStateRef.current.vertexBuffer); passEnc.draw(numLipVertices);
      }
      passEnc.end();
      currentDevice.queue.submit([cmdEnc.finish()]);

      if(frameCounter.current === 1) { console.log(`[RENDER 1] First full frame (video+lips attempt).`); setDebugMessage("Live Tracking Active!"); }
      animationFrameIdRef.current = requestAnimationFrame(render);
    };

    const initializeAll = async () => {
      if (!navigator.gpu) { setError("WebGPU not supported."); return; }
      setDebugMessage("Initializing Systems...");
      try {
        console.log("[initializeAll] Initializing FaceLandmarker...");
        const vision = await FilesetResolver.forVisionTasks('https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm');
        // Correctly provide options for FaceLandmarker
        const lm = await FaceLandmarker.createFromOptions(vision, {
          baseOptions: {
            modelAssetPath: '/models/face_landmarker.task', // Path confirmed by user
            delegate: 'GPU',
          },
          outputFaceBlendshapes: false,
          runningMode: 'VIDEO',
          numFaces: 1,
        });
        currentLandmarkerInstance = lm; // Assign to local variable for direct use if needed
        setLandmarker(lm); // Update React state
        console.log("[initializeAll] FaceLandmarker ready.");

        console.log("[initializeAll] Initializing WebGPU Device & Format...");
        const adapter = await navigator.gpu.requestAdapter();
        if (!adapter) { setError("No GPU adapter."); return; }
        device = await adapter.requestDevice(); deviceRef.current = device;
        console.log("[initializeAll] Device obtained.");
        device.lost.then((info) => { 
            console.error(`[DEVICE_LOST_HANDLER] WebGPU device lost: ${info.message}`); 
            setError(`Device lost.`); setDebugMessage("Error: Device Lost.");
            if (animationFrameIdRef.current) cancelAnimationFrame(animationFrameIdRef.current);
            deviceRef.current = null; contextRef.current = null; currentLandmarkerInstance = null; setLandmarker(null);
        });
        
        context = canvasElement.getContext('webgpu'); contextRef.current = context;
        if (!context) { setError('No WebGPU context.'); return; }
        format = navigator.gpu.getPreferredCanvasFormat(); formatRef.current = format;
        console.log("[initializeAll] Context and Format obtained.");

        console.log("[initializeAll] Creating pipelines and GPU resources...");
        const { videoPipeline, lipstickPipeline, videoBindGroupLayout, aspectRatioGroupLayout } = await createPipelines(device, format);
        pipelineStateRef.current = { ...pipelineStateRef.current, videoPipeline, lipstickPipeline, videoBindGroupLayout, aspectRatioGroupLayout };
        const uniformBufferSize = 4 * Float32Array.BYTES_PER_ELEMENT;
        pipelineStateRef.current.aspectRatioUniformBuffer = device.createBuffer({ size: uniformBufferSize, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST });
        if (aspectRatioGroupLayout && pipelineStateRef.current.aspectRatioUniformBuffer) {
            pipelineStateRef.current.aspectRatioBindGroup = device.createBindGroup({ layout: aspectRatioGroupLayout, entries: [{ binding: 0, resource: { buffer: pipelineStateRef.current.aspectRatioUniformBuffer }}]});
        } else { console.warn("[initializeAll] AspectRatioGroupLayout or UniformBuffer missing for bind group."); }
        pipelineStateRef.current.videoSampler = device.createSampler({ magFilter: 'linear', minFilter: 'linear' });
        pipelineStateRef.current.vertexBuffer = device.createBuffer({ size: pipelineStateRef.current.vertexBufferSize, usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST });
        console.log("[initializeAll] Pipelines and GPU resources created.");
        
        console.log("[initializeAll] Setting up video element...");
        if (!navigator.mediaDevices?.getUserMedia) throw new Error("Camera not supported for video.");
        const stream = await navigator.mediaDevices.getUserMedia({ video: { width: 640, height: 480 } });
        videoElement.srcObject = stream; // videoElement is videoRef.current
        await new Promise((res, rej) => {
          videoElement.onloadedmetadata = () => { console.log(`[initializeAll] Video metadata: ${videoElement.videoWidth}x${videoElement.videoHeight}`); res(); };
          videoElement.onerror = () => rej(new Error("Video load error."));
        });
        await videoElement.play();
        console.log("[initializeAll] Video playback started.");
        
        resizeObserver = new ResizeObserver(resizeHandlerRef.current);
        resizeObserver.observe(canvasElement);
        console.log("[initializeAll] ResizeObserver observing canvas.");
        console.log("[initializeAll] Calling initial configureCanvas.");
        if(resizeHandlerRef.current) resizeHandlerRef.current(); 
        else console.error("[initializeAll] resizeHandlerRef.current is null before initial call");
        
        // setIsGpuReady(true); // Not strictly needed as render loop checks device/context
        console.log("[initializeAll] All sub-initializations complete.");

        if (!renderLoopStarted) { console.log("[initializeAll] Starting render loop."); render(); renderLoopStarted = true; }
      } catch (err) { console.error("[initializeAll] Major error:", err); setError(`Init failed: ${err.message}`); }
    };
    initializeAll();
    return () => {
      console.log("[MAIN_EFFECT_CLEANUP] Cleaning up.");
      if (animationFrameIdRef.current) cancelAnimationFrame(animationFrameIdRef.current);
      if (resizeObserver && canvasRef.current) resizeObserver.unobserve(canvasRef.current);
      videoRef.current?.srcObject?.getTracks().forEach(track => track.stop());
      if(videoRef.current) videoRef.current.srcObject = null;
      const dvc = deviceRef.current; if (dvc) { pipelineStateRef.current.vertexBuffer?.destroy(); pipelineStateRef.current.aspectRatioUniformBuffer?.destroy(); }
      deviceRef.current = null; contextRef.current = null; formatRef.current = null; 
      setLandmarker(null); 
      // setIsGpuReady(false); // No longer using this state for allResourcesReady
    };
  }, []); // Main effect

  // This useEffect is primarily for updating the UI message.
  // The render loop itself gates on deviceRef.current and contextRef.current.
  useEffect(() => {
    // A simpler check for UI message readiness
    if (deviceRef.current && contextRef.current && landmarker) { 
        setDebugMessage("Live Tracking Active!"); 
        console.log("[UI_MSG_EFFECT] All core resources appear ready.");
    } else { 
        setDebugMessage("Initializing...");
    }
  }, [landmarker, deviceRef.current, contextRef.current]); // Depend on refs directly might not trigger, but good for initial


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