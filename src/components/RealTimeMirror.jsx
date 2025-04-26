// src/components/RealTimeMirror.jsx - CORRECTED - Add setTimeout

import React, { useRef, useEffect, useState, useCallback, forwardRef, useImperativeHandle } from 'react';
import TryOnRenderer from './TryOnRenderer'; // Using bare-minimum shader version

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
        // console.log(`PredictWebcam [${checkTime}]: Skipping processing - ${reason}`); // Less noisy
        return; // Exit processing for this frame
    }

    // If ready, capture values needed for the timeout
    const video = videoRef.current;
    const currentIntensity = effectIntensity;

    // Use setTimeout to defer detection and rendering call
    setTimeout(async () => {
        const detectionTime = performance.now().toFixed(0);
        try {
            // console.log(`PredictWebcam [${detectionTime}]: Starting detection inside setTimeout`);
            const results = faceLandmarker.detectForVideo(video, performance.now());

            const currentRenderer = rendererRef.current;
            // console.log(`PredictWebcam [${detectionTime}]: Checking Ref inside setTimeout. Ref exists? ${!!currentRenderer}`);

            if (currentRenderer && typeof currentRenderer.renderResults === 'function') {
                // console.log(`PredictWebcam [${detectionTime}]: Calling renderResults inside setTimeout`);
                currentRenderer.renderResults(video, results, currentIntensity); // Use captured values
            } else {
                console.log(`PredictWebcam [${detectionTime}]: Error inside setTimeout - Skipping renderResults call (ref or method missing). Ref:`, currentRenderer);
            }
        } catch (error) {
            console.error(`PredictWebcam [${detectionTime}]: Error during detection/render call inside setTimeout:`, error);
        }
    }, 0); // setTimeout with 0 delay

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
}); // <-- THIS IS LINE 141

RealTimeMirror.displayName = 'RealTimeMirror'; // Line 143
export default RealTimeMirror; // Line 144