// src/components/RealTimeMirror.jsx - Passes Results & Intensity

import React, { useRef, useEffect, useState, useCallback } from 'react';
import TryOnRenderer from './TryOnRenderer'; // Uses the post-processing version

const RealTimeMirror = ({ faceLandmarker, effectIntensity }) => { // Accept intensity prop
  console.log("RealTimeMirror rendering...");
  const videoRef = useRef(null);
  const rendererRef = useRef(null); // Ref to control the renderer component
  const animationFrameRef = useRef(null);
  const [videoStream, setVideoStream] = useState(null);
  const [isCameraLoading, setIsCameraLoading] = useState(true);
  const [cameraError, setCameraError] = useState(null);
  const [videoDimensions, setVideoDimensions] = useState({ width: 640, height: 480 });

  // --- Camera Access ---
  useEffect(() => {
    let isMounted = true; let stream = null;
    const enableStream = async () => { if (!faceLandmarker || !navigator.mediaDevices?.getUserMedia) { if (isMounted) { setCameraError("getUserMedia not supported or FaceLandmarker not ready."); setIsCameraLoading(false); } return; }
      try { console.log("Mirror Mode: Requesting stream..."); stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 720 } }, audio: false }); console.log("Mirror Mode: Stream acquired.");
        if (isMounted && videoRef.current) {
          videoRef.current.srcObject = stream; setVideoStream(stream);
          videoRef.current.onloadedmetadata = () => { console.log("Mirror Mode: Metadata loaded.");
             if (isMounted && videoRef.current) { console.log(`Mirror video dims: ${videoRef.current.videoWidth}x${videoRef.current.videoHeight}`); setVideoDimensions({ width: videoRef.current.videoWidth, height: videoRef.current.videoHeight }); setIsCameraLoading(false); requestAnimationFrame(predictWebcam); } // Start loop here
          };
        } else { stream?.getTracks().forEach(track => track.stop()); }
      } catch (err) { console.error("Mirror Mode: Camera Error:", err); if (isMounted) { /* ... set error message ... */ let message = "Failed to access camera."; if (err.name === "NotFoundError") message = "No camera found."; else if (err.name === "NotAllowedError") message = "Permission denied."; else if (err.name === "NotReadableError") message = "Camera in use."; setCameraError(message); setIsCameraLoading(false); } }
    };
    enableStream();
    return () => { isMounted = false; console.log("Cleaning up RealTimeMirror..."); cancelAnimationFrame(animationFrameRef.current); videoStream?.getTracks().forEach(track => track.stop()); if (videoRef.current) { videoRef.current.srcObject = null; videoRef.current.onloadedmetadata = null; } setVideoStream(null); rendererRef.current?.clearCanvas(); }; // Clear renderer on unmount
  }, [faceLandmarker]); // Removed predictWebcam from deps, defined below now


  // --- MediaPipe Detection Loop ---
  const predictWebcam = useCallback(async () => {
    // Schedule next frame first
    animationFrameRef.current = requestAnimationFrame(predictWebcam);

    // Ensure everything is ready
    if (!faceLandmarker || !videoRef.current || videoRef.current.readyState < 2 || !rendererRef.current) { return; }

    const video = videoRef.current;
    const startTimeMs = performance.now();
    const results = faceLandmarker.detectForVideo(video, startTimeMs);

    // Pass results AND intensity to the Renderer component instance
    if (rendererRef.current) {
        rendererRef.current.renderResults(video, results, effectIntensity); // Pass intensity
    }

  }, [faceLandmarker, effectIntensity]); // Add effectIntensity dependency


  // Re-initialize loop when predictWebcam changes (due to effectIntensity change)
  useEffect(() => {
      // Only start loop if stream is active and metadata loaded
       if(videoStream && videoRef.current?.readyState >= 2) {
            console.log("RealTimeMirror: (Re)starting prediction loop.");
            cancelAnimationFrame(animationFrameHandle.current); // Cancel previous loop
            animationFrameHandle.current = requestAnimationFrame(predictWebcam);
       }
       // Cleanup is handled by the main camera useEffect
  }, [predictWebcam, videoStream]);


  return (
    <div className="border p-4 rounded bg-blue-50 relative">
      <h2 className="text-xl font-semibold mb-2">Real-Time Mirror Mode</h2>
      {isCameraLoading && <p>Starting camera...</p>}
      {cameraError && <p className="text-red-500">{cameraError}</p>}
      {/* Container for positioning */}
      <div className="relative w-full max-w-md mx-auto" style={{ paddingTop: `${(videoDimensions.height / videoDimensions.width) * 100}%` }}>
        {/* Hidden video element */}
        <video ref={videoRef} autoPlay playsInline muted className="absolute top-0 left-0 w-0 h-0 -z-10" />
        {/* Visible TryOnRenderer */}
        {!isCameraLoading && !cameraError && videoDimensions.width > 0 && (
          <TryOnRenderer
            ref={rendererRef}
            videoWidth={videoDimensions.width}
            videoHeight={videoDimensions.height}
            className="absolute top-0 left-0 w-full h-full rounded shadow overflow-hidden" // Add styling
          />
        )}
         {/* Loading/Error Overlay for Renderer Area */}
         {(isCameraLoading || cameraError) && !videoStream && (
             <div className="absolute inset-0 flex items-center justify-center bg-gray-200 rounded shadow">
                <p className="text-gray-500">{cameraError ? 'Camera Error' : 'Loading Camera...'}</p>
             </div>
         )}
      </div>
      {!faceLandmarker && <p className="text-red-500 mt-2 text-center">Waiting for AI Model...</p>}
    </div>
  );
};

export default RealTimeMirror;