// src/pages/LipstickMirrorLive.jsx (Corrected Render Loop Lifecycle)

import React, { useEffect, useRef, useState } from 'react'; // Removed useCallback as startRenderLoop is now part of useEffect
import initWebGPU from '@/utils/initWebGPU';
import createPipelines from '@/utils/createPipelines';
import lipTriangles from '@/utils/lipTriangles';
import { FaceLandmarker, FilesetResolver } from '@mediapipe/tasks-vision';

export default function LipstickMirrorLive() {
  const canvasRef = useRef(null);
  const videoRef = useRef(null);
  const [landmarker, setLandmarker] = useState(null);
  const [error, setError] = useState(null);
  const [debugMessage, setDebugMessage] = useState('Initializing...');
  const frameCounter = useRef(0);

  const renderState = useRef({
    device: null,
    context: null,
    videoPipeline: null,
    lipstickPipeline: null,
    videoBindGroupLayout: null,
    // videoBindGroup: null, // Bind group is created per frame
    videoSampler: null,
    vertexBuffer: null,
    vertexBufferSize: 0,
    renderRequestId: null, // Stores the ID from requestAnimationFrame
  }).current;

  // Effect 1: Initialize FaceLandmarker (runs once)
  useEffect(() => {
    const initLandmarker = async () => {
      try {
        setDebugMessage("Initializing FaceLandmarker...");
        console.log("[LM_EFFECT] Initializing FaceLandmarker...");
        const vision = await FilesetResolver.forVisionTasks(
          'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm'
        );
        const faceLandmarker = await FaceLandmarker.createFromOptions(vision, {
          baseOptions: {
            modelAssetPath: '/models/face_landmarker.task',
            delegate: 'GPU',
          },
          outputFaceBlendshapes: false,
          outputFacialTransformationMatrixes: false,
          runningMode: 'VIDEO',
          numFaces: 1,
        });
        setLandmarker(faceLandmarker); // This will trigger the render loop effect
        setDebugMessage("FaceLandmarker ready.");
        console.log("[LM_EFFECT] FaceLandmarker ready.");
      } catch (err) {
        console.error("[LM_EFFECT] Error initializing FaceLandmarker:", err);
        setError(`FaceLandmarker init failed: ${err.message}.`);
        setDebugMessage("Error.");
      }
    };
    initLandmarker();
  }, []); // Empty dependency array: runs once on mount

  // Effect 2: Initialize WebGPU and Video (runs once)
  useEffect(() => {
    if (!canvasRef.current || !videoRef.current) {
      console.log("[INIT_EFFECT] Canvas or Video ref not ready yet.");
      return;
    }

    let isCleanup = false; // Flag to prevent setup if cleanup runs early

    const initGPUAndVideo = async () => {
      try {
        setDebugMessage("Initializing Camera and WebGPU...");
        console.log("[INIT_EFFECT] Initializing Camera and WebGPU...");

        // --- Video Setup ---
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
          throw new Error("Camera access (getUserMedia) not supported.");
        }
        console.log("[INIT_EFFECT] Requesting camera stream...");
        setDebugMessage("Requesting camera access...");
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { width: 640, height: 480 }
        });

        if (isCleanup) {
          stream.getTracks().forEach(track => track.stop());
          console.log("[INIT_EFFECT] Cleanup started during camera init, stopping stream.");
          return;
        }
        videoRef.current.srcObject = stream;
        setDebugMessage("Waiting for video metadata...");
        console.log("[INIT_EFFECT] Video stream obtained, waiting for metadata...");
        await new Promise((resolve, reject) => {
          videoRef.current.onloadedmetadata = () => {
            console.log(`[INIT_EFFECT] Video metadata loaded: ${videoRef.current.videoWidth}x${videoRef.current.videoHeight}`);
            setDebugMessage("Video ready. Initializing WebGPU...");
            resolve();
          };
          videoRef.current.onerror = (e) => {
            console.error("[INIT_EFFECT] Video loading error:", e);
            reject(new Error("Failed to load video stream."));
          }
        });
        await videoRef.current.play();
        console.log("[INIT_EFFECT] Video playback started.");

        // --- WebGPU Setup ---
        if (!navigator.gpu) throw new Error("WebGPU is not supported.");
        const { device, context, format } = await initWebGPU(canvasRef.current);
        // Store critical WebGPU objects in renderState (a ref)
        renderState.device = device;
        renderState.context = context;
        console.log("[INIT_EFFECT] WebGPU device and context obtained.");
        setDebugMessage("WebGPU initialized. Creating pipelines...");

        device.lost.then((info) => {
          console.error(`[INIT_EFFECT] WebGPU device lost: ${info.message}`);
          setError(`WebGPU device lost: ${info.message}. Please refresh.`);
          setDebugMessage("Error: Device Lost.");
          if (renderState.renderRequestId) cancelAnimationFrame(renderState.renderRequestId);
          renderState.device = null; // Nullify device on loss
        });

        const { videoPipeline, lipstickPipeline, videoBindGroupLayout } = await createPipelines(device, format);
        renderState.videoPipeline = videoPipeline;
        renderState.lipstickPipeline = lipstickPipeline;
        renderState.videoBindGroupLayout = videoBindGroupLayout;
        console.log("[INIT_EFFECT] WebGPU Pipelines created.");

        renderState.videoSampler = device.createSampler({
          label: 'Video Sampler', magFilter: 'linear', minFilter: 'linear',
          addressModeU: 'clamp-to-edge', addressModeV: 'clamp-to-edge',
        });
        console.log("[INIT_EFFECT] WebGPU Sampler created.");

        renderState.vertexBufferSize = 2048;
        renderState.vertexBuffer = device.createBuffer({
          label: 'Lip Vertices Buffer', size: renderState.vertexBufferSize,
          usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
        });
        console.log("[INIT_EFFECT] WebGPU Vertex Buffer created.");
        setDebugMessage("GPU and Video Initialized. Waiting for Landmarker to start rendering.");
        console.log("[INIT_EFFECT] Initialization complete for GPU and Video.");
        // Note: Render loop is NOT started here. It's handled by another useEffect.

      } catch (err) {
        console.error("[INIT_EFFECT] Initialization failed:", err);
        setError(`Setup failed: ${err.message}`);
        setDebugMessage("Error.");
      }
    };

    initGPUAndVideo();

    return () => { // Cleanup for this effect
      console.log("[INIT_EFFECT_CLEANUP] Cleaning up GPU/Video resources...");
      isCleanup = true;
      const stream = videoRef.current?.srcObject;
      if (stream && typeof stream.getTracks === 'function') {
        stream.getTracks().forEach(track => track.stop());
      }
      if (videoRef.current) videoRef.current.srcObject = null;
      renderState.vertexBuffer?.destroy();
      // renderState.device is not destroyed here, its 'lost' promise handles its invalidation.
      // We nullify renderState properties that would cause issues if reused.
      renderState.device = null; // Crucial to stop render loop if it was running
      renderState.context = null;
      // Other renderState items will be overwritten or ignored if init runs again
      console.log("[INIT_EFFECT_CLEANUP] GPU/Video cleanup finished.");
    };
  }, []); // Empty dependency array: runs once on mount

  // Effect 3: Manage the Render Loop (starts/stops based on dependencies)
  useEffect(() => {
    // Check if all conditions are met to start rendering
    if (landmarker && renderState.device && renderState.context &&
        renderState.videoPipeline && renderState.lipstickPipeline &&
        renderState.videoBindGroupLayout && renderState.videoSampler && renderState.vertexBuffer) {

      console.log("[RENDER_LOOP_EFFECT] All conditions met. Starting render loop.");
      setDebugMessage("Starting render loop...");

      // `render` function is defined inside this effect, so it has fresh closures
      // over `landmarker` (from state) and `renderState` items.
      const render = async () => {
        frameCounter.current++;
        // console.log(`[RENDER ${frameCounter.current}] Loop start.`);

        if (!renderState.device) { // Primary check: if device is lost, stop.
          console.warn(`[RENDER ${frameCounter.current}] Exiting: Device is null/lost.`);
          setDebugMessage("Render Error: Device lost.");
          setError("WebGPU Device lost. Please refresh.");
          renderState.renderRequestId = null; // Clear the ID
          return;
        }

        if (!videoRef.current || videoRef.current.readyState < videoRef.current.HAVE_ENOUGH_DATA) {
          // console.log(`[RENDER ${frameCounter.current}] Waiting for video ready state (current: ${videoRef.current?.readyState}).`);
          renderState.renderRequestId = requestAnimationFrame(render); // Try next frame
          return;
        }
        // console.log(`[RENDER ${frameCounter.current}] Video ready. Landmarker is available.`);

        const videoFrame = videoRef.current;
        let numLipVertices = 0;

        try {
          const now = performance.now();
          const results = landmarker.detectForVideo(videoFrame, now); // Use landmarker from state (fresh closure)

          if (results && results.faceLandmarks && results.faceLandmarks.length > 0) {
            const landmarks = results.faceLandmarks[0];
            const lips = lipTriangles.map(([idxA, idxB, idxC]) => [
              landmarks[idxA], landmarks[idxB], landmarks[idxC],
            ]);
            const vertices = new Float32Array(
              lips.flat().map(pt => [(0.5 - pt.x) * 2, (0.5 - pt.y) * 2]).flat()
            );
            numLipVertices = vertices.length / 2;
            if (vertices.byteLength > 0) {
              if (vertices.byteLength <= renderState.vertexBufferSize) {
                renderState.device.queue.writeBuffer(renderState.vertexBuffer, 0, vertices);
              } else {
                console.warn(`[RENDER ${frameCounter.current}] Vertex data too large. Lips skipped.`);
                numLipVertices = 0;
              }
            } else { numLipVertices = 0; }
          } else { numLipVertices = 0; }
        } catch (err) {
          console.error(`[RENDER ${frameCounter.current}] Error in landmark/vertex processing:`, err);
          numLipVertices = 0;
        }

        let videoTextureGPU;
        try {
          videoTextureGPU = renderState.device.importExternalTexture({ source: videoFrame });
        } catch (err) {
          console.error(`[RENDER ${frameCounter.current}] Failed to import external texture:`, err);
          renderState.renderRequestId = requestAnimationFrame(render); // Try next frame
          return;
        }

        let frameBindGroup;
        try {
            frameBindGroup = renderState.device.createBindGroup({
            label: 'Video Frame Bind Group', layout: renderState.videoBindGroupLayout,
            entries: [
              { binding: 0, resource: renderState.videoSampler }, { binding: 1, resource: videoTextureGPU },
            ],
          });
        } catch (err) {
            console.error(`[RENDER ${frameCounter.current}] Failed to create video bind group:`, err);
            renderState.renderRequestId = requestAnimationFrame(render);
            return;
        }
        
        const commandEncoder = renderState.device.createCommandEncoder({ label: `F${frameCounter.current}` });
        const canvasTextureView = renderState.context.getCurrentTexture().createView();
        const passEncoder = commandEncoder.beginRenderPass({
          label: `RP_F${frameCounter.current}`,
          colorAttachments: [{
            view: canvasTextureView, loadOp: 'clear', storeOp: 'store',
            clearValue: { r: 0.1, g: 0.1, b: 0.15, a: 1.0 }, // Dark grey
          }],
        });

        // Draw video background (still uses debug blue shader for now)
        passEncoder.setPipeline(renderState.videoPipeline);
        passEncoder.setBindGroup(0, frameBindGroup);
        passEncoder.draw(6, 1, 0, 0);

        // Draw lipstick overlay
        if (numLipVertices > 0) {
          passEncoder.setPipeline(renderState.lipstickPipeline);
          passEncoder.setVertexBuffer(0, renderState.vertexBuffer);
          passEncoder.draw(numLipVertices, 1, 0, 0);
        }
        passEncoder.end();
        renderState.device.queue.submit([commandEncoder.finish()]);
        if (frameCounter.current === 1) { // Log after first successful render
            console.log(`[RENDER ${frameCounter.current}] First frame rendered successfully. Expecting dark grey bg (or blue if debug shader active) + lips.`);
            setDebugMessage("Live Tracking Active!");
        }

        // Schedule next frame IF device still exists
        if (renderState.device) {
          renderState.renderRequestId = requestAnimationFrame(render);
        } else {
          console.log(`[RENDER ${frameCounter.current}] Device became null during render. Stopping loop.`);
          renderState.renderRequestId = null;
        }
      };

      // Start the render loop
      console.log("[RENDER_LOOP_EFFECT] Requesting first animation frame for the new loop.");
      frameCounter.current = 0; // Reset frame counter for new loop session
      renderState.renderRequestId = requestAnimationFrame(render);

      // Cleanup function for THIS useEffect instance
      return () => {
        console.log("[RENDER_LOOP_EFFECT_CLEANUP] Dependencies changed or component unmounting. Stopping render loop.");
        if (renderState.renderRequestId) {
          cancelAnimationFrame(renderState.renderRequestId);
          renderState.renderRequestId = null;
        }
        setDebugMessage("Render loop stopped.");
      };
    } else {
      // Conditions not met, ensure any old loop is stopped.
      console.log("[RENDER_LOOP_EFFECT] Conditions NOT MET for starting render loop:", {
        landmarkerReady: !!landmarker, deviceReady: !!renderState.device, contextReady: !!renderState.context,
        videoPipeReady: !!renderState.videoPipeline /* add other checks if verbose */
      });
      if (renderState.renderRequestId) {
        console.log("[RENDER_LOOP_EFFECT] Conditions unmet, ensuring previous loop is stopped.");
        cancelAnimationFrame(renderState.renderRequestId);
        renderState.renderRequestId = null;
      }
       // setDebugMessage("Waiting for resources..."); // Or more specific message
    }
    // Dependencies for starting/stopping the render loop itself
  }, [landmarker, renderState.device, renderState.context, renderState.videoPipeline, renderState.lipstickPipeline, renderState.videoBindGroupLayout, renderState.videoSampler, renderState.vertexBuffer]);


  return (
    <div style={{ width: '640px', height: '480px', margin: 'auto', border: '1px solid #ccc', position: 'relative', overflow: 'hidden' }}>
      <div style={{ position: 'absolute', top: '5px', left: '5px', background: 'rgba(0,0,0,0.7)', color: 'white', padding: '2px 5px', fontSize: '12px', zIndex: 10, pointerEvents: 'none' }}>
        {error ? `Error: ${error}` : debugMessage} (Frame: {frameCounter.current})
      </div>
      <video ref={videoRef} style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', objectFit: 'cover', opacity: 0, pointerEvents: 'none', zIndex: 1 }}
        width={640} height={480} autoPlay playsInline muted />
      <canvas ref={canvasRef} width={640} height={480} style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', zIndex: 2 }} />
    </div>
  );
}