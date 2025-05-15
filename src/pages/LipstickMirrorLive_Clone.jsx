// src/pages/LipstickMirrorLive_Clone.jsx (Stage 2: Add Lips Overlay)

import React, { useEffect, useRef, useState } from 'react';
import createPipelines from '@/utils/createPipelines'; 
import lipTriangles from '@/utils/lipTriangles'; // Now used for drawing
import { FaceLandmarker, FilesetResolver } from '@mediapipe/tasks-vision';

export default function LipstickMirrorLive_Clone() {
  const canvasRef = useRef(null);
  const videoRef = useRef(null); 

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
    vertexBufferSize: 2048, // Should be sufficient for lip triangles
  });
  const animationFrameIdRef = useRef(null);
  const resizeHandlerRef = useRef(null);

  const [landmarker, setLandmarker] = useState(null);
  const [error, setError] = useState(null);
  const [debugMessage, setDebugMessage] = useState('Initializing...');
  const frameCounter = useRef(0); 
  
  useEffect(() => {
    console.log("[LML_Clone STAGE2] useEffect running.");
    let device = null; let context = null; let format = null;
    let currentLandmarkerInstance = null; 
    let resizeObserver = null; let renderLoopStarted = false;
    
    const canvasElement = canvasRef.current; 
    const videoElement = videoRef.current;

    if (!canvasElement || !videoElement) { /* ... error handling ... */ return; }

    const configureCanvas = (entries) => { /* ... same as previous working version ... */ 
      if (!device || !context || !format || !canvasRef.current) { console.warn("[LML_Clone configureCanvas] Prerequisites not met."); return; }
      const currentCanvas = canvasRef.current;
      if (entries) { console.log("[LML_Clone configureCanvas via RO]"); } else { console.log("[LML_Clone configureCanvas direct]"); }
      const dpr = window.devicePixelRatio || 1;
      const cw = currentCanvas.clientWidth; const ch = currentCanvas.clientHeight;
      if (cw === 0 || ch === 0) { console.warn(`[LML_Clone configureCanvas] Canvas clientW/H is zero.`); return; }
      const tw = Math.floor(cw * dpr); const th = Math.floor(ch * dpr);
      if (currentCanvas.width !== tw || currentCanvas.height !== th) { currentCanvas.width = tw; currentCanvas.height = th; console.log(`[LML_Clone configureCanvas] Canvas buffer SET:${tw}x${th}`); }
      else { console.log(`[LML_Clone configureCanvas] Canvas size ${tw}x${th} OK.`); }
      try { context.configure({ device, format, alphaMode: 'opaque', size: [currentCanvas.width, currentCanvas.height] }); console.log(`[LML_Clone configureCanvas] Context CONFIG. Size:${currentCanvas.width}x${currentCanvas.height}`); }
      catch (e) { console.error("[LML_Clone configureCanvas] Error config context:", e); setError("Error config context."); }
    };
    resizeHandlerRef.current = configureCanvas;

    const render = async () => {
      const currentDevice = deviceRef.current; 
      const currentContext = contextRef.current;
      const currentVideoEl = videoRef.current; 
      const pState = pipelineStateRef.current;
      const activeLandmarker = landmarker; 

      if (!currentDevice || !currentContext || !pState.videoPipeline || !pState.lipstickPipeline || !currentVideoEl) {
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

      // --- MediaPipe Landmark Processing & Vertex Buffer Update ---
      let numLipVertices = 0; 
      if (activeLandmarker && pState.vertexBuffer) { 
        try {
          const now = performance.now(); 
          const results = activeLandmarker.detectForVideo(currentVideoEl, now);
          if (results?.faceLandmarks?.length > 0) {
            const allFaceLm = results.faceLandmarks[0];
            if (frameCounter.current % 120 === 1 && allFaceLm) { 
                let minX=1,maxX=0,minY=1,maxY=0; 
                allFaceLm.forEach(lm => {minX=Math.min(minX,lm.x);maxX=Math.max(maxX,lm.x);minY=Math.min(minY,lm.y);maxY=Math.max(maxY,lm.y);}); 
                console.log(`[RENDER LML_Clone ${frameCounter.current}] Landmark Spread: X[${minX.toFixed(3)}-${maxX.toFixed(3)}], Y[${minY.toFixed(3)}-${maxY.toFixed(3)}]`);
            }
            // Use lipTriangles data to get specific lip landmark indices
            const lips = lipTriangles.map(([idxA, idxB, idxC]) => [
                allFaceLm[idxA], allFaceLm[idxB], allFaceLm[idxC]
            ]);
            const lipVertexData = new Float32Array(lips.flat().map(pt => [(0.5-pt.x)*2, (0.5-pt.y)*2]).flat());
            numLipVertices = lipVertexData.length/2;
            if(lipVertexData.byteLength > 0){ 
                if(lipVertexData.byteLength <= pState.vertexBufferSize) {
                    currentDevice.queue.writeBuffer(pState.vertexBuffer,0,lipVertexData);
                } else {
                    console.warn(`[RENDER LML_Clone ${frameCounter.current}] Lip vertex data too large for buffer.`);
                    numLipVertices=0;
                }
            } else {
                numLipVertices=0;
            }
          } else {
            numLipVertices = 0; // No face detected
          }
        } catch (e) { 
            console.error(`[RENDER LML_Clone ${frameCounter.current}] Error in landmarker processing:`, e);
            numLipVertices = 0; 
        }
      }
      // --- End MediaPipe ---

      let videoTextureGPU, frameBindGroupForTexture;
      try { /* ... same as before ... */ 
        videoTextureGPU = currentDevice.importExternalTexture({ source: currentVideoEl });
        if (pState.videoBindGroupLayout && pState.videoSampler) {
          frameBindGroupForTexture = currentDevice.createBindGroup({ layout: pState.videoBindGroupLayout, entries: [{binding:0,resource:pState.videoSampler},{binding:1,resource:videoTextureGPU}]});
        } else { animationFrameIdRef.current = requestAnimationFrame(render); return; }
      } catch (e) { animationFrameIdRef.current = requestAnimationFrame(render); return; }
      
      let currentGpuTexture, texView;
      try { /* ... same as before ... */ 
        currentGpuTexture = currentContext.getCurrentTexture(); texView = currentGpuTexture.createView(); 
      }
      catch(e) { console.error(`[RENDER LML_Clone ${frameCounter.current}] Error currentTex:`, e); if(resizeHandlerRef.current) resizeHandlerRef.current(); animationFrameIdRef.current = requestAnimationFrame(render); return; }
      
      if (frameCounter.current < 2 || frameCounter.current % 240 === 1) { console.log(`[RENDER LML_Clone ${frameCounter.current}] Canvas: ${canvasRef.current.width}x${canvasRef.current.height}. GPU Tex: ${currentGpuTexture.width}x${currentGpuTexture.height}`); }

      const cmdEnc = currentDevice.createCommandEncoder({label: "LML_Clone_FullRenderEncoder"});
      const passEnc = cmdEnc.beginRenderPass({colorAttachments:[{view:texView,clearValue:{r:0.0,g:0.0,b:0.0,a:1.0},loadOp:'clear',storeOp:'store'}]});
      passEnc.setViewport(0,0,currentGpuTexture.width,currentGpuTexture.height,0,1);
      passEnc.setScissorRect(0,0,currentGpuTexture.width,currentGpuTexture.height);
      
      // Draw video background
      if (pState.videoPipeline && frameBindGroupForTexture && pState.aspectRatioBindGroup) {
        passEnc.setPipeline(pState.videoPipeline);
        passEnc.setBindGroup(0, frameBindGroupForTexture); 
        passEnc.setBindGroup(1, pState.aspectRatioBindGroup);
        passEnc.draw(6);
      }
      
      // --- Draw Lipstick Overlay ---
      if(numLipVertices>0 && pState.lipstickPipeline && pState.vertexBuffer){
        passEnc.setPipeline(pState.lipstickPipeline); 
        passEnc.setVertexBuffer(0,pState.vertexBuffer); 
        passEnc.draw(numLipVertices); // Draw the calculated lip vertices
        if (frameCounter.current % 60 === 1) console.log(`[RENDER LML_Clone ${frameCounter.current}] Drawing ${numLipVertices} lip vertices.`);
      }
      // --- End Lipstick Overlay ---

      passEnc.end();
      currentDevice.queue.submit([cmdEnc.finish()]);

      if(frameCounter.current === 1) { console.log(`[RENDER LML_Clone 1] First full frame (video+lips attempt).`); }
      animationFrameIdRef.current = requestAnimationFrame(render);
    }; // End of render function

    const initializeAll = async () => { /* ... same as previous working version ... */ 
      if (!navigator.gpu) { setError("WebGPU not supported."); return; }
      setDebugMessage("Initializing Full Application...");
      try {
        console.log("[LML_Clone initializeAll] Initializing FaceLandmarker...");
        const vision = await FilesetResolver.forVisionTasks('https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm');
        const lmInstance = await FaceLandmarker.createFromOptions(vision, { 
            baseOptions: { modelAssetPath: '/models/face_landmarker.task', delegate: 'GPU' },
            outputFaceBlendshapes: false, runningMode: 'VIDEO', numFaces: 1,
        });
        setLandmarker(lmInstance); console.log("[LML_Clone initializeAll] FaceLandmarker ready.");

        console.log("[LML_Clone initializeAll] Initializing WebGPU Device & Format...");
        const adapter = await navigator.gpu.requestAdapter();
        if (!adapter) { setError("No GPU adapter."); return; }
        device = await adapter.requestDevice(); deviceRef.current = device;
        console.log("[LML_Clone initializeAll] Device obtained.");
        device.lost.then((info) => { /* ... */ });
        context = canvasElement.getContext('webgpu'); contextRef.current = context;
        if (!context) { setError('No WebGPU context.'); return; }
        format = navigator.gpu.getPreferredCanvasFormat(); formatRef.current = format;
        console.log("[LML_Clone initializeAll] Context and Format obtained.");

        console.log("[LML_Clone initializeAll] Creating pipelines and GPU resources...");
        const { videoPipeline, lipstickPipeline, videoBindGroupLayout, aspectRatioGroupLayout } = await createPipelines(device, format);
        pipelineStateRef.current = { ...pipelineStateRef.current, videoPipeline, lipstickPipeline, videoBindGroupLayout, aspectRatioGroupLayout };
        const uniformBufferSize = 4 * Float32Array.BYTES_PER_ELEMENT;
        pipelineStateRef.current.aspectRatioUniformBuffer = device.createBuffer({ size: uniformBufferSize, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST });
        if (aspectRatioGroupLayout && pipelineStateRef.current.aspectRatioUniformBuffer) {
            pipelineStateRef.current.aspectRatioBindGroup = device.createBindGroup({ layout: aspectRatioGroupLayout, entries: [{ binding: 0, resource: { buffer: pipelineStateRef.current.aspectRatioUniformBuffer }}]});
        }
        pipelineStateRef.current.videoSampler = device.createSampler({ magFilter: 'linear', minFilter: 'linear' });
        pipelineStateRef.current.vertexBuffer = device.createBuffer({ size: pipelineStateRef.current.vertexBufferSize, usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST }); // For lips
        console.log("[LML_Clone initializeAll] Pipelines and GPU resources created.");
        
        console.log("[LML_Clone initializeAll] Setting up video element...");
        if (!navigator.mediaDevices?.getUserMedia) throw new Error("Camera not supported.");
        const stream = await navigator.mediaDevices.getUserMedia({ video: { width: 640, height: 480 } });
        videoElement.srcObject = stream;
        await new Promise((res, rej) => { 
            videoElement.onloadedmetadata = () => { console.log(`[LML_Clone initializeAll] Video metadata: ${videoElement.videoWidth}x${videoElement.videoHeight}`); res(); };
            videoElement.onerror = () => rej(new Error("Video load error."));
        });
        await videoElement.play(); console.log("[LML_Clone initializeAll] Video playback started.");
        
        resizeObserver = new ResizeObserver(resizeHandlerRef.current);
        resizeObserver.observe(canvasElement);
        console.log("[LML_Clone initializeAll] ResizeObserver observing canvas.");
        if(resizeHandlerRef.current) resizeHandlerRef.current(); 
        else console.error("[LML_Clone initializeAll] resizeHandlerRef.current is null");
        
        console.log("[LML_Clone initializeAll] All sub-initializations complete.");
        if (!renderLoopStarted) { console.log("[LML_Clone initializeAll] Starting render loop."); render(); renderLoopStarted = true; }
      } catch (err) { console.error("[LML_Clone initializeAll] Major error:", err); setError(`Init failed: ${err.message}`); }
    }; // End of initializeAll

    initializeAll();
    return () => { /* ... cleanup (same as before) ... */
      console.log("[LML_Clone MAIN_EFFECT_CLEANUP] Cleaning up.");
      if (animationFrameIdRef.current) cancelAnimationFrame(animationFrameIdRef.current);
      if (resizeObserver && canvasRef.current) resizeObserver.unobserve(canvasRef.current);
      if (resizeObserver) resizeObserver.disconnect();
      videoRef.current?.srcObject?.getTracks().forEach(track => track.stop());
      if(videoRef.current) videoRef.current.srcObject = null;
      const dvc = deviceRef.current; if (dvc) { pipelineStateRef.current.vertexBuffer?.destroy(); pipelineStateRef.current.aspectRatioUniformBuffer?.destroy(); }
      deviceRef.current = null; contextRef.current = null; formatRef.current = null; 
      setLandmarker(null); 
    };
  }, []);

  useEffect(() => { /* ... UI Message Effect (same as before, maybe update message) ... */ 
    if(landmarker && deviceRef.current && contextRef.current && pipelineStateRef.current.lipstickPipeline && !error) { 
        setDebugMessage("Live Lipstick Try-On Active");
    } else if (error) {
        setDebugMessage(`Error: ${String(error).substring(0, 30)}...`);
    } else {
        setDebugMessage("Initializing Lipstick Try-On...");
    }
  }, [landmarker, deviceRef.current, contextRef.current, pipelineStateRef.current.lipstickPipeline, error]);

  return ( /* ... JSX using original parent div styling (same as before) ... */
    <div style={{ width: '640px', height: '480px', margin: 'auto', border: '1px solid #ccc', position: 'relative', overflow: 'hidden', background: 'darkkhaki' }}>
      <div style={{position:'absolute',top:'5px',left:'5px',background:'rgba(0,0,0,0.7)',color:'white',padding:'2px 5px',fontSize:'12px',zIndex:10,pointerEvents:'none'}}>
        {debugMessage} (Frame: {frameCounter.current})
      </div>
      <video ref={videoRef} style={{position:'absolute',top:0,left:0,width:'100%',height:'100%',objectFit:'cover',opacity:0,pointerEvents:'none',zIndex:1}} width={640} height={480} autoPlay playsInline muted />
      <canvas ref={canvasRef} width={640} height={480} style={{position:'absolute',top:0,left:0,width:'100%',height:'100%',zIndex:2, background: 'lightpink'}} />
    </div>
  );
}