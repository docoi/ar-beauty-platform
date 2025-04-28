// src/components/RealTimeMirror.jsx - UNCONDITIONAL results logging for debug

import React, { useRef, useEffect, useState, useCallback, forwardRef } from 'react';
import TryOnRenderer from './TryOnRenderer'; // Expects the version with detailed mask logging

const RealTimeMirror = forwardRef(({
  faceLandmarker,
  effectIntensity
}, ref) => {
  const videoRef = useRef(null);
  const animationFrameRef = useRef({ count: 0, rafId: null }); // Ensure rafId is tracked
  const [videoStream, setVideoStream] = useState(null);
  const [isCameraLoading, setIsCameraLoading] = useState(true);
  const [cameraError, setCameraError] = useState(null);
  const [videoDimensions, setVideoDimensions] = useState({ width: 640, height: 480 });
  const [latestResults, setLatestResults] = useState(null);

  // Camera Access Effect (No changes needed)
  useEffect(() => {
    let isMounted = true; let stream = null;
    const enableStream = async () => { if (!isPreviewing || !faceLandmarker || !navigator.mediaDevices?.getUserMedia) { if (isMounted) setIsCameraLoading(false); return; } setIsCameraLoading(true); setCameraError(null); setDebugInfo(''); try { stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 720 } }, audio: false }); if (isMounted && selfieVideoRef.current) { selfieVideoRef.current.srcObject = stream; setCameraStream(stream); selfieVideoRef.current.onloadedmetadata = () => { if (isMounted && selfieVideoRef.current) { setSelfieDimensions({ width: selfieVideoRef.current.videoWidth, height: selfieVideoRef.current.videoHeight }); setIsCameraLoading(false); } }; } else if (stream) { stream?.getTracks().forEach(track => track.stop()); } } catch (err) { if (isMounted) { let message = "Camera Error."; /* ... */ setCameraError(message); setIsCameraLoading(false); setDebugInfo(`Camera Error: ${message}`); } } };
    if (isPreviewing) { enableStream(); } else { setIsCameraLoading(false); const currentStream = cameraStream || stream; currentStream?.getTracks().forEach(track => track.stop()); if (selfieVideoRef.current) { selfieVideoRef.current.srcObject = null; } setCameraStream(null); }
    return () => { isMounted = false; const currentStream = cameraStream || stream; currentStream?.getTracks().forEach(track => track.stop()); if (selfieVideoRef.current) { selfieVideoRef.current.srcObject = null; selfieVideoRef.current.onloadedmetadata = null; } setCameraStream(null); };
   }, [faceLandmarker]); // Keep dependency


  // Prediction Loop Callback - UNCONDITIONAL LOGGING
  const predictWebcam = useCallback(() => {
    // Update frame count stored in ref
    animationFrameRef.current.count = (animationFrameRef.current.count || 0) + 1;
    const frameCount = animationFrameRef.current.count;
    // Request next frame FIRST
    animationFrameRef.current.rafId = requestAnimationFrame(predictWebcam);

    // Check conditions AFTER requesting next frame
    if (!faceLandmarker || !videoRef.current || videoRef.current.readyState < 2 ) { return; }
    const video = videoRef.current;
    let results = null;

    try {
      const startTime = performance.now();
      results = faceLandmarker.detectForVideo(video, startTime);

      // *** UNCONDITIONAL LOGGING for the first 20 frames ***
      if (results && frameCount <= 20) {
          console.log(`--- [Frame ${frameCount}] RealTimeMirror: detectForVideo results ---`, results);
          if (results.segmentationMasks) {
              console.log(` -> [Frame ${frameCount}] segmentationMasks:`, results.segmentationMasks);
              if (results.segmentationMasks.length > 0 && results.segmentationMasks[0]) {
                   const maskData = results.segmentationMasks[0]?.maskData;
                   console.log(` -> [Frame ${frameCount}] maskData type: ${maskData?.constructor?.name}, instanceof WebGLTexture: ${maskData instanceof WebGLTexture}`);
              } else {
                   console.log(` -> [Frame ${frameCount}] segmentationMasks: Array is empty.`);
              }
          } else {
               console.log(` -> [Frame ${frameCount}] segmentationMasks: Not found in results.`);
          }
          console.log(`-----------------------------------------`); // Separator
      }
      // *******************************************************

      setLatestResults(results); // Update state
    }
    catch (error) {
       console.error(`PredictWebcam: Error during faceLandmarker.detectForVideo (Frame ${frameCount}):`, error);
       setLatestResults(null);
    }
  }, [faceLandmarker]);


  // Effect to manage loop start/stop
  useEffect(() => {
       if (videoStream && faceLandmarker) {
           console.log("RealTimeMirror: Starting prediction loop.");
           cancelAnimationFrame(animationFrameRef.current?.rafId); // Clear previous before starting
           animationFrameRef.current.count = 0; // Reset count
           animationFrameRef.current.rafId = requestAnimationFrame(predictWebcam);
       } else {
           cancelAnimationFrame(animationFrameRef.current?.rafId);
       }
       // Cleanup
       return () => {
           cancelAnimationFrame(animationFrameRef.current?.rafId);
       };
   }, [videoStream, faceLandmarker, predictWebcam]);


  const shouldRenderTryOn = !isCameraLoading && !cameraError && videoDimensions.width > 0;

  // --- JSX ---
  return (
    <div className="border p-4 rounded bg-blue-50 relative">
       <h2 className="text-xl font-semibold mb-2">Real-Time Mirror Mode</h2>
       {isCameraLoading && <p className="text-center py-4">Starting camera...</p>}
       {cameraError && <p className="text-red-500 text-center py-4">{cameraError}</p>}
      <div className="relative w-full max-w-md mx-auto" style={{ paddingTop: `${videoDimensions.width > 0 ? (videoDimensions.height / videoDimensions.width) * 100 : 75}%` }}>
        <video ref={videoRef} autoPlay playsInline muted className="absolute top-0 left-0 w-0 h-0 -z-10" />
        {shouldRenderTryOn ? (
          <TryOnRenderer
            videoRefProp={videoRef}
            imageElement={null}
            mediaPipeResults={latestResults} // Pass state here
            isStatic={false}
            brightness={1.0}
            contrast={1.0}
            effectIntensity={effectIntensity}
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