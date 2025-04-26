// src/components/RealTimeMirror.jsx - Fixed animationFrameHandle typo

import React, { useRef, useEffect, useState, useCallback, forwardRef, useImperativeHandle } from 'react';
import TryOnRenderer from './TryOnRenderer'; // Should use the one with bare-minimum shader for now

const RealTimeMirror = forwardRef(({
  faceLandmarker,
  effectIntensity
}, ref) => {
  console.log("RealTimeMirror rendering...");
  const videoRef = useRef(null);
  // const rendererRef = useRef(null); // No longer needed for method calls
  const animationFrameRef = useRef(null); // *** CORRECT NAME IS animationFrameRef ***
  const [videoStream, setVideoStream] = useState(null);
  const videoStreamRef = useRef(null);
  const [isCameraLoading, setIsCameraLoading] = useState(true);
  const [cameraError, setCameraError] = useState(null);
  const [videoDimensions, setVideoDimensions] = useState({ width: 640, height: 480 });
  const [latestResults, setLatestResults] = useState(null);

  // Effect to keep ref in sync with state
  useEffect(() => { /* ... sync ref ... */ }, [videoStream]);
  // Imperative handle for parent
  useImperativeHandle(ref, () => ({ /* ... */ }));

  // Effect for camera access
  useEffect(() => {
    let isMounted = true; let stream = null;
    const enableStream = async () => { /* ... */ console.log("Mirror Mode: enableStream - Requesting stream..."); try { /* ... */ if (isMounted && videoRef.current) { /* ... */ videoRef.current.onloadedmetadata = () => { /* ... */ console.log("RealTimeMirror: Starting initial prediction loop from onloadedmetadata."); cancelAnimationFrame(animationFrameRef.current); animationFrameRef.current = requestAnimationFrame(predictWebcam); }; /* ... */ } /* ... */ } catch (err) { /* ... */ } }; enableStream();
    return () => { isMounted = false; console.log("Cleaning up RealTimeMirror (useEffect cleanup)..."); cancelAnimationFrame(animationFrameRef.current); /* *** USE CORRECT REF NAME *** */ const currentStream = videoStreamRef.current; /* ... stop tracks ... */; if (videoRef.current) { /* ... reset srcObject ... */ } setVideoStream(null); setLatestResults(null); /* Clear results */ /* rendererRef.current?.clearCanvas(); // Cannot call this if ref isn't used */ console.log("RealTimeMirror cleanup complete."); };
  }, [faceLandmarker]);


  // Prediction Loop Callback
  const predictWebcam = useCallback(() => {
    // *** USE CORRECT REF NAME ***
    animationFrameRef.current = requestAnimationFrame(predictWebcam); // Schedule next

    if (!faceLandmarker || !videoRef.current || videoRef.current.readyState < 2 ) { return; }

    const video = videoRef.current;
    try {
        const results = faceLandmarker.detectForVideo(video, performance.now());
        setLatestResults(results); // Update state
    } catch (error) { console.error(`PredictWebcam: Error during faceLandmarker.detectForVideo:`, error); setLatestResults(null); }
  }, [faceLandmarker]);


  // Effect to manage loop start/stop
  useEffect(() => {
       if (videoStream && faceLandmarker) {
           console.log("RealTimeMirror: Starting prediction loop (stream/landmarker ready).");
           // *** USE CORRECT REF NAME ***
           cancelAnimationFrame(animationFrameRef.current);
           animationFrameRef.current = requestAnimationFrame(predictWebcam);
       } else {
           console.log("RealTimeMirror: Stopping prediction loop (stream/landmarker not ready).");
            // *** USE CORRECT REF NAME ***
           cancelAnimationFrame(animationFrameRef.current);
       }
       return () => {
           console.log("RealTimeMirror: Cleaning up loop start/stop effect.");
            // *** USE CORRECT REF NAME ***
           cancelAnimationFrame(animationFrameRef.current);
       };
   }, [videoStream, faceLandmarker, predictWebcam]);


  // --- JSX ---
  return (
    <div className="border p-4 rounded bg-blue-50 relative">
       <h2 className="text-xl font-semibold mb-2">Real-Time Mirror Mode</h2>
       {isCameraLoading && <p className="text-center py-4">Starting camera...</p>}
       {cameraError && <p className="text-red-500 text-center py-4">{cameraError}</p>}
      <div className="relative w-full max-w-md mx-auto" style={{ paddingTop: `${videoDimensions.width > 0 ? (videoDimensions.height / videoDimensions.width) * 100 : 75}%` }}>
        <video ref={videoRef} autoPlay playsInline muted className="absolute top-0 left-0 w-0 h-0 -z-10" />
        {videoStream && !isCameraLoading && !cameraError && videoDimensions.width > 0 ? (
          <TryOnRenderer // Pass props
            // ref={rendererRef} // No longer passing ref down
            videoElement={videoRef.current}
            imageElement={null}
            mediaPipeResults={latestResults}
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