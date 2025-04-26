// src/components/RealTimeMirror.jsx - REVISED - Pass Props to Renderer

import React, { useRef, useEffect, useState, useCallback, forwardRef, useImperativeHandle } from 'react';
import TryOnRenderer from './TryOnRenderer'; // Expects prop-driven version

const RealTimeMirror = forwardRef(({
  faceLandmarker,
  effectIntensity
}, ref) => { // Still use forwardRef in case parent needs other controls
  console.log("RealTimeMirror rendering...");
  const videoRef = useRef(null);
  // No longer need rendererRef for calling methods
  // const rendererRef = useRef(null);
  const animationFrameRef = useRef(null);
  const [videoStream, setVideoStream] = useState(null);
  const [isCameraLoading, setIsCameraLoading] = useState(true);
  const [cameraError, setCameraError] = useState(null);
  const [videoDimensions, setVideoDimensions] = useState({ width: 640, height: 480 });
  // State to hold latest results
  const [latestResults, setLatestResults] = useState(null);

  // Expose only intensity update if needed by parent
  useImperativeHandle(ref, () => ({
      // updateEffectIntensity: (intensity) => {
      //     // Parent now passes intensity directly as prop
      // }
  }));

  // Effect for camera access (mostly same, starts loop)
  useEffect(() => {
    let isMounted = true; let stream = null;
    const enableStream = async () => { /* ... same checks ... */ setIsCameraLoading(true); setCameraError(null); setVideoStream(null); console.log("Mirror Mode: enableStream - Requesting stream..."); try { stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 720 } }, audio: false }); console.log("Mirror Mode: enableStream - Stream acquired."); if (isMounted && videoRef.current) { videoRef.current.srcObject = stream; setVideoStream(stream); videoRef.current.onloadedmetadata = () => { console.log("Mirror Mode: enableStream - Metadata loaded."); if (isMounted && videoRef.current) { console.log(`Mirror video dims: ${videoRef.current.videoWidth}x${videoRef.current.videoHeight}`); setVideoDimensions({ width: videoRef.current.videoWidth, height: videoRef.current.videoHeight }); setIsCameraLoading(false); console.log("RealTimeMirror: Starting initial prediction loop from onloadedmetadata."); cancelAnimationFrame(animationFrameHandle.current); animationFrameHandle.current = requestAnimationFrame(predictWebcam); } }; /* ... error handler ... */ } else { /* ... stop tracks ... */ } } catch (err) { /* ... error handling ... */ } }; enableStream();
    return () => { isMounted = false; console.log("Cleaning up RealTimeMirror (useEffect cleanup)..."); cancelAnimationFrame(animationFrameHandle.current); /* ... stop tracks ... */; if (videoRef.current) { /* ... reset srcObject ... */ } setVideoStream(null); setLatestResults(null); /* << Clear results */ console.log("RealTimeMirror cleanup complete."); };
  }, [faceLandmarker]); // Removed predictWebcam dep


  // Prediction Loop Callback (sets state)
  const predictWebcam = useCallback(() => { // No longer async needed here
    animationFrameRef.current = requestAnimationFrame(predictWebcam); // Schedule next

    // Simplified check: just need video element and landmarker
    if (!faceLandmarker || !videoRef.current || videoRef.current.readyState < 2 ) {
        return;
    }

    // If ready, proceed with detection
    const video = videoRef.current;
    try {
        const results = faceLandmarker.detectForVideo(video, performance.now());
        setLatestResults(results); // Update state with latest results
    } catch (error) {
        console.error(`PredictWebcam: Error during faceLandmarker.detectForVideo:`, error);
        setLatestResults(null); // Clear results on error?
    }
  }, [faceLandmarker]); // Only depends on landmarker


  // Effect to manage loop start/stop (simpler)
  useEffect(() => {
       if (videoStream && faceLandmarker) { // Start loop only when stream and landmarker ready
            console.log("RealTimeMirror: Starting prediction loop (stream/landmarker ready).");
           cancelAnimationFrame(animationFrameHandle.current);
           animationFrameHandle.current = requestAnimationFrame(predictWebcam);
       } else {
            console.log("RealTimeMirror: Stopping prediction loop (stream/landmarker not ready).");
           cancelAnimationFrame(animationFrameHandle.current);
       }
       return () => {
           console.log("RealTimeMirror: Cleaning up loop start/stop effect.");
           cancelAnimationFrame(animationFrameHandle.current);
       };
   }, [videoStream, faceLandmarker, predictWebcam]); // Depend on stream, landmarker, and callback


  // --- JSX ---
  return (
    <div className="border p-4 rounded bg-blue-50 relative">
       <h2 className="text-xl font-semibold mb-2">Real-Time Mirror Mode</h2>
       {isCameraLoading && <p className="text-center py-4">Starting camera...</p>}
       {cameraError && <p className="text-red-500 text-center py-4">{cameraError}</p>}
      <div className="relative w-full max-w-md mx-auto" style={{ paddingTop: `${videoDimensions.width > 0 ? (videoDimensions.height / videoDimensions.width) * 100 : 75}%` }}>
        {/* Hidden video element still needed for detection */}
        <video ref={videoRef} autoPlay playsInline muted className="absolute top-0 left-0 w-0 h-0 -z-10" />

        {/* Conditionally render TryOnRenderer and pass props */}
        {videoStream && !isCameraLoading && !cameraError && videoDimensions.width > 0 ? (
          <TryOnRenderer
            // No ref needed here anymore unless parent needs other controls
            videoElement={videoRef.current} // Pass video element
            imageElement={null}            // No image in mirror mode
            mediaPipeResults={latestResults} // Pass latest results state
            isStatic={false}               // Indicate it's video
            brightness={1.0}               // Not used by shader when isStatic=false
            contrast={1.0}                 // Not used by shader when isStatic=false
            effectIntensity={effectIntensity} // Pass intensity
            className="absolute top-0 left-0 w-full h-full rounded shadow overflow-hidden"
          />
        ) : (
           <div className="absolute inset-0 flex items-center justify-center bg-gray-200 rounded shadow">
              <p className="text-gray-500">{cameraError ? 'Camera Error' : (isCameraLoading ? 'Loading Camera...' : 'Initializing...')}</p>
           </div>
        )}
      </div>
      {!faceLandmarker && <p className="text-red-500 mt-2 text-center">Waiting for AI Model...</p>}
    </div>
  );
});
RealTimeMirror.displayName = 'RealTimeMirror';
export default RealTimeMirror;