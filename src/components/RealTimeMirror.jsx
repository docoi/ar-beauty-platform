// src/components/RealTimeMirror.jsx - Reset to last working state

import React, { useRef, useEffect, useState, useCallback, forwardRef, useImperativeHandle } from 'react';
import TryOnRenderer from './TryOnRenderer'; // Should use the one with bare-minimum shader for now

const RealTimeMirror = forwardRef(({
  faceLandmarker,
  effectIntensity
}, ref) => {
  console.log("RealTimeMirror rendering...");
  const videoRef = useRef(null);
  const rendererRef = useRef(null); // Ref for the CHILD TryOnRenderer
  const animationFrameRef = useRef(null);
  const [videoStream, setVideoStream] = useState(null);
  const videoStreamRef = useRef(null); // Ref for stream check in loop
  const [isCameraLoading, setIsCameraLoading] = useState(true);
  const [cameraError, setCameraError] = useState(null);
  const [videoDimensions, setVideoDimensions] = useState({ width: 640, height: 480 });

  // Effect to keep ref in sync with state
  useEffect(() => {
    videoStreamRef.current = videoStream;
    console.log("VideoStream Ref updated:", videoStreamRef.current ? 'Stream Set' : 'Stream Cleared');
  }, [videoStream]);

  // Imperative handle for parent
  useImperativeHandle(ref, () => ({
      updateEffectIntensity: (intensity) => {
          if (rendererRef.current && typeof rendererRef.current.updateEffectIntensity === 'function') {
             rendererRef.current.updateEffectIntensity(intensity);
          }
      },
  }));

  // Effect for camera access
  useEffect(() => {
    let isMounted = true; let stream = null;
    const enableStream = async () => { if (!faceLandmarker || !navigator.mediaDevices?.getUserMedia) { if (isMounted) { setCameraError("getUserMedia not supported or FaceLandmarker not ready."); setIsCameraLoading(false); } return; } setIsCameraLoading(true); setCameraError(null); setVideoStream(null); console.log("Mirror Mode: enableStream - Requesting stream..."); try { stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 720 } }, audio: false }); console.log("Mirror Mode: enableStream - Stream acquired."); if (isMounted && videoRef.current) { videoRef.current.srcObject = stream; setVideoStream(stream); /* << SET STATE */ videoRef.current.onloadedmetadata = () => { console.log("Mirror Mode: enableStream - Metadata loaded."); if (isMounted && videoRef.current) { console.log(`Mirror video dims: ${videoRef.current.videoWidth}x${videoRef.current.videoHeight}`); setVideoDimensions({ width: videoRef.current.videoWidth, height: videoRef.current.videoHeight }); setIsCameraLoading(false); console.log("RealTimeMirror: Starting initial prediction loop from onloadedmetadata."); cancelAnimationFrame(animationFrameRef.current); animationFrameRef.current = requestAnimationFrame(predictWebcam); } }; videoRef.current.onerror = (e) => { console.error("Mirror Mode: Video Element Error:", e); if(isMounted) setCameraError("Video element encountered an error."); setIsCameraLoading(false); } } else { console.log("Mirror Mode: enableStream - Component unmounted or videoRef missing after stream aquisition. Stopping tracks."); stream?.getTracks().forEach(track => track.stop()); } } catch (err) { console.error("Mirror Mode: enableStream - Camera Error:", err); if (isMounted) { let message = "Failed to access camera."; /* ... error messages ... */ setCameraError(message); setIsCameraLoading(false); } } }; enableStream();
    return () => { isMounted = false; console.log("Cleaning up RealTimeMirror (useEffect cleanup)..."); cancelAnimationFrame(animationFrameRef.current); const currentStream = videoStreamRef.current; /* << USE REF in cleanup */ console.log("Stopping tracks for stream:", currentStream ? 'Exists' : 'None'); currentStream?.getTracks().forEach(track => { console.log(`Stopping track: ${track.label} (${track.readyState})`); track.stop(); }); if (videoRef.current) { console.log("Resetting video srcObject."); videoRef.current.srcObject = null; videoRef.current.onloadedmetadata = null; videoRef.current.onerror = null; } setVideoStream(null); /* << Clear State */ rendererRef.current?.clearCanvas(); console.log("RealTimeMirror cleanup complete."); };
  }, [faceLandmarker]);


  // Prediction Loop Callback
  const predictWebcam = useCallback(async () => {
    animationFrameRef.current = requestAnimationFrame(predictWebcam); // Schedule next frame first

    const checkTime = performance.now().toFixed(0);
    let ready = true;
    let reason = "";

    // Readiness checks (using videoStreamRef)
    if (!faceLandmarker) { ready = false; reason = "faceLandmarker missing"; }
    else if (!videoRef.current) { ready = false; reason = "videoRef missing"; }
    else if (videoRef.current.readyState < 2) { ready = false; reason = `videoRef not ready (${videoRef.current.readyState})`; }
    else if (!rendererRef.current) { ready = false; reason = "rendererRef missing"; }
    else if (!videoStreamRef.current) { ready = false; reason = "videoStream REF missing"; }

    if (!ready) {
        // console.log(`PredictWebcam [${checkTime}]: Skipping processing - ${reason}`); // Keep logs minimal
        return; // Exit processing for this frame
    }

    // If ready, proceed
    const video = videoRef.current;
    const startTimeMs = performance.now();
    try {
        const results = faceLandmarker.detectForVideo(video, startTimeMs);

        // Call renderResults if ref and method exist
        if (rendererRef.current && typeof rendererRef.current.renderResults === 'function') {
            rendererRef.current.renderResults(video, results, effectIntensity);
        } else {
            console.log(`PredictWebcam [${checkTime}]: Error - Skipping renderResults call (ref or method missing). Ref:`, rendererRef.current);
        }

    } catch (error) {
        console.error(`PredictWebcam [${checkTime}]: Error during prediction/render call:`, error);
    }
  }, [faceLandmarker, effectIntensity]); // videoStream removed


  // Effect handles stopping the loop if the state indicates no stream
  useEffect(() => {
       if (!videoStream) {
           console.log("RealTimeMirror: Stopping prediction loop (videoStream state is null).");
           cancelAnimationFrame(animationFrameRef.current);
       }
       return () => {
           // console.log("RealTimeMirror: Cleaning up loop stop effect."); // Minimal logs
           cancelAnimationFrame(animationFrameRef.current);
       };
   }, [videoStream]);


  // --- JSX ---
  return (
    <div className="border p-4 rounded bg-blue-50 relative">
       <h2 className="text-xl font-semibold mb-2">Real-Time Mirror Mode</h2>
       {isCameraLoading && <p className="text-center py-4">Starting camera...</p>}
       {cameraError && <p className="text-red-500 text-center py-4">{cameraError}</p>}
      <div className="relative w-full max-w-md mx-auto" style={{ paddingTop: `${videoDimensions.width > 0 ? (videoDimensions.height / videoDimensions.width) * 100 : 75}%` }}>
        <video ref={videoRef} autoPlay playsInline muted className="absolute top-0 left-0 w-0 h-0 -z-10" />
        {/* Base visibility on state */}
        {videoStream && !isCameraLoading && !cameraError && videoDimensions.width > 0 ? (
          <TryOnRenderer
            ref={rendererRef} // Pass ref to child
            videoWidth={videoDimensions.width}
            videoHeight={videoDimensions.height}
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