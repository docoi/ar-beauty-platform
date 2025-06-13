// src/pages/LipstickMirrorLive_Clone.jsx

import React, { useEffect, useRef, useState } from 'react';
import createPipelines from '@/utils/createPipelines';
import { FaceLandmarker, FilesetResolver } from '@mediapipe/tasks-vision';
import { load } from '@loaders.gl/core';
import { GLTFLoader } from '@loaders.gl/gltf';

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
    videoPipeline: null, videoBindGroupLayout: null, videoSampler: null,
    aspectRatioGroupLayout: null, aspectRatioUniformBuffer: null, aspectRatioBindGroup: null,
    lipstickMaterialGroupLayout: null, lipstickMaterialUniformBuffer: null,
    lightingGroupLayout: null, lightingUniformBuffer: null, lightingBindGroup: null,
    lipstickAlbedoTexture: null, lipstickAlbedoTextureView: null,
    lipstickNormalTexture: null, lipstickNormalTextureView: null,
    lipstickAlbedoSampler: null,
    lipModelData: null, lipModelVertexBuffer: null, lipModelIndexBuffer: null,
    lipModelIndexFormat: 'uint16', lipModelNumIndices: 0,
    lipModelPipeline: null, lipModelMaterialBindGroup: null,
    lipModelAspectRatioBindGroup: null, lipModelLightingBindGroup: null,
  });

  const [landmarkerState, setLandmarkerState] = useState(null);
  const [error, setError] = useState(null);
  const [debugMessage, setDebugMessage] = useState('Initializing...');

  useEffect(() => { selectedColorForRenderRef.current = selectedColorUI; }, [selectedColorUI]);

  useEffect(() => {
    console.log("[LML_Clone 3DModel] Main useEffect with @loaders.gl (with detailed logging).");
    let deviceInternal = null; let contextInternal = null; let formatInternal = null;
    let resizeObserverInternal = null; let renderLoopStartedInternal = false;

    const canvasElement = canvasRef.current;
    const videoElement = videoRef.current;
    if (!canvasElement || !videoElement) { setError("Canvas or Video element not found."); return; }

    const configureCanvas = (/* entries */) => {
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

    const render = async () => { /* ... (render function remains the same for now) ... */
        const currentDevice = deviceRef.current; const currentContext = contextRef.current;
        const currentVideoEl = videoRef.current; const pState = pipelineStateRef.current;
        const activeLandmarker = landmarkerRef.current;

        if (!currentDevice || !currentContext || !pState.videoPipeline || (pState.lipModelData && !pState.lipModelPipeline) ) {
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
        // --- Landmark processing & 3D Model Deformation (placeholder) ---
        let videoTextureGPU, frameBindGroupForTexture;
        try {
            videoTextureGPU = currentDevice.importExternalTexture({ source: currentVideoEl });
            if (pState.videoBindGroupLayout && pState.videoSampler) { frameBindGroupForTexture = currentDevice.createBindGroup({ layout: pState.videoBindGroupLayout, entries: [{ binding: 0, resource: pState.videoSampler }, { binding: 1, resource: videoTextureGPU }] }); }
            else { animationFrameIdRef.current = requestAnimationFrame(render); return; }
        } catch (e) { console.error("Error importing video texture:", e); animationFrameIdRef.current = requestAnimationFrame(render); return; }
        let currentGpuTexture, texView;
        try {
            currentGpuTexture = currentContext.getCurrentTexture(); texView = currentGpuTexture.createView();
        } catch (e) { console.warn("Error getting current texture", e); if (resizeHandlerRef.current) resizeHandlerRef.current(); animationFrameIdRef.current = requestAnimationFrame(render); return; }
        const cmdEnc = currentDevice.createCommandEncoder({label: "Main Render Encoder"});
        const passEnc = cmdEnc.beginRenderPass({ colorAttachments: [{ view: texView, clearValue: { r: 0.0, g: 0.0, b: 0.0, a: 1.0 }, loadOp: 'clear', storeOp: 'store' }]});
        passEnc.setViewport(0, 0, currentGpuTexture.width, currentGpuTexture.height, 0, 1);
        passEnc.setScissorRect(0, 0, currentGpuTexture.width, currentGpuTexture.height);
        if (pState.videoPipeline && frameBindGroupForTexture && pState.aspectRatioBindGroup) {
            passEnc.setPipeline(pState.videoPipeline); passEnc.setBindGroup(0, frameBindGroupForTexture); passEnc.setBindGroup(1, pState.aspectRatioBindGroup); passEnc.draw(6);
        }
        if (pState.lipModelPipeline && pState.lipModelVertexBuffer && pState.lipModelIndexBuffer && pState.lipModelAspectRatioBindGroup && pState.lipModelMaterialBindGroup && pState.lipModelLightingBindGroup) {
            passEnc.setPipeline(pState.lipModelPipeline);
            passEnc.setBindGroup(0, pState.lipModelAspectRatioBindGroup); passEnc.setBindGroup(1, pState.lipModelMaterialBindGroup); passEnc.setBindGroup(2, pState.lipModelLightingBindGroup);
            passEnc.setVertexBuffer(0, pState.lipModelVertexBuffer);
            passEnc.setIndexBuffer(pState.lipModelIndexBuffer, pState.lipModelIndexFormat);
            passEnc.drawIndexed(pState.lipModelNumIndices);
        }
        passEnc.end(); currentDevice.queue.submit([cmdEnc.finish()]);
        animationFrameIdRef.current = requestAnimationFrame(render);
    };

    const initializeAll = async () => {
        console.log("[LML_Clone 3DModel] Attempting to load /models/lips_model.glb using @loaders.gl/gltf");
        setDebugMessage("Loading 3D Lip Model...");
        let gltfSceneData; // Will hold the result from loaders.gl
        try {
            gltfSceneData = await load('/models/lips_model.glb', GLTFLoader);
            
            // --- DETAILED LOGGING INSERTED HERE ---
            console.log("[LML_Clone 3DModel] GLB model loaded by @loaders.gl. Full data object:", gltfSceneData);
            console.log("Top-level keys in gltfSceneData:", Object.keys(gltfSceneData));
            console.log("gltfSceneData.meshes:", gltfSceneData.meshes);
            if (gltfSceneData.json && gltfSceneData.json.meshes) {
                console.log("Raw json.meshes from GLTF:", gltfSceneData.json.meshes);
                if (gltfSceneData.json.meshes.length > 0) {
                    console.log("First raw json.mesh's primitives:", gltfSceneData.json.meshes[0].primitives);
                }
            } else { console.log("gltfSceneData.json or gltfSceneData.json.meshes is undefined."); }

            if (gltfSceneData.scene) {
                console.log("gltfSceneData.scene (default scene resolved by loaders.gl):", gltfSceneData.scene);
                if (gltfSceneData.scene.nodes) {
                    console.log("Nodes in default scene (gltfSceneData.scene.nodes):");
                    gltfSceneData.scene.nodes.forEach((node, index) => {
                        console.log(`  Node ${index} (name: ${node.name || 'N/A'}):`, node);
                        if (node.mesh) {
                            console.log(`    Node ${index} has MESH object:`, node.mesh);
                            if (node.mesh.primitives) {
                                console.log(`    Node ${index} mesh primitives:`, node.mesh.primitives);
                            }
                        }
                    });
                }
            } else if (gltfSceneData.scenes) {
                 console.log("gltfSceneData.scenes (array of all scenes):", gltfSceneData.scenes);
                 const defaultSceneIndex = gltfSceneData.json.scene;
                 if (defaultSceneIndex !== undefined && gltfSceneData.scenes[defaultSceneIndex]) {
                     const defaultScene = gltfSceneData.scenes[defaultSceneIndex];
                     console.log("Default scene from gltfSceneData.scenes array:", defaultScene);
                     if (defaultScene.nodes) {
                        console.log("Nodes in default scene (from scenes array):");
                        defaultScene.nodes.forEach((node, index) => {
                            console.log(`  Node ${index} (name: ${node.name || 'N/A'}):`, node);
                            if (node.mesh) {
                                console.log(`    Node ${index} has MESH object:`, node.mesh);
                                 if (node.mesh.primitives) {
                                    console.log(`    Node ${index} mesh primitives:`, node.mesh.primitives);
                                }
                            }
                        });
                     }
                 }
            } else { console.log("No scene information readily available at gltfSceneData.scene or gltfSceneData.scenes"); }
            // --- END OF DETAILED LOGGING ---


            // Original check that was failing
            if (!gltfSceneData || !gltfSceneData.meshes || gltfSceneData.meshes.length === 0) {
                // Let's try accessing mesh via the scene graph if top-level meshes array is empty
                let foundMeshViaScene = false;
                if (gltfSceneData.scene && gltfSceneData.scene.nodes) {
                    for (const node of gltfSceneData.scene.nodes) {
                        if (node.mesh && node.mesh.primitives && node.mesh.primitives.length > 0) {
                            gltfSceneData.meshes = [node.mesh]; // Promote this mesh to the top level for our existing logic
                            console.log("[LML_Clone 3DModel] Found mesh via scene graph and promoted it.");
                            foundMeshViaScene = true;
                            break;
                        }
                    }
                }
                if (!foundMeshViaScene) {
                    throw new Error("No meshes found in gltfSceneData.meshes, and couldn't find one via default scene nodes.");
                }
            }
            
            const mesh = gltfSceneData.meshes[0];
            if (!mesh || !mesh.primitives || mesh.primitives.length === 0) {
                throw new Error("First mesh has no primitives.");
            }
            const primitive = mesh.primitives[0];

            if (!primitive.attributes.POSITION) {
                throw new Error("Mesh primitive is missing POSITION attribute.");
            }
            
            const positions = primitive.attributes.POSITION.value;
            const normals = primitive.attributes.NORMAL ? primitive.attributes.NORMAL.value : null;
            const uvs = primitive.attributes.TEXCOORD_0 ? primitive.attributes.TEXCOORD_0.value : null;
            const indices = primitive.indices ? primitive.indices.value : null;

            if (!positions) throw new Error("Parsed model data is missing positions.");
            // Warnings if data is missing, but don't halt unless positions are missing.
            if (!normals) console.warn("Loaded 3D model is missing normals! Lighting may be incorrect or flat.");
            if (!uvs) console.warn("Loaded 3D model is missing UVs (TEXCOORD_0)! Texturing will not work correctly.");
            if (!indices) console.warn("Loaded 3D model is missing indices! Will attempt non-indexed drawing if pipeline supports it (currently expects indexed).");


            pipelineStateRef.current.lipModelData = {
                positions, normals, uvs, indices,
                targets: primitive.targets || [], 
                shapeKeyNames: mesh.extras?.targetNames || gltfSceneData.extras?.targetNames || [],
            };

            console.log("[LML_Clone 3DModel] Mesh data extracted via @loaders.gl:", { /* ... data summary ... */ });
            setDebugMessage("3D Model Parsed. Initializing GPU resources...");

        } catch (modelLoadError) {
            console.error("[LML_Clone 3DModel] Error loading or parsing lip model with @loaders.gl:", modelLoadError);
            setError(`Failed to load 3D lip model: ${modelLoadError.message.substring(0, 150)}...`);
            setDebugMessage("Error: 3D Model Load Failed.");
            return; 
        }

        if (!navigator.gpu) { setError("WebGPU not supported."); return; }
        setDebugMessage("Initializing WebGPU for 3D Model...");

        try {
            // ... (Landmarker, Adapter, Device, Context, Format setup) ...
            const vision = await FilesetResolver.forVisionTasks('https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm');
            const lmInstance = await FaceLandmarker.createFromOptions(vision, { baseOptions: { modelAssetPath: '/models/face_landmarker.task', delegate: 'GPU' }, outputFaceBlendshapes: true, runningMode: 'VIDEO', numFaces: 1 });
            landmarkerRef.current = lmInstance; setLandmarkerState(lmInstance);
            const adapter = await navigator.gpu.requestAdapter(); if (!adapter) throw new Error("No WebGPU adapter found.");
            deviceInternal = await adapter.requestDevice(); deviceRef.current = deviceInternal;
            deviceInternal.lost.then((info) => { console.error(`Device lost: ${info.message}`); setError("Device lost"); deviceRef.current = null; if (animationFrameIdRef.current) cancelAnimationFrame(animationFrameIdRef.current); });
            contextInternal = canvasElement.getContext('webgpu'); contextRef.current = contextInternal;
            formatInternal = navigator.gpu.getPreferredCanvasFormat(); formatRef.current = formatInternal;

            let lipstickAlbedoImageBitmap, lipstickNormalImageBitmap;
            try { lipstickAlbedoImageBitmap = await loadImageBitmap('/textures/lipstick_albedo_gray.png'); } catch (e) { console.warn("Failed to load albedo texture.", e); }
            try { lipstickNormalImageBitmap = await loadImageBitmap('/textures/lipstick_normal.png'); } catch (e) { console.warn("Failed to load normal map.", e); }

            const p = pipelineStateRef.current;
            const layoutsAndPipelines = await createPipelines(deviceInternal, formatInternal, true /* is3DModelMode */);
            if (!layoutsAndPipelines.videoPipeline || !layoutsAndPipelines.lipModelPipeline) throw new Error("Pipeline creation failed.");

            p.videoPipeline = layoutsAndPipelines.videoPipeline;
            p.lipModelPipeline = layoutsAndPipelines.lipModelPipeline;
            p.videoBindGroupLayout = layoutsAndPipelines.videoBindGroupLayout;
            p.aspectRatioGroupLayout = layoutsAndPipelines.aspectRatioGroupLayout;
            p.lipstickMaterialGroupLayout = layoutsAndPipelines.lipstickMaterialGroupLayout;
            p.lightingGroupLayout = layoutsAndPipelines.lightingGroupLayout;

            p.aspectRatioUniformBuffer = deviceInternal.createBuffer({ label: "Aspect Ratio UB", size: 16 * 4, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST });
            p.aspectRatioBindGroup = deviceInternal.createBindGroup({ label: "Aspect Ratio BG (Video)", layout: p.aspectRatioGroupLayout, entries: [{binding:0, resource:{buffer: p.aspectRatioUniformBuffer}}]});
            p.lipModelAspectRatioBindGroup = deviceInternal.createBindGroup({ label: "MVP Matrix BG (3D Model)", layout: p.aspectRatioGroupLayout, entries: [{binding:0, resource:{buffer: p.aspectRatioUniformBuffer}}]});

            p.lipstickMaterialUniformBuffer = deviceInternal.createBuffer({ label: "Material Tint UB", size: 4 * 4, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST });
            p.lightingUniformBuffer = deviceInternal.createBuffer({ label: "Lighting UB", size: 12 * 4, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST });
            p.lipModelLightingBindGroup = deviceInternal.createBindGroup({ label: "Lighting BG (3D Model)", layout: p.lightingGroupLayout, entries: [{binding:0, resource:{buffer:p.lightingUniformBuffer}}]});
            
            p.videoSampler = deviceInternal.createSampler({ magFilter: 'linear', minFilter: 'linear' });

            if (lipstickAlbedoImageBitmap) {
                p.lipstickAlbedoTexture = deviceInternal.createTexture({label:"Albedo Tex", size:[lipstickAlbedoImageBitmap.width, lipstickAlbedoImageBitmap.height], format:'rgba8unorm', usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST | GPUTextureUsage.RENDER_ATTACHMENT});
                deviceInternal.queue.copyExternalImageToTexture({source:lipstickAlbedoImageBitmap}, {texture:p.lipstickAlbedoTexture}, [lipstickAlbedoImageBitmap.width, lipstickAlbedoImageBitmap.height]);
                p.lipstickAlbedoTextureView = p.lipstickAlbedoTexture.createView();
            }
            p.lipstickAlbedoSampler = deviceInternal.createSampler({label:"Material Sampler", magFilter:'linear', minFilter:'linear', addressModeU:'repeat', addressModeV:'repeat'});

            if (lipstickNormalImageBitmap) {
                p.lipstickNormalTexture = deviceInternal.createTexture({label:"Normal Tex", size:[lipstickNormalImageBitmap.width, lipstickNormalImageBitmap.height], format:'rgba8unorm', usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST | GPUTextureUsage.RENDER_ATTACHMENT});
                deviceInternal.queue.copyExternalImageToTexture({source:lipstickNormalImageBitmap}, {texture:p.lipstickNormalTexture}, [lipstickNormalImageBitmap.width, lipstickNormalImageBitmap.height]);
                p.lipstickNormalTextureView = p.lipstickNormalTexture.createView();
            }

            const materialEntries = [{binding:0, resource:{buffer:p.lipstickMaterialUniformBuffer}}];
            if (p.lipstickAlbedoTextureView) materialEntries.push({binding:1, resource:p.lipstickAlbedoTextureView}); else console.warn("Albedo TV missing for MatBG");
            if (p.lipstickAlbedoSampler) materialEntries.push({binding:2, resource:p.lipstickAlbedoSampler}); else console.warn("Albedo Sampler missing for MatBG");
            if (p.lipstickNormalTextureView) materialEntries.push({binding:3, resource:p.lipstickNormalTextureView}); else console.warn("Normal TV missing for MatBG");
            
            if (p.lipstickMaterialGroupLayout && p.lipstickMaterialUniformBuffer ) {
                 p.lipModelMaterialBindGroup = deviceInternal.createBindGroup({label:"3D Lip Material BG", layout:p.lipstickMaterialGroupLayout, entries: materialEntries});
            } else { throw new Error("Material bind group creation failed for 3D model."); }

            const model = p.lipModelData;
            if (model && model.positions && model.normals && model.uvs && model.indices) {
                const numVertices = model.positions.length / 3;
                const interleavedBufferData = new Float32Array(numVertices * 8);
                for (let i = 0; i < numVertices; i++) {
                    let offset = i * 8;
                    interleavedBufferData[offset++] = model.positions[i*3+0]; interleavedBufferData[offset++] = model.positions[i*3+1]; interleavedBufferData[offset++] = model.positions[i*3+2];
                    interleavedBufferData[offset++] = model.normals[i*3+0]; interleavedBufferData[offset++] = model.normals[i*3+1]; interleavedBufferData[offset++] = model.normals[i*3+2];
                    interleavedBufferData[offset++] = model.uvs[i*2+0]; interleavedBufferData[offset++] = model.uvs[i*2+1];
                }
                
                p.lipModelVertexBuffer = deviceInternal.createBuffer({ label: "3D Lip Model VB", size: interleavedBufferData.byteLength, usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST, mappedAtCreation: true, });
                new Float32Array(p.lipModelVertexBuffer.getMappedRange()).set(interleavedBufferData);
                p.lipModelVertexBuffer.unmap();

                p.lipModelIndexBuffer = deviceInternal.createBuffer({ label: "3D Lip Model IB", size: model.indices.byteLength, usage: GPUBufferUsage.INDEX | GPUBufferUsage.COPY_DST, mappedAtCreation: true, });
                if (model.indices instanceof Uint16Array) { new Uint16Array(p.lipModelIndexBuffer.getMappedRange()).set(model.indices); p.lipModelIndexFormat = 'uint16'; }
                else if (model.indices instanceof Uint32Array) { new Uint32Array(p.lipModelIndexBuffer.getMappedRange()).set(model.indices); p.lipModelIndexFormat = 'uint32'; }
                else { throw new Error("Unsupported GLTF index buffer type for model.indices"); }
                p.lipModelIndexBuffer.unmap();
                p.lipModelNumIndices = model.indices.length;
            } else { throw new Error("Essential model data (pos, norm, uv, indices) missing after parse for GPU buffers."); }

            const stream = await navigator.mediaDevices.getUserMedia({ video: { width: 640, height: 480 } });
            videoElement.srcObject = stream;
            await new Promise((res, rej) => { videoElement.onloadedmetadata = res; videoElement.onerror = () => rej(new Error("Video metadata error."));});
            await videoElement.play();
            resizeObserverInternal = new ResizeObserver(resizeHandlerRef.current);
            resizeObserverInternal.observe(canvasElement);
            if (resizeHandlerRef.current) resizeHandlerRef.current();

            console.log("[LML_Clone 3DModel] GPU resources and video initialized using @loaders.gl.");
            setDebugMessage("Ready (3D Model Mode).");
            if (!renderLoopStartedInternal) { render(); renderLoopStartedInternal = true; }

        } catch (err) {
            setError(`GPU Init failed: ${err.message.substring(0,150)}...`);
            console.error("[LML_Clone 3DModel] Major error during GPU initialization:", err);
            setDebugMessage("Error: GPU Init Failed.");
        }
    };

    initializeAll();
    return () => { /* ... (cleanup as before) ... */
        console.log("[LML_Clone 3DModel] Cleanup running.");
        if (animationFrameIdRef.current) cancelAnimationFrame(animationFrameIdRef.current);
        if (resizeObserverInternal && canvasRef.current) resizeObserverInternal.unobserve(canvasRef.current);
        if (resizeObserverInternal) resizeObserverInternal.disconnect();
        videoRef.current?.srcObject?.getTracks().forEach(track => track.stop());
        if (videoRef.current) videoRef.current.srcObject = null;
        const pState = pipelineStateRef.current;
        pState.aspectRatioUniformBuffer?.destroy(); pState.lipstickMaterialUniformBuffer?.destroy();
        pState.lightingUniformBuffer?.destroy(); pState.lipstickAlbedoTexture?.destroy();
        pState.lipstickNormalTexture?.destroy(); pState.lipModelVertexBuffer?.destroy();
        pState.lipModelIndexBuffer?.destroy();
        if (landmarkerRef.current && typeof landmarkerRef.current.close === 'function') { landmarkerRef.current.close(); }
        landmarkerRef.current = null; setLandmarkerState(null);
        deviceRef.current = null; contextRef.current = null; formatRef.current = null;
        console.log("[LML_Clone 3DModel] Cleanup complete.");
    };
  }, []);

  useEffect(() => {
    if (error) { setDebugMessage(`Error: ${error.substring(0,50)}...`); }
    else if (landmarkerState && deviceRef.current && contextRef.current && pipelineStateRef.current.lipModelPipeline) {
      setDebugMessage("Live Active (3D Model)");
    } else if (pipelineStateRef.current.lipModelData && !error && !pipelineStateRef.current.lipModelPipeline) {
      setDebugMessage("Model Loaded, GPU Init...");
    } else if (!pipelineStateRef.current.lipModelData && !error) {
        setDebugMessage("Initializing (3D Model Load Attempt)...");
    }
  }, [landmarkerState, deviceRef.current, contextRef.current, pipelineStateRef.current.lipModelPipeline, pipelineStateRef.current.lipModelData, error]);

  return (
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