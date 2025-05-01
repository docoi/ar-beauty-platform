// src/components/RealTimeMirror.jsx - Start Polling Immediately (FULL CODE)

import React, { useRef, useEffect, useState, useCallback, forwardRef } from 'react';
import TryOnRenderer from './TryOnRenderer'; // The simplified WebGL base renderer

// Define which landmarks form the outer face contour.
const FACE_OUTLINE_INDICES = [ 10, 338, 297, 332, 284, 251, 389, 356, 454, 323, 361, 288, 397, 365, 379, 378, 400, 377, 152, 148, 176, 149, 150, 136, 172, 58, 132, 93, 234, 127, 162, 21, 54, 103, 67, 109 ];

const RealTimeMirror = forwardRef(({
  faceLandmarker,
  imageSegmenter,
  effectIntensity
}, ref) => {
  const videoRef = useRef(null);
  const webglCanvasRef = useRef(null);
  const overlayCanvasRef = useRef(null);
  const animationFrameRef = useRef({ count: 0, rafId: null }); // For prediction loop
  const checkReadyRafRef = useRef(null);
  const [videoStream, setVideoStream] = useState(null);
  const [isCameraLoading, setIsCameraLoading] = useState(true);
  const [cameraError, setCameraError] = useState(null);
  const [videoDimensions, setVideoDimensions] = useState({ width: 0, height: 0 });
  // No results state needed here

  // --- Canvas Drawing Function ---
  const drawOverlay = useCallback((landmarks, segmentationMask) => {
    const overlayCanvas = overlayCanvasRef.current;
    const video = videoRef.current;
    if (!overlayCanvas || !video || !videoDimensions.width || !videoDimensions.height) return;

    const ctx = overlayCanvas.getContext('2d');
    if (!ctx) return;

    const canvasWidth = videoDimensions.width;
    const canvasHeight = videoDimensions.height;

    if (overlayCanvas.width !== canvasWidth || overlayCanvas.height !== canvasHeight) {
        overlayCanvas.width = canvasWidth;
        overlayCanvas.height = canvasHeight;
        // console.log(`Resized Overlay Canvas to ${canvasWidth}x${canvasHeight}`);
    }
    ctx.clearRect(0, 0, canvasWidth, canvasHeight);

    // --- Mirror the 2D canvas context horizontally ---
    ctx.save();
    ctx.scale(-1, 1);
    ctx.translate(-canvasWidth, 0);
    // ------------------------------------------------

    try {
        const facePoints = landmarks?.faceLandmarks?.[0];
        if (facePoints && facePoints.length > 0) {
            // 1. Create clipping path
            ctx.beginPath();
            FACE_OUTLINE_INDICES.forEach((index, i) => {
                if (index < facePoints.length) {
                    const point = facePoints[index];
                    const x = point.x * canvasWidth;
                    const y = point.y * canvasHeight;
                    if (i === 0) { ctx.moveTo(x, y); } else { ctx.lineTo(x, y); }
                }
            });
            ctx.closePath();
            ctx.save();
            ctx.clip(); // Clip subsequent drawings to this path

            // 2. Apply Hydration Effect (semi-transparent white overlay)
            if (effectIntensity > 0.01) {
                ctx.fillStyle = `rgba(255, 255, 255, ${0.15 * effectIntensity})`;
                ctx.fillRect(0, 0, canvasWidth, canvasHeight); // Fill clipped area
            }
            ctx.restore(); // Remove clipping mask
        }
        // Note: Silhouette mask drawing is omitted for simplicity/performance initially

    } catch (error) {
        console.error("Error during overlay drawing:", error);
    } finally {
         // --- Restore the transformation ---
         ctx.restore();
    }
  }, [effectIntensity, videoDimensions]);


  // --- Camera Access Effect (Start polling immediately) ---
  useEffect(() => {
    let isMounted = true;
    let stream = null;
    let checkReadyFrameId = null;
    console.log("RealTimeMirror: Camera useEffect - Mounting/Running (Immediate Polling).");

    // Polling function
    const checkVideoReady = () => {
        if (!isMounted || !videoRef.current) return;
        const video = videoRef.current;
        const readyState = video.readyState;
        const width = video.videoWidth;
        const height = video.videoHeight;
        const hasDimensions = width > 0 && height > 0;
        const isReady = readyState >= 2 && hasDimensions;

        if (isReady) {
            console.log(`<<<< RealTimeMirror: Video Ready via Polling! State=${readyState}, Dims=${width}x${height} >>>>`);
            setVideoDimensions({ width, height });
            setIsCameraLoading(false);
            setCameraError(null);
            cancelAnimationFrame(checkReadyRafRef.current); checkReadyRafRef.current = null;
        } else {
            if (isMounted) { checkReadyFrameId = requestAnimationFrame(checkVideoReady); checkReadyRafRef.current = checkReadyFrameId; }
        }
    };

    const enableStream = async () => {
        console.log("RealTimeMirror: enableStream called.");
        if (!faceLandmarker) { if (isMounted) { setCameraError("AI models initializing..."); setIsCameraLoading(false); } return; }
        if (!navigator.mediaDevices?.getUserMedia) { if (isMounted) { setCameraError("getUserMedia not supported."); setIsCameraLoading(false); } return; }
        console.log("RealTimeMirror: Setting camera STARTING state...");
        setIsCameraLoading(true); setCameraError(null); setVideoStream(null); setVideoDimensions({ width: 0, height: 0 });
        cancelAnimationFrame(checkReadyRafRef.current); // Cancel previous polling
        try {
            console.log("RealTimeMirror: Calling getUserMedia...");
            stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 720 } }, audio: false });
            console.log("RealTimeMirror: getUserMedia SUCCESS.");
            if (isMounted && videoRef.current) {
                console.log("RealTimeMirror: Assigning stream to video element.");
                videoRef.current.srcObject = stream; setVideoStream(stream);
                videoRef.current.onloadedmetadata = null; videoRef.current.onloadeddata = null; videoRef.current.oncanplay = null; videoRef.current.onplaying = null;
                videoRef.current.onerror = (e) => { if(isMounted) { console.error("Video Error:", e); setCameraError("Video element error."); setIsCameraLoading(false); cancelAnimationFrame(checkReadyRafRef.current); } };
                console.log("RealTimeMirror: Starting readiness polling..."); // Start polling
                checkReadyFrameId = requestAnimationFrame(checkVideoReady); checkReadyRafRef.current = checkReadyFrameId;
                console.log("RealTimeMirror: Attempting videoRef.current.play()..."); // Still try to play
                 videoRef.current.play().catch(err => { console.warn("RealTimeMirror: video.play() failed:", err); });
            } else { stream?.getTracks().forEach(track => track.stop()); }
        } catch (err) { console.error("RealTimeMirror: enableStream Error:", err); if (isMounted) { setCameraError("Failed to access camera."); setIsCameraLoading(false); } }
    };
    enableStream();

    // Cleanup
    return () => {
        isMounted = false; console.log("RealTimeMirror: Camera useEffect - Cleaning up.");
        cancelAnimationFrame(checkReadyRafRef.current); cancelAnimationFrame(animationFrameRef.current?.rafId);
        const currentStream = videoStream || stream; currentStream?.getTracks().forEach(track => track.stop());
        if (videoRef.current) { videoRef.current.onerror = null; videoRef.current.srcObject = null; }
        setVideoStream(null); setIsCameraLoading(true); setCameraError(null); setVideoDimensions({ width: 0, height: 0 });
    };
   }, [faceLandmarker]);


  // --- Prediction & Drawing Loop ---
  const predictionDrawLoop = useCallback(() => {
    animationFrameRef.current.rafId = requestAnimationFrame(predictionDrawLoop);
    animationFrameRef.current.count++;
    if (isCameraLoading || cameraError || !videoRef.current || !faceLandmarker || !imageSegmenter) { return; }
    const video = videoRef.current; const startTime = performance.now();
    try {
      const landmarkResults = faceLandmarker.detectForVideo(video, startTime);
      const segmentationResults = imageSegmenter.segmentForVideo(video, startTime); // Still get segmentation, even if not drawn yet
      // Call the draw function with the latest results
      drawOverlay(landmarkResults, segmentationResults);
    } catch (error) { console.error(`Prediction/Draw Error:`, error); /* ... error handling ... */ }
  }, [faceLandmarker, imageSegmenter, isCameraLoading, cameraError, drawOverlay]);


  // Effect to manage prediction/draw loop start/stop
  useEffect(() => {
       if (!isCameraLoading && !cameraError && videoStream && faceLandmarker && imageSegmenter) {
           console.log("RealTimeMirror: Starting Prediction & Draw Loop.");
           cancelAnimationFrame(animationFrameRef.current?.rafId);
           animationFrameRef.current.count = 0;
           animationFrameRef.current.rafId = requestAnimationFrame(predictionDrawLoop);
       } else { cancelAnimationFrame(animationFrameRef.current?.rafId); }
       return () => { cancelAnimationFrame(animationFrameRef.current?.rafId); };
   }, [videoStream, faceLandmarker, imageSegmenter, isCameraLoading, cameraError, predictionDrawLoop]);


  // Determine if base WebGL renderer should be shown
  const shouldRenderTryOnBase = !isCameraLoading && !cameraError; // Show base once camera is ready
  console.log("RealTimeMirror: Render() Check. isCameraLoading:", isCameraLoading, "cameraError:", cameraError, "shouldRenderTryOnBase:", shouldRenderTryOnBase);

  // --- JSX Return ---
  return (
    <div className="border p-4 rounded bg-blue-50 relative">
       <h2 className="text-xl font-semibold mb-2 text-center">Real-Time Mirror Mode</h2>
       {(isCameraLoading && !cameraError) && <p className="text-center py-4">Initializing Camera & AI...</p>}
       {cameraError && <p className="text-red-500 text-center py-4">{cameraError}</p>}

      {/* Container for Layered Canvases */}
      <div
          className="relative w-full max-w-md mx-auto bg-gray-700"
          style={{ aspectRatio: `${videoDimensions.width || 16}/${videoDimensions.height || 9}`, overflow: 'hidden' }}
      >
          {/* Hidden Video Element */}
          <video ref={videoRef} autoPlay playsInline muted className="absolute top-0 left-0 w-[1px] h-[1px] opacity-5" />

          {/* Base WebGL Canvas (Render when camera is ready) */}
          {shouldRenderTryOnBase && (
              <TryOnRenderer
                  ref={webglCanvasRef}
                  videoRefProp={videoRef}
                  imageElement={null}
                  isStatic={false}
                  className="absolute top-0 left-0 w-full h-full z-0" // Base layer
                  style={{ objectFit: 'cover' }}
              />
          )}

          {/* Overlay 2D Canvas (Always present, drawn into when ready) */}
           <canvas
              ref={overlayCanvasRef}
              className="absolute top-0 left-0 w-full h-full z-10 pointer-events-none"
              // Width/Height set dynamically in drawOverlay
              style={{ objectFit: 'cover' }}
           />

           {/* Fallback UI (Only shown during initial camera loading/error) */}
           {isCameraLoading && !cameraError && (
               <div className="absolute inset-0 flex items-center justify-center bg-gray-200 z-20">
                  <p className="text-gray-500">Initializing...</p>
               </div>
           )}
      </div>
      {/* --- End Container --- */}

      {/* AI Model Status */}
      {/* Optional: Can show AI model status separately if desired */}
    </div>
  );
  // *******************

});
RealTimeMirror.displayName = 'RealTimeMirror';
export default RealTimeMirror;