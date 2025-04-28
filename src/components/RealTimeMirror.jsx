// src/components/RealTimeMirror.jsx - ADDED results logging

import React, { useRef, useEffect, useState, useCallback, forwardRef } from 'react';
import TryOnRenderer from './TryOnRenderer'; // Expects the version with detailed mask logging

const RealTimeMirror = forwardRef(({
  faceLandmarker,
  effectIntensity
}, ref) => {
  // console.log("RealTimeMirror rendering..."); // Reduce noise
  const videoRef = useRef(null);
  const animationFrameRef = useRef({ count: 0 }); // Initialize ref object immediately
  const [videoStream, setVideoStream] = useState(null);
  const [isCameraLoading, setIsCameraLoading] = useState(true);
  const [cameraError, setCameraError] = useState(null);
  const [videoDimensions, setVideoDimensions] = useState({ width: 640, height: 480 });
  const [latestResults, setLatestResults] = useState(null);

  // Camera Access Effect
  useEffect(() => {
    let isMounted = true; let stream = null;
    const enableStream = async () => { if (!faceLandmarker || !navigator.mediaDevices?.getUserMedia) { if (isMounted) { setCameraError("getUserMedia not supported or FaceLandmarker not ready."); setIsCameraLoading(false); } return; } setIsCameraLoading(true); setCameraError(null); setVideoStream(null); /*console.log("Mirror Mode: enableStream - Requesting stream...");*/ try { stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 720 } }, audio: false }); /*console.log("Mirror Mode: enableStream - Stream acquired.");*/ if (isMounted && videoRef.current) { videoRef.current.srcObject = stream; setVideoStream(stream); videoRef.current.onloadedmetadata = () => { /*console.log("Mirror Mode: enableStream - Metadata loaded.");*/ if (isMounted && videoRef.current) { console.log(`Mirror video dims: ${videoRef.current.videoWidth}x${videoRef.current.videoHeight}`); setVideoDimensions({ width: videoRef.current.videoWidth, height: videoRef.current.videoHeight }); setIsCameraLoading(false); console.log("RealTimeMirror: Starting prediction loop from onloadedmetadata."); cancelAnimationFrame(animationFrameRef.current?.rafId); animationFrameRef.current.rafId = requestAnimationFrame(predictWebcam); } }; videoRef.current.onerror = (e) => { console.error("Mirror Mode: Video Element Error:", e); if(isMounted) setCameraError("Video element encountered an error."); setIsCameraLoading(false); } } else { /*console.log("Mirror Mode: enableStream - Component unmounted...");*/ stream?.getTracks().forEach(track => track.stop()); } } catch (err) { console.error("Mirror Mode: enableStream - Camera Error:", err); if (isMounted) { let message = "Failed to access camera."; /* ... error messages ... */ setCameraError(message); setIsCameraLoading(false); } } };
    enableStream();
    // Cleanup function
    return () => { isMounted = false; /*console.log("Cleaning up RealTimeMirror...");*/ cancelAnimationFrame(animationFrameRef.current?.rafId); const currentStream = videoStream || stream; /*console.log("Stopping tracks for stream:", currentStream ? 'Exists' : 'None');*/ currentStream?.getTracks().forEach(track => { /*console.log(`Stopping track: ${track.label}`);*/ track.stop(); }); if (videoRef.current) { /*console.log("Resetting video srcObject.");*/ videoRef.current.srcObject = null; videoRef.current.onloadedmetadata = null; videoRef.current.onerror = null; } setVideoStream(null); setLatestResults(null); /*console.log("RealTimeMirror cleanup complete.");*/ };
  }, [faceLandmarker]); // Dependency only on faceLandmarker instance itself


  // Prediction Loop Callback - ADDED LOGGING
  const predictWebcam = useCallback(() => {
    // Update frame count stored in ref
    animationFrameRef.current.count = (animationFrameRef.current.count || 0) + 1;
    const frameCount = animationFrameRef.current.count;
    // Request next frame
    animationFrameRef.current.rafId = requestAnimationFrame(predictWebcam);

    if (!faceLandmarker || !videoRef.current || videoRef.current.readyState < 2 ) { return; }
    const video = videoRef.current;
    let results = null;

    try {
      const startTime = performance.now();
      results = faceLandmarker.detectForVideo(video, startTime);

      // *** ADDED LOGGING HERE (Log periodically) ***
      if (results && frameCount % 100 === 1) { // Log approx every ~1.5 seconds (use modulo 1 for first frame)
          console.log("--- RealTimeMirror: detectForVideo results ---", results);
          // Specifically log the segmentationMasks part if it exists
          if (results.segmentationMasks) {
              console.log(" -> segmentationMasks:", results.segmentationMasks);
              if (results.segmentationMasks.length > 0 && results.segmentationMasks[0]) { // Check index 0 exists
                   const maskData = results.segmentationMasks[0]?.maskData;
                   console.log(" -> segmentationMasks[0].maskData type:", maskData?.constructor?.name);
                   // Check specifically for WebGLTexture using instanceof
                   console.log(" -> segmentationMasks[0].maskData instanceof WebGLTexture:", maskData instanceof WebGLTexture);
              } else {
                   console.log(" -> segmentationMasks: Array is empty.");
              }
          } else {
               console.log(" -> segmentationMasks: Not found in results.");
          }
      }
      // ***********************************

      setLatestResults(results); // Update state AFTER logging
    }
    catch (error) {
       console.error(`PredictWebcam: Error during faceLandmarker.detectForVideo:`, error);
       setLatestResults(null);
    }
  }, [faceLandmarker]); // Only depends on faceLandmarker instance


  // Effect to manage loop start/stop (using videoStream state)
  useEffect(() => {
       if (videoStream && faceLandmarker) {
           console.log("RealTimeMirror: Starting prediction loop (stream/landmarker ready).");
           cancelAnimationFrame(animationFrameRef.current?.rafId);
           animationFrameRef.current.count = 0; // Reset count
           animationFrameRef.current.rafId = requestAnimationFrame(predictWebcam);
       } else {
           // console.log("RealTimeMirror: Stopping prediction loop (stream/landmarker not ready).");
           cancelAnimationFrame(animationFrameRef.current?.rafId);
       }
       // Cleanup for this effect
       return () => {
           // console.log("RealTimeMirror: Cleaning up loop start/stop effect.");
           cancelAnimationFrame(animationFrameRef.current?.rafId);
       };
   }, [videoStream, faceLandmarker, predictWebcam]); // Include predictWebcam


  // Determine if TryOnRenderer should render
  const shouldRenderTryOn = !isCameraLoading && !cameraError && videoDimensions.width > 0;

  // --- JSX ---
  return (
    <div className="border p-4 rounded bg-blue-50 relative">
       <h2 className="text-xl font-semibold mb-2">Real-Time Mirror Mode</h2>
       {isCameraLoading && <p className="text-center py-4">Starting camera...</p>}
       {cameraError && <p className="text-red-500 text-center py-4">{cameraError}</p>}
      {/* Container for aspect ratio */}
      <div className="relative w-full max-w-md mx-auto" style={{ paddingTop: `${videoDimensions.width > 0 ? (videoDimensions.height / videoDimensions.width) * 100 : 75}%` }}>
        {/* Hidden video element */}
        <video ref={videoRef} autoPlay playsInline muted className="absolute top-0 left-0 w-0 h-0 -z-10" />

        {/* Conditional rendering of TryOnRenderer or fallback */}
        {shouldRenderTryOn ? (
          <TryOnRenderer
            videoRefProp={videoRef} // Pass the ref object
            imageElement={null}
            mediaPipeResults={latestResults} // Pass the results state
            isStatic={false}
            brightness={1.0} // Default B/C for mirror
            contrast={1.0}
            effectIntensity={effectIntensity} // Pass slider value
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