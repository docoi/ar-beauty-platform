// src/pages/LipstickMirrorLive_Clone.jsx

import React, { useEffect, useRef, useState } from 'react';
import createPipelines from '@/utils/createPipelines';
import lipTriangles from '@/utils/lipTriangles';
import { FaceLandmarker, FilesetResolver } from '@mediapipe/tasks-vision';

// Define some lipstick colors (R, G, B, A - values 0.0 to 1.0)
const LIPSTICK_COLORS = [
  { name: 'Nude Pink', value: [228/255, 170/255, 170/255, 0.7] }, // #E4AAAA
  { name: 'Classic Red', value: [200/255, 0/255, 0/255, 0.75] },   // #C80000
  { name: 'Deep Plum', value: [100/255, 20/255, 50/255, 0.7] },    // #641432
  { name: 'Coral Burst', value: [255/255, 100/255, 80/255, 0.7] }, // #FF6450
  { name: 'Soft Mauve', value: [180/255, 120/255, 150/255, 0.65] },// #B47896
  { name: 'Original Yellow', value: [1.0, 1.0, 0.0, 0.7] }, // For testing
];

export default function LipstickMirrorLive_Clone() {
  const canvasRef = useRef(null);
  const videoRef = useRef(null);

  const animationFrameIdRef = useRef(null);
  const frameCounter = useRef(0);
  const resizeHandlerRef = useRef(null);

  const deviceRef = useRef(null);
  const contextRef = useRef(null);
  const formatRef = useRef(null);
  const landmarkerRef = useRef(null);

  // NEW: State for selected lipstick color
  const [selectedColor, setSelectedColor] = useState(LIPSTICK_COLORS[0].value);

  const pipelineStateRef = useRef({
    videoPipeline: null, lipstickPipeline: null, videoBindGroupLayout: null,
    aspectRatioGroupLayout: null, aspectRatioUniformBuffer: null, aspectRatioBindGroup: null,
    // NEW: Lipstick material uniform buffer and bind group
    lipstickMaterialGroupLayout: null, // Will be populated by createPipelines
    lipstickMaterialUniformBuffer: null,
    lipstickMaterialBindGroup: null,
    videoSampler: null, vertexBuffer: null, vertexBufferSize: 2048,
  });

  const [landmarkerState, setLandmarkerState] = useState(null);
  const [error, setError] = useState(null);
  const [debugMessage, setDebugMessage] = useState('Initializing...');

  useEffect(() => {
    console.log("[LML_Clone ColorSelect] useEffect running.");
    let deviceInternal = null; let contextInternal = null; let formatInternal = null;
    let resizeObserverInternal = null; let renderLoopStartedInternal = false;

    const canvasElement = canvasRef.current;
    const videoElement = videoRef.current;

    if (!canvasElement || !videoElement) { /* ... */ return; }

    const configureCanvas = (entries) => { /* ... Same as before ... */
      if (!deviceInternal || !contextInternal || !formatInternal || !canvasRef.current) { return; }
      const currentCanvas = canvasRef.current;
      if (entries) { /* RO log */ } else { /* direct call log */ }
      const dpr = window.devicePixelRatio || 1;
      const cw = currentCanvas.clientWidth; const ch = currentCanvas.clientHeight;
      if (cw === 0 || ch === 0) { return; }
      const tw = Math.floor(cw * dpr); const th = Math.floor(ch * dpr);
      if (currentCanvas.width !== tw || currentCanvas.height !== th) { currentCanvas.width = tw; currentCanvas.height = th; console.log(`[LML_Clone ColorSelect configureCanvas] Canvas buffer SET:${tw}x${th}`); }
      try {
        contextInternal.configure({ device: deviceInternal, format: formatInternal, alphaMode: 'opaque', size: [currentCanvas.width, currentCanvas.height] });
        if (frameCounter.current < 2 || (entries && frameCounter.current % 60 === 1)) console.log(`[LML_Clone ColorSelect configureCanvas] Context CONFIG. Size:${currentCanvas.width}x${currentCanvas.height}`);
      } catch (e) { setError("Error config context."); }
    };
    resizeHandlerRef.current = configureCanvas;

    const render = async () => {
      const currentDevice = deviceRef.current; const currentContext = contextRef.current;
      const currentVideoEl = videoRef.current; const pState = pipelineStateRef.current;
      const activeLandmarker = landmarkerRef.current;
      // Check for new lipstickMaterialBindGroup as well
      if (!currentDevice || !currentContext || !pState.videoPipeline || !pState.lipstickPipeline || !pState.aspectRatioBindGroup || !pState.lipstickMaterialBindGroup || !currentVideoEl) {
        animationFrameIdRef.current = requestAnimationFrame(render); return;
      }
      frameCounter.current++;
      if (currentVideoEl.readyState < currentVideoEl.HAVE_ENOUGH_DATA || currentVideoEl.videoWidth === 0) { animationFrameIdRef.current = requestAnimationFrame(render); return; }

      // Update aspect ratio uniform buffer (remains the same)
      if (pState.aspectRatioUniformBuffer) {
        const aspectRatioData = new Float32Array([currentVideoEl.videoWidth, currentVideoEl.videoHeight, currentContext.canvas.width, currentContext.canvas.height]);
        currentDevice.queue.writeBuffer(pState.aspectRatioUniformBuffer, 0, aspectRatioData);
      }

      // NEW: Update lipstick material uniform buffer (color)
      if (pState.lipstickMaterialUniformBuffer) {
        const colorData = new Float32Array(selectedColor); // selectedColor is already [r,g,b,a]
        currentDevice.queue.writeBuffer(pState.lipstickMaterialUniformBuffer, 0, colorData);
      }

      let numLipVertices = 0;
      if (activeLandmarker && pState.vertexBuffer) {
        try {
          const now = performance.now(); const results = activeLandmarker.detectForVideo(currentVideoEl, now);
          if (results?.faceLandmarks?.length > 0) {
            const allFaceLm = results.faceLandmarks[0];
            const lips = lipTriangles.map(([idxA, idxB, idxC]) => { if (allFaceLm && idxA < allFaceLm.length && idxB < allFaceLm.length && idxC < allFaceLm.length && allFaceLm[idxA] && allFaceLm[idxB] && allFaceLm[idxC]) { return [allFaceLm[idxA], allFaceLm[idxB], allFaceLm[idxC]]; } return null; }).filter(tri => tri !== null);
            if (lips.length > 0) {
              const lipVertexData = new Float32Array(lips.flat().map(pt => [(0.5 - pt.x) * 2, (0.5 - pt.y) * 2]).flat());
              numLipVertices = lipVertexData.length / 2;
              if (lipVertexData.byteLength > 0) { if (lipVertexData.byteLength <= pState.vertexBufferSize) { currentDevice.queue.writeBuffer(pState.vertexBuffer, 0, lipVertexData); } else { numLipVertices = 0; } } else { numLipVertices = 0; }
            } else { numLipVertices = 0; }
          } else { numLipVertices = 0; }
        } catch (e) { numLipVertices = 0; }
      }
      let videoTextureGPU, frameBindGroupForTexture; try { videoTextureGPU = currentDevice.importExternalTexture({ source: currentVideoEl }); if (pState.videoBindGroupLayout && pState.videoSampler) { frameBindGroupForTexture = currentDevice.createBindGroup({ layout: pState.videoBindGroupLayout, entries: [{ binding: 0, resource: pState.videoSampler }, { binding: 1, resource: videoTextureGPU }] }); } else { animationFrameIdRef.current = requestAnimationFrame(render); return; } } catch (e) { animationFrameIdRef.current = requestAnimationFrame(render); return; }
      let currentGpuTexture, texView; try { currentGpuTexture = currentContext.getCurrentTexture(); texView = currentGpuTexture.createView(); } catch (e) { if (resizeHandlerRef.current) resizeHandlerRef.current(); animationFrameIdRef.current = requestAnimationFrame(render); return; }
      const cmdEnc = currentDevice.createCommandEncoder(); const passEnc = cmdEnc.beginRenderPass({ colorAttachments: [{ view: texView, clearValue: { r: 0.0, g: 0.0, b: 0.0, a: 1.0 }, loadOp: 'clear', storeOp: 'store' }] });
      passEnc.setViewport(0, 0, currentGpuTexture.width, currentGpuTexture.height, 0, 1); passEnc.setScissorRect(0, 0, currentGpuTexture.width, currentGpuTexture.height);
      if (pState.videoPipeline && frameBindGroupForTexture && pState.aspectRatioBindGroup) { passEnc.setPipeline(pState.videoPipeline); passEnc.setBindGroup(0, frameBindGroupForTexture); passEnc.setBindGroup(1, pState.aspectRatioBindGroup); passEnc.draw(6); }
      
      // MODIFIED: Pass the new lipstickMaterialBindGroup as group 1
      if (numLipVertices > 0 && pState.lipstickPipeline && pState.vertexBuffer && pState.aspectRatioBindGroup && pState.lipstickMaterialBindGroup) {
        passEnc.setPipeline(pState.lipstickPipeline);
        passEnc.setBindGroup(0, pState.aspectRatioBindGroup); // Group 0 for aspect ratios (vertex shader)
        passEnc.setBindGroup(1, pState.lipstickMaterialBindGroup); // Group 1 for material (fragment shader)
        passEnc.setVertexBuffer(0, pState.vertexBuffer);
        passEnc.draw(numLipVertices);
        if (frameCounter.current === 1 || frameCounter.current % 60 === 1) console.log(`[LML_Clone ColorSelect RENDER] Drawing ${numLipVertices} lip vertices.`);
      }
      passEnc.end(); currentDevice.queue.submit([cmdEnc.finish()]);
      if (frameCounter.current === 1) { console.log(`[LML_Clone ColorSelect RENDER 1] First full frame (video+lips).`); }
      animationFrameIdRef.current = requestAnimationFrame(render);
    };

    const initializeAll = async () => {
      if (!navigator.gpu) { setError("WebGPU not supported."); return; }
      setDebugMessage("Initializing Color Select...");
      try {
        const vision = await FilesetResolver.forVisionTasks('https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm');
        const lmInstance = await FaceLandmarker.createFromOptions(vision, { baseOptions: { modelAssetPath: '/models/face_landmarker.task', delegate: 'GPU' }, outputFaceBlendshapes: false, runningMode: 'VIDEO', numFaces: 1, });
        landmarkerRef.current = lmInstance; setLandmarkerState(lmInstance); console.log("[LML_Clone ColorSelect] FaceLandmarker ready.");

        const adapter = await navigator.gpu.requestAdapter(); deviceInternal = await adapter.requestDevice(); deviceRef.current = deviceInternal;
        deviceInternal.lost.then(() => { /* ... */ });
        contextInternal = canvasElement.getContext('webgpu'); contextRef.current = contextInternal;
        formatInternal = navigator.gpu.getPreferredCanvasFormat(); formatRef.current = formatInternal;
        console.log("[LML_Clone ColorSelect] Device, Context, Format obtained.");

        // createPipelines will now also return lipstickMaterialGroupLayout
        const { videoPipeline, lipstickPipeline, videoBindGroupLayout, aspectRatioGroupLayout, lipstickMaterialGroupLayout } = await createPipelines(deviceInternal, formatInternal);
        const currentVertexBufferSize = pipelineStateRef.current.vertexBufferSize || 2048;
        pipelineStateRef.current = { ...pipelineStateRef.current, videoPipeline, lipstickPipeline, videoBindGroupLayout, aspectRatioGroupLayout, lipstickMaterialGroupLayout }; // Store the new layout

        // Aspect Ratio Uniform Buffer (remains the same size)
        const aspectRatioUniformBufferSize = 4 * Float32Array.BYTES_PER_ELEMENT;
        pipelineStateRef.current.aspectRatioUniformBuffer = deviceInternal.createBuffer({ size: aspectRatioUniformBufferSize, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST });
        if (aspectRatioGroupLayout && pipelineStateRef.current.aspectRatioUniformBuffer) {
          pipelineStateRef.current.aspectRatioBindGroup = deviceInternal.createBindGroup({ layout: aspectRatioGroupLayout, entries: [{ binding: 0, resource: { buffer: pipelineStateRef.current.aspectRatioUniformBuffer } }] });
        }
        
        // NEW: Lipstick Material Uniform Buffer (for color)
        const lipstickMaterialUniformBufferSize = 4 * Float32Array.BYTES_PER_ELEMENT; // 4 floats for RGBA
        pipelineStateRef.current.lipstickMaterialUniformBuffer = deviceInternal.createBuffer({
            label: "Lipstick Material Uniform Buffer",
            size: lipstickMaterialUniformBufferSize,
            usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
        });
        // NEW: Create Bind Group for lipstick material
        if (lipstickMaterialGroupLayout && pipelineStateRef.current.lipstickMaterialUniformBuffer) {
            pipelineStateRef.current.lipstickMaterialBindGroup = deviceInternal.createBindGroup({
                label: "Lipstick Material Bind Group",
                layout: lipstickMaterialGroupLayout,
                entries: [{ binding: 0, resource: { buffer: pipelineStateRef.current.lipstickMaterialUniformBuffer }}],
            });
        }

        pipelineStateRef.current.videoSampler = deviceInternal.createSampler({ magFilter: 'linear', minFilter: 'linear' });
        pipelineStateRef.current.vertexBuffer = deviceInternal.createBuffer({ size: currentVertexBufferSize, usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST });
        console.log("[LML_Clone ColorSelect] Pipelines & GPU resources created.");

        const stream = await navigator.mediaDevices.getUserMedia({ video: { width: 640, height: 480 } });
        videoElement.srcObject = stream; await new Promise((res) => { videoElement.onloadedmetadata = () => { res(); }; });
        await videoElement.play(); console.log("[LML_Clone ColorSelect] Video playback started.");

        resizeObserverInternal = new ResizeObserver(resizeHandlerRef.current); resizeObserverInternal.observe(canvasElement);
        if (resizeHandlerRef.current) resizeHandlerRef.current();
        console.log("[LML_Clone ColorSelect] All sub-initializations complete.");
        if (!renderLoopStartedInternal) { render(); renderLoopStartedInternal = true; }
      } catch (err) { setError(`Init ColorSelect failed: ${err.message.substring(0, 50)}...`); console.error("[LML_Clone ColorSelect initializeAll] Major error:", err); }
    };
    initializeAll();
    return () => { /* ... Same cleanup, but add new buffer destruction ... */
      if (animationFrameIdRef.current) cancelAnimationFrame(animationFrameIdRef.current);
      if (resizeObserverInternal && canvasRef.current) resizeObserverInternal.unobserve(canvasRef.current);
      if (resizeObserverInternal) resizeObserverInternal.disconnect();
      videoRef.current?.srcObject?.getTracks().forEach(track => track.stop());
      if (videoRef.current) videoRef.current.srcObject = null;
      const dvc = deviceRef.current;
      if (dvc) {
        pipelineStateRef.current.vertexBuffer?.destroy();
        pipelineStateRef.current.aspectRatioUniformBuffer?.destroy();
        pipelineStateRef.current.lipstickMaterialUniformBuffer?.destroy(); // NEW: Destroy
      }
      deviceRef.current = null; contextRef.current = null; formatRef.current = null;
      landmarkerRef.current = null; setLandmarkerState(null);
    };
  }, []); // Empty dependency array ensures this runs once on mount

  useEffect(() => { /* ... Same UI Message Effect ... */
    if (landmarkerState && deviceRef.current && contextRef.current && pipelineStateRef.current.lipstickPipeline && !error) {
      setDebugMessage("Live Active (Color Select)");
    } else if (error) {
      setDebugMessage(`Error`);
    } else {
      setDebugMessage("Initializing (Color Select)...");
    }
  }, [landmarkerState, deviceRef.current, contextRef.current, pipelineStateRef.current.lipstickPipeline, error]);

  return (
    <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, overflow: 'hidden', margin: 0, padding: 0, background: 'darkslateblue' }}>
      <div style={{ position: 'absolute', top: '5px', left: '5px', background: 'rgba(0,0,0,0.7)', color: 'white', padding: '2px 5px', fontSize: '12px', zIndex: 20, pointerEvents: 'none' }}>
        {debugMessage} (Frame: {frameCounter.current})
      </div>

      {/* NEW: Color Swatches UI */}
      <div style={{
        position: 'absolute',
        bottom: '20px',
        left: '50%',
        transform: 'translateX(-50%)',
        display: 'flex',
        gap: '10px',
        padding: '10px',
        backgroundColor: 'rgba(255, 255, 255, 0.2)',
        borderRadius: '10px',
        zIndex: 10
      }}>
        {LIPSTICK_COLORS.map(color => (
          <div
            key={color.name}
            title={color.name}
            onClick={() => setSelectedColor(color.value)}
            style={{
              width: '40px',
              height: '40px',
              backgroundColor: `rgba(${color.value[0]*255}, ${color.value[1]*255}, ${color.value[2]*255}, ${color.value[3]})`,
              borderRadius: '50%',
              border: selectedColor === color.value ? '3px solid white' : '3px solid transparent',
              cursor: 'pointer',
              transition: 'border 0.2s ease-in-out'
            }}
          />
        ))}
      </div>

      <video ref={videoRef} style={{ display: 'none' }} width={640} height={480} autoPlay playsInline muted />
      <canvas ref={canvasRef} width={640} height={480} style={{ width: '100%', height: '100%', display: 'block', background: 'lightpink' }} />
    </div>
  );
}