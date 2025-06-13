// src/pages/LipstickMirrorLive_Clone.jsx

import React, { useEffect, useRef, useState } from 'react';
import createPipelines from '@/utils/createPipelines';
import { FaceLandmarker, FilesetResolver } from '@mediapipe/tasks-vision';
import { load } from '@loaders.gl/core';
import { GLTFLoader } from '@loaders.gl/gltf'; // GLTFLoader will be used

const LIPSTICK_COLORS = [ /* ... as before ... */ ];
async function loadImageBitmap(url) { /* ... as before ... */ }

// RE-INTRODUCE and ADAPT this helper function
function getAccessorDataFromGLTF(gltfJson, accessorIndex, binaryBuffer) {
    if (!gltfJson.accessors || !gltfJson.bufferViews || !gltfJson.buffers) {
        throw new Error("GLTF JSON is missing accessors, bufferViews, or buffers definition.");
    }
    const accessor = gltfJson.accessors[accessorIndex];
    if (!accessor) {
        throw new Error(`Accessor ${accessorIndex} not found.`);
    }
    const bufferView = gltfJson.bufferViews[accessor.bufferView];
    if (!bufferView) {
        throw new Error(`BufferView ${accessor.bufferView} not found for accessor ${accessorIndex}.`);
    }
    // const bufferDef = gltfJson.buffers[bufferView.buffer]; // Not strictly needed if we assume one main binaryBuffer

    const componentType = accessor.componentType; // e.g., 5126 for FLOAT
    const type = accessor.type;                 // e.g., "VEC3", "VEC2", "SCALAR"
    const count = accessor.count;               // Number of elements (e.g., number of vertices for POSITION)

    let numComponents;
    switch (type) {
        case "SCALAR": numComponents = 1; break;
        case "VEC2":   numComponents = 2; break;
        case "VEC3":   numComponents = 3; break;
        case "VEC4":   numComponents = 4; break;
        default: throw new Error(`Unsupported accessor type: ${type}`);
    }

    let TypedArrayConstructor;
    let componentByteSize = 0;
    switch (componentType) {
        case 5120: TypedArrayConstructor = Int8Array;   componentByteSize = 1; break;
        case 5121: TypedArrayConstructor = Uint8Array;  componentByteSize = 1; break;
        case 5122: TypedArrayConstructor = Int16Array;  componentByteSize = 2; break;
        case 5123: TypedArrayConstructor = Uint16Array; componentByteSize = 2; break;
        case 5125: TypedArrayConstructor = Uint32Array; componentByteSize = 4; break;
        case 5126: TypedArrayConstructor = Float32Array;componentByteSize = 4; break;
        default: throw new Error(`Unsupported component type: ${componentType}`);
    }

    const totalValues = count * numComponents; // Total number of individual floats, shorts, etc.
    const accessorByteLength = totalValues * componentByteSize;
    const byteOffset = (bufferView.byteOffset || 0) + (accessor.byteOffset || 0);

    if (binaryBuffer.byteLength < byteOffset + accessorByteLength) {
        throw new Error(
            `Buffer out of bounds for accessor ${accessorIndex}. ` +
            `Calculated offset: ${byteOffset}, length: ${accessorByteLength}. ` +
            `Binary buffer size: ${binaryBuffer.byteLength}. ` +
            `BufferView target: ${bufferView.target}, bvLength: ${bufferView.byteLength}`
        );
    }

    // Create a new ArrayBuffer slice for this accessor's data
    const dataSlice = binaryBuffer.slice(byteOffset, byteOffset + accessorByteLength);
    return new TypedArrayConstructor(dataSlice);
}


