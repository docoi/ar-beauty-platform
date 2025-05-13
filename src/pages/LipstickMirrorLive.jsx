// src/pages/LipstickMirrorLive.jsx

import React, { useEffect, useRef, useState, useCallback } from 'react';
import initWebGPU from '@/utils/initWebGPU';
// Updated import: createPipelines now returns multiple items
import createPipelines from '@/utils/createPipelines';
// Ensure this path is correct and the file exports the triangle indices
import lipTriangles from '@/utils/lipTriangles';
import { FaceLandmarker, FilesetResolver } from '@mediapipe/tasks-vision';

// --- Placeholder/Example for src/utils/lipTriangles.js ---
// Make sure this file exists and exports the correct data structure.
// If not, create `src/utils/lipTriangles.js` with content like this:
/*
// src/utils/lipTriangles.js

// Example using MediaPipe landmark indices for the *outer* contour of the lips
// See: https://developers.google.com/mediapipe/solutions/vision/face_landmarker#face_landmarks
const OUTER_LIP_LANDMARKS = [
   61, 185, 40, 39, 37, 0, 267, 269, 270, 409, 291, // Upper outer lip
   375, 321, 405, 314, 17, 84, 181, 91, 146 // Lower outer lip (closed loop with 61 and 291)
];

// Example simple triangulation (e.g., triangle fan from the first point)
// This is likely NOT topologically correct for lips and needs refinement.
// It only uses the first 11 points (upper lip example).
// A proper triangulation would involve all OUTER_LIP_LANDMARKS and potentially inner lip landmarks too.
const simpleTriangleIndices = [];
// Fan from point 0 (landmark 61) to the rest of the upper lip points
for (let i = 1; i < 11 - 1; i++) {
    simpleTriangleIndices.push([
        OUTER_LIP_LANDMARKS[0], // Anchor point (landmark 61)
        OUTER_LIP_LANDMARKS[i],
        OUTER_LIP_LANDMARKS[i + 1]
    ]);
}

// You MUST replace this example 'simpleTriangleIndices' with the actual, correct
// triangulation data provided by ChatGPT or derived from the landmark documentation
// for both upper and lower lips (and potentially inner lips).
// For now, using the placeholder:
const lipTrianglesData = simpleTriangleIndices;

export default lipTrianglesData;
*/
// --- End lipTriangles.js example ---


