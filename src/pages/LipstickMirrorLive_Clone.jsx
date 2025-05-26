// src/pages/LipstickMirrorLive_Clone.jsx

import React, { useEffect, useRef, useState } from 'react';
import createPipelines from '@/utils/createPipelines';
import lipTriangles from '@/utils/lipTriangles';
import { FaceLandmarker, FilesetResolver } from '@mediapipe/tasks-vision';

// ... (LIPSTICK_COLORS and loadImageBitmap as before) ...
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
  if (!response.ok) { throw new Error(`Failed to fetch image ${url}: ${response.statusText}`); }
  const blob = await response.blob();
  return createImageBitmap(blob);
}


export default function LipstickMirrorLive_Clone() {
  // ... (canvasRef, videoRef, etc. as before) ...
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
  const lightSettingsRef = useRef({ /* ... as before ... */
    direction: [0.5, 0.5, 1.0],
    ambientColor: [0.2, 0.2, 0.2, 1.0],
    diffuseColor: [0.8, 0.8, 0.8, 1.0],
  });

  const pipelineStateRef = useRef({
    videoPipeline: null, lipstickPipeline: null, videoBindGroupLayout: null,
    aspectRatioGroupLayout: null, aspectRatioUniformBuffer: null, aspectRatioBindGroup: null,
    lipstickMaterialGroupLayout: null, // Layout for color uniform, albedo tex, albedo sampler, normal tex
    lipstickMaterialUniformBuffer: null,
    lipstickMaterialBindGroup: null,
    lightingGroupLayout: null,
    lightingUniformBuffer: null,
    lightingBindGroup: null,
    videoSampler: null,
    vertexBuffer: null, vertexBufferSize: 2048 * (7/4), // Pos(2) + UV(2) + Normal(3) = 7 floats
    lipstickAlbedoTexture: null,
    lipstickAlbedoTextureView: null,
    lipstickAlbedoSampler: null, // We can reuse this for the normal map if filtering is the same
    // NEW: Normal Map resources
    lipstickNormalTexture: null,
    lipstickNormalTextureView: null,
  });

  // ... (landmarkerState, error, debugMessage states as before) ...
  const [landmarkerState, setLandmarkerState] = useState(null);
  const [error, setError] = useState(null);
  const [debugMessage, setDebugMessage] = useState('Initializing...');


  useEffect(() => { selectedColorForRenderRef.current = selectedColorUI; }, [selectedColorUI]);

  useEffect(() => {
    console.log("[LML_Clone NormalMap] Main useEffect running.");
    // ... (deviceInternal, contextInternal, etc. as before) ...
    let deviceInternal = null; let contextInternal = null; let formatInternal = null;
    let resizeObserverInternal = null; let renderLoopStartedInternal = false;

    const canvasElement = canvasRef.current;
    const videoElement = videoRef.current;
    if (!canvasElement || !videoElement) { /* ... error handling ... */ return; }

    const configureCanvas = (entries) => { /* ... Same as before ... */
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

    const render = async () => { /* ... Same render loop structure, no changes here for normal map init ... */
      const currentDevice = deviceRef.current; const currentContext = contextRef.current;
      const currentVideoEl = videoRef.current; const pState = pipelineStateRef.current;
      const activeLandmarker = landmarkerRef.current;

      if (!currentDevice || !currentContext || !pState.videoPipeline || !pState.lipstickPipeline ||
          !pState.aspectRatioBindGroup || !pState.lipstickMaterialBindGroup || !pState.lightingBindGroup ||
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
        const colorData = new Float32Array(selectedColorForRenderRef.current);
        currentDevice.queue.writeBuffer(pState.lipstickMaterialUniformBuffer, 0, colorData);
      }
      if (pState.lightingUniformBuffer) {
        const lightDir = lightSettingsRef.current.direction; const ambientCol = lightSettingsRef.current.ambientColor; const diffuseCol = lightSettingsRef.current.diffuseColor;
        const lightingData = new Float32Array([ lightDir[0], lightDir[1], lightDir[2], 0.0, ambientCol[0], ambientCol[1], ambientCol[2], ambientCol[3], diffuseCol[0], diffuseCol[1], diffuseCol[2], diffuseCol[3] ]);
        currentDevice.queue.writeBuffer(pState.lightingUniformBuffer, 0, lightingData);
      }

      let numLipVertices = 0;
      if (activeLandmarker && pState.vertexBuffer) {
        try {
          const now = performance.now(); const results = activeLandmarker.detectForVideo(currentVideoEl, now);
          if (results?.faceLandmarks?.length > 0) {
            const allFaceLm = results.faceLandmarks[0];
            const lips = lipTriangles.map(([idxA, idxB, idxC]) => { if (allFaceLm && idxA < allFaceLm.length && idxB < allFaceLm.length && idxC < allFaceLm.length && allFaceLm[idxA] && allFaceLm[idxB] && allFaceLm[idxC]) { return [allFaceLm[idxA], allFaceLm[idxB], allFaceLm[idxC]]; } return null; }).filter(tri => tri !== null);
            if (lips.length > 0) {
              const lipVertexData = new Float32Array( lips.flat().flatMap(pt => [ (0.5 - pt.x) * 2, (0.5 - pt.y) * 2, pt.x, pt.y, 0.0, 0.0, 1.0, ]) );
              numLipVertices = lipVertexData.length / 7;
              if (lipVertexData.byteLength > 0) { if (lipVertexData.byteLength <= pState.vertexBufferSize) { currentDevice.queue.writeBuffer(pState.vertexBuffer, 0, lipVertexData); } else { console.warn("[LML_Clone NormalMap RENDER] Lip vertex data too large for buffer."); numLipVertices = 0; } } else { numLipVertices = 0; }
            } else { numLipVertices = 0; }
          } else { numLipVertices = 0; }
        } catch (e) { console.error("[LML_Clone NormalMap RENDER] Error in landmarker processing:", e); numLipVertices = 0; }
      }

      let videoTextureGPU, frameBindGroupForTexture; try { videoTextureGPU = currentDevice.importExternalTexture({ source: currentVideoEl }); if (pState.videoBindGroupLayout && pState.videoSampler) { frameBindGroupForTexture = currentDevice.createBindGroup({ layout: pState.videoBindGroupLayout, entries: [{ binding: 0, resource: pState.videoSampler }, { binding: 1, resource: videoTextureGPU }] }); } else { animationFrameIdRef.current = requestAnimationFrame(render); return; } } catch (e) { console.error("[LML_Clone RENDER] Error importing video texture:", e); animationFrameIdRef.current = requestAnimationFrame(render); return; }
      let currentGpuTexture, texView; try { currentGpuTexture = currentContext.getCurrentTexture(); texView = currentGpuTexture.createView(); } catch (e) { console.warn("[LML_Clone RENDER] Error getting current texture, trying to reconfigure canvas.", e); if (resizeHandlerRef.current) resizeHandlerRef.current(); animationFrameIdRef.current = requestAnimationFrame(render); return; }
      const cmdEnc = currentDevice.createCommandEncoder(); const passEnc = cmdEnc.beginRenderPass({ colorAttachments: [{ view: texView, clearValue: { r: 0.0, g: 0.0, b: 0.0, a: 1.0 }, loadOp: 'clear', storeOp: 'store' }] });
      passEnc.setViewport(0, 0, currentGpuTexture.width, currentGpuTexture.height, 0, 1); passEnc.setScissorRect(0, 0, currentGpuTexture.width, currentGpuTexture.height);
      if (pState.videoPipeline && frameBindGroupForTexture && pState.aspectRatioBindGroup) { passEnc.setPipeline(pState.videoPipeline); passEnc.setBindGroup(0, frameBindGroupForTexture); passEnc.setBindGroup(1, pState.aspectRatioBindGroup); passEnc.draw(6); }

      if (numLipVertices > 0 && pState.lipstickPipeline && pState.vertexBuffer && pState.aspectRatioBindGroup && pState.lipstickMaterialBindGroup && pState.lightingBindGroup) {
        passEnc.setPipeline(pState.lipstickPipeline);
        passEnc.setBindGroup(0, pState.aspectRatioBindGroup);
        passEnc.setBindGroup(1, pState.lipstickMaterialBindGroup);
        passEnc.setBindGroup(2, pState.lightingBindGroup);
        passEnc.setVertexBuffer(0, pState.vertexBuffer);
        passEnc.draw(numLipVertices);
      }
      passEnc.end(); currentDevice.queue.submit([cmdEnc.finish()]);
      animationFrameIdRef.current = requestAnimationFrame(render);
    };


    const initializeAll = async () => {
        if (!navigator.gpu) { setError("WebGPU not supported."); return; }
        setDebugMessage("Initializing Normal Map Mode...");
        try {
            // Load Albedo Texture
            let lipstickAlbedoImageBitmap;
            try { lipstickAlbedoImageBitmap = await loadImageBitmap('/textures/lipstick_albedo_gray.png'); console.log("[LML_Clone NormalMap] Lipstick albedo texture loaded."); }
            catch (texError) { console.error("[LML_Clone NormalMap] Failed to load lipstick albedo texture:", texError); setError("Failed to load albedo texture.");}

            // NEW: Load Normal Map Texture
            let lipstickNormalImageBitmap;
            try {
              lipstickNormalImageBitmap = await loadImageBitmap('/textures/lipstick_normal.png'); // Ensure this file exists
              console.log("[LML_Clone NormalMap] Lipstick normal map texture loaded.");
            } catch (texError) {
              console.error("[LML_Clone NormalMap] Failed to load lipstick normal map texture:", texError);
              setError("Failed to load normal map texture.");
              // Decide on fallback: proceed, bind group creation might be partial or fail if layout expects it
            }

            // ... (Landmarker, Adapter, Device, Context, Format as before) ...
            const vision = await FilesetResolver.forVisionTasks('https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm');
            const lmInstance = await FaceLandmarker.createFromOptions(vision, { baseOptions: { modelAssetPath: '/models/face_landmarker.task', delegate: 'GPU' }, outputFaceBlendshapes: false, runningMode: 'VIDEO', numFaces: 1 });
            landmarkerRef.current = lmInstance; setLandmarkerState(lmInstance);
            const adapter = await navigator.gpu.requestAdapter(); if (!adapter) throw new Error("No WebGPU adapter found.");
            deviceInternal = await adapter.requestDevice(); deviceRef.current = deviceInternal;
            deviceInternal.lost.then((info) => { console.error(`Device lost: ${info.message}`); setError("Device lost"); deviceRef.current = null; if (animationFrameIdRef.current) cancelAnimationFrame(animationFrameIdRef.current); });
            contextInternal = canvasElement.getContext('webgpu'); contextRef.current = contextInternal;
            formatInternal = navigator.gpu.getPreferredCanvasFormat(); formatRef.current = formatInternal;


            // Create Pipelines (createPipelines will be updated for normal map binding)
            const { videoPipeline, lipstickPipeline, videoBindGroupLayout,
                    aspectRatioGroupLayout, lipstickMaterialGroupLayout, lightingGroupLayout
                  } = await createPipelines(deviceInternal, formatInternal);
            if (!videoPipeline || !lipstickPipeline) throw new Error("Pipeline creation failed");

            pipelineStateRef.current = { // Update ref with new pipeline and layout info
                ...pipelineStateRef.current, videoPipeline, lipstickPipeline, videoBindGroupLayout,
                aspectRatioGroupLayout, lipstickMaterialGroupLayout, lightingGroupLayout
            };

            // Aspect Ratio Uniforms (Same)
            /* ... aspectRatioUniformBuffer and aspectRatioBindGroup creation as before ... */
            const aspectRatioUniformBufferSize = 4 * Float32Array.BYTES_PER_ELEMENT;
            pipelineStateRef.current.aspectRatioUniformBuffer = deviceInternal.createBuffer({ label: "Aspect Ratio Uniform Buffer", size: aspectRatioUniformBufferSize, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST });
            if (pipelineStateRef.current.aspectRatioGroupLayout && pipelineStateRef.current.aspectRatioUniformBuffer) { pipelineStateRef.current.aspectRatioBindGroup = deviceInternal.createBindGroup({ label: "Aspect Ratio Bind Group", layout: pipelineStateRef.current.aspectRatioGroupLayout, entries: [{ binding: 0, resource: { buffer: pipelineStateRef.current.aspectRatioUniformBuffer }}]}); } else { throw new Error("Failed to create aspect ratio bind group."); }


            // Albedo Texture and Sampler (Same as before, if bitmap loaded)
            if (lipstickAlbedoImageBitmap) { /* ... albedo texture GPU resource creation ... */
                const textureDescriptor = { label: "Lipstick Albedo Texture", size: [lipstickAlbedoImageBitmap.width, lipstickAlbedoImageBitmap.height], format: 'rgba8unorm', usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST | GPUTextureUsage.RENDER_ATTACHMENT,};
                pipelineStateRef.current.lipstickAlbedoTexture = deviceInternal.createTexture(textureDescriptor);
                deviceInternal.queue.copyExternalImageToTexture( { source: lipstickAlbedoImageBitmap }, { texture: pipelineStateRef.current.lipstickAlbedoTexture }, [lipstickAlbedoImageBitmap.width, lipstickAlbedoImageBitmap.height] );
                pipelineStateRef.current.lipstickAlbedoTextureView = pipelineStateRef.current.lipstickAlbedoTexture.createView();
                pipelineStateRef.current.lipstickAlbedoSampler = deviceInternal.createSampler({ label: "Lipstick Albedo/Normal Sampler", magFilter: 'linear', minFilter: 'linear', mipmapFilter: 'linear', addressModeU: 'clamp-to-edge', addressModeV: 'clamp-to-edge', }); // Can be reused
            }

            // NEW: Normal Map GPU Texture
            if (lipstickNormalImageBitmap) {
                const textureDescriptor = {
                    label: "Lipstick Normal Map Texture",
                    size: [lipstickNormalImageBitmap.width, lipstickNormalImageBitmap.height],
                    format: 'rgba8unorm', // Normal maps are often stored this way
                    usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST | GPUTextureUsage.RENDER_ATTACHMENT,
                };
                pipelineStateRef.current.lipstickNormalTexture = deviceInternal.createTexture(textureDescriptor);
                deviceInternal.queue.copyExternalImageToTexture(
                    { source: lipstickNormalImageBitmap },
                    { texture: pipelineStateRef.current.lipstickNormalTexture },
                    [lipstickNormalImageBitmap.width, lipstickNormalImageBitmap.height]
                );
                pipelineStateRef.current.lipstickNormalTextureView = pipelineStateRef.current.lipstickNormalTexture.createView();
                console.log("[LML_Clone NormalMap] Lipstick Normal Map GPU Texture created.");
            }

            // Lipstick Material Uniform Buffer (for tint/alpha - same)
            /* ... lipstickMaterialUniformBuffer creation ... */
            const lipstickMaterialUniformBufferSize = 4 * Float32Array.BYTES_PER_ELEMENT;
            pipelineStateRef.current.lipstickMaterialUniformBuffer = deviceInternal.createBuffer({ label: "Lipstick Material Tint Uniform Buffer", size: lipstickMaterialUniformBufferSize, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST });


            // MODIFIED: Lipstick Material Bind Group (Now includes Normal Map Texture View)
            if (pipelineStateRef.current.lipstickMaterialGroupLayout && pipelineStateRef.current.lipstickMaterialUniformBuffer) {
                const entries = [{ binding: 0, resource: { buffer: pipelineStateRef.current.lipstickMaterialUniformBuffer }}];
                // Albedo Texture and Sampler (binding 1 and 2)
                if (lipstickAlbedoImageBitmap && pipelineStateRef.current.lipstickAlbedoTextureView && pipelineStateRef.current.lipstickAlbedoSampler) {
                    entries.push({ binding: 1, resource: pipelineStateRef.current.lipstickAlbedoTextureView });
                    entries.push({ binding: 2, resource: pipelineStateRef.current.lipstickAlbedoSampler }); // Sampler
                } else {
                     console.warn("[LML_Clone NormalMap] Albedo texture resources missing for material bind group.");
                     if(lipstickAlbedoImageBitmap) throw new Error("Albedo image loaded but GPU resources missing.");
                }
                // Normal Map Texture View (binding 3) - Sampler can be reused (binding 2 is albedo's sampler)
                if (lipstickNormalImageBitmap && pipelineStateRef.current.lipstickNormalTextureView && pipelineStateRef.current.lipstickAlbedoSampler) { // Re-use albedo sampler for normal map
                    entries.push({ binding: 3, resource: pipelineStateRef.current.lipstickNormalTextureView });
                } else {
                    console.warn("[LML_Clone NormalMap] Normal map resources missing for material bind group.");
                    if(lipstickNormalImageBitmap) throw new Error("Normal map image loaded but GPU resources missing.");
                }

                pipelineStateRef.current.lipstickMaterialBindGroup = deviceInternal.createBindGroup({
                    label: "Lipstick Material Bind Group (with Normal Map)",
                    layout: pipelineStateRef.current.lipstickMaterialGroupLayout,
                    entries: entries,
                });
                console.log("[LML_Clone NormalMap] Lipstick Material Bind Group created (entries length: " + entries.length + ").");
            } else {
                throw new Error("Failed to create lipstick material bind group (layout or uniform buffer missing).");
            }

            // Lighting Uniform Buffer and Bind Group (Same)
            /* ... lightingUniformBuffer and lightingBindGroup creation ... */
            const lightingUniformBufferSize = (4 + 4 + 4) * Float32Array.BYTES_PER_ELEMENT;
            pipelineStateRef.current.lightingUniformBuffer = deviceInternal.createBuffer({ label: "Lighting Uniform Buffer", size: lightingUniformBufferSize, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST, });
            if (pipelineStateRef.current.lightingGroupLayout && pipelineStateRef.current.lightingUniformBuffer) { pipelineStateRef.current.lightingBindGroup = deviceInternal.createBindGroup({ label: "Lighting Bind Group", layout: pipelineStateRef.current.lightingGroupLayout, entries: [{ binding: 0, resource: { buffer: pipelineStateRef.current.lightingUniformBuffer }}], }); } else { throw new Error("Failed to create lighting bind group."); }


            // Vertex Buffer & Video Sampler (Same)
            /* ... vertexBuffer and videoSampler creation ... */
            const currentVertexBufferSize = pipelineStateRef.current.vertexBufferSize;
            pipelineStateRef.current.vertexBuffer = deviceInternal.createBuffer({ label: "Lip Vertex Buffer (Pos+UV+Norm)", size: currentVertexBufferSize, usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST });
            pipelineStateRef.current.videoSampler = deviceInternal.createSampler({ magFilter: 'linear', minFilter: 'linear' });


            // Video Setup and Start (Same)
            /* ... video stream, play, resizeObserver ... */
            const stream = await navigator.mediaDevices.getUserMedia({ video: { width: 640, height: 480 } });
            videoElement.srcObject = stream;
            await new Promise((res, rej) => { videoElement.onloadedmetadata = res; videoElement.onerror = () => rej(new Error("Video metadata loading error."));});
            await videoElement.play();
            resizeObserverInternal = new ResizeObserver(resizeHandlerRef.current);
            resizeObserverInternal.observe(canvasElement);
            if (resizeHandlerRef.current) resizeHandlerRef.current();

            console.log("[LML_Clone NormalMap] All sub-initializations complete.");
            if (!renderLoopStartedInternal) { render(); renderLoopStartedInternal = true; }
        } catch (err) {
            setError(`Normal Map Init failed: ${err.message.substring(0,150)}...`);
            console.error("[LML_Clone NormalMap initializeAll] Major error:", err);
        }
    };

    initializeAll();

    return () => { /* ... Cleanup: add lipstickNormalTexture destruction ... */
        console.log("[LML_Clone NormalMap] Cleanup running.");
        if (animationFrameIdRef.current) cancelAnimationFrame(animationFrameIdRef.current);
        if (resizeObserverInternal && canvasRef.current) resizeObserverInternal.unobserve(canvasRef.current);
        if (resizeObserverInternal) resizeObserverInternal.disconnect();
        videoRef.current?.srcObject?.getTracks().forEach(track => track.stop());
        if (videoRef.current) videoRef.current.srcObject = null;

        const pState = pipelineStateRef.current;
        pState.vertexBuffer?.destroy();
        pState.aspectRatioUniformBuffer?.destroy();
        pState.lipstickMaterialUniformBuffer?.destroy();
        pState.lipstickAlbedoTexture?.destroy();
        pState.lipstickNormalTexture?.destroy(); // NEW
        pState.lightingUniformBuffer?.destroy();

        if (landmarkerRef.current && typeof landmarkerRef.current.close === 'function') { landmarkerRef.current.close(); }
        landmarkerRef.current = null; setLandmarkerState(null);
        deviceRef.current = null; contextRef.current = null; formatRef.current = null;
        console.log("[LML_Clone NormalMap] Cleanup complete.");
    };
  }, []);

  useEffect(() => { /* ... Same UI Message Effect ... */
    if (error) { setDebugMessage(`Error: ${error.substring(0,40)}...`); }
    else if (landmarkerState && deviceRef.current && contextRef.current && pipelineStateRef.current.lipstickPipeline) { setDebugMessage("Live Active (Normal Map Mode)"); }
    else { setDebugMessage("Initializing (Normal Map Mode)..."); }
  }, [landmarkerState, deviceRef.current, contextRef.current, pipelineStateRef.current.lipstickPipeline, error]);


  return ( /* ... Same JSX for UI ... */
    <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, overflow: 'hidden', margin: 0, padding: 0, background: 'darkslateblue' }}>
      <div style={{ position: 'absolute', top: '5px', left: '5px', background: 'rgba(0,0,0,0.7)', color: 'white', padding: '2px 5px', fontSize: '12px', zIndex: 20, pointerEvents: 'none' }}>
        {debugMessage} (Frame: {frameCounter.current})
      </div>
      <div style={{ position: 'absolute', bottom: '20px', left: '50%', transform: 'translateX(-50%)', display: 'flex', gap: '10px', padding: '10px', backgroundColor: 'rgba(255, 255, 255, 0.2)', borderRadius: '10px', zIndex: 10 }}>
        {LIPSTICK_COLORS.map(color => ( <div key={color.name} title={color.name} onClick={() => setSelectedColorUI(color.value)} style={{ width: '40px', height: '40px', backgroundColor: `rgba(${color.value[0]*255}, ${color.value[1]*255}, ${color.value[2]*255}, ${color.value[3]})`, borderRadius: '50%', border: selectedColorUI === color.value ? '3px solid white' : '3px solid transparent', cursor: 'pointer', transition: 'border 0.2s ease-in-out' }} /> ))}
      </div>
      <video ref={videoRef} style={{ display: 'none' }} width={640} height={480} autoPlay playsInline muted />
      <canvas ref={canvasRef} width={640} height={480} style={{ width: '100%', height: '100%', display: 'block', background: 'lightpink' }} />
    </div>
  );
}