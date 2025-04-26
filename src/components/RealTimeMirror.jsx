// src/components/RealTimeMirror.jsx - REVISED - Pass Props to Renderer (From Msg #67)

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
  const animationFrameRef = useRef(null); // Using Ref for the animation frame handle
  const [videoStream, setVideoStream] = useState(null); // Keep state for stream
  const videoStreamRef = useRef(null); // Keep Ref for stream check in loop
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

   // Effect to keep ref in sync with state
  useEffect(() => {
    videoStreamRef.current = videoStream;
    console.log("VideoStream Ref updated:", videoStreamRef.current ? 'Stream Set' : 'Stream Cleared');
  }, [videoStream]);


  // Effect for camera access (mostly same, starts loop)
  useEffect(() => {
    let isMounted = true; let stream = null;
    const enableStream = async () => { if (!faceLandmarker || !navigator.mediaDevices?.getUserMedia) { if (isMounted) { setCameraError("getUserMedia not supported or FaceLandmarker not ready."); setIsCameraLoading(false); } return; } setIsCameraLoading(true); setCameraError(null); setVideoStream(null); console.log("Mirror Mode: enableStream - Requesting stream..."); try { stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 720 } }, audio: false }); console.log("Mirror Mode: enableStream - Stream acquired."); if (isMounted && videoRef.current) { videoRef.current.srcObject = stream; setVideoStream(stream); videoRef.current.onloadedmetadata = () => { console.log("Mirror Mode: enableStream - Metadata loaded."); if (isMounted && videoRef.current) { console.log(`Mirror video dims: ${videoRef.current.videoWidth}x${videoRef.current.videoHeight}`); setVideoDimensions({ width: videoRef.current.videoWidth, height: videoRef.current.videoHeight }); setIsCameraLoading(false); console.log("RealTimeMirror: Starting initial prediction loop from onloadedmetadata."); cancelAnimationFrame(animationFrameRef.current); animationFrameRef.current = requestAnimationFrame(predictWebcam); } }; videoRef.current.onerror = (e) => { console.error("Mirror Mode: Video Element Error:", e); if(isMounted) setCameraError("Video element encountered an error."); setIsCameraLoading(false); } } else { console.log("Mirror Mode: enableStream - Component unmounted or videoRef missing after stream aquisition. Stopping tracks."); stream?.getTracks().forEach(track => track.stop()); } } catch (err) { console.error("Mirror Mode: enableStream - Camera Error:", err); if (isMounted) { let message = "Failed to access camera."; /* ... error messages ... */ setCameraError(message); setIsCameraLoading(false); } } }; enableStream();
    // Cleanup function
    return () => { isMounted = false; console.log("Cleaning up RealTimeMirror (useEffect cleanup)..."); cancelAnimationFrame(animationFrameRef.current); /* USE REF */ const currentStream = videoStreamRef.current; console.log("Stopping tracks for stream:", currentStream ? 'Exists' : 'None'); currentStream?.getTracks().forEach(track => { console.log(`Stopping track: ${track.label} (${track.readyState})`); track.stop(); }); if (videoRef.current) { console.log("Resetting video srcObject."); videoRef.current.srcObject = null; videoRef.current.onloadedmetadata = null; videoRef.current.onerror = null; } setVideoStream(null); setLatestResults(null); /* Clear results */ console.log("RealTimeMirror cleanup complete."); };
  }, [faceLandmarker]); // predictWebcam correctly removed previously


  // Prediction Loop Callback (sets state)
  const predictWebcam = useCallback(() => { // No longer async needed here
    animationFrameRef.current = requestAnimationFrame(predictWebcam); // Schedule next

    // Check necessary refs/state *before* detection
    // Use videoStreamRef here as state might be stale in the callback closure
    if (!faceLandmarker || !videoRef.current || videoRef.current.readyState < 2 || !videoStreamRef.current ) {
        // console.log("PredictWebcam: Skipping frame - Refs/Stream not ready."); // Less noisy
        return; // Skip if not ready
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
       // Use videoStream STATE to determine if loop should run
       if (videoStream && faceLandmarker) {
            console.log("RealTimeMirror: Starting prediction loop (stream/landmarker ready).");
           cancelAnimationFrame(animationFrameRef.current);
           animationFrameRef.current = requestAnimationFrame(predictWebcam);
       } else {
           console.log("RealTimeMirror: Stopping prediction loop (stream/landmarker not ready).");
           cancelAnimationFrame(animationFrameRef.current);
       }
       return () => {
           console.log("RealTimeMirror: Cleaning up loop start/stop effect.");
           cancelAnimationFrame(animationFrameRef.current);
       };
   // Add predictWebcam back as dependency since it's called inside
   }, [videoStream, faceLandmarker, predictWebcam]);


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
        {/* Check videoStream STATE for rendering */}
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