export default function LipstickMirrorLive_Clone() {
  // ... (Component setup, refs, state mostly as before) ...
  const canvasRef = useRef(null); /* ... */ videoRef = useRef(null); animationFrameIdRef = useRef(null); frameCounter = useRef(0); resizeHandlerRef = useRef(null); deviceRef = useRef(null); contextRef = useRef(null); formatRef = useRef(null); landmarkerRef = useRef(null);
  const [selectedColorUI, setSelectedColorUI] = useState(LIPSTICK_COLORS[0].value); selectedColorForRenderRef = useRef(LIPSTICK_COLORS[0].value); lightSettingsRef = useRef({direction: [0.5,0.5,1.0], ambientColor: [0.2,0.2,0.2,1.0], diffuseColor: [0.8,0.8,0.8,1.0]});
  const pipelineStateRef = useRef({ videoPipeline: null, videoBindGroupLayout: null, videoSampler: null, aspectRatioGroupLayout: null, aspectRatioUniformBuffer: null, aspectRatioBindGroup: null, lipstickMaterialGroupLayout: null, lipstickMaterialUniformBuffer: null, lightingGroupLayout: null, lightingUniformBuffer: null, lightingBindGroup: null, lipstickAlbedoTexture: null, lipstickAlbedoTextureView: null, lipstickNormalTexture: null, lipstickNormalTextureView: null, lipstickAlbedoSampler: null, lipModelData: null, lipModelVertexBuffer: null, lipModelIndexBuffer: null, lipModelIndexFormat: 'uint16', lipModelNumIndices: 0, lipModelPipeline: null, lipModelMaterialBindGroup: null, lipModelAspectRatioBindGroup: null, lipModelLightingBindGroup: null, });
  const [landmarkerState, setLandmarkerState] = useState(null); const [error, setError] = useState(null); const [debugMessage, setDebugMessage] = useState('Initializing...');
  useEffect(() => { selectedColorForRenderRef.current = selectedColorUI; }, [selectedColorUI]);

  useEffect(() => {
    console.log("[LML_Clone 3DModel] Main useEffect with @loaders.gl (re-adding accessor parsing).");
    let deviceInternal = null, contextInternal = null, formatInternal = null; /* ... */
    let resizeObserverInternal = null; let renderLoopStartedInternal = false;
    const canvasElement = canvasRef.current; const videoElement = videoRef.current;
    if (!canvasElement || !videoElement) { setError("Canvas or Video element not found."); return; }
    const configureCanvas = (/*entries*/) => { /* ... */ }; resizeHandlerRef.current = configureCanvas;
    const render = async () => { /* ... (render function is mostly fine for now) ... */ };

    const initializeAll = async () => {
        console.log("[LML_Clone 3DModel] Attempting to load /models/lips_model.glb using @loaders.gl/gltf");
        setDebugMessage("Loading 3D Lip Model...");
        let gltfData; 
        try {
            // Remove unrecognized 'postProcess' option. Default behavior should be sufficient.
            gltfData = await load('/models/lips_model.glb', GLTFLoader);
            console.log("[LML_Clone 3DModel] GLB model loaded by @loaders.gl. Full data object:", gltfData);

            const gltfJson = gltfData.json;
            // Access the main binary buffer correctly from the GLB structure provided by loaders.gl
            let mainBinaryBuffer;
            if (gltfData.glb && gltfData.glb.binChunks && gltfData.glb.binChunks.length > 0 && gltfData.glb.binChunks[0].arrayBuffer) {
                mainBinaryBuffer = gltfData.glb.binChunks[0].arrayBuffer; // Common for GLB v2
                 console.log("[LML_Clone 3DModel] Using gltfData.glb.binChunks[0].arrayBuffer");
            } else if (gltfData.buffers && gltfData.buffers.length > 0 && gltfData.buffers[0].arrayBuffer) {
                // Some loaders.gl versions might put it here after processing
                mainBinaryBuffer = gltfData.buffers[0].arrayBuffer;
                console.log("[LML_Clone 3DModel] Using gltfData.buffers[0].arrayBuffer");
            } else {
                throw new Error("Could not find the main binary buffer in the loaded GLTF data (_glb.binChunks or buffers[0].arrayBuffer).");
            }


            if (!gltfJson) throw new Error("GLTF JSON part not found in loaded data.");
            if (!gltfJson.meshes || gltfJson.meshes.length === 0) {
                throw new Error("No meshes array found in GLTF JSON (gltfJson.meshes).");
            }
            
            const meshJson = gltfJson.meshes[0]; // Your validator confirmed one mesh
            console.log("[LML_Clone 3DModel] Using mesh from json.meshes[0]:", meshJson);

            if (!meshJson.primitives || meshJson.primitives.length === 0) {
                throw new Error("No primitives found in the first mesh of GLTF JSON.");
            }
            const primitiveJson = meshJson.primitives[0];
            console.log("[LML_Clone 3DModel] Using primitive from mesh.primitives[0]:", primitiveJson);

            if (primitiveJson.attributes.POSITION === undefined) {
                throw new Error("Mesh primitive is missing POSITION attribute accessor index.");
            }

            // Use our helper to get data using accessors
            const positions = getAccessorDataFromGLTF(gltfJson, primitiveJson.attributes.POSITION, mainBinaryBuffer);
            const normals = primitiveJson.attributes.NORMAL !== undefined ? getAccessorDataFromGLTF(gltfJson, primitiveJson.attributes.NORMAL, mainBinaryBuffer) : null;
            const uvs = primitiveJson.attributes.TEXCOORD_0 !== undefined ? getAccessorDataFromGLTF(gltfJson, primitiveJson.attributes.TEXCOORD_0, mainBinaryBuffer) : null;
            const indices = primitiveJson.indices !== undefined ? getAccessorDataFromGLTF(gltfJson, primitiveJson.indices, mainBinaryBuffer) : null;
            
            const targetsData = [];
            const shapeKeyNames = meshJson.extras?.targetNames || primitiveJson.extras?.targetNames || [];
            if (primitiveJson.targets) { /* ... shape key extraction using getAccessorDataFromGLTF ... */ }


            if (!positions) throw new Error("Parsed model data is missing positions after accessor processing.");
            pipelineStateRef.current.lipModelData = { positions, normals, uvs, indices, targets: targetsData, shapeKeyNames };
            console.log("[LML_Clone 3DModel] Mesh data extracted via custom accessor parsing:", { /* ... data summary ... */ });
            setDebugMessage("3D Model Parsed. Initializing GPU...");

        } catch (modelLoadError) {
            console.error("[LML_Clone 3DModel] Error loading or processing lip model with @loaders.gl:", modelLoadError);
            setError(`Failed to load 3D lip model: ${modelLoadError.message.substring(0, 150)}...`);
            setDebugMessage("Error: 3D Model Load Failed.");
            return; 
        }

        // ... (The rest of initializeAll: WebGPU setup, texture loading, pipeline creation, GPU buffer creation for model, etc.
        //      This part should be IDENTICAL to the last known good full code version I sent,
        //      as the error was in the model data extraction part above.)
        //      I will include it fully below.
        if (!navigator.gpu) { setError("WebGPU not supported."); return; }
        setDebugMessage("Initializing WebGPU for 3D Model...");
        try {
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
            p.videoPipeline = layoutsAndPipelines.videoPipeline; p.lipModelPipeline = layoutsAndPipelines.lipModelPipeline;
            p.videoBindGroupLayout = layoutsAndPipelines.videoBindGroupLayout; p.aspectRatioGroupLayout = layoutsAndPipelines.aspectRatioGroupLayout;
            p.lipstickMaterialGroupLayout = layoutsAndPipelines.lipstickMaterialGroupLayout; p.lightingGroupLayout = layoutsAndPipelines.lightingGroupLayout;

            p.aspectRatioUniformBuffer = deviceInternal.createBuffer({ label: "MVP Matrix UB", size: 16 * 4, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST });
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
            if (p.lipstickMaterialGroupLayout && p.lipstickMaterialUniformBuffer ) { p.lipModelMaterialBindGroup = deviceInternal.createBindGroup({label:"3D Lip Material BG", layout:p.lipstickMaterialGroupLayout, entries: materialEntries}); }
            else { throw new Error("Material bind group creation failed for 3D model."); }

            const model = p.lipModelData;
            if (model && model.positions && model.normals && model.uvs && model.indices) {
                const numVertices = model.positions.length / 3;
                const interleavedBufferData = new Float32Array(numVertices * 8); // Pos(3) + Norm(3) + UV(2) = 8 floats
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
                else { throw new Error("Unsupported GLTF index buffer type for model.indices. Expected Uint16Array or Uint32Array."); }
                p.lipModelIndexBuffer.unmap();
                p.lipModelNumIndices = model.indices.length;
                console.log(`[LML_Clone 3DModel] Created VB (${numVertices} verts) and IB (${p.lipModelNumIndices} indices, format ${p.lipModelIndexFormat}) for 3D model.`);
            } else { 
                let missing = [];
                if (!model?.positions) missing.push("positions"); if (!model?.normals) missing.push("normals");
                if (!model?.uvs) missing.push("uvs"); if (!model?.indices) missing.push("indices");
                throw new Error(`Essential model data (${missing.join(', ')}) missing after parse for GPU buffers.`); 
            }

            const stream = await navigator.mediaDevices.getUserMedia({ video: { width: 640, height: 480 } });
            videoElement.srcObject = stream;
            await new Promise((res, rej) => { videoElement.onloadedmetadata = res; videoElement.onerror = () => rej(new Error("Video metadata error."));});
            await videoElement.play();
            resizeObserverInternal = new ResizeObserver(resizeHandlerRef.current);
            resizeObserverInternal.observe(canvasElement);
            if (resizeHandlerRef.current) resizeHandlerRef.current();

            console.log("[LML_Clone 3DModel] GPU resources and video initialized using @loaders.gl (manual accessor processing).");
            setDebugMessage("Ready (3D Model Mode).");
            if (!renderLoopStartedInternal) { render(); renderLoopStartedInternal = true; }
        } catch (err) {
            setError(`GPU Init failed: ${err.message.substring(0,150)}...`);
            console.error("[LML_Clone 3DModel] Major error during GPU initialization:", err);
            setDebugMessage("Error: GPU Init Failed.");
        }
    }; // End of initializeAll

    initializeAll();
    return () => { /* ... Full cleanup ... */ 
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
  }, []); // Main useEffect

  useEffect(() => { /* ... UI Message Effect ... */ 
    if (error) { setDebugMessage(`Error: ${error.substring(0,50)}...`); }
    else if (landmarkerState && deviceRef.current && contextRef.current && pipelineStateRef.current.lipModelPipeline) {
      setDebugMessage("Live Active (3D Model)");
    } else if (pipelineStateRef.current.lipModelData && !error && !pipelineStateRef.current.lipModelPipeline) {
      setDebugMessage("Model Parsed, GPU Init...");
    } else if (!pipelineStateRef.current.lipModelData && !error) {
        setDebugMessage("Initializing (3D Model Load Attempt)...");
    }
  }, [landmarkerState, deviceRef.current, contextRef.current, pipelineStateRef.current.lipModelPipeline, pipelineStateRef.current.lipModelData, error]);

  return ( /* ... JSX as before ... */ 
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