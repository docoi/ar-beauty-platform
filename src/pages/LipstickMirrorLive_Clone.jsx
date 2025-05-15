// src/pages/LipstickMirrorLive_Clone.jsx (Stage 3.A: Add Video Element & Stream)

import React, { useEffect, useRef, useState } from 'react';
// createPipelines, lipTriangles are NOT used in this step
// FaceLandmarker will be initialized
import { FaceLandmarker, FilesetResolver } from '@mediapipe/tasks-vision';


export default function LipstickMirrorLive_Clone() {
  const canvasRef = useRef(null);
  const videoRef = useRef(null); // Re-added

  const animationFrameIdRef = useRef(null);
  const frameCounter = useRef(0);
  const resizeHandlerRef = useRef(null);
  
  const deviceRef = useRef(null);
  const contextRef = useRef(null);
  const formatRef = useRef(null);

  // pipelineStateRef is minimal for this step, as pipelines aren't created yet
  const pipelineStateRef = useRef({ }); 

  // Landmarker state will be used
  const [landmarker, setLandmarker] = useState(null); 
  const [error, setError] = useState(null);
  const [debugMessage, setDebugMessage] = useState('Initializing...');
  
  useEffect(() => {
    console.log("[LML_Clone Stage 3.A] useEffect running.");
    let device = null; let context = null; let format = null;
    let currentLandmarkerInstance = null; 
    let resizeObserver = null; let renderLoopStarted = false;
    
    const canvasElement = canvasRef.current; 
    const videoElement = videoRef.current; // Get video element from ref

    if (!canvasElement || !videoElement) { // Check videoElement too
      console.error("[LML_Clone Stage 3.A] Canvas or Video element not available.");
      setError("Canvas or Video element not found.");
      return;
    }

    const configureCanvas = (entries) => {
      if (!device || !context || !format || !canvasRef.current) { console.warn("[LML_Clone S3A configureCanvas] Prerequisites not met."); return; }
      const currentCanvas = canvasRef.current;
      if (entries) { console.log("[LML_Clone S3A configureCanvas via RO]"); } else { console.log("[LML_Clone S3A configureCanvas direct]"); }
      const dpr = window.devicePixelRatio || 1;
      const cw = currentCanvas.clientWidth; const ch = currentCanvas.clientHeight;
      if (cw === 0 || ch === 0) { console.warn(`[LML_Clone S3A configureCanvas] Canvas clientW/H is zero.`); return; }
      const tw = Math.floor(cw * dpr); const th = Math.floor(ch * dpr);
      console.log(`[LML_Clone S3A configureCanvas] DPR:${dpr}, clientW/H:${cw}x${ch} => phys:${tw}x${th}`);
      if (currentCanvas.width !== tw || currentCanvas.height !== th) { currentCanvas.width = tw; currentCanvas.height = th; console.log(`[LML_Clone S3A configureCanvas] Canvas buffer SET:${tw}x${th}`); }
      else { console.log(`[LML_Clone S3A configureCanvas] Canvas size ${tw}x${th} OK.`); }
      try { context.configure({ device, format, alphaMode: 'opaque', size: [currentCanvas.width, currentCanvas.height] }); console.log(`[LML_Clone S3A configureCanvas] Context CONFIG. Size:${currentCanvas.width}x${currentCanvas.height}`); }
      catch (e) { console.error("[LML_Clone S3A configureCanvas] Error config context:", e); setError("Error config context."); }
    };
    resizeHandlerRef.current = configureCanvas;

    const render = async () => {
      const currentDevice = deviceRef.current; 
      const currentContext = contextRef.current;
      if (!currentDevice || !currentContext) { animationFrameIdRef.current = requestAnimationFrame(render); return; }
      frameCounter.current++;
      
      let currentGpuTexture, texView;
      try { currentGpuTexture = currentContext.getCurrentTexture(); texView = currentGpuTexture.createView(); }
      catch(e) { console.error(`[RENDER LML_Clone S3A ${frameCounter.current}] Error currentTex:`, e); if(resizeHandlerRef.current) resizeHandlerRef.current(); animationFrameIdRef.current = requestAnimationFrame(render); return; }
      
      if (frameCounter.current < 2 || frameCounter.current % 240 === 1) { console.log(`[RENDER LML_Clone S3A ${frameCounter.current}] Canvas: ${canvasRef.current.width}x${canvasRef.current.height}. GPU Tex: ${currentGpuTexture.width}x${currentGpuTexture.height}`); }

      const cmdEnc = currentDevice.createCommandEncoder({label: "LML_Clone_S3A_ClearEncoder"});
      // Clearing to DARK GREEN, as per the last confirmed working base
      const passEnc = cmdEnc.beginRenderPass({colorAttachments:[{view:texView,clearValue:{r:0.0,g:0.5,b:0.0,a:1.0},loadOp:'clear',storeOp:'store'}]});
      passEnc.setViewport(0,0,currentGpuTexture.width,currentGpuTexture.height,0,1);
      passEnc.setScissorRect(0,0,currentGpuTexture.width,currentGpuTexture.height);
      passEnc.end();
      currentDevice.queue.submit([cmdEnc.finish()]);

      if(frameCounter.current === 1) { console.log(`[RENDER LML_Clone S3A 1] First frame (dark green clear).`); }
      animationFrameIdRef.current = requestAnimationFrame(render);
    };

    const initializeAll = async () => {
      if (!navigator.gpu) { setError("WebGPU not supported."); return; }
      setDebugMessage("Initializing Stage 3.A: Video Stream...");
      try {
        console.log("[LML_Clone S3A initializeAll] Initializing FaceLandmarker...");
        const vision = await FilesetResolver.forVisionTasks('https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm');
        const lmInstance = await FaceLandmarker.createFromOptions(vision, { 
            baseOptions: { modelAssetPath: '/models/face_landmarker.task', delegate: 'GPU' },
            outputFaceBlendshapes: false, runningMode: 'VIDEO', numFaces: 1,
        });
        setLandmarker(lmInstance); // Set landmarker state
        console.log("[LML_Clone S3A initializeAll] FaceLandmarker ready.");

        console.log("[LML_Clone S3A initializeAll] Initializing WebGPU Device & Format...");
        const adapter = await navigator.gpu.requestAdapter();
        if (!adapter) { setError("No GPU adapter."); return; }
        device = await adapter.requestDevice(); deviceRef.current = device;
        console.log("[LML_Clone S3A initializeAll] Device obtained.");
        device.lost.then((info) => { /* ... device lost handling ... */ });
        
        context = canvasElement.getContext('webgpu'); contextRef.current = context;
        if (!context) { setError('No WebGPU context.'); return; }
        format = navigator.gpu.getPreferredCanvasFormat(); formatRef.current = format;
        console.log("[LML_Clone S3A initializeAll] Context and Format obtained.");

        console.log("[LML_Clone S3A initializeAll] Skipping pipeline creation for this step.");
        
        // --- Video Element Setup ---
        console.log("[LML_Clone S3A initializeAll] Setting up video element...");
        if (!navigator.mediaDevices?.getUserMedia) throw new Error("Camera not supported.");
        const stream = await navigator.mediaDevices.getUserMedia({ video: { width: 640, height: 480 } });
        videoElement.srcObject = stream; // videoElement is videoRef.current
        await new Promise((res, rej) => { 
            videoElement.onloadedmetadata = () => { console.log(`[LML_Clone S3A initializeAll] Video metadata: ${videoElement.videoWidth}x${videoElement.videoHeight}`); res(); };
            videoElement.onerror = () => rej(new Error("Video load error."));
        });
        await videoElement.play(); 
        console.log("[LML_Clone S3A initializeAll] Video playback started.");
        // --- End Video Element Setup ---
        
        resizeObserver = new ResizeObserver(resizeHandlerRef.current);
        resizeObserver.observe(canvasElement);
        console.log("[LML_Clone S3A initializeAll] ResizeObserver observing canvas.");
        if(resizeHandlerRef.current) resizeHandlerRef.current(); 
        else console.error("[LML_Clone S3A initializeAll] resizeHandlerRef.current is null");
        
        console.log("[LML_Clone S3A initializeAll] All sub-initializations for S3A complete.");
        if (!renderLoopStarted) { console.log("[LML_Clone S3A initializeAll] Starting render loop."); render(); renderLoopStarted = true; }
        
      } catch (err) { console.error("[LML_Clone S3A initializeAll] Major error:", err); setError(`Init S3A failed: ${err.message}`); }
    };
    initializeAll();
    return () => { /* ... cleanup ... */
      console.log("[LML_Clone S3A MAIN_EFFECT_CLEANUP] Cleaning up.");
      if (animationFrameIdRef.current) cancelAnimationFrame(animationFrameIdRef.current);
      if (resizeObserver && canvasRef.current) resizeObserver.unobserve(canvasRef.current);
      if (resizeObserver) resizeObserver.disconnect();
      videoRef.current?.srcObject?.getTracks().forEach(track => track.stop());
      if(videoRef.current) videoRef.current.srcObject = null;
      deviceRef.current = null; contextRef.current = null; formatRef.current = null; 
      setLandmarker(null); 
    };
  }, []);

  useEffect(() => { 
    if(landmarker && deviceRef.current && contextRef.current && !error) { 
        setDebugMessage("Stage 3.A: Video Stream Ready");
    } else if (error) {
        setDebugMessage(`Error: ${String(error).substring(0,30)}...`);
    } else {
        setDebugMessage("Initializing Stage 3.A...");
    }
  }, [landmarker, deviceRef.current, contextRef.current, error]);

  return (
    // Using the original parent div styling that LipstickMirrorLive needs
    <div style={{ width: '640px', height: '480px', margin: 'auto', border: '1px solid #ccc', position: 'relative', overflow: 'hidden', background: 'darkkhaki' }}>
      <div style={{position:'absolute',top:'5px',left:'5px',background:'rgba(0,0,0,0.7)',color:'white',padding:'2px 5px',fontSize:'12px',zIndex:10,pointerEvents:'none'}}>
        {debugMessage} (Frame: {frameCounter.current})
      </div>
      {/* Video element is in the DOM but not visible, WebGPU will use it as a texture source later */}
      <video ref={videoRef} style={{display:'none'}} width={640} height={480} autoPlay playsInline muted />
      <canvas 
        ref={canvasRef} 
        width={640} // Nominal HTML attributes
        height={480}
        style={{
          position:'absolute', top:0, left:0, 
          width:'100%', height:'100%', 
          zIndex:2, 
          display: 'block', 
          background: 'lightpink' // CSS background for the canvas element itself
        }} 
      />
    </div>
  );
}