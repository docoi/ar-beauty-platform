// src/pages/LipstickMirrorLive_Clone.jsx (Stage 2: Add Lips Overlay with DETAILED LOGS)

import React, { useEffect, useRef, useState } from 'react';
import createPipelines from '@/utils/createPipelines'; 
import lipTriangles from '@/utils/lipTriangles'; 
import { FaceLandmarker, FilesetResolver } from '@mediapipe/tasks-vision';

export default function LipstickMirrorLive_Clone() {
  const canvasRef = useRef(null);
  const videoRef = useRef(null); 

  const animationFrameIdRef = useRef(null);
  const frameCounter = useRef(0);
  const resizeHandlerRef = useRef(null);
  
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

  const [landmarker, setLandmarker] = useState(null); 
  const [error, setError] = useState(null);
  const [debugMessage, setDebugMessage] = useState('Initializing...');
  
  useEffect(() => {
    console.log("[LML_Clone S2_LipsDebug] useEffect running.");
    let deviceInternal = null; let contextInternal = null; let formatInternal = null;
    let resizeObserverInternal = null; let renderLoopStartedInternal = false;
    
    const canvasElement = canvasRef.current; 
    const videoElement = videoRef.current;

    if (!canvasElement || !videoElement) {
      console.error("[LML_Clone S2_LipsDebug] Canvas or Video element not available.");
      setError("Canvas or Video element not found.");
      return;
    }

    const configureCanvas = (entries) => {
      if (!deviceInternal || !contextInternal || !formatInternal || !canvasRef.current) { console.warn("[LML_Clone S2_LipsDebug configureCanvas] Prerequisites not met."); return; }
      const currentCanvas = canvasRef.current;
      if (entries) { /* console.log("[LML_Clone S2_LipsDebug configureCanvas via RO]"); */ } 
      else { /* console.log("[LML_Clone S2_LipsDebug configureCanvas direct]"); */ }
      const dpr = window.devicePixelRatio || 1;
      const cw = currentCanvas.clientWidth; const ch = currentCanvas.clientHeight;
      if (cw === 0 || ch === 0) { console.warn(`[LML_Clone S2_LipsDebug configureCanvas] Canvas clientW/H is zero.`); return; }
      const tw = Math.floor(cw * dpr); const th = Math.floor(ch * dpr);
      // console.log(`[LML_Clone S2_LipsDebug configureCanvas] DPR:${dpr}, clientW/H:${cw}x${ch} => phys:${tw}x${th}`);
      if (currentCanvas.width !== tw || currentCanvas.height !== th) { currentCanvas.width = tw; currentCanvas.height = th; console.log(`[LML_Clone S2_LipsDebug configureCanvas] Canvas buffer SET:${tw}x${th}`); }
      else { /* console.log(`[LML_Clone S2_LipsDebug configureCanvas] Canvas size ${tw}x${th} OK.`); */ }
      try { 
          contextInternal.configure({ device: deviceInternal, format: formatInternal, alphaMode: 'opaque', size: [currentCanvas.width, currentCanvas.height] }); 
          // console.log(`[LML_Clone S2_LipsDebug configureCanvas] Context CONFIG. Size:${currentCanvas.width}x${currentCanvas.height}`); 
      }
      catch (e) { console.error("[LML_Clone S2_LipsDebug configureCanvas] Error config context:", e); setError("Error config context."); }
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
        if (frameCounter.current % 60 === 2 || frameCounter.current === 1) { 
            console.log(`[LML_Clone S2 RENDER ${frameCounter.current}] Attempting landmark detection. Landmarker: ${!!activeLandmarker}, VertexBuffer: ${!!pState.vertexBuffer}`);
        }
        try {
          const now = performance.now(); 
          const results = activeLandmarker.detectForVideo(currentVideoEl, now);
          
          if (results?.faceLandmarks?.length > 0) {
            const allFaceLm = results.faceLandmarks[0];
            if ((frameCounter.current % 60 === 2 || frameCounter.current === 1) && allFaceLm) { 
                console.log(`[LML_Clone S2 RENDER ${frameCounter.current}] Face landmarks detected. Count: ${allFaceLm.length}`);
            }

            const lips = lipTriangles.map(([idxA, idxB, idxC]) => {
                if (allFaceLm && idxA < allFaceLm.length && idxB < allFaceLm.length && idxC < allFaceLm.length &&
                    allFaceLm[idxA] && allFaceLm[idxB] && allFaceLm[idxC]) {
                    return [allFaceLm[idxA], allFaceLm[idxB], allFaceLm[idxC]];
                }
                if (frameCounter.current % 60 === 2 || frameCounter.current === 1) {
                    console.warn(`[LML_Clone S2 RENDER ${frameCounter.current}] Invalid landmark index in lipTriangles: ${idxA}, ${idxB}, or ${idxC} (Landmark count: ${allFaceLm?.length})`);
                }
                return null;
            }).filter(tri => tri !== null);

            if (lips.length > 0) {
                const lipVertexData = new Float32Array(lips.flat().map(pt => [(0.5 - pt.x) * 2, (0.5 - pt.y) * 2]).flat());
                numLipVertices = lipVertexData.length / 2;
                 if (frameCounter.current % 60 === 2 || frameCounter.current === 1) console.log(`[LML_Clone S2 RENDER ${frameCounter.current}] Calculated ${numLipVertices} lip vertices.`);

                if(lipVertexData.byteLength > 0){ 
                    if(lipVertexData.byteLength <= pState.vertexBufferSize) {
                        currentDevice.queue.writeBuffer(pState.vertexBuffer, 0, lipVertexData);
                    } else {
                        console.warn(`[LML_Clone S2 RENDER ${frameCounter.current}] Lip vertex data (${lipVertexData.byteLength}) too large for buffer (${pState.vertexBufferSize}).`);
                        numLipVertices = 0;
                    }
                } else {
                    if (frameCounter.current % 60 === 2 || frameCounter.current === 1) console.log(`[LML_Clone S2 RENDER ${frameCounter.current}] lipVertexData is empty (length 0).`);
                    numLipVertices = 0;
                }
            } else {
                if (frameCounter.current % 60 === 2 || frameCounter.current === 1) console.log(`[LML_Clone S2 RENDER ${frameCounter.current}] No valid lip triangles formed from landmarks.`);
                numLipVertices = 0;
            }
          } else {
            if (frameCounter.current % 60 === 2 || frameCounter.current === 1) {
                console.log(`[LML_Clone S2 RENDER ${frameCounter.current}] No face landmarks detected in results.`);
            }
            numLipVertices = 0; 
          }
        } catch (e) { 
            console.error(`[LML_Clone S2 RENDER ${frameCounter.current}] Error in landmarker processing:`, e);
            numLipVertices = 0; 
        }
      } else {
          if (frameCounter.current % 60 === 2 || frameCounter.current === 1) {
              console.log(`[LML_Clone S2 RENDER ${frameCounter.current}] Skipping landmark detection: Landmarker not ready (${!!activeLandmarker}) or VertexBuffer not ready (${!!pState.vertexBuffer}).`);
          }
      }
      // --- End MediaPipe ---

      let videoTextureGPU, frameBindGroupForTexture;
      try { /* ... video texture and bind group ... */ 
        videoTextureGPU = currentDevice.importExternalTexture({ source: currentVideoEl });
        if (pState.videoBindGroupLayout && pState.videoSampler) {
          frameBindGroupForTexture = currentDevice.createBindGroup({ layout: pState.videoBindGroupLayout, entries: [{binding:0,resource:pState.videoSampler},{binding:1,resource:videoTextureGPU}]});
        } else { animationFrameIdRef.current = requestAnimationFrame(render); return; }
      } catch (e) { animationFrameIdRef.current = requestAnimationFrame(render); return; }
      
      let currentGpuTexture, texView;
      try { /* ... current texture view ... */ 
        currentGpuTexture = currentContext.getCurrentTexture(); texView = currentGpuTexture.createView(); 
      }
      catch(e) { console.error(`[RENDER LML_Clone S2 ${frameCounter.current}] Error currentTex:`, e); if(resizeHandlerRef.current) resizeHandlerRef.current(); animationFrameIdRef.current = requestAnimationFrame(render); return; }
      
      if (frameCounter.current === 1 || frameCounter.current % 240 === 1) { console.log(`[RENDER LML_Clone S2 ${frameCounter.current}] Canvas: ${canvasRef.current.width}x${canvasRef.current.height}. GPU Tex: ${currentGpuTexture.width}x${currentGpuTexture.height}`); }

      const cmdEnc = currentDevice.createCommandEncoder({label: "LML_Clone_S2_Encoder"});
      const passEnc = cmdEnc.beginRenderPass({colorAttachments:[{view:texView,clearValue:{r:0.0,g:0.0,b:0.0,a:1.0},loadOp:'clear',storeOp:'store'}]});
      passEnc.setViewport(0,0,currentGpuTexture.width,currentGpuTexture.height,0,1);
      passEnc.setScissorRect(0,0,currentGpuTexture.width,currentGpuTexture.height);
      
      if (pState.videoPipeline && frameBindGroupForTexture && pState.aspectRatioBindGroup) {
        passEnc.setPipeline(pState.videoPipeline);
        passEnc.setBindGroup(0, frameBindGroupForTexture); 
        passEnc.setBindGroup(1, pState.aspectRatioBindGroup);
        passEnc.draw(6);
      }
      
      if(numLipVertices > 0 && pState.lipstickPipeline && pState.vertexBuffer){
        passEnc.setPipeline(pState.lipstickPipeline); 
        passEnc.setVertexBuffer(0, pState.vertexBuffer); 
        passEnc.draw(numLipVertices); 
        if (frameCounter.current % 60 === 2 || frameCounter.current === 1) console.log(`[LML_Clone S2 RENDER ${frameCounter.current}] EXECUTED LIP DRAW CALL for ${numLipVertices} vertices.`);
      } else {
        if ((frameCounter.current % 60 === 2 || frameCounter.current === 1) && pState.lipstickPipeline && pState.vertexBuffer) {
             console.log(`[LML_Clone S2 RENDER ${frameCounter.current}] SKIPPED LIP DRAW CALL. numLipVertices: ${numLipVertices}, lipstickPipe: ${!!pState.lipstickPipeline}, vertexBuf: ${!!pState.vertexBuffer}`);
        }
      }
      passEnc.end();
      currentDevice.queue.submit([cmdEnc.finish()]);

      if(frameCounter.current === 1) { console.log(`[RENDER LML_Clone S2 1] First full frame attempt (video+lips).`); }
      animationFrameIdRef.current = requestAnimationFrame(render);
    }; 

    const initializeAll = async () => { /* ... same as Stage 1.B ... */ 
      if (!navigator.gpu) { setError("WebGPU not supported."); return; }
      setDebugMessage("Initializing Lipstick Try-On (S2)...");
      try {
        console.log("[LML_Clone S2 initializeAll] Initializing FaceLandmarker...");
        const vision = await FilesetResolver.forVisionTasks('https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm');
        const lmInstance = await FaceLandmarker.createFromOptions(vision, { 
            baseOptions: { modelAssetPath: '/models/face_landmarker.task', delegate: 'GPU' },
            outputFaceBlendshapes: false, runningMode: 'VIDEO', numFaces: 1,
        });
        setLandmarker(lmInstance); 
        console.log("[LML_Clone S2 initializeAll] FaceLandmarker ready.");

        console.log("[LML_Clone S2 initializeAll] Initializing WebGPU Device & Format...");
        const adapter = await navigator.gpu.requestAdapter();
        if (!adapter) { setError("No GPU adapter."); return; }
        deviceInternal = await adapter.requestDevice(); deviceRef.current = deviceInternal;
        console.log("[LML_Clone S2 initializeAll] Device obtained.");
        deviceInternal.lost.then((info) => { /* ... */ });
        contextInternal = canvasElement.getContext('webgpu'); contextRef.current = contextInternal;
        if (!contextInternal) { setError('No WebGPU context.'); return; }
        formatInternal = navigator.gpu.getPreferredCanvasFormat(); formatRef.current = formatInternal;
        console.log("[LML_Clone S2 initializeAll] Context and Format obtained.");

        console.log("[LML_Clone S2 initializeAll] Creating pipelines and GPU resources...");
        const { videoPipeline, lipstickPipeline, videoBindGroupLayout, aspectRatioGroupLayout } = await createPipelines(deviceInternal, formatInternal);
        pipelineStateRef.current = { ...pipelineStateRef.current, videoPipeline, lipstickPipeline, videoBindGroupLayout, aspectRatioGroupLayout };
        const uniformBufferSize = 4 * Float32Array.BYTES_PER_ELEMENT;
        pipelineStateRef.current.aspectRatioUniformBuffer = deviceInternal.createBuffer({ size: uniformBufferSize, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST });
        if (aspectRatioGroupLayout && pipelineStateRef.current.aspectRatioUniformBuffer) {
            pipelineStateRef.current.aspectRatioBindGroup = deviceInternal.createBindGroup({ layout: aspectRatioGroupLayout, entries: [{ binding: 0, resource: { buffer: pipelineStateRef.current.aspectRatioUniformBuffer }}]});
        }
        pipelineStateRef.current.videoSampler = deviceInternal.createSampler({ magFilter: 'linear', minFilter: 'linear' });
        pipelineStateRef.current.vertexBuffer = deviceInternal.createBuffer({ size: pipelineStateRef.current.vertexBufferSize, usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST });
        console.log("[LML_Clone S2 initializeAll] All Pipelines and GPU resources created.");
        
        console.log("[LML_Clone S2 initializeAll] Setting up video element...");
        if (!navigator.mediaDevices?.getUserMedia) throw new Error("Camera not supported.");
        const stream = await navigator.mediaDevices.getUserMedia({ video: { width: 640, height: 480 } });
        videoElement.srcObject = stream;
        await new Promise((res, rej) => { 
            videoElement.onloadedmetadata = () => { console.log(`[LML_Clone S2 initializeAll] Video metadata: ${videoElement.videoWidth}x${videoElement.videoHeight}`); res(); };
            videoElement.onerror = () => rej(new Error("Video load error."));
        });
        await videoElement.play(); console.log("[LML_Clone S2 initializeAll] Video playback started.");
        
        resizeObserverInternal = new ResizeObserver(resizeHandlerRef.current);
        resizeObserverInternal.observe(canvasElement);
        console.log("[LML_Clone S2 initializeAll] ResizeObserver observing canvas.");
        if(resizeHandlerRef.current) resizeHandlerRef.current(); 
        else console.error("[LML_Clone S2 initializeAll] resizeHandlerRef.current is null");
        
        console.log("[LML_Clone S2 initializeAll] All sub-initializations complete.");
        if (!renderLoopStartedInternal) { console.log("[LML_Clone S2 initializeAll] Starting render loop."); render(); renderLoopStartedInternal = true; }
      } catch (err) { console.error("[LML_Clone S2 initializeAll] Major error:", err); setError(`Init S2 failed: ${err.message}`); }
    };
    initializeAll();
    return () => { /* ... cleanup (same as before) ... */
      console.log("[LML_Clone S2 MAIN_EFFECT_CLEANUP] Cleaning up.");
      if (animationFrameIdRef.current) cancelAnimationFrame(animationFrameIdRef.current);
      if (resizeObserverInternal && canvasRef.current) resizeObserverInternal.unobserve(canvasRef.current);
      if (resizeObserverInternal) resizeObserverInternal.disconnect();
      videoRef.current?.srcObject?.getTracks().forEach(track => track.stop());
      if(videoRef.current) videoRef.current.srcObject = null;
      const dvc = deviceRef.current; if (dvc) { pipelineStateRef.current.vertexBuffer?.destroy(); pipelineStateRef.current.aspectRatioUniformBuffer?.destroy(); }
      deviceRef.current = null; contextRef.current = null; formatRef.current = null; 
      setLandmarker(null); 
    };
  }, []);

  useEffect(() => { /* ... UI Message Effect (same as before, maybe update message) ... */ 
    if(landmarker && deviceRef.current && contextRef.current && pipelineStateRef.current.lipstickPipeline && !error) { 
        setDebugMessage("Live Lipstick Try-On (S2)");
    } else if (error) {
        setDebugMessage(`Error: ${String(error).substring(0,30)}...`);
    } else {
        setDebugMessage("Initializing Lipstick Try-On (S2)...");
    }
  }, [landmarker, deviceRef.current, contextRef.current, pipelineStateRef.current.lipstickPipeline, error]);

  return ( /* ... JSX for Full Viewport Parent (same as Stage 1.B) ... */
    <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, overflow: 'hidden', margin: 0, padding: 0, background: 'darkslateblue' }}>
      <div style={{ position:'absolute',top:'5px',left:'5px',background:'rgba(0,0,0,0.7)',color:'white',padding:'2px 5px',fontSize:'12px',zIndex:10,pointerEvents:'none'}}>
        {debugMessage} (Frame: {frameCounter.current})
      </div>
      <video ref={videoRef} style={{ display: 'none' }} width={640} height={480} autoPlay playsInline muted />
      <canvas ref={canvasRef} width={640} height={480} style={{ width: '100%', height: '100%', display: 'block', background: 'lightpink' }} />
    </div>
  );
}