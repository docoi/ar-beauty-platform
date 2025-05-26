// src/pages/LipstickMirrorLive_Clone.jsx

import React, { useEffect, useRef, useState } from 'react';
import createPipelines from '@/utils/createPipelines';
import lipTriangles from '@/utils/lipTriangles';
import { FaceLandmarker, FilesetResolver } from '@mediapipe/tasks-vision';

const LIPSTICK_COLORS = [
  { name: 'Nude Pink', value: [228/255, 170/255, 170/255, 0.85] },
  { name: 'Classic Red', value: [200/255, 0/255, 0/255, 0.9] },
  { name: 'Deep Plum', value: [100/255, 20/255, 50/255, 0.85] },
  { name: 'Coral Burst', value: [255/255, 100/255, 80/255, 0.8] },
  { name: 'Soft Mauve', value: [180/255, 120/255, 150/255, 0.8] },
  { name: 'Highlight Gloss', value: [1.0, 1.0, 1.0, 0.3] },
];

async function loadImageBitmap(url) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch image ${url}: ${response.statusText}`);
  }
  const blob = await response.blob();
  return createImageBitmap(blob);
}

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

  const [selectedColorUI, setSelectedColorUI] = useState(LIPSTICK_COLORS[0].value);
  const selectedColorForRenderRef = useRef(LIPSTICK_COLORS[0].value);

  const pipelineStateRef = useRef({
    videoPipeline: null, lipstickPipeline: null, videoBindGroupLayout: null,
    aspectRatioGroupLayout: null, aspectRatioUniformBuffer: null, aspectRatioBindGroup: null,
    lipstickMaterialGroupLayout: null,
    lipstickMaterialUniformBuffer: null,
    lipstickMaterialBindGroup: null,
    videoSampler: null, vertexBuffer: null, vertexBufferSize: 2048 * 2, // Increased for UVs
    lipstickAlbedoTexture: null,
    lipstickAlbedoTextureView: null,
    lipstickAlbedoSampler: null,
  });

  const [landmarkerState, setLandmarkerState] = useState(null);
  const [error, setError] = useState(null);
  const [debugMessage, setDebugMessage] = useState('Initializing...');

  useEffect(() => {
    selectedColorForRenderRef.current = selectedColorUI;
    // console.log('[LML_Clone Texture] selectedColorForRenderRef updated to:', selectedColorUI);
  }, [selectedColorUI]);

  useEffect(() => {
    console.log("[LML_Clone Texture] Main useEffect running.");
    let deviceInternal = null; let contextInternal = null; let formatInternal = null;
    let resizeObserverInternal = null; let renderLoopStartedInternal = false;

    const canvasElement = canvasRef.current;
    const videoElement = videoRef.current;
    if (!canvasElement || !videoElement) {
        setError("Canvas or Video element not found.");
        console.error("[LML_Clone Texture] Canvas or Video element not found on mount.");
        return;
    }

    const configureCanvas = (entries) => {
      if (!deviceInternal || !contextInternal || !formatInternal || !canvasRef.current) { return; }
      const currentCanvas = canvasRef.current;
      const dpr = window.devicePixelRatio || 1;
      const cw = currentCanvas.clientWidth; const ch = currentCanvas.clientHeight;
      if (cw === 0 || ch === 0) { return; }
      const tw = Math.floor(cw * dpr); const th = Math.floor(ch * dpr);
      if (currentCanvas.width !== tw || currentCanvas.height !== th) { currentCanvas.width = tw; currentCanvas.height = th; }
      try { contextInternal.configure({ device: deviceInternal, format: formatInternal, alphaMode: 'opaque', size: [currentCanvas.width, currentCanvas.height] });}
      catch (e) { setError("Error config context: " + e.message); console.error("Error config context:", e); }
    };
    resizeHandlerRef.current = configureCanvas;

    const render = async () => {
      const currentDevice = deviceRef.current; const currentContext = contextRef.current;
      const currentVideoEl = videoRef.current; const pState = pipelineStateRef.current; // Ok to use alias here as it's read-only for this part
      const activeLandmarker = landmarkerRef.current;

      if (!currentDevice || !currentContext || !pState.videoPipeline || !pState.lipstickPipeline ||
          !pState.aspectRatioBindGroup || !pState.lipstickMaterialBindGroup ||
          // !pState.lipstickAlbedoTextureView || // Texture might not be ready if loading failed, shader should handle or bind group creation should have failed
          !currentVideoEl) {
        animationFrameIdRef.current = requestAnimationFrame(render); return;
      }
      frameCounter.current++;
      if (currentVideoEl.readyState < currentVideoEl.HAVE_ENOUGH_DATA || currentVideoEl.videoWidth === 0 || currentVideoEl.videoHeight === 0) {
        animationFrameIdRef.current = requestAnimationFrame(render); return;
      }

      if (pState.aspectRatioUniformBuffer) {
        const aspectRatioData = new Float32Array([currentVideoEl.videoWidth, currentVideoEl.videoHeight, currentContext.canvas.width, currentContext.canvas.height]);
        currentDevice.queue.writeBuffer(pState.aspectRatioUniformBuffer, 0, aspectRatioData);
      }

      if (pState.lipstickMaterialUniformBuffer) {
        // if (frameCounter.current % 60 === 1) { console.log("[LML_Clone Texture RENDER] Writing tint/alpha to GPU buffer:", selectedColorForRenderRef.current); }
        const colorData = new Float32Array(selectedColorForRenderRef.current);
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
              const lipVertexData = new Float32Array(
                lips.flat().flatMap(pt => [
                  (0.5 - pt.x) * 2, (0.5 - pt.y) * 2, pt.x, pt.y // PosX, PosY, UV_U, UV_V (try 1.0 - pt.y for UV_V if texture is upside down)
                ])
              );
              numLipVertices = lipVertexData.length / 4;
              if (lipVertexData.byteLength > 0) { if (lipVertexData.byteLength <= pState.vertexBufferSize) { currentDevice.queue.writeBuffer(pState.vertexBuffer, 0, lipVertexData); } else { console.warn("[LML_Clone Texture RENDER] Lip vertex data (with UVs) too large for buffer."); numLipVertices = 0; } } else { numLipVertices = 0; }
            } else { numLipVertices = 0; }
          } else { numLipVertices = 0; }
        } catch (e) { console.error("[LML_Clone Texture RENDER] Error in landmarker processing:", e); numLipVertices = 0; }
      }

      let videoTextureGPU, frameBindGroupForTexture; try { videoTextureGPU = currentDevice.importExternalTexture({ source: currentVideoEl }); if (pState.videoBindGroupLayout && pState.videoSampler) { frameBindGroupForTexture = currentDevice.createBindGroup({ layout: pState.videoBindGroupLayout, entries: [{ binding: 0, resource: pState.videoSampler }, { binding: 1, resource: videoTextureGPU }] }); } else { animationFrameIdRef.current = requestAnimationFrame(render); return; } } catch (e) { console.error("[LML_Clone RENDER] Error importing video texture:", e); animationFrameIdRef.current = requestAnimationFrame(render); return; }
      let currentGpuTexture, texView; try { currentGpuTexture = currentContext.getCurrentTexture(); texView = currentGpuTexture.createView(); } catch (e) { console.warn("[LML_Clone RENDER] Error getting current texture, trying to reconfigure canvas.", e); if (resizeHandlerRef.current) resizeHandlerRef.current(); animationFrameIdRef.current = requestAnimationFrame(render); return; }
      const cmdEnc = currentDevice.createCommandEncoder(); const passEnc = cmdEnc.beginRenderPass({ colorAttachments: [{ view: texView, clearValue: { r: 0.0, g: 0.0, b: 0.0, a: 1.0 }, loadOp: 'clear', storeOp: 'store' }] });
      passEnc.setViewport(0, 0, currentGpuTexture.width, currentGpuTexture.height, 0, 1); passEnc.setScissorRect(0, 0, currentGpuTexture.width, currentGpuTexture.height);
      if (pState.videoPipeline && frameBindGroupForTexture && pState.aspectRatioBindGroup) { passEnc.setPipeline(pState.videoPipeline); passEnc.setBindGroup(0, frameBindGroupForTexture); passEnc.setBindGroup(1, pState.aspectRatioBindGroup); passEnc.draw(6); }

      if (numLipVertices > 0 && pState.lipstickPipeline && pState.vertexBuffer && pState.aspectRatioBindGroup && pState.lipstickMaterialBindGroup) {
        passEnc.setPipeline(pState.lipstickPipeline);
        passEnc.setBindGroup(0, pState.aspectRatioBindGroup);
        passEnc.setBindGroup(1, pState.lipstickMaterialBindGroup);
        passEnc.setVertexBuffer(0, pState.vertexBuffer);
        passEnc.draw(numLipVertices);
      }
      passEnc.end(); currentDevice.queue.submit([cmdEnc.finish()]);
      animationFrameIdRef.current = requestAnimationFrame(render);
    };

    const initializeAll = async () => {
        if (!navigator.gpu) { setError("WebGPU not supported."); return; }
        setDebugMessage("Initializing Texture Mode...");
        try {
            // --- Load Lipstick Albedo Texture FIRST ---
            let lipstickAlbedoImageBitmap;
            try {
                lipstickAlbedoImageBitmap = await loadImageBitmap('/textures/lipstick_albedo.png');
              console.log("[LML_Clone Texture] Lipstick albedo texture loaded successfully.", lipstickAlbedoImageBitmap.width, lipstickAlbedoImageBitmap.height);
            } catch (texError) {
              console.error("[LML_Clone Texture] Failed to load lipstick albedo texture:", texError);
              setError("Failed to load lipstick texture.");
              // Decide on fallback: for now, we proceed, bind group creation might fail or be partial.
            }

            // --- Standard Initializations ---
            const vision = await FilesetResolver.forVisionTasks('https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm');
            const lmInstance = await FaceLandmarker.createFromOptions(vision, { baseOptions: { modelAssetPath: '/models/face_landmarker.task', delegate: 'GPU' }, outputFaceBlendshapes: false, runningMode: 'VIDEO', numFaces: 1 });
            landmarkerRef.current = lmInstance; setLandmarkerState(lmInstance);

            const adapter = await navigator.gpu.requestAdapter(); if (!adapter) throw new Error("No WebGPU adapter found.");
            deviceInternal = await adapter.requestDevice(); deviceRef.current = deviceInternal;
            deviceInternal.lost.then((info) => {
                console.error(`Device lost: ${info.message}`); setError("Device lost");
                deviceRef.current = null; contextRef.current = null; // Prevent further operations
                if (animationFrameIdRef.current) cancelAnimationFrame(animationFrameIdRef.current);
            });
            contextInternal = canvasElement.getContext('webgpu'); contextRef.current = contextInternal;
            formatInternal = navigator.gpu.getPreferredCanvasFormat(); formatRef.current = formatInternal;

            // --- Create Pipelines ---
            const { videoPipeline, lipstickPipeline, videoBindGroupLayout, aspectRatioGroupLayout, lipstickMaterialGroupLayout } = await createPipelines(deviceInternal, formatInternal);
            if (!videoPipeline || !lipstickPipeline) throw new Error("Pipeline creation failed");

            // Update the ref with new pipeline and layout info, preserving existing values like vertexBufferSize
            pipelineStateRef.current = {
                ...pipelineStateRef.current,
                videoPipeline, lipstickPipeline, videoBindGroupLayout,
                aspectRatioGroupLayout, lipstickMaterialGroupLayout
            };

            // --- Aspect Ratio Uniforms ---
            const aspectRatioUniformBufferSize = 4 * Float32Array.BYTES_PER_ELEMENT;
            pipelineStateRef.current.aspectRatioUniformBuffer = deviceInternal.createBuffer({ label: "Aspect Ratio Uniform Buffer", size: aspectRatioUniformBufferSize, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST });
            if (pipelineStateRef.current.aspectRatioGroupLayout && pipelineStateRef.current.aspectRatioUniformBuffer) {
              pipelineStateRef.current.aspectRatioBindGroup = deviceInternal.createBindGroup({ label: "Aspect Ratio Bind Group", layout: pipelineStateRef.current.aspectRatioGroupLayout, entries: [{ binding: 0, resource: { buffer: pipelineStateRef.current.aspectRatioUniformBuffer }}]});
            } else { throw new Error("Failed to create aspect ratio bind group (layout or buffer missing)."); }


            // --- Lipstick GPU Texture and Sampler ---
            if (lipstickAlbedoImageBitmap) { // Only if texture loaded successfully
                const textureDescriptor = {
                    label: "Lipstick Albedo Texture",
                    size: [lipstickAlbedoImageBitmap.width, lipstickAlbedoImageBitmap.height],
                    format: 'rgba8unorm',
                    usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST | GPUTextureUsage.RENDER_ATTACHMENT,
                };
                pipelineStateRef.current.lipstickAlbedoTexture = deviceInternal.createTexture(textureDescriptor);
                deviceInternal.queue.copyExternalImageToTexture(
                    { source: lipstickAlbedoImageBitmap },
                    { texture: pipelineStateRef.current.lipstickAlbedoTexture },
                    [lipstickAlbedoImageBitmap.width, lipstickAlbedoImageBitmap.height]
                );
                pipelineStateRef.current.lipstickAlbedoTextureView = pipelineStateRef.current.lipstickAlbedoTexture.createView();
                pipelineStateRef.current.lipstickAlbedoSampler = deviceInternal.createSampler({
                    label: "Lipstick Albedo Sampler",
                    magFilter: 'linear', minFilter: 'linear', mipmapFilter: 'linear',
                    addressModeU: 'clamp-to-edge', addressModeV: 'clamp-to-edge',
                });
                console.log("[LML_Clone Texture] Lipstick GPU Texture and Sampler created.");
            }

            // --- Lipstick Material Uniform Buffer (for tint/alpha) ---
            const lipstickMaterialUniformBufferSize = 4 * Float32Array.BYTES_PER_ELEMENT;
            pipelineStateRef.current.lipstickMaterialUniformBuffer = deviceInternal.createBuffer({ label: "Lipstick Material Tint Uniform Buffer", size: lipstickMaterialUniformBufferSize, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST });

            // --- Lipstick Material Bind Group ---
            if (pipelineStateRef.current.lipstickMaterialGroupLayout && pipelineStateRef.current.lipstickMaterialUniformBuffer) {
                const entries = [{ binding: 0, resource: { buffer: pipelineStateRef.current.lipstickMaterialUniformBuffer }}];
                if (lipstickAlbedoImageBitmap && pipelineStateRef.current.lipstickAlbedoTextureView && pipelineStateRef.current.lipstickAlbedoSampler) {
                    // Only add texture entries if bitmap was loaded AND GPU resources for it were created
                    entries.push({ binding: 1, resource: pipelineStateRef.current.lipstickAlbedoTextureView });
                    entries.push({ binding: 2, resource: pipelineStateRef.current.lipstickAlbedoSampler });
                    console.log("[LML_Clone Texture] Creating Material Bind Group WITH Texture.");
                } else {
                    console.warn("[LML_Clone Texture] Creating Material Bind Group WITHOUT Texture (texture or its GPU resources missing). Shader might not work as expected if it requires these bindings.");
                    // This branch means the shader must be able to function without texture bindings 1 & 2,
                    // or the layout provided by createPipelines for lipstickMaterialGroupLayout must not strictly require them.
                    // Our current createPipelines.js *does* define them, so this path would lead to a validation error if texture failed.
                    // A more robust solution would be two different layouts/pipelines or shader using #ifdefs.
                    // For now, if lipstickAlbedoImageBitmap is null, this path will be taken. If it was loaded but GPU resources failed, it's an issue.
                    if (lipstickAlbedoImageBitmap) { // Texture was loaded, but GPU resources for it are missing
                        throw new Error("Texture loaded, but GPU texture/sampler resources are missing for bind group creation.");
                    }
                }
                pipelineStateRef.current.lipstickMaterialBindGroup = deviceInternal.createBindGroup({
                    label: "Lipstick Material Bind Group",
                    layout: pipelineStateRef.current.lipstickMaterialGroupLayout,
                    entries: entries,
                });
                 console.log("[LML_Clone Texture] Lipstick Material Bind Group created (entries length: " + entries.length + ").");
            } else {
                throw new Error("Failed to create lipstick material bind group (layout or uniform buffer missing).");
            }

            // --- Vertex Buffer ---
            const currentVertexBufferSize = pipelineStateRef.current.vertexBufferSize;
            pipelineStateRef.current.vertexBuffer = deviceInternal.createBuffer({ label: "Lip Vertex Buffer (Pos+UV)", size: currentVertexBufferSize, usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST });
            pipelineStateRef.current.videoSampler = deviceInternal.createSampler({ magFilter: 'linear', minFilter: 'linear' });
            console.log("[LML_Clone Texture] Other GPU resources (vertex buffer, video sampler) created.");

            // --- Video Setup and Start ---
            const stream = await navigator.mediaDevices.getUserMedia({ video: { width: 640, height: 480 } });
            videoElement.srcObject = stream;
            await new Promise((res, rej) => { videoElement.onloadedmetadata = res; videoElement.onerror = () => rej(new Error("Video metadata loading error."));});
            await videoElement.play();
            console.log("[LML_Clone Texture] Video playback started.");

            resizeObserverInternal = new ResizeObserver(resizeHandlerRef.current);
            resizeObserverInternal.observe(canvasElement);
            if (resizeHandlerRef.current) resizeHandlerRef.current();
            console.log("[LML_Clone Texture] All sub-initializations complete.");
            if (!renderLoopStartedInternal) { render(); renderLoopStartedInternal = true; }
        } catch (err) {
            setError(`Texture Init failed: ${err.message.substring(0,150)}...`); // Increased substring length for more error info
            console.error("[LML_Clone Texture initializeAll] Major error during initialization:", err);
        }
    };

    initializeAll();

    return () => {
        console.log("[LML_Clone Texture] Cleanup running.");
        if (animationFrameIdRef.current) cancelAnimationFrame(animationFrameIdRef.current);
        if (resizeObserverInternal && canvasRef.current) resizeObserverInternal.unobserve(canvasRef.current);
        if (resizeObserverInternal) resizeObserverInternal.disconnect();
        videoRef.current?.srcObject?.getTracks().forEach(track => track.stop());
        if (videoRef.current) videoRef.current.srcObject = null;

        // Use a local variable for pipelineStateRef.current for easier access in cleanup
        const pState = pipelineStateRef.current;
        pState.vertexBuffer?.destroy();
        pState.aspectRatioUniformBuffer?.destroy();
        pState.lipstickMaterialUniformBuffer?.destroy();
        pState.lipstickAlbedoTexture?.destroy();

        if (landmarkerRef.current && typeof landmarkerRef.current.close === 'function') { landmarkerRef.current.close(); }
        landmarkerRef.current = null; setLandmarkerState(null);
        deviceRef.current = null; contextRef.current = null; formatRef.current = null;
        console.log("[LML_Clone Texture] Cleanup complete.");
    };
  }, []);

  useEffect(() => {
    if (error) { setDebugMessage(`Error: ${error.substring(0,40)}...`); }
    else if (landmarkerState && deviceRef.current && contextRef.current && pipelineStateRef.current.lipstickPipeline) { setDebugMessage("Live Active (Texture Mode)"); }
    else { setDebugMessage("Initializing (Texture Mode)..."); }
  }, [landmarkerState, deviceRef.current, contextRef.current, pipelineStateRef.current.lipstickPipeline, error]);

  return (
    <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, overflow: 'hidden', margin: 0, padding: 0, background: 'darkslateblue' }}>
      <div style={{ position: 'absolute', top: '5px', left: '5px', background: 'rgba(0,0,0,0.7)', color: 'white', padding: '2px 5px', fontSize: '12px', zIndex: 20, pointerEvents: 'none' }}>
        {debugMessage} (Frame: {frameCounter.current})
      </div>

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
            onClick={() => setSelectedColorUI(color.value)}
            style={{
              width: '40px',
              height: '40px',
              backgroundColor: `rgba(${color.value[0]*255}, ${color.value[1]*255}, ${color.value[2]*255}, ${color.value[3]})`,
              borderRadius: '50%',
              border: selectedColorUI === color.value ? '3px solid white' : '3px solid transparent',
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