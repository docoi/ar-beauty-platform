// Inside LipstickMirrorLive.jsx
// Replace the ENTIRE initializeAll async function with this one:

const initializeAll = async () => {
  if (!navigator.gpu) { setError("WebGPU not supported."); return; }
  setDebugMessage("Initializing Systems...");
  try {
    // --- MediaPipe Landmarker ---
    console.log("[initializeAll] Initializing FaceLandmarker...");
    const vision = await FilesetResolver.forVisionTasks(
      'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm'
    );
    const lm = await FaceLandmarker.createFromOptions(vision, {
      baseOptions: {
        modelAssetPath: '/models/face_landmarker.task', // Crucial path
        delegate: 'GPU',
      },
      outputFaceBlendshapes: false, // We don't need blendshapes for lipstick
      runningMode: 'VIDEO',         // Process video stream
      numFaces: 1,                  // Detect only one face
    });
    currentLandmarker = lm; // Assign to local variable if used within initializeAll's scope before render loop
    setLandmarker(lm);    // Update React state
    console.log("[initializeAll] FaceLandmarker ready.");

    // --- WebGPU Device & Format ---
    console.log("[initializeAll] Initializing WebGPU Device & Format...");
    const adapter = await navigator.gpu.requestAdapter();
    if (!adapter) { setError("No GPU adapter."); return; }
    device = await adapter.requestDevice(); deviceRef.current = device;
    console.log("[initializeAll] Device obtained.");
    device.lost.then((info) => { 
        console.error(`[DEVICE_LOST_HANDLER] WebGPU device lost: ${info.message}`); 
        setError(`Device lost.`); setDebugMessage("Error: Device Lost.");
        if (animationFrameIdRef.current) cancelAnimationFrame(animationFrameIdRef.current);
        deviceRef.current = null; contextRef.current = null; currentLandmarker = null; setLandmarker(null); // also clear landmarker
    });
    
    // Use canvasElement from top of useEffect scope (defined as canvasRef.current)
    context = canvasElement.getContext('webgpu'); contextRef.current = context;
    if (!context) { setError('No WebGPU context.'); return; }
    format = navigator.gpu.getPreferredCanvasFormat(); formatRef.current = format;
    console.log("[initializeAll] Context and Format obtained.");

    // --- Pipelines and GPU Resources ---
    console.log("[initializeAll] Creating pipelines and GPU resources...");
    const { videoPipeline, lipstickPipeline, videoBindGroupLayout, aspectRatioGroupLayout } = await createPipelines(device, format);
    pipelineStateRef.current = { 
        ...pipelineStateRef.current, 
        videoPipeline, 
        lipstickPipeline, 
        videoBindGroupLayout, 
        aspectRatioGroupLayout 
    };
    const uniformBufferSize = 4 * Float32Array.BYTES_PER_ELEMENT;
    pipelineStateRef.current.aspectRatioUniformBuffer = device.createBuffer({ size: uniformBufferSize, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST });
    if (aspectRatioGroupLayout && pipelineStateRef.current.aspectRatioUniformBuffer) {
        pipelineStateRef.current.aspectRatioBindGroup = device.createBindGroup({ layout: aspectRatioGroupLayout, entries: [{ binding: 0, resource: { buffer: pipelineStateRef.current.aspectRatioUniformBuffer }}]});
    } else {
         console.warn("[initializeAll] AspectRatioGroupLayout or UniformBuffer missing, cannot create bind group.");
    }
    pipelineStateRef.current.videoSampler = device.createSampler({ magFilter: 'linear', minFilter: 'linear' });
    pipelineStateRef.current.vertexBuffer = device.createBuffer({ size: pipelineStateRef.current.vertexBufferSize, usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST });
    console.log("[initializeAll] Pipelines and GPU resources created.");
    
    // --- Video Element Setup ---
    console.log("[initializeAll] Setting up video element...");
    if (!navigator.mediaDevices?.getUserMedia) throw new Error("Camera not supported for video.");
    const stream = await navigator.mediaDevices.getUserMedia({ video: { width: 640, height: 480 } });
    videoElement.srcObject = stream; // videoElement is videoRef.current from outer scope
    await new Promise((res, rej) => {
      videoElement.onloadedmetadata = () => { console.log(`[initializeAll] Video metadata: ${videoElement.videoWidth}x${videoElement.videoHeight}`); res(); };
      videoElement.onerror = () => rej(new Error("Video load error."));
    });
    await videoElement.play();
    console.log("[initializeAll] Video playback started.");
    
    // --- Setup ResizeObserver and Initial Canvas/Context Configuration ---
    resizeObserver = new ResizeObserver(resizeHandlerRef.current); // Uses the stored function
    resizeObserver.observe(canvasElement); // Observe canvasElement
    console.log("[initializeAll] ResizeObserver observing canvas.");
    
    console.log("[initializeAll] Calling initial configureCanvas.");
    if (resizeHandlerRef.current) { // Ensure it's defined
        resizeHandlerRef.current(); 
    } else {
        console.error("[initializeAll] resizeHandlerRef.current is not defined before initial call.");
    }
    
    // setIsGpuReady(true); // This state is not used anymore for allResourcesReady logic directly
    console.log("[initializeAll] All sub-initializations complete.");

    // --- Start Render Loop ---
    if (!renderLoopStarted) {
        console.log("[initializeAll] Starting render loop.");
        render(); // The render function is defined in the outer useEffect scope
        renderLoopStarted = true;
    }
    // setDebugMessage("Live Tracking Active!"); // This will be set by the separate useEffect for UI messages

  } catch (err) {
    console.error("[initializeAll] Major error during initialization:", err);
    setError(`Init failed: ${err.message}`); // Set error state
    setDebugMessage("Initialization Error."); // Update debug message
  }
}; // End of initializeAll