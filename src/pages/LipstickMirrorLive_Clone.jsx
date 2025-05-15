// src/pages/LipstickMirrorLive_Clone.jsx (Full Viewport Parent + Video)

import React, { useEffect, useRef, useState } from 'react';
import createPipelines from '@/utils/createPipelines'; 
import lipTriangles from '@/utils/lipTriangles'; 
import { FaceLandmarker, FilesetResolver } from '@mediapipe/tasks-vision';

export default function LipstickMirrorLive_Clone() {
  const canvasRef = useRef(null);
  const videoRef = useRef(null); 

  const deviceRef = useRef(null);
  const contextRef = useRef(null);
  const formatRef = useRef(null);
  const pipelineStateRef = useRef({ /* ... same as before ... */ 
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
    console.log("[LML_Clone FullVP] useEffect running.");
    let device = null; let context = null; let format = null;
    let currentLandmarkerInstance = null; 
    let resizeObserver = null; let renderLoopStarted = false;
    
    const canvasElement = canvasRef.current; 
    const videoElement = videoRef.current;

    if (!canvasElement || !videoElement) {
      console.error("[LML_Clone FullVP] Canvas or Video element not available.");
      return;
    }

    const configureCanvas = (entries) => {
      if (!device || !context || !format || !canvasRef.current) { console.warn("[LML_Clone FullVP configureCanvas] Prerequisites not met."); return; }
      const currentCanvas = canvasRef.current;
      if (entries) { console.log("[LML_Clone FullVP configureCanvas via RO]"); } else { console.log("[LML_Clone FullVP configureCanvas direct]"); }
      const dpr = window.devicePixelRatio || 1;
      const cw = currentCanvas.clientWidth; const ch = currentCanvas.clientHeight;
      if (cw === 0 || ch === 0) { console.warn(`[LML_Clone FullVP configureCanvas] Canvas clientW/H is zero.`); return; }
      const tw = Math.floor(cw * dpr); const th = Math.floor(ch * dpr);
      console.log(`[LML_Clone FullVP configureCanvas] DPR:${dpr}, clientW/H:${cw}x${ch} => phys:${tw}x${th}`);
      if (currentCanvas.width !== tw || currentCanvas.height !== th) { currentCanvas.width = tw; currentCanvas.height = th; console.log(`[LML_Clone FullVP configureCanvas] Canvas buffer SET:${tw}x${th}`); }
      else { console.log(`[LML_Clone FullVP configureCanvas] Canvas size ${tw}x${th} OK.`); }
      try { context.configure({ device, format, alphaMode: 'opaque', size: [currentCanvas.width, currentCanvas.height] }); console.log(`[LML_Clone FullVP configureCanvas] Context CONFIG. Size:${currentCanvas.width}x${currentCanvas.height}`); }
      catch (e) { console.error("[LML_Clone FullVP configureCanvas] Error config context:", e); setError("Error config context."); }
    };
    resizeHandlerRef.current = configureCanvas;

    const render = async () => {
      const currentDevice = deviceRef.current; const currentContext = contextRef.current;
      const currentVideoEl = videoRef.current; const pState = pipelineStateRef.current;
      const activeLandmarker = landmarker; 

      if (!currentDevice || !currentContext || !pState.videoPipeline || !currentVideoEl) {
        animationFrameIdRef.current = requestAnimationFrame(render); return; 
      }
      frameCounter.current++;
      if (currentVideoEl.readyState < currentVideoEl.HAVE_ENOUGH_DATA || currentVideoEl.videoWidth === 0) {
        animationFrameIdRef.current = requestAnimationFrame(render); return;
      }
      
      if (pState.aspectRatioUniformBuffer && currentVideoEl.videoWidth > 0 && currentContext.canvas.width > 0) {
        const aspectRatioData = new Float32Array([ currentVideoEl.videoWidth, currentVideoEl.videoHeight, currentContext.canvas.width, currentContext.canvas.height ]);
        currentDevice.queue.writeBuffer(pState.aspectRatioUniformBuffer, 0, aspectRatioData);
      }

      let numLipVertices = 0; 
      if (activeLandmarker) { /* ... landmarker processing (for next stage) ... */ }

      let videoTextureGPU, frameBindGroupForTexture;
      try {
        videoTextureGPU = currentDevice.importExternalTexture({ source: currentVideoEl });
        if (pState.videoBindGroupLayout && pState.videoSampler) {
          frameBindGroupForTexture = currentDevice.createBindGroup({ layout: pState.videoBindGroupLayout, entries: [{binding:0,resource:pState.videoSampler},{binding:1,resource:videoTextureGPU}]});
        } else { animationFrameIdRef.current = requestAnimationFrame(render); return; }
      } catch (e) { animationFrameIdRef.current = requestAnimationFrame(render); return; }
      
      let currentGpuTexture, texView;
      try { currentGpuTexture = currentContext.getCurrentTexture(); texView = currentGpuTexture.createView(); }
      catch(e) { console.error(`[RENDER LML_Clone FullVP ${frameCounter.current}] Error currentTex:`, e); if(resizeHandlerRef.current) resizeHandlerRef.current(); animationFrameIdRef.current = requestAnimationFrame(render); return; }
      
      if (frameCounter.current < 2 || frameCounter.current % 240 === 1) { console.log(`[RENDER LML_Clone FullVP ${frameCounter.current}] Canvas: ${canvasRef.current.width}x${canvasRef.current.height}. GPU Tex: ${currentGpuTexture.width}x${currentGpuTexture.height}`); }

      const cmdEnc = currentDevice.createCommandEncoder({label: "LML_Clone_FullVP_Encoder"});
      const passEnc = cmdEnc.beginRenderPass({colorAttachments:[{view:texView,clearValue:{r:0.0,g:0.0,b:0.0,a:1.0},loadOp:'clear',storeOp:'store'}]});
      passEnc.setViewport(0,0,currentGpuTexture.width,currentGpuTexture.height,0,1);
      passEnc.setScissorRect(0,0,currentGpuTexture.width,currentGpuTexture.height);
      
      if (pState.videoPipeline && frameBindGroupForTexture && pState.aspectRatioBindGroup) {
        passEnc.setPipeline(pState.videoPipeline);
        passEnc.setBindGroup(0, frameBindGroupForTexture); 
        passEnc.setBindGroup(1, pState.aspectRatioBindGroup);
        passEnc.draw(6);
      }
      // No lipstick drawing yet
      passEnc.end();
      currentDevice.queue.submit([cmdEnc.finish()]);

      if(frameCounter.current === 1) { console.log(`[RENDER LML_Clone FullVP 1] First frame with video.`); setDebugMessage("Live Video Active (FullVP)"); }
      animationFrameIdRef.current = requestAnimationFrame(render);
    };

    const initializeAll = async () => {
      // ... (All of initializeAll remains identical to the previous version)
      // It correctly sets up landmarker, device, context, format, pipelines, video, ResizeObserver
      // The key change is the JSX structure this component returns.
      if (!navigator.gpu) { setError("WebGPU not supported."); return; }
      setDebugMessage("Initializing LML_Clone FullVP Systems...");
      try {
        console.log("[LML_Clone FullVP initializeAll] Initializing FaceLandmarker...");
        const vision = await FilesetResolver.forVisionTasks('https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm');
        const lmInstance = await FaceLandmarker.createFromOptions(vision, { /* ... correct options ... */ 
            baseOptions: { modelAssetPath: '/models/face_landmarker.task', delegate: 'GPU' },
            outputFaceBlendshapes: false, runningMode: 'VIDEO', numFaces: 1,
        });
        setLandmarker(lmInstance); console.log("[LML_Clone FullVP initializeAll] FaceLandmarker ready.");

        console.log("[LML_Clone FullVP initializeAll] Initializing WebGPU Device & Format...");
        const adapter = await navigator.gpu.requestAdapter();
        if (!adapter) { setError("No GPU adapter."); return; }
        device = await adapter.requestDevice(); deviceRef.current = device;
        console.log("[LML_Clone FullVP initializeAll] Device obtained.");
        device.lost.then((info) => { /* ... */ });
        context = canvasElement.getContext('webgpu'); contextRef.current = context;
        if (!context) { setError('No WebGPU context.'); return; }
        format = navigator.gpu.getPreferredCanvasFormat(); formatRef.current = format;
        console.log("[LML_Clone FullVP initializeAll] Context and Format obtained.");

        console.log("[LML_Clone FullVP initializeAll] Creating pipelines and GPU resources...");
        const { videoPipeline, lipstickPipeline, videoBindGroupLayout, aspectRatioGroupLayout } = await createPipelines(device, format);
        pipelineStateRef.current = { ...pipelineStateRef.current, videoPipeline, lipstickPipeline, videoBindGroupLayout, aspectRatioGroupLayout };
        const uniformBufferSize = 4 * Float32Array.BYTES_PER_ELEMENT;
        pipelineStateRef.current.aspectRatioUniformBuffer = device.createBuffer({ size: uniformBufferSize, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST });
        if (aspectRatioGroupLayout && pipelineStateRef.current.aspectRatioUniformBuffer) {
            pipelineStateRef.current.aspectRatioBindGroup = device.createBindGroup({ layout: aspectRatioGroupLayout, entries: [{ binding: 0, resource: { buffer: pipelineStateRef.current.aspectRatioUniformBuffer }}]});
        }
        pipelineStateRef.current.videoSampler = device.createSampler({ magFilter: 'linear', minFilter: 'linear' });
        pipelineStateRef.current.vertexBuffer = device.createBuffer({ size: pipelineStateRef.current.vertexBufferSize, usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST });
        console.log("[LML_Clone FullVP initializeAll] Pipelines and GPU resources created.");
        
        console.log("[LML_Clone FullVP initializeAll] Setting up video element...");
        if (!navigator.mediaDevices?.getUserMedia) throw new Error("Camera not supported.");
        const stream = await navigator.mediaDevices.getUserMedia({ video: { width: 640, height: 480 } });
        videoElement.srcObject = stream;
        await new Promise((res, rej) => { /* ... onloadedmetadata ... */ 
            videoElement.onloadedmetadata = () => { console.log(`[LML_Clone FullVP initializeAll] Video metadata: ${videoElement.videoWidth}x${videoElement.videoHeight}`); res(); };
            videoElement.onerror = () => rej(new Error("Video load error."));
        });
        await videoElement.play(); console.log("[LML_Clone FullVP initializeAll] Video playback started.");
        
        resizeObserver = new ResizeObserver(resizeHandlerRef.current);
        resizeObserver.observe(canvasElement);
        console.log("[LML_Clone FullVP initializeAll] ResizeObserver observing canvas.");
        if(resizeHandlerRef.current) resizeHandlerRef.current(); 
        else console.error("[LML_Clone FullVP initializeAll] resizeHandlerRef.current is null");
        
        console.log("[LML_Clone FullVP initializeAll] All sub-initializations complete.");
        if (!renderLoopStarted) { console.log("[LML_Clone FullVP initializeAll] Starting render loop."); render(); renderLoopStarted = true; }
      } catch (err) { console.error("[LML_Clone FullVP initializeAll] Major error:", err); setError(`Init failed: ${err.message}`); }
    }; // End of initializeAll

    initializeAll();
    return () => { /* ... cleanup (same as before) ... */
      console.log("[LML_Clone FullVP MAIN_EFFECT_CLEANUP] Cleaning up.");
      if (animationFrameIdRef.current) cancelAnimationFrame(animationFrameIdRef.current);
      if (resizeObserver && canvasRef.current) resizeObserver.unobserve(canvasRef.current);
      if (resizeObserver) resizeObserver.disconnect();
      videoRef.current?.srcObject?.getTracks().forEach(track => track.stop());
      if(videoRef.current) videoRef.current.srcObject = null;
      const dvc = deviceRef.current; if (dvc) { pipelineStateRef.current.vertexBuffer?.destroy(); pipelineStateRef.current.aspectRatioUniformBuffer?.destroy(); }
      deviceRef.current = null; contextRef.current = null; formatRef.current = null; 
      setLandmarker(null); 
    };
  }, []); // Main effect

  useEffect(() => { /* ... UI Message Effect (same as before) ... */ 
    if(landmarker && deviceRef.current && contextRef.current && pipelineStateRef.current.videoPipeline && !error) { 
        setDebugMessage("Live Video Active (FullVP)");
    } else if (error) {
        setDebugMessage(`Error: ${String(error).substring(0, 30)}...`);
    } else {
        setDebugMessage("Initializing (FullVP)...");
    }
  }, [landmarker, deviceRef.current, contextRef.current, pipelineStateRef.current.videoPipeline, error]);

  // --- MODIFIED JSX based on ChatGPT's "Recommended Structural Fix" ---
  return (
    <div style={{
      position: 'absolute', // Takes up full available space of its offset parent, or viewport if no offset parent
      top: 0, left: 0, right: 0, bottom: 0, // Stretches to edges
      overflow: 'hidden',    // Prevent scrollbars if canvas slightly overflows (due to rounding)
      margin: 0,             // Reset margin
      padding: 0,            // Reset padding
      background: 'darkslateblue' // Background for the very outer div, to see its bounds
    }}>
      <div style={{
        position:'absolute',
        top:'5px', left:'5px',
        background:'rgba(0,0,0,0.7)',
        color:'white',
        padding:'2px 5px',
        fontSize:'12px',
        zIndex:10, // Ensure it's above the canvas
        pointerEvents:'none'
      }}>
        {debugMessage} (Frame: {frameCounter.current})
      </div>
      
      {/* Video element is not directly visible but provides the texture */}
      <video 
        ref={videoRef} 
        style={{ display: 'none' }} // Keep it out of layout, WebGPU uses it directly
        width={640} height={480} autoPlay playsInline muted 
      />
      
      <canvas
        ref={canvasRef}
        // HTML width/height attributes are set by JS in configureCanvas
        style={{
          width: '100%',    // Fill the parent div
          height: '100%',   // Fill the parent div
          display: 'block', // Removes extra space below inline elements
          // CSS background for the canvas element itself, visible if WebGPU doesn't draw
          // Let's use the lightpink again to be sure
          background: 'lightpink', 
        }}
      />
    </div>
  );
}