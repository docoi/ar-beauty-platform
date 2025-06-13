// src/pages/LipstickMirrorLive_Clone.jsx

import React, { useEffect, useRef, useState } from 'react';
import createPipelines from '@/utils/createPipelines';
// import lipTriangles from '@/utils/lipTriangles'; // Will likely be replaced by 3D model
import { FaceLandmarker, FilesetResolver } from '@mediapipe/tasks-vision';

// NEW: Import from @loaders.gl
import { load } from '@loaders.gl/core';
import { GLTFLoader } from '@loaders.gl/gltf';

const LIPSTICK_COLORS = [
  { name: 'Nude Pink', value: [228/255, 170/255, 170/255, 0.85] },
  { name: 'Classic Red', value: [200/255, 0/255, 0/255, 0.9] },
  { name: 'Deep Plum', value: [100/255, 20/255, 50/255, 0.85] },
  // ... other colors
];

async function loadImageBitmap(url) {
  const response = await fetch(url);
  if (!response.ok) { throw new Error(`Failed to fetch image ${url}: ${response.statusText}`); }
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
  const lightSettingsRef = useRef({
    direction: [0.5, 0.5, 1.0],
    ambientColor: [0.2, 0.2, 0.2, 1.0],
    diffuseColor: [0.8, 0.8, 0.8, 1.0],
  });

  const pipelineStateRef = useRef({
    videoPipeline: null,
    lipstickPipeline: null, // This will be for the 3D model
    videoBindGroupLayout: null,
    aspectRatioGroupLayout: null, aspectRatioUniformBuffer: null, aspectRatioBindGroup: null,
    lipstickMaterialGroupLayout: null, // For lipstick PBR material (color, albedo, normal, sampler)
    lipstickMaterialUniformBuffer: null, // For tint/alpha
    lipstickMaterialBindGroup: null,
    lightingGroupLayout: null, lightingUniformBuffer: null, lightingBindGroup: null,
    videoSampler: null,

    // 2D lip data (to be phased out or used as fallback)
    // vertexBuffer: null, vertexBufferSize: 2048 * (7/4),

    // 3D Lip Model Data & Buffers
    lipModelData: null, // Parsed: { positions, normals, uvs, indices, shapeKeys, indexCount, indexFormat }
    lipModelVertexBuffer: null, // Combined buffer for positions, normals, uvs
    lipModelIndexBuffer: null,
    // Shape key buffers will be handled later

    lipstickAlbedoTexture: null, lipstickAlbedoTextureView: null,
    lipstickNormalTexture: null, lipstickNormalTextureView: null,
    lipstickSampler: null, // Single sampler for lipstick textures
  });

  const [landmarkerState, setLandmarkerState] = useState(null);
  const [error, setError] = useState(null);
  const [debugMessage, setDebugMessage] = useState('Initializing...');

  useEffect(() => {
    selectedColorForRenderRef.current = selectedColorUI;
  }, [selectedColorUI]);

  // Function to load and parse the 3D lip model
  const loadLipModelData = async () => {
    try {
      setDebugMessage("Loading 3D lip model...");
      console.log("[LML_Clone 3DModel] Attempting to load /models/lips_model.glb");
      // Ensure options disable worker if it causes issues in your setup, or handle appropriately
      const gltfData = await load('/models/lips_model.glb', GLTFLoader /*, { worker: false }*/);
      console.log("[LML_Clone 3DModel] GLB model loaded and parsed:", gltfData);

      if (!gltfData.meshes || gltfData.meshes.length === 0) {
        throw new Error("No meshes found in GLTF model.");
      }
      // Assuming the first mesh is our lip model
      const mesh = gltfData.meshes[0];
      if (!mesh.primitives || mesh.primitives.length === 0) {
        throw new Error("No primitives found in the first mesh.");
      }
      // Assuming the first primitive is the one we want
      const primitive = mesh.primitives[0];

      const positions = primitive.attributes.POSITION?.value;
      const normals = primitive.attributes.NORMAL?.value;
      const uvs = primitive.attributes.TEXCOORD_0?.value; // Common name for first UV set
      const indices = primitive.indices?.value;
      const shapeKeys = primitive.targets; // Array of { POSITION?, NORMAL?, TANGENT? }

      if (!positions) throw new Error("POSITION attribute missing in GLTF primitive.");
      if (!normals) throw new Error("NORMAL attribute missing in GLTF primitive.");
      if (!uvs) throw new Error("TEXCOORD_0 attribute missing in GLTF primitive.");
      if (!indices) throw new Error("Indices missing in GLTF primitive.");

      // Store the raw data
      pipelineStateRef.current.lipModelData = {
        positions: positions, // Float32Array
        normals: normals,     // Float32Array
        uvs: uvs,             // Float32Array
        indices: indices,     // Uint16Array or Uint32Array
        shapeKeys: shapeKeys, // Array of target attributes, or undefined
        indexCount: indices.length,
        indexFormat: (indices instanceof Uint16Array) ? 'uint16' : 'uint32',
        // We'll also need to know attribute strides and offsets when creating the vertex buffer
      };

      console.log("[LML_Clone 3DModel] Extracted lip model data successfully.");
      console.log("Positions count:", positions.length / 3, "Normals count:", normals.length / 3, "UVs count:", uvs.length / 2);
      console.log("Indices count:", indices.length);
      if (shapeKeys) {
        console.log("Shape Keys found:", shapeKeys.length);
        shapeKeys.forEach((target, i) => {
          console.log(`  Shape Key ${i}:`, Object.keys(target));
        });
      } else {
        console.log("No Shape Keys found in this primitive.");
      }

      setDebugMessage("3D lip model data processed.");
      return true;

    } catch (err) {
      console.error("[LML_Clone 3DModel] Error loading or parsing lip model:", err);
      setError(`Failed to load 3D lip model: ${err.message.substring(0,150)}`);
      setDebugMessage("Error loading 3D model.");
      pipelineStateRef.current.lipModelData = null; // Ensure it's null on failure
      return false;
    }
  };

  useEffect(() => {
    console.log("[LML_Clone 3DModel] Main useEffect running for WebGPU initialization.");
    let deviceInternal = null;
    let contextInternal = null;
    let formatInternal = null;
    let resizeObserverInternal = null;
    let renderLoopStartedInternal = false;

    const canvasElement = canvasRef.current;
    const videoElement = videoRef.current;

    if (!canvasElement || !videoElement) {
      setError("Canvas or Video element not found.");
      return;
    }

    const configureCanvas = () => {
        if (!deviceInternal || !contextInternal || !formatInternal || !canvasRef.current) { return; }
        const currentCanvas = canvasRef.current;
        const dpr = window.devicePixelRatio || 1;
        const cw = currentCanvas.clientWidth; const ch = currentCanvas.clientHeight;
        if (cw === 0 || ch === 0) { return; }
        const targetWidth = Math.floor(cw * dpr); const targetHeight = Math.floor(ch * dpr);
        if (currentCanvas.width !== targetWidth || currentCanvas.height !== targetHeight) {
            currentCanvas.width = targetWidth; currentCanvas.height = targetHeight;
        }
        try {
            contextInternal.configure({ device: deviceInternal, format: formatInternal, alphaMode: 'opaque', size: [currentCanvas.width, currentCanvas.height] });
        } catch (e) { setError("Error config context: " + e.message); console.error("Error config context:", e); }
    };
    resizeHandlerRef.current = configureCanvas;

    const render = async () => {
      const currentDevice = deviceRef.current;
      const currentContext = contextRef.current;
      const currentVideoEl = videoRef.current;
      const pState = pipelineStateRef.current;

      if (!currentDevice || !currentContext || !pState.videoPipeline || !currentVideoEl) {
        animationFrameIdRef.current = requestAnimationFrame(render);
        return;
      }
      // Add checks for lipstickPipeline and other necessary bind groups IF we are drawing lips
      if (pState.lipModelData && pState.lipModelVertexBuffer && pState.lipModelIndexBuffer) {
          if (!pState.lipstickPipeline || !pState.aspectRatioBindGroup || !pState.lipstickMaterialBindGroup || !pState.lightingBindGroup) {
              animationFrameIdRef.current = requestAnimationFrame(render);
              return;
          }
      }


      frameCounter.current++;
      if (currentVideoEl.readyState < currentVideoEl.HAVE_ENOUGH_DATA || currentVideoEl.videoWidth === 0 || currentVideoEl.videoHeight === 0) {
        animationFrameIdRef.current = requestAnimationFrame(render);
        return;
      }

      // Update common uniforms (aspect ratio, tint color, lighting)
      if (pState.aspectRatioUniformBuffer && pState.aspectRatioBindGroup) {
        const aspectRatioData = new Float32Array([currentVideoEl.videoWidth, currentVideoEl.videoHeight, currentContext.canvas.width, currentContext.canvas.height]);
        currentDevice.queue.writeBuffer(pState.aspectRatioUniformBuffer, 0, aspectRatioData);
      }
      if (pState.lipstickMaterialUniformBuffer && pState.lipstickMaterialBindGroup) {
        const colorData = new Float32Array(selectedColorForRenderRef.current);
        currentDevice.queue.writeBuffer(pState.lipstickMaterialUniformBuffer, 0, colorData);
      }
      if (pState.lightingUniformBuffer && pState.lightingBindGroup) {
        const lightDir = lightSettingsRef.current.direction; const ambientCol = lightSettingsRef.current.ambientColor; const diffuseCol = lightSettingsRef.current.diffuseColor;
        const lightingData = new Float32Array([ lightDir[0], lightDir[1], lightDir[2], 0.0, ambientCol[0], ambientCol[1], ambientCol[2], ambientCol[3], diffuseCol[0], diffuseCol[1], diffuseCol[2], diffuseCol[3] ]);
        currentDevice.queue.writeBuffer(pState.lightingUniformBuffer, 0, lightingData);
      }

      let videoTextureGPU, frameBindGroupForTexture;
      try {
        videoTextureGPU = currentDevice.importExternalTexture({ source: currentVideoEl });
        if (pState.videoBindGroupLayout && pState.videoSampler) {
          frameBindGroupForTexture = currentDevice.createBindGroup({ layout: pState.videoBindGroupLayout, entries: [{ binding: 0, resource: pState.videoSampler }, { binding: 1, resource: videoTextureGPU }] });
        } else { animationFrameIdRef.current = requestAnimationFrame(render); return; }
      } catch (e) { console.error("[LML_Clone RENDER] Error importing video texture:", e); animationFrameIdRef.current = requestAnimationFrame(render); return; }

      let currentGpuTexture, texView;
      try {
        currentGpuTexture = currentContext.getCurrentTexture();
        texView = currentGpuTexture.createView();
      } catch (e) {
        console.warn("[LML_Clone RENDER] Error getting current texture, trying to reconfigure canvas.", e);
        if (resizeHandlerRef.current) resizeHandlerRef.current();
        animationFrameIdRef.current = requestAnimationFrame(render); return;
      }

      const commandEncoder = currentDevice.createCommandEncoder({label: "Main Command Encoder"});
      const renderPassDescriptor = {
        colorAttachments: [{ view: texView, clearValue: { r: 0.0, g: 0.0, b: 0.0, a: 1.0 }, loadOp: 'clear', storeOp: 'store' }],
        // Add depth stencil attachment here if/when 3D model needs depth testing
      };
      const passEncoder = commandEncoder.beginRenderPass(renderPassDescriptor);
      passEncoder.setViewport(0, 0, currentGpuTexture.width, currentGpuTexture.height, 0, 1);
      passEncoder.setScissorRect(0, 0, currentGpuTexture.width, currentGpuTexture.height);

      // Draw video background
      if (pState.videoPipeline && frameBindGroupForTexture && pState.aspectRatioBindGroup) {
        passEncoder.setPipeline(pState.videoPipeline);
        passEncoder.setBindGroup(0, frameBindGroupForTexture);
        passEncoder.setBindGroup(1, pState.aspectRatioBindGroup);
        passEncoder.draw(6);
      }

      // TODO LATER: Draw the 3D lip model if data and buffers are ready
      if (pState.lipModelData && pState.lipModelVertexBuffer && pState.lipModelIndexBuffer && pState.lipstickPipeline) {
          // passEncoder.setPipeline(pState.lipstickPipeline);
          // passEncoder.setBindGroup(0, pState.aspectRatioBindGroup); // Or a new MVP matrix bind group
          // passEncoder.setBindGroup(1, pState.lipstickMaterialBindGroup);
          // passEncoder.setBindGroup(2, pState.lightingBindGroup);
          // passEncoder.setVertexBuffer(0, pState.lipModelVertexBuffer);
          // passEncoder.setIndexBuffer(pState.lipModelIndexBuffer, pState.lipModelData.indexFormat);
          // passEncoder.drawIndexed(pState.lipModelData.indexCount);
          if (frameCounter.current % 120 === 1) console.log("[LML_Clone 3DModel] Would draw 3D model here if render logic was complete.");
      }


      passEncoder.end();
      currentDevice.queue.submit([commandEncoder.finish()]);
      animationFrameIdRef.current = requestAnimationFrame(render);
    };

    const initializeAll = async () => {
        if (!navigator.gpu) { setError("WebGPU not supported."); return; }
        setDebugMessage("Initializing 3D Model Mode...");
        try {
            // STEP 1: Load 3D Model Data (this is new)
            const modelLoadedSuccessfully = await loadLipModelData();
            if (!modelLoadedSuccessfully) {
                // Error already set by loadLipModelData
                // We might want to fall back to 2D lips or stop initialization
                console.error("[LML_Clone 3DModel initializeAll] Halting further GPU init due to model load failure.");
                return; // Stop further initialization if model fails critical step
            }

            // STEP 2: Load Textures (Albedo, Normal for lipstick)
            let lipstickAlbedoImageBitmap, lipstickNormalImageBitmap;
            try {
                lipstickAlbedoImageBitmap = await loadImageBitmap('/textures/lipstick_albedo_gray.png');
                console.log("[LML_Clone 3DModel] Lipstick albedo texture loaded.");
            } catch (texError) { console.error("[LML_Clone 3DModel] Failed to load lipstick albedo texture:", texError); /* Continue, material bind group might be partial */ }
            try {
                lipstickNormalImageBitmap = await loadImageBitmap('/textures/lipstick_normal.png');
                console.log("[LML_Clone 3DModel] Lipstick normal map texture loaded.");
            } catch (texError) { console.error("[LML_Clone 3DModel] Failed to load lipstick normal map texture:", texError); /* Continue */ }


            // STEP 3: Initialize WebGPU Device, Context, Format
            const vision = await FilesetResolver.forVisionTasks('https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm');
            const lmInstance = await FaceLandmarker.createFromOptions(vision, { baseOptions: { modelAssetPath: '/models/face_landmarker.task', delegate: 'GPU' }, outputFaceBlendshapes: true, runningMode: 'VIDEO', numFaces: 1 }); // outputFaceBlendshapes: true
            landmarkerRef.current = lmInstance; setLandmarkerState(lmInstance);

            const adapter = await navigator.gpu.requestAdapter(); if (!adapter) throw new Error("No WebGPU adapter found.");
            deviceInternal = await adapter.requestDevice(); deviceRef.current = deviceInternal;
            deviceInternal.lost.then((info) => { console.error(`Device lost: ${info.message}`); setError("Device lost"); deviceRef.current = null; if (animationFrameIdRef.current) cancelAnimationFrame(animationFrameIdRef.current); });
            contextInternal = canvasElement.getContext('webgpu'); contextRef.current = contextInternal;
            formatInternal = navigator.gpu.getPreferredCanvasFormat(); formatRef.current = formatInternal;
            console.log("[LML_Clone 3DModel] WebGPU Device, Context, Format obtained.");

            // STEP 4: Create Pipelines (createPipelines will need updates for 3D model vertex layout)
            // For now, it still uses the old 2D lip vertex layout if lipstickPipeline is created.
            // We will adapt this in the next iteration.
            const { videoPipeline, lipstickPipeline, videoBindGroupLayout,
                    aspectRatioGroupLayout, lipstickMaterialGroupLayout, lightingGroupLayout
                  } = await createPipelines(deviceInternal, formatInternal); // This createPipelines is for the 2D version
            if (!videoPipeline) throw new Error("Video pipeline creation failed");
            // Lipstick pipeline might fail if its vertex layout doesn't match what we intend for 3D
            // For this step, we're focusing on loading data. The actual 3D rendering pipeline setup comes next.
             pipelineStateRef.current = {
                ...pipelineStateRef.current, videoPipeline, lipstickPipeline, // Store the lipstickPipeline for now, it will be recreated/updated
                videoBindGroupLayout, aspectRatioGroupLayout, lipstickMaterialGroupLayout, lightingGroupLayout
            };
            console.log("[LML_Clone 3DModel] Initial pipelines (possibly for 2D) created.");


            // STEP 5: Create GPU Resources (Uniform Buffers, Textures, Sampler)
            // Aspect Ratio Uniforms
            const aspectRatioUniformBufferSize = 4 * Float32Array.BYTES_PER_ELEMENT;
            pipelineStateRef.current.aspectRatioUniformBuffer = deviceInternal.createBuffer({ label: "Aspect Ratio Uniform Buffer", size: aspectRatioUniformBufferSize, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST });
            if (pipelineStateRef.current.aspectRatioGroupLayout) {
                pipelineStateRef.current.aspectRatioBindGroup = deviceInternal.createBindGroup({ label: "Aspect Ratio Bind Group", layout: pipelineStateRef.current.aspectRatioGroupLayout, entries: [{ binding: 0, resource: { buffer: pipelineStateRef.current.aspectRatioUniformBuffer }}]});
            }

            // Lipstick Material Textures & Sampler
            pipelineStateRef.current.lipstickSampler = deviceInternal.createSampler({ label: "Lipstick Sampler", magFilter: 'linear', minFilter: 'linear', mipmapFilter: 'linear', addressModeU: 'clamp-to-edge', addressModeV: 'clamp-to-edge' });
            if (lipstickAlbedoImageBitmap) {
                const desc = { label: "Lipstick Albedo Texture", size: [lipstickAlbedoImageBitmap.width, lipstickAlbedoImageBitmap.height], format: 'rgba8unorm', usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST | GPUTextureUsage.RENDER_ATTACHMENT };
                pipelineStateRef.current.lipstickAlbedoTexture = deviceInternal.createTexture(desc);
                deviceInternal.queue.copyExternalImageToTexture( { source: lipstickAlbedoImageBitmap }, { texture: pipelineStateRef.current.lipstickAlbedoTexture }, [lipstickAlbedoImageBitmap.width, lipstickAlbedoImageBitmap.height] );
                pipelineStateRef.current.lipstickAlbedoTextureView = pipelineStateRef.current.lipstickAlbedoTexture.createView();
            }
            if (lipstickNormalImageBitmap) {
                const desc = { label: "Lipstick Normal Texture", size: [lipstickNormalImageBitmap.width, lipstickNormalImageBitmap.height], format: 'rgba8unorm', usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST | GPUTextureUsage.RENDER_ATTACHMENT };
                pipelineStateRef.current.lipstickNormalTexture = deviceInternal.createTexture(desc);
                deviceInternal.queue.copyExternalImageToTexture( { source: lipstickNormalImageBitmap }, { texture: pipelineStateRef.current.lipstickNormalTexture }, [lipstickNormalImageBitmap.width, lipstickNormalImageBitmap.height] );
                pipelineStateRef.current.lipstickNormalTextureView = pipelineStateRef.current.lipstickNormalTexture.createView();
            }

            // Lipstick Material Tint Uniform Buffer
            const lipstickMaterialUniformBufferSize = 4 * Float32Array.BYTES_PER_ELEMENT;
            pipelineStateRef.current.lipstickMaterialUniformBuffer = deviceInternal.createBuffer({ label: "Lipstick Material Tint Uniform Buffer", size: lipstickMaterialUniformBufferSize, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST });

            // Lipstick Material Bind Group (Dynamic entries based on loaded textures)
            if (pipelineStateRef.current.lipstickMaterialGroupLayout && pipelineStateRef.current.lipstickMaterialUniformBuffer && pipelineStateRef.current.lipstickSampler) {
                const materialEntries = [{ binding: 0, resource: { buffer: pipelineStateRef.current.lipstickMaterialUniformBuffer }}];
                if (pipelineStateRef.current.lipstickAlbedoTextureView) {
                    materialEntries.push({ binding: 1, resource: pipelineStateRef.current.lipstickAlbedoTextureView });
                    materialEntries.push({ binding: 2, resource: pipelineStateRef.current.lipstickSampler }); // Sampler for Albedo
                }
                if (pipelineStateRef.current.lipstickNormalTextureView) {
                     // Assuming normal map uses the same sampler as albedo. If not, bind another sampler.
                    materialEntries.push({ binding: 3, resource: pipelineStateRef.current.lipstickNormalTextureView });
                }
                pipelineStateRef.current.lipstickMaterialBindGroup = deviceInternal.createBindGroup({
                    label: "Lipstick Material Bind Group",
                    layout: pipelineStateRef.current.lipstickMaterialGroupLayout, // This layout needs to match the entries
                    entries: materialEntries,
                });
                console.log("[LML_Clone 3DModel] Lipstick Material Bind Group created with " + materialEntries.length + " entries.");
            }

            // Lighting Uniforms
            const lightingUniformBufferSize = (4 + 4 + 4) * Float32Array.BYTES_PER_ELEMENT;
            pipelineStateRef.current.lightingUniformBuffer = deviceInternal.createBuffer({ label: "Lighting Uniform Buffer", size: lightingUniformBufferSize, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST });
            if (pipelineStateRef.current.lightingGroupLayout) {
                pipelineStateRef.current.lightingBindGroup = deviceInternal.createBindGroup({ label: "Lighting Bind Group", layout: pipelineStateRef.current.lightingGroupLayout, entries: [{ binding: 0, resource: { buffer: pipelineStateRef.current.lightingUniformBuffer }}]});
            }
            console.log("[LML_Clone 3DModel] Uniform buffers and textures created.");


            // STEP 6: Create GPU Buffers for the 3D Lip Model (Placeholder for now, will be done in next step)
            // if (pipelineStateRef.current.lipModelData) {
            //    // TODO: Create lipModelVertexBuffer and lipModelIndexBuffer here
            //    console.log("[LML_Clone 3DModel] Placeholder for creating GPU buffers for 3D model.");
            // }


            // Video Sampler (for video background) & other general resources
            pipelineStateRef.current.videoSampler = deviceInternal.createSampler({ magFilter: 'linear', minFilter: 'linear' });

            // Video Setup and Start
            const stream = await navigator.mediaDevices.getUserMedia({ video: { width: 640, height: 480 } });
            videoElement.srcObject = stream;
            await new Promise((res, rej) => { videoElement.onloadedmetadata = res; videoElement.onerror = () => rej(new Error("Video metadata loading error."));});
            await videoElement.play();
            console.log("[LML_Clone 3DModel] Video playback started.");

            resizeObserverInternal = new ResizeObserver(resizeHandlerRef.current);
            resizeObserverInternal.observe(canvasElement);
            configureCanvas(); // Initial call

            console.log("[LML_Clone 3DModel] All sub-initializations complete (model data loaded).");
            setDebugMessage("3D Model Loaded. Ready for GPU buffers.");
            if (!renderLoopStartedInternal) { render(); renderLoopStartedInternal = true; }

        } catch (err) {
            setError(`3D Model Init failed: ${err.message.substring(0,150)}...`);
            console.error("[LML_Clone 3DModel initializeAll] Major error:", err);
            setDebugMessage("Error in 3D Model Init.");
        }
    };

    initializeAll();

    return () => { // Cleanup
        console.log("[LML_Clone 3DModel] Cleanup running.");
        if (animationFrameIdRef.current) cancelAnimationFrame(animationFrameIdRef.current);
        if (resizeObserverInternal && canvasRef.current) resizeObserverInternal.unobserve(canvasRef.current);
        if (resizeObserverInternal) resizeObserverInternal.disconnect();
        videoRef.current?.srcObject?.getTracks().forEach(track => track.stop());
        if (videoRef.current) videoRef.current.srcObject = null;

        const pState = pipelineStateRef.current;
        // pState.vertexBuffer?.destroy(); // Old 2D buffer
        pState.lipModelVertexBuffer?.destroy(); // New 3D model buffer
        pState.lipModelIndexBuffer?.destroy();  // New 3D model buffer

        pState.aspectRatioUniformBuffer?.destroy();
        pState.lipstickMaterialUniformBuffer?.destroy();
        pState.lightingUniformBuffer?.destroy();
        pState.lipstickAlbedoTexture?.destroy();
        pState.lipstickNormalTexture?.destroy();

        if (landmarkerRef.current && typeof landmarkerRef.current.close === 'function') { landmarkerRef.current.close(); }
        landmarkerRef.current = null; setLandmarkerState(null);
        // Consider device.destroy() if appropriate for your app lifecycle, but it's often not needed for page unloads.
        deviceRef.current = null; contextRef.current = null; formatRef.current = null;
        console.log("[LML_Clone 3DModel] Cleanup complete.");
    };
  }, []); // Empty dependency array to run once on mount

  useEffect(() => { /* UI Message Effect */
    if (error) { setDebugMessage(`Error: ${error.substring(0,40)}...`); }
    else if (landmarkerState && deviceRef.current && pipelineStateRef.current.videoPipeline) { // General readiness check
        if(pipelineStateRef.current.lipModelData && !pipelineStateRef.current.lipModelVertexBuffer) {
            setDebugMessage("3D Model Parsed. GPU Buffers Next.");
        } else if (pipelineStateRef.current.lipModelVertexBuffer) {
            setDebugMessage("Live Active (3D Model Mode)");
        } else {
            setDebugMessage("Initializing...");
        }
    } else { setDebugMessage("Initializing..."); }
  }, [landmarkerState, deviceRef.current, pipelineStateRef.current.videoPipeline, pipelineStateRef.current.lipModelData, pipelineStateRef.current.lipModelVertexBuffer, error]);

  return ( /* ... Same JSX ... */
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