export default function LipstickMirrorLive() {
  const canvasRef = useRef(null);
  const videoRef = useRef(null);
  const [landmarker, setLandmarker] = useState(null);
  const [error, setError] = useState(null); // State to display errors
  const [debugMessage, setDebugMessage] = useState('Initializing...'); // State for status updates

  // useRef to store WebGPU state and other values needed across renders/callbacks
  const renderState = useRef({
    device: null,
    context: null,
    videoPipeline: null,
    lipstickPipeline: null,
    videoBindGroupLayout: null, // Store the layout
    videoBindGroup: null,       // Store the bind group
    videoSampler: null,
    vertexBuffer: null,
    vertexBufferSize: 0,        // Store current buffer size
    renderRequestId: null,
  }).current; // .current gives us the mutable object

  // --- Initialize Face Landmarker ---
  useEffect(() => {
    const initLandmarker = async () => {
      try {
        setDebugMessage("Initializing FaceLandmarker...");
        const vision = await FilesetResolver.forVisionTasks(
          'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm' // Use @latest or specific version
        );
        const faceLandmarker = await FaceLandmarker.createFromOptions(vision, {
          baseOptions: {
            // Ensure model is in public/models folder or adjust path
            modelAssetPath: '/models/face_landmarker.task',
            delegate: 'GPU', // Use GPU acceleration
          },
          outputFaceBlendshapes: false, // Not needed for this task
          outputFacialTransformationMatrixes: false, // Not needed
          runningMode: 'VIDEO', // Process video stream
          numFaces: 1, // Detect only one face
        });
        setLandmarker(faceLandmarker); // Store the landmarker instance in state
        setDebugMessage("FaceLandmarker ready.");
      } catch (err) {
        console.error("Error initializing FaceLandmarker:", err);
        setError(`FaceLandmarker init failed: ${err.message}. Ensure model file is accessible.`);
        setDebugMessage("Error.");
      }
    };
    initLandmarker();
  }, []); // Empty dependency array: run only once on component mount

  // --- Initialize WebGPU and Video ---
  useEffect(() => {
    // Check if canvas and video refs are valid
    if (!canvasRef.current || !videoRef.current) {
        console.log("Canvas or Video ref not ready yet.");
        return;
    }

    let isCleanup = false; // Flag to prevent setup if cleanup has started

    const init = async () => {
      try {
        setDebugMessage("Initializing Camera and WebGPU...");

        // --- Video Setup ---
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
            throw new Error("Camera access (getUserMedia) not supported by this browser.");
        }
        console.log("Requesting camera stream...");
        setDebugMessage("Requesting camera access...");
        const stream = await navigator.mediaDevices.getUserMedia({
            video: { width: 640, height: 480 } // Specify resolution
        });

        if (isCleanup) { // Check if cleanup started during async getUserMedia
             stream.getTracks().forEach(track => track.stop());
             return;
        }

        videoRef.current.srcObject = stream;
        setDebugMessage("Waiting for video metadata...");

        // Wait for video metadata to determine actual dimensions and readiness
        await new Promise((resolve, reject) => {
            videoRef.current.onloadedmetadata = () => {
                console.log("Video metadata loaded:", videoRef.current.videoWidth, videoRef.current.videoHeight);
                setDebugMessage("Video ready. Initializing WebGPU...");
                resolve();
            };
            videoRef.current.onerror = (e) => {
                 console.error("Video loading error:", e);
                 reject(new Error("Failed to load video stream."));
            }
        });

        // Play the video (muted is often required for autoplay)
        await videoRef.current.play();
        console.log("Video playback started.");


        // --- WebGPU Setup ---
        if (!navigator.gpu) {
            throw new Error("WebGPU is not supported by this browser.");
        }

        const { device, context, format } = await initWebGPU(canvasRef.current);
        renderState.device = device;
        renderState.context = context;
        console.log("WebGPU device and context obtained.");
        setDebugMessage("WebGPU initialized. Creating pipelines...");

        // Device loss handling
        device.lost.then((info) => {
            console.error(`WebGPU device lost: ${info.message}`);
            setError(`WebGPU device lost: ${info.message}. Please refresh.`);
            setDebugMessage("Error: Device Lost.");
            // Cleanup resources, stop render loop, etc.
            cancelAnimationFrame(renderState.renderRequestId);
            renderState.device = null; // Mark device as lost
            // Potentially try to re-initialize? For now, show error.
        });


        // Create pipelines and get bind group layout
        const { videoPipeline, lipstickPipeline, videoBindGroupLayout } = await createPipelines(device, format);
        renderState.videoPipeline = videoPipeline;
        renderState.lipstickPipeline = lipstickPipeline;
        renderState.videoBindGroupLayout = videoBindGroupLayout; // Store layout
        console.log("WebGPU Pipelines created.");
        setDebugMessage("Pipelines created. Setting up resources...");

        // --- Create Sampler for Video Texture ---
        renderState.videoSampler = device.createSampler({
            label: 'Video Sampler',
            magFilter: 'linear', // Linear interpolation for magnification
            minFilter: 'linear', // Linear interpolation for minification
            addressModeU: 'clamp-to-edge', // Clamp UV coords outside 0-1
            addressModeV: 'clamp-to-edge',
        });
        console.log("WebGPU Sampler created.");

        // --- Create Vertex Buffer for Lip Geometry ---
        // Initial size - might need resizing if lipTriangles is large, but 2KB should be plenty for lips
        renderState.vertexBufferSize = 2048;
        renderState.vertexBuffer = device.createBuffer({
            label: 'Lip Vertices Buffer',
            size: renderState.vertexBufferSize,
            // Usage: Vertex buffer data, destination for copy operations (writeBuffer)
            usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
        });
        console.log("WebGPU Vertex Buffer created.");

        setDebugMessage("Initialization complete. Starting render loop...");
        startRenderLoop(); // Start the render loop function

      } catch (err) {
        console.error("Initialization failed:", err);
        setError(`Setup failed: ${err.message}`);
        setDebugMessage("Error.");
      }
    };

    init();

    // --- Cleanup Function ---
    return () => {
        console.log("Cleaning up LipstickMirrorLive component...");
        isCleanup = true; // Signal that cleanup has started
        setDebugMessage("Closing...");

        // Cancel animation frame request
        if (renderState.renderRequestId) {
            cancelAnimationFrame(renderState.renderRequestId);
            renderState.renderRequestId = null;
            console.log("Render loop stopped.");
        }

        // Stop video stream tracks
        const stream = videoRef.current?.srcObject;
        if (stream && typeof stream.getTracks === 'function') {
            stream.getTracks().forEach(track => track.stop());
            console.log("Video stream tracks stopped.");
        }
        if (videoRef.current) {
            videoRef.current.srcObject = null; // Release the stream reference
        }


        // Destroy WebGPU resources (best effort)
        // Buffers, Textures, BindGroups should be destroyed. Pipelines/Layouts/Samplers might not have destroy().
        // The device itself is not destroyed here, only if lost.
         renderState.vertexBuffer?.destroy();
         //renderState.videoTexture?.destroy(); // Texture is imported dynamically
         // renderState.videoBindGroup? - Need to check if destroyable, usually managed by JS GC
         console.log("WebGPU resources released (buffers destroyed).");

         // Reset state refs
         renderState.device = null;
         renderState.context = null;
         renderState.videoPipeline = null;
         renderState.lipstickPipeline = null;
         renderState.vertexBuffer = null;
         // etc.

         console.log("Cleanup finished.");
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Run once on mount


  // --- Render Loop ---
  const startRenderLoop = useCallback(() => {
    const { device, context, videoPipeline, lipstickPipeline, videoBindGroupLayout, videoSampler, vertexBuffer } = renderState;

    // Check if essential WebGPU resources are available
    if (!device || !context || !videoPipeline || !lipstickPipeline || !videoSampler || !vertexBuffer || !videoBindGroupLayout) {
      console.error("Render loop cannot start: WebGPU resources not fully initialized.");
      setError("Render loop failed: WebGPU resources missing.");
      setDebugMessage("Error: Render Setup.");
      return;
    }

    const render = async () => {
      // Exit if device is lost or cleanup has begun
      if (!renderState.device || renderState.renderRequestId === null) {
          console.log("Render loop stopping (device lost or cleanup).");
          return;
      }

      // Ensure landmarker and video are ready
      if (!landmarker || !videoRef.current || videoRef.current.readyState < videoRef.current.HAVE_ENOUGH_DATA) {
         renderState.renderRequestId = requestAnimationFrame(render); // Try again next frame
         return;
      }

      const videoFrame = videoRef.current; // Source for the texture

      // --- Face Landmark Detection ---
      let numLipVertices = 0;
      let faceDetected = false;
      try {
          const now = performance.now();
          const results = landmarker.detectForVideo(videoFrame, now); // Get landmarks

          // --- Prepare Lip Vertex Data ---
          if (results && results.faceLandmarks && results.faceLandmarks.length > 0) {
            faceDetected = true;
            const landmarks = results.faceLandmarks[0]; // Get landmarks for the first detected face

            // Map landmark indices from lipTriangles to actual landmark coordinates
            const lips = lipTriangles.map(([idxA, idxB, idxC]) => [
              landmarks[idxA], // Get point A using index from lipTriangles
              landmarks[idxB], // Get point B
              landmarks[idxC], // Get point C
            ]);

            // Flatten the triangle points into a single Float32Array [x1, y1, x2, y2, ...]
            // Convert normalized MediaPipe coordinates [0, 1] to WebGPU Normalized Device Coordinates (NDC) [-1, 1]
            const vertices = new Float32Array(
              lips.flat().map(pt => [
                (pt.x - 0.5) * 2, // Map x from [0, 1] range to [-1, 1] range
                (0.5 - pt.y) * 2  // Map y from [0, 1] range to [ 1, -1] range (invert Y axis)
              ]).flat() // Flatten the array of [x, y] pairs
            );
            numLipVertices = vertices.length / 2; // Each vertex has 2 components (x, y)

            // --- Update Vertex Buffer ---
            if (vertices.byteLength > 0) {
                if (vertices.byteLength <= renderState.vertexBufferSize) {
                    // Copy the vertex data to the GPU buffer
                    device.queue.writeBuffer(
                        vertexBuffer, // Target buffer
                        0,            // Offset in the buffer (bytes)
                        vertices      // Source data (Float32Array)
                    );
                } else {
                    console.warn(`Vertex data (${vertices.byteLength} bytes) exceeds buffer size (${renderState.vertexBufferSize} bytes). Lip overlay skipped.`);
                    // Ideally, resize the buffer here if this can happen often
                    numLipVertices = 0; // Don't draw if data doesn't fit
                }
            } else {
                 numLipVertices = 0; // No vertices to draw
            }

          } else {
              // No face detected in this frame
              numLipVertices = 0;
          }
      } catch (err) {
          console.error("Error during landmark detection or vertex processing:", err);
          // Don't stop the whole loop, just skip drawing lips this frame
          numLipVertices = 0;
      }


       // --- Dynamic Video Texture Update ---
       // Import the current video frame as an external texture
       // This is a lightweight operation. The texture content is implicitly updated.
       let videoTextureGPU;
       try {
           videoTextureGPU = device.importExternalTexture({
             label: 'Imported Video Texture',
             source: videoFrame
           });
       } catch (err) {
           console.error("Failed to import external texture:", err);
           renderState.renderRequestId = requestAnimationFrame(render); // Try again
           return; // Skip rendering this frame if texture import fails
       }


      // --- Create/Update Bind Group for Video ---
      // Bind group needs the sampler and the *imported* video texture view
      renderState.videoBindGroup = device.createBindGroup({
        label: 'Video Frame Bind Group',
        layout: videoBindGroupLayout, // Use the pre-defined layout
        entries: [
          { binding: 0, resource: videoSampler }, // Sampler
          { binding: 1, resource: videoTextureGPU }, // Dynamically imported video texture
        ],
      });


      // --- Rendering Commands ---
      const commandEncoder = device.createCommandEncoder({ label: 'Main Command Encoder' });

      // Get the texture view from the canvas context to render into
      const canvasTextureView = context.getCurrentTexture().createView();

      // Start the render pass
      const passEncoder = commandEncoder.beginRenderPass({
        label: 'Main Render Pass',
        colorAttachments: [{
          view: canvasTextureView, // Render target
          loadOp: 'clear',         // Clear the canvas before drawing
          storeOp: 'store',       // Store the results after drawing
          clearValue: { r: 0.1, g: 0.1, b: 0.15, a: 1.0 }, // Clear to a dark color
        }],
      });

      // --- Draw Call 1: Video Background ---
      passEncoder.setPipeline(videoPipeline); // Set the video rendering pipeline
      passEncoder.setBindGroup(0, renderState.videoBindGroup); // Set the bind group with texture/sampler
      // Draw 6 vertices (2 triangles forming a full-screen quad), 1 instance
      passEncoder.draw(6, 1, 0, 0);

      // --- Draw Call 2: Lipstick Overlay (only if vertices exist) ---
      if (numLipVertices > 0) {
          passEncoder.setPipeline(lipstickPipeline); // Switch to the lipstick pipeline
          // Set the vertex buffer containing lip coordinates at slot 0
          passEncoder.setVertexBuffer(0, vertexBuffer);
          // Draw the lip triangles: 'numLipVertices' vertices, 1 instance
          passEncoder.draw(numLipVertices, 1, 0, 0);
      }

      // --- End Pass and Submit ---
      passEncoder.end(); // Finalize the render pass
      device.queue.submit([commandEncoder.finish()]); // Submit the command buffer to the GPU

      // Request the next frame
      if (renderState.device) { // Check again if device exists before requesting next frame
        renderState.renderRequestId = requestAnimationFrame(render);
      }
    };

    // Start the first frame render
     renderState.renderRequestId = requestAnimationFrame(render);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [landmarker]); // Re-run setup if landmarker changes (though it shouldn't after init)


  // --- JSX Rendering ---
  return (
    <div style={{ width: '640px', height: '480px', margin: 'auto', border: '1px solid #ccc', position: 'relative', overflow: 'hidden' }}>
      <div style={{ position: 'absolute', top: '5px', left: '5px', background: 'rgba(0,0,0,0.6)', color: 'white', padding: '2px 5px', fontSize: '12px', zIndex: 3 }}>
          {error ? `Error: ${error}` : debugMessage}
      </div>
      {/* Video element: Source for MediaPipe & WebGPU texture, visually hidden */}
      <video
        ref={videoRef}
        style={{
            position: 'absolute',
            top: 0, left: 0,
            width: '100%', height: '100%',
            objectFit: 'cover', // Cover the container, might crop
            //visibility: 'hidden', // Hide visually but keep layout space and functionality
            opacity: 0, // Alternative way to hide, might be slightly better perf
            pointerEvents: 'none', // Prevent interaction
            zIndex: 1 // Behind canvas
        }}
        width={640} // Intrinsic size hint
        height={480}
        autoPlay // Attempt to autoplay
        playsInline // Essential for iOS and inline playback
        muted // Usually required for autoplay without user gesture
      />
      {/* Canvas element: Where WebGPU renders */}
      <canvas
        ref={canvasRef}
        width={640} // Match video resolution
        height={480}
        style={{
            position: 'absolute',
            top: 0, left: 0,
            width: '100%', // Scale with container
            height: '100%',
            zIndex: 2 // In front of hidden video
        }}
      />
      {/* Future UI elements (e.g., color pickers) can go here */}
    </div>
  );
}