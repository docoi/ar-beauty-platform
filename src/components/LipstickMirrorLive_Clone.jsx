// src/components/LipstickMirrorLive_Clone.jsx

import React, { useEffect, useRef, useState } from 'react';
import createPipelines from '@/utils/createPipelines';
import { FaceLandmarker, FilesetResolver } from '@mediapipe/tasks-vision';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { Mesh } from 'three';
import { mat4, vec3 } from 'gl-matrix';
import GUI from 'lil-gui';

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

function calculateBoundingBoxCenter(positions) {
  if (!positions || positions.length < 3) return vec3.create();
  let minX = Infinity, minY = Infinity, minZ = Infinity;
  let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;
  for (let i = 0; i < positions.length; i += 3) {
    const x = positions[i]; const y = positions[i + 1]; const z = positions[i + 2];
    minX = Math.min(minX, x); minY = Math.min(minY, y); minZ = Math.min(minZ, z);
    maxX = Math.max(maxX, x); maxY = Math.max(maxY, y); maxZ = Math.max(maxZ, z);
  }
  const center = vec3.fromValues((minX + maxX) / 2, (minY + maxY) / 2, (minZ + maxZ) / 2);
  return center;
}

export default function LipstickMirrorLive_Clone() {
  const canvasRef = useRef(null);
  const videoRef = useRef(null);
  const animationFrameIdRef = useRef(null);
  const landmarkerRef = useRef(null);

  const debugControlsRef = useRef({
      scale: 0.075,
      offsetX: 0.0,
      offsetY: -0.04,
      offsetZ: 0.05,
      static: false, // Add a checkbox to force static mode for easier positioning
  });
  
  const [selectedColorUI, setSelectedColorUI] = useState(LIPSTICK_COLORS[0].value);
  const selectedColorForRenderRef = useRef(LIPSTICK_COLORS[0].value);
  
  const [error, setError] = useState(null);
  const [debugMessage, setDebugMessage] = useState('Initializing...');

  useEffect(() => {
    selectedColorForRenderRef.current = selectedColorUI;
  }, [selectedColorUI]);

  useEffect(() => {
    let gui = null;
    let isCleanedUp = false;

    // This is the core state for all our WebGPU objects.
    const gpuState = {
        device: null,
        context: null,
        format: null,
        pState: { /* pipeline state */ },
    };

    const configureCanvasAndDepthTexture = () => {
        if (!gpuState.device || !gpuState.context || !gpuState.format || !canvasRef.current) return;
        const dpr = window.devicePixelRatio || 1;
        const cw = canvasRef.current.clientWidth;
        const ch = canvasRef.current.clientHeight;
        if (cw === 0 || ch === 0) return;

        const targetWidth = Math.floor(cw * dpr);
        const targetHeight = Math.floor(ch * dpr);

        if (canvasRef.current.width === targetWidth && canvasRef.current.height === targetHeight) return;

        canvasRef.current.width = targetWidth;
        canvasRef.current.height = targetHeight;

        gpuState.context.configure({ device: gpuState.device, format: gpuState.format, alphaMode: 'opaque', size: [targetWidth, targetHeight] });
        
        gpuState.pState.depthTexture?.destroy();
        gpuState.pState.depthTexture = gpuState.device.createTexture({
            size: [targetWidth, targetHeight],
            format: 'depth24plus',
            usage: GPUTextureUsage.RENDER_ATTACHMENT,
        });
        gpuState.pState.depthTextureView = gpuState.pState.depthTexture.createView();
    };

    const render = () => {
        if (isCleanedUp || !gpuState.device || !gpuState.pState.videoPipeline || !videoRef.current || videoRef.current.readyState < 2) {
            animationFrameIdRef.current = requestAnimationFrame(render);
            return;
        }

        const { device, context, pState } = gpuState;
        
        const landmarkerResult = (landmarkerRef.current && !debugControlsRef.current.static) 
            ? landmarkerRef.current.detectForVideo(videoRef.current, performance.now()) 
            : null;

        const hasFace = landmarkerResult?.faceLandmarks?.length > 0 && landmarkerResult?.facialTransformationMatrixes?.length > 0;

        device.queue.writeBuffer(pState.videoAspectRatioUBO, 0, new Float32Array([videoRef.current.videoWidth, videoRef.current.videoHeight, context.canvas.width, context.canvas.height]));

        const projectionMatrix = mat4.create();
        mat4.perspective(projectionMatrix, 45 * Math.PI / 180, context.canvas.width / context.canvas.height, 0.1, 1000.0);
        
        const viewMatrix = mat4.create();
        mat4.lookAt(viewMatrix, vec3.fromValues(0, 0, 1.2), vec3.fromValues(0, 0, 0), vec3.fromValues(0, 1, 0));
        
        let modelMatrix = mat4.create();

        // This block now handles both tracking AND static modes.
        if (pState.lipModelData) {
            if (hasFace) { // Live Tracking Mode
                const faceTransform = mat4.clone(landmarkerResult.facialTransformationMatrixes[0].data);
                const flipYZ = mat4.fromValues(1,0,0,0,  0,-1,0,0,  0,0,-1,0,  0,0,0,1);
                const poseMatrix = mat4.multiply(mat4.create(), faceTransform, flipYZ);

                const localAdjustmentMatrix = mat4.create();
                const { scale, offsetX, offsetY, offsetZ } = debugControlsRef.current;
                mat4.translate(localAdjustmentMatrix, localAdjustmentMatrix, [offsetX, offsetY, offsetZ]);
                mat4.scale(localAdjustmentMatrix, localAdjustmentMatrix, [scale, scale, scale]);
                mat4.translate(localAdjustmentMatrix, localAdjustmentMatrix, vec3.negate(vec3.create(), pState.lipModelData.modelCenter));
                
                mat4.multiply(modelMatrix, poseMatrix, localAdjustmentMatrix);
            } else { // Static Mode (or if no face is detected)
                const { scale, offsetX, offsetY, offsetZ } = debugControlsRef.current;
                mat4.translate(modelMatrix, modelMatrix, [offsetX, offsetY, offsetZ]);
                mat4.scale(modelMatrix, modelMatrix, [scale, scale, scale]);
                mat4.translate(modelMatrix, modelMatrix, vec3.negate(vec3.create(), pState.lipModelData.modelCenter));
            }
        } else {
             mat4.scale(modelMatrix, modelMatrix, [0, 0, 0]);
        }
        
        const sceneMatrices = new Float32Array(16 * 3);
        sceneMatrices.set(projectionMatrix, 0);
        sceneMatrices.set(viewMatrix, 16);
        sceneMatrices.set(modelMatrix, 32);
        device.queue.writeBuffer(pState.lipModelMatrixUBO, 0, sceneMatrices);

        device.queue.writeBuffer(pState.lipstickMaterialUniformBuffer, 0, new Float32Array(selectedColorForRenderRef.current));
        
        let videoTextureGPU;
        try { videoTextureGPU = device.importExternalTexture({ source: videoRef.current }); } catch (e) {
            animationFrameIdRef.current = requestAnimationFrame(render); return;
        }

        const frameBindGroupForTexture = device.createBindGroup({ layout: pState.videoBindGroupLayout, entries: [{ binding: 0, resource: pState.videoSampler }, { binding: 1, resource: videoTextureGPU }] });

        const currentTextureView = context.getCurrentTexture().createView();
        const cmdEnc = device.createCommandEncoder();
        const passEnc = cmdEnc.beginRenderPass({
            colorAttachments: [{ view: currentTextureView, clearValue: [0,0,0,1], loadOp: 'clear', storeOp: 'store' }],
            depthStencilAttachment: { view: pState.depthTextureView, depthClearValue: 1.0, depthLoadOp: 'clear', depthStoreOp: 'store' }
        });

        passEnc.setPipeline(pState.videoPipeline);
        passEnc.setBindGroup(0, frameBindGroupForTexture);
        passEnc.setBindGroup(1, pState.videoAspectRatioBindGroup);
        passEnc.draw(6);

        if (pState.lipModelPipeline) {
            passEnc.setPipeline(pState.lipModelPipeline);
            passEnc.setBindGroup(0, pState.lipModelMatrixBindGroup);
            passEnc.setBindGroup(1, pState.lipModelMaterialBindGroup);
            passEnc.setBindGroup(2, pState.lipModelLightingBindGroup);
            passEnc.setVertexBuffer(0, pState.lipModelVertexBuffer);
            passEnc.setIndexBuffer(pState.lipModelIndexBuffer, pState.lipModelIndexFormat);
            passEnc.drawIndexed(pState.lipModelNumIndices);
        }
        passEnc.end();
        device.queue.submit([cmdEnc.finish()]);
        animationFrameIdRef.current = requestAnimationFrame(render);
    };

    const initialize = async () => {
        // --- STAGE 1: Load essential GPU and media resources ---
        try {
            setDebugMessage("Loading 3D Model...");
            const loader = new GLTFLoader();
            const gltf = await loader.loadAsync('/models/lips_model.glb');
            let lipMesh = null;
            gltf.scene.traverse((object) => { if (object instanceof Mesh) { lipMesh = object; } });
            if (!lipMesh) throw new Error("Could not find a mesh in the loaded GLTF scene.");
            const geometry = lipMesh.geometry;
            const positions = geometry.attributes.position.array;
            const normals = geometry.attributes.normal.array;
            const uvs = geometry.attributes.uv.array;
            const indices = geometry.index.array;
            const modelCenter = calculateBoundingBoxCenter(positions);
            gpuState.pState.lipModelData = { positions, normals, uvs, indices, modelCenter };

            setDebugMessage("Initializing GPU...");
            if (!navigator.gpu) throw new Error("WebGPU not supported.");
            const adapter = await navigator.gpu.requestAdapter();
            if (!adapter) throw new Error("No GPU adapter found.");
            gpuState.device = await adapter.requestDevice();
            gpuState.context = canvasRef.current.getContext('webgpu');
            gpuState.format = navigator.gpu.getPreferredCanvasFormat();
            
            configureCanvasAndDepthTexture();

            let lipstickAlbedoImageBitmap, lipstickNormalImageBitmap;
            try { lipstickAlbedoImageBitmap = await loadImageBitmap('/textures/lipstick_albedo_gray.png'); } catch (e) { console.warn(e); }
            try { lipstickNormalImageBitmap = await loadImageBitmap('/textures/lipstick_normal.png'); } catch (e) { console.warn(e); }
            
            const layoutsAndPipelines = await createPipelines(gpuState.device, gpuState.format, true);
            Object.assign(gpuState.pState, layoutsAndPipelines);
            
            // Create all buffers and samplers...
            gpuState.pState.videoAspectRatioUBO = gpuState.device.createBuffer({ size: 16, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST });
            gpuState.pState.videoAspectRatioBindGroup = gpuState.device.createBindGroup({ layout: gpuState.pState.videoAspectRatioGroupLayout, entries: [{binding:0, resource:{buffer:gpuState.pState.videoAspectRatioUBO}}]});
            gpuState.pState.lipModelMatrixUBO = gpuState.device.createBuffer({ size: 192, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST });
            gpuState.pState.lipModelMatrixBindGroup = gpuState.device.createBindGroup({ layout: gpuState.pState.lipModelMatrixGroupLayout, entries: [{binding:0, resource:{buffer:gpuState.pState.lipModelMatrixUBO}}]});
            gpuState.pState.lipstickMaterialUniformBuffer = gpuState.device.createBuffer({ size: 16, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST });
            gpuState.pState.lightingUniformBuffer = gpuState.device.createBuffer({ size: 64, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST });
            gpuState.pState.lipModelLightingBindGroup = gpuState.device.createBindGroup({ layout: gpuState.pState.lightingGroupLayout, entries: [{binding:0, resource:{buffer:gpuState.pState.lightingUniformBuffer}}]});
            gpuState.pState.videoSampler = gpuState.device.createSampler({ magFilter: 'linear', minFilter: 'linear' });

            if (lipstickAlbedoImageBitmap) { gpuState.pState.lipstickAlbedoTexture = gpuState.device.createTexture({ size:[lipstickAlbedoImageBitmap.width, lipstickAlbedoImageBitmap.height], format:'rgba8unorm', usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST | GPUTextureUsage.RENDER_ATTACHMENT}); gpuState.device.queue.copyExternalImageToTexture({source:lipstickAlbedoImageBitmap}, {texture:gpuState.pState.lipstickAlbedoTexture}, [lipstickAlbedoImageBitmap.width, lipstickAlbedoImageBitmap.height]); gpuState.pState.lipstickAlbedoTextureView = gpuState.pState.lipstickAlbedoTexture.createView(); }
            if (lipstickNormalImageBitmap) { gpuState.pState.lipstickNormalTexture = gpuState.device.createTexture({label:"NormalTex", size:[lipstickNormalImageBitmap.width, lipstickNormalImageBitmap.height], format:'rgba8unorm', usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST | GPUTextureUsage.RENDER_ATTACHMENT}); gpuState.device.queue.copyExternalImageToTexture({source:lipstickNormalImageBitmap}, {texture:gpuState.pState.lipstickNormalTexture}, [lipstickNormalImageBitmap.width, lipstickNormalImageBitmap.height]); gpuState.pState.lipstickNormalTextureView = gpuState.pState.lipstickNormalTexture.createView(); }
            gpuState.pState.lipstickAlbedoSampler = gpuState.device.createSampler({magFilter:'linear', minFilter:'linear'});

            const materialEntries = [{binding:0, resource:{buffer:gpuState.pState.lipstickMaterialUniformBuffer}}];
            if (gpuState.pState.lipstickAlbedoTextureView) materialEntries.push({binding:1, resource:gpuState.pState.lipstickAlbedoTextureView});
            if (gpuState.pState.lipstickAlbedoSampler) materialEntries.push({binding:2, resource:gpuState.pState.lipstickAlbedoSampler});
            if (gpuState.pState.lipstickNormalTextureView) materialEntries.push({binding:3, resource:gpuState.pState.lipstickNormalTextureView});
            gpuState.pState.lipModelMaterialBindGroup = gpuState.device.createBindGroup({layout:gpuState.pState.lipstickMaterialGroupLayout, entries: materialEntries});
            
            const model = gpuState.pState.lipModelData;
            const numVertices = model.positions.length / 3;
            const interleaved = new Float32Array(numVertices * 8); 
            for (let i=0; i<numVertices; ++i) { interleaved.set(model.positions.slice(i*3, i*3+3), i*8); interleaved.set(model.normals.slice(i*3, i*3+3), i*8+3); interleaved.set(model.uvs.slice(i*2, i*2+2), i*8+6); }
            gpuState.pState.lipModelVertexBuffer = gpuState.device.createBuffer({ size: interleaved.byteLength, usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST });
            gpuState.device.queue.writeBuffer(gpuState.pState.lipModelVertexBuffer, 0, interleaved);
            
            const iData = model.indices;
            gpuState.pState.lipModelIndexBuffer = gpuState.device.createBuffer({ size: iData.byteLength, usage: GPUBufferUsage.INDEX | GPUBufferUsage.COPY_DST });
            gpuState.device.queue.writeBuffer(gpuState.pState.lipModelIndexBuffer, 0, iData);
            gpuState.pState.lipModelIndexFormat = (iData instanceof Uint16Array) ? 'uint16' : 'uint32';
            gpuState.pState.lipModelNumIndices = model.indices.length;

            setDebugMessage("Starting video...");
            const stream = await navigator.mediaDevices.getUserMedia({ video: true });
            videoRef.current.srcObject = stream;
            await videoRef.current.play();

            const resizeObserver = new ResizeObserver(configureCanvasAndDepthTexture);
            resizeObserver.observe(canvasRef.current);
            
            // Start rendering! Video and static model will now appear.
            render();
            setDebugMessage("Ready. Initializing tracking...");

        } catch (err) {
            setError(err.message);
            setDebugMessage("Error during setup.");
            return; // Stop if essential setup fails
        }

        // --- STAGE 2: Load MediaPipe in the background ---
        try {
            const vision = await FilesetResolver.forVisionTasks('https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm');
            const lmInstance = await FaceLandmarker.createFromOptions(vision, {
                baseOptions: { modelAssetPath: '/models/face_landmarker.task', delegate: 'GPU' },
                outputFaceLandmarks: true,
                outputFacialTransformationMatrixes: true,
                runningMode: 'VIDEO',
                numFaces: 1,
            });
            landmarkerRef.current = lmInstance; // Tracking is now live
            setDebugMessage("Tracking Active");
        } catch (err) {
            console.error("Failed to initialize Face Landmarker:", err);
            setDebugMessage("Tracking failed to load."); // Non-fatal error
        }
    };

    // Setup GUI and start initialization
    gui = new GUI();
    const controls = debugControlsRef.current;
    gui.add(controls, 'scale', 0.01, 0.2, 0.001).name('Scale');
    gui.add(controls, 'offsetX', -0.5, 0.5, 0.001).name('Offset X');
    gui.add(controls, 'offsetY', -0.5, 0.5, 0.001).name('Offset Y');
    gui.add(controls, 'offsetZ', -0.5, 0.5, 0.001).name('Offset Z');
    gui.add(controls, 'static').name('Force Static');

    initialize();

    return () => {
        isCleanedUp = true;
        gui?.destroy();
        if (animationFrameIdRef.current) cancelAnimationFrame(animationFrameIdRef.current);
        videoRef.current?.srcObject?.getTracks().forEach(t => t.stop());
        landmarkerRef.current?.close();
    };
  }, []);

  return ( 
    <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, overflow: 'hidden' }}>
      <div style={{ position: 'absolute', top: '5px', left: '5px', background: 'rgba(0,0,0,0.7)', color: 'white', padding: '2px 5px', fontSize: '12px', zIndex: 20, pointerEvents: 'none' }}>
        {error ? `Error: ${error}` : debugMessage}
      </div>
      <div style={{ position: 'absolute', bottom: '20px', left: '50%', transform: 'translateX(-50%)', display: 'flex', gap: '10px', padding: '10px', backgroundColor: 'rgba(255, 255, 255, 0.2)', borderRadius: '10px', zIndex: 10 }}>
        {LIPSTICK_COLORS.map(color => (
            <div key={color.name} title={color.name} onClick={() => setSelectedColorUI(color.value)} style={{ width: '40px', height: '40px', backgroundColor: `rgba(${color.value[0]*255}, ${color.value[1]*255}, ${color.value[2]*255}, ${color.value[3]})`, borderRadius: '50%', border: selectedColorUI === color.value ? '3px solid white' : '3px solid transparent', cursor: 'pointer' }} />
        ))}
      </div>
      <video ref={videoRef} style={{ display: 'none' }} autoPlay playsInline muted />
      <canvas ref={canvasRef} style={{ width: '100%', height: '100%', display: 'block' }} />
    </div>
  );
}