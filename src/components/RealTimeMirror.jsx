// src/components/RealTimeMirror.jsx - BASELINE COMPATIBLE
// Only sets up camera video feed, does NOT run AI predictions.

import React, { useRef, useEffect, useState, useCallback, forwardRef } from 'react';
import TryOnRenderer from './TryOnRenderer'; // Expects the BASELINE version

const RealTimeMirror = forwardRef(({
  // REMOVED: faceLandmarker, imageSegmenter, effectIntensity props
}, ref) => {
  const videoRef = useRef(null);
  // const animationFrameRef = useRef({ count: 0, rafId: null }); // Not needed
  const [videoStream, setVideoStream] = useState(null);
  const [isCameraLoading, setIsCameraLoading] = useState(true);
  const [cameraError, setCameraError] = useState(null);
  const [videoDimensions, setVideoDimensions] = useState({ width: 640, height: 480 });
  // REMOVED: latestLandmarkResults, latestSegmentationResults state

  // Camera Access Effect (No AI dependency)
  useEffect(() => {
    let isMounted = true; let stream = null;
    const enableStream = async () => {
        // Simplified check: Just need mediaDevices
        if (!navigator.mediaDevices?.getUserMedia) {
            if (isMounted) { setCameraError("getUserMedia not supported."); setIsCameraLoading(false); }
            return;
        }
        setIsCameraLoading(true); setCameraError(null); setVideoStream(null);
        try {
            stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 720 } }, audio: false });
            if (isMounted && videoRef.current) {
                videoRef.current.srcObject = stream;
                setVideoStream(stream); // Keep track to stop it later
                videoRef.current.onloadedmetadata = () => {
                    if (isMounted && videoRef.current) {
                        console.log(`Mirror video dims: ${videoRef.current.videoWidth}x${videoRef.current.videoHeight}`);
                        setVideoDimensions({ width: videoRef.current.videoWidth, height: videoRef.current.videoHeight });
                        setIsCameraLoading(false); // Camera is ready
                        console.log("RealTimeMirror Baseline: Metadata loaded.");
                    }
                };
                videoRef.current.onerror = (e) => { console.error("Mirror Mode Baseline: Video Element Error:", e); if(isMounted) setCameraError("Video element encountered an error."); setIsCameraLoading(false); };
            } else {
                 // If component unmounted before video loaded
                stream?.getTracks().forEach(track => track.stop());
            }
        } catch (err) {
            console.error("Mirror Mode Baseline: enableStream - Camera Error:", err);
            if (isMounted) { let message = "Failed to access camera."; setCameraError(message); setIsCameraLoading(false); }
        }
    };
    enableStream();

    // Cleanup
    return () => {
        isMounted = false;
        console.log("RealTimeMirror Baseline: Cleaning up...");
        // cancelAnimationFrame(animationFrameRef.current?.rafId); // No loop to cancel
        videoStream?.getTracks().forEach(track => track.stop()); // Use tracked stream
        if (videoRef.current) { videoRef.current.srcObject = null; videoRef.current.onloadedmetadata = null; videoRef.current.onerror = null; }
        setVideoStream(null); setIsCameraLoading(true);
    };
   }, []); // Runs once on mount


  // REMOVED predictWebcam callback and associated useEffect

  // Determine if renderer should be shown
  const shouldRenderTryOn = !isCameraLoading && !cameraError && videoDimensions.width > 0;

  // JSX - Pass ONLY videoRefProp
  return (
    <div className="border p-4 rounded bg-blue-50 relative">
       <h2 className="text-xl font-semibold mb-2 text-center">Real-Time Mirror Mode</h2>
       {isCameraLoading && <p className="text-center py-4">Starting camera...</p>}
       {cameraError && <p className="text-red-500 text-center py-4">{cameraError}</p>}
      {/* Aspect ratio container */}
      <div className="relative w-full max-w-md mx-auto" style={{ paddingTop: `${videoDimensions.width > 0 ? (videoDimensions.height / videoDimensions.width) * 100 : 75}%` }}>
        {/* Video element is hidden, only used as texture source */}
        <video ref={videoRef} autoPlay playsInline muted className="absolute top-0 left-0 w-0 h-0 -z-10" />

        {/* Render TryOnRenderer or fallback */}
        {shouldRenderTryOn ? (
          <TryOnRenderer
            videoRefProp={videoRef} // Pass the video ref
            imageElement={null}   // No image in this mode
            isStatic={false}       // Indicate video mode
            // REMOVED: mediaPipeResults, segmentationResults, effectIntensity
            className="absolute top-0 left-0 w-full h-full rounded shadow overflow-hidden"
          />
        ) : ( // Fallback UI
           <div className="absolute inset-0 flex items-center justify-center bg-gray-200 rounded shadow">
              <p className="text-gray-500">{cameraError ? 'Camera Error' : (isCameraLoading ? 'Loading Camera...' : 'Initializing...')}</p>
           </div>
        )}
      </div>
      {/* Removed AI model status text */}
    </div>
  );
});
RealTimeMirror.displayName = 'RealTimeMirror';
export default RealTimeMirror;