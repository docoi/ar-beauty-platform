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
  
    const pipelineStateRef = useRef({ 
      videoPipeline: null, lipstickPipeline: null, videoBindGroupLayout: null,
      aspectRatioGroupLayout: null, aspectRatioUniformBuffer: null, aspectRatioBindGroup: null,
      videoSampler: null, vertexBuffer: null, vertexBufferSize: 2048,
    });
  
    const [landmarkerState, setLandmarkerState] = useState(null); 
    const [error, setError] = useState(null);
    const [debugMessage, setDebugMessage] = useState('Initializing...');
    
    useEffect(() => {
      console.log("[LML_Clone S2_VidErrorDebug] useEffect running.");
      let deviceInternal = null; let contextInternal = null; let formatInternal = null;
      let resizeObserverInternal = null; let renderLoopStartedInternal = false;
      
      const canvasElement = canvasRef.current; 
      const videoElement = videoRef.current; 
  
      if (!canvasElement || !videoElement) {
        console.error("[LML_Clone S2_VidErrorDebug] Canvas or Video element not available.");
        setError("Canvas or Video element not found.");
        return;
      }
  
      const configureCanvas = (entries) => { /* ... same as before ... */ 
          if (!deviceInternal || !contextInternal || !formatInternal || !canvasRef.current) { return; }
          const currentCanvas = canvasRef.current;
          if (entries) { /* RO call */ } else { /* direct call */ }
          const dpr = window.devicePixelRatio || 1;
          const cw = currentCanvas.clientWidth; const ch = currentCanvas.clientHeight;
          if (cw === 0 || ch === 0) { return; }
          const tw = Math.floor(cw * dpr); const th = Math.floor(ch * dpr);
          if (currentCanvas.width !== tw || currentCanvas.height !== th) { currentCanvas.width = tw; currentCanvas.height = th; }
          try { contextInternal.configure({ device: deviceInternal, format: formatInternal, alphaMode: 'opaque', size: [currentCanvas.width, currentCanvas.height] }); 
          } catch (e) { setError("Error config context."); }
          if (frameCounter.current < 2) console.log(`[LML_Clone S2_VidErrorDebug configureCanvas] Context CONFIG. Size:${currentCanvas.width}x${currentCanvas.height}`);
      };
      resizeHandlerRef.current = configureCanvas;
  
      const render = async () => { /* ... same as before, with lipstick drawing logic ... */ };
  
      const initializeAll = async () => {
        if (!navigator.gpu) { setError("WebGPU not supported."); return; }
        setDebugMessage("Initializing S2_VidErrorDebug...");
        try {
          console.log("[LML_Clone S2_VidErrorDebug initializeAll] Initializing FaceLandmarker...");
          const vision = await FilesetResolver.forVisionTasks('https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm');
          const lmInstance = await FaceLandmarker.createFromOptions(vision, { 
              baseOptions: { modelAssetPath: '/models/face_landmarker.task', delegate: 'GPU' },
              outputFaceBlendshapes: false, runningMode: 'VIDEO', numFaces: 1,
          });
          landmarkerRef.current = lmInstance; setLandmarkerState(lmInstance); 
          console.log("[LML_Clone S2_VidErrorDebug initializeAll] FaceLandmarker ready.");
  
          console.log("[LML_Clone S2_VidErrorDebug initializeAll] Initializing WebGPU Device & Format...");
          const adapter = await navigator.gpu.requestAdapter();
          if (!adapter) { setError("No GPU adapter."); return; }
          deviceInternal = await adapter.requestDevice(); deviceRef.current = deviceInternal;
          console.log("[LML_Clone S2_VidErrorDebug initializeAll] Device obtained.");
          deviceInternal.lost.then((info) => { /* ... */ });
          contextInternal = canvasElement.getContext('webgpu'); contextRef.current = contextInternal;
          if (!contextInternal) { setError('No WebGPU context.'); return; }
          formatInternal = navigator.gpu.getPreferredCanvasFormat(); formatRef.current = formatInternal;
          console.log("[LML_Clone S2_VidErrorDebug initializeAll] Context and Format obtained.");
  
          console.log("[LML_Clone S2_VidErrorDebug initializeAll] Creating pipelines and GPU resources...");
          const { videoPipeline, lipstickPipeline, videoBindGroupLayout, aspectRatioGroupLayout } = await createPipelines(deviceInternal, formatInternal);
          const currentVertexBufferSize = pipelineStateRef.current.vertexBufferSize || 2048;
          pipelineStateRef.current = { ...pipelineStateRef.current, videoPipeline, lipstickPipeline, videoBindGroupLayout, aspectRatioGroupLayout };
          const uniformBufferSize = 4 * Float32Array.BYTES_PER_ELEMENT;
          pipelineStateRef.current.aspectRatioUniformBuffer = deviceInternal.createBuffer({ size: uniformBufferSize, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST });
          if (aspectRatioGroupLayout && pipelineStateRef.current.aspectRatioUniformBuffer) { pipelineStateRef.current.aspectRatioBindGroup = deviceInternal.createBindGroup({ layout: aspectRatioGroupLayout, entries: [{ binding: 0, resource: { buffer: pipelineStateRef.current.aspectRatioUniformBuffer }}]}); }
          pipelineStateRef.current.videoSampler = deviceInternal.createSampler({ magFilter: 'linear', minFilter: 'linear' });
          pipelineStateRef.current.vertexBuffer = deviceInternal.createBuffer({ size: currentVertexBufferSize, usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST });
          console.log("[LML_Clone S2_VidErrorDebug initializeAll] All Pipelines and GPU resources created.");
          
          // --- Video Element Setup with its own try-catch ---
          console.log("[LML_Clone S2_VidErrorDebug initializeAll] Setting up video element...");
          try {
              if (!videoElement) throw new Error("videoRef.current (videoElement) is null at video setup point."); // Check local videoElement
              if (!navigator.mediaDevices?.getUserMedia) throw new Error("Camera API (getUserMedia) not supported.");
              
              console.log("[LML_Clone S2_VidErrorDebug initializeAll] Requesting media stream...");
              const stream = await navigator.mediaDevices.getUserMedia({ video: { width: 640, height: 480 } });
              console.log("[LML_Clone S2_VidErrorDebug initializeAll] Media stream obtained.");
              
              videoElement.srcObject = stream; // Use local videoElement
              console.log("[LML_Clone S2_VidErrorDebug initializeAll] srcObject assigned.");
              
              await new Promise((resolve, reject) => { 
                  videoElement.onloadedmetadata = () => { 
                      console.log(`[LML_Clone S2_VidErrorDebug initializeAll] Video metadata: ${videoElement.videoWidth}x${videoElement.videoHeight}`); 
                      resolve(); 
                  };
                  videoElement.onerror = (e) => {
                      console.error("[LML_Clone S2_VidErrorDebug initializeAll] videoElement.onerror triggered:", e);
                      reject(new Error("Video element error during metadata loading."));
                  };
              });
              console.log("[LML_Clone S2_VidErrorDebug initializeAll] onloadedmetadata resolved.");
              
              await videoElement.play(); 
              console.log("[LML_Clone S2_VidErrorDebug initializeAll] Video playback started.");
          } catch (videoError) {
              console.error("[LML_Clone S2_VidErrorDebug initializeAll] ERROR DURING VIDEO SETUP:", videoError);
              setError(`Video Setup Failed: ${String(videoError.message).substring(0, 50)}...`);
              throw videoError; // Re-throw to be caught by the main try-catch to halt further GPU init
          }
          // --- End Video Element Setup ---
          
          resizeObserverInternal = new ResizeObserver(resizeHandlerRef.current);
          resizeObserverInternal.observe(canvasElement);
          console.log("[LML_Clone S2_VidErrorDebug initializeAll] ResizeObserver observing canvas.");
          if(resizeHandlerRef.current) resizeHandlerRef.current(); 
          else console.error("[LML_Clone S2_VidErrorDebug initializeAll] resizeHandlerRef.current is null");
          
          console.log("[LML_Clone S2_VidErrorDebug initializeAll] All sub-initializations complete.");
          if (!renderLoopStartedInternal) { console.log("[LML_Clone S2_VidErrorDebug initializeAll] Starting render loop."); render(); renderLoopStartedInternal = true; }
        } catch (err) { 
            console.error("[LML_Clone S2_VidErrorDebug initializeAll] Main try-catch error:", err); 
            setError(`Init S2_VidErrorDebug failed: ${String(err.message).substring(0,50)}...`); 
            setDebugMessage(`Error: ${String(err.message).substring(0,30)}...`);
        }
      }; // End of initializeAll
  
      initializeAll();
      return () => { /* ... cleanup ... */ 
          console.log("[LML_Clone S2_VidErrorDebug MAIN_EFFECT_CLEANUP] Cleaning up.");
          if (animationFrameIdRef.current) cancelAnimationFrame(animationFrameIdRef.current);
          if (resizeObserverInternal && canvasRef.current) resizeObserverInternal.unobserve(canvasRef.current);
          if (resizeObserverInternal) resizeObserverInternal.disconnect();
          if (videoRef.current && videoRef.current.srcObject) { videoRef.current.srcObject.getTracks().forEach(track => track.stop()); }
          if (videoRef.current) videoRef.current.srcObject = null;
          const dvc = deviceRef.current; if (dvc) { pipelineStateRef.current.vertexBuffer?.destroy(); pipelineStateRef.current.aspectRatioUniformBuffer?.destroy(); }
          deviceRef.current = null; contextRef.current = null; formatRef.current = null; 
          landmarkerRef.current = null; setLandmarkerState(null);
      };
    }, []); // Main effect
  
    useEffect(() => { /* ... UI Message Effect ... */ 
        if(landmarkerState && deviceRef.current && contextRef.current && pipelineStateRef.current.lipstickPipeline && !error) { setDebugMessage("Live Lipstick Try-On (S2 VidErrorDebug)"); }
        else if (error) { setDebugMessage(`Error: ${String(error).substring(0,40)}...`); }
        else { setDebugMessage("Initializing Lipstick Try-On (S2 VidErrorDebug)..."); }
    }, [landmarkerState, deviceRef.current, contextRef.current, pipelineStateRef.current.lipstickPipeline, error]);
  
    return ( /* ... JSX (Full Viewport Parent) ... */ 
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, overflow: 'hidden', margin: 0, padding: 0, background: 'darkslateblue' }}>
        <div style={{position:'absolute',top:'5px',left:'5px',background:'rgba(0,0,0,0.7)',color:'white',padding:'2px 5px',fontSize:'12px',zIndex:10,pointerEvents:'none'}}>
          {debugMessage} (Frame: {frameCounter.current})
        </div>
        <video ref={videoRef} style={{ display: 'none' }} width={640} height={480} autoPlay playsInline muted />
        <canvas ref={canvasRef} width={640} height={480} style={{ width: '100%', height: '100%', display: 'block', background: 'lightpink' }} />
      </div>
    );
  }