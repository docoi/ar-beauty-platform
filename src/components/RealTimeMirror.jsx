// src/components/RealTimeMirror.jsx - Added Debug Logging for Camera State

import React, { useRef, useEffect, useState, useCallback, forwardRef } from 'react';
import TryOnRenderer from './TryOnRenderer'; // Expects the onBeforeCompile version

const RealTimeMirror = forwardRef(({
  faceLandmarker,
  imageSegmenter,
  effectIntensity
}, ref) => {
  const videoRef = useRef(null);
  const animationFrameRef = useRef({ count: 0, rafId: null });
  const [videoStream, setVideoStream] = useState(null);
  const [isCameraLoading, setIsCameraLoading] = useState(true);
  const [cameraError, setCameraError] = useState(null);
  const [videoDimensions, setVideoDimensions] = useState({ width: 0, height: 0 }); // Start with 0 dims
  const [latestLandmarkResults, setLatestLandmarkResults] = useState(null);
  const [latestSegmentationResults, setLatestSegmentationResults] = useState(null);

  // Camera Access Effect with Debug Logging
  useEffect(() => {
    let isMounted = true;
    let stream = null;
    console.log("RealTimeMirror: Camera useEffect - Mounting/Running.");

    const enableStream = async () => {
        console.log("RealTimeMirror: enableStream called.");
        if (!faceLandmarker) { // Only check landmarker for initial AI readiness guard
            if (isMounted) { console.warn("RealTimeMirror: FaceLandmarker not ready yet."); setCameraError("AI models initializing..."); setIsCameraLoading(false); }
            return;
        }
         if (!navigator.mediaDevices?.getUserMedia) {
            if (isMounted) { console.error("RealTimeMirror: getUserMedia not supported."); setCameraError("getUserMedia not supported."); setIsCameraLoading(false); }
            return;
        }

        console.log("RealTimeMirror: Setting camera loading state...");
        setIsCameraLoading(true);
        setCameraError(null);
        setVideoStream(null);
        setVideoDimensions({ width: 0, height: 0 }); // Reset dimensions

        try {
            console.log("RealTimeMirror: Calling getUserMedia...");
            stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 720 } }, audio: false });
            console.log("RealTimeMirror: getUserMedia SUCCESS.");

            if (isMounted && videoRef.current) {
                console.log("RealTimeMirror: Assigning stream to video element.");
                videoRef.current.srcObject = stream;
                setVideoStream(stream); // Store stream reference

                videoRef.current.onloadedmetadata = () => {
                    // <<<--- THIS IS THE CRITICAL CALLBACK ---<<<
                    if (isMounted && videoRef.current) {
                        console.log("<<<< RealTimeMirror: onloadedmetadata FIRED! >>>>");
                        const vw = videoRef.current.videoWidth;
                        const vh = videoRef.current.videoHeight;
                        console.log(`     Video Dimensions: ${vw}x${vh}`);
                        if (vw > 0 && vh > 0) {
                            setVideoDimensions({ width: vw, height: vh });
                            setIsCameraLoading(false); // <<<--- THIS SHOULD HIDE LOADING INDICATOR
                            setCameraError(null); // Clear any previous error
                             console.log("     State updated: isCameraLoading=false, videoDimensions set.");
                        } else {
                             console.warn("     onloadedmetadata fired but video dimensions are zero?");
                             setCameraError("Failed to get video dimensions.");
                             setIsCameraLoading(false); // Still stop loading, but show error
                        }
                    } else {
                         console.log("RealTimeMirror: onloadedmetadata fired but component unmounted or videoRef invalid.");
                    }
                };

                videoRef.current.onerror = (e) => {
                    console.error("RealTimeMirror: Video Element Error Event:", e);
                    if(isMounted) {
                        setCameraError("Video element encountered an error.");
                        setIsCameraLoading(false);
                        setVideoStream(null); // Clear stream on video error
                        stream?.getTracks().forEach(track => track.stop()); // Stop tracks
                    }
                 };

                 // Add loadeddata listener as a fallback/comparison
                 videoRef.current.onloadeddata = () => {
                     if (isMounted) console.log("RealTimeMirror: onloadeddata event fired.");
                 };
                 videoRef.current.oncanplay = () => {
                      if (isMounted) console.log("RealTimeMirror: oncanplay event fired.");
                 };


                 console.log("RealTimeMirror: Waiting for metadata...");
                 // Explicitly call play here? Might help trigger metadata load on some browsers
                 videoRef.current.play().catch(err => {
                     console.error("RealTimeMirror: video.play() failed:", err);
                     if (isMounted) { setCameraError("Could not play video stream."); setIsCameraLoading(false); }
                 });

            } else {
                console.log("RealTimeMirror: Component unmounted or videoRef missing after getUserMedia success. Stopping stream.");
                stream?.getTracks().forEach(track => track.stop());
            }
        } catch (err) {
            console.error("RealTimeMirror: enableStream - Camera Access or Setup Error:", err);
            if (isMounted) {
                 let message = "Failed to access camera.";
                 if (err.name === "NotAllowedError") { message = "Camera permission denied."; }
                 else if (err.name === "NotFoundError") { message = "No camera found."; }
                 else if (err.name === "NotReadableError") { message = "Camera is already in use."; }
                 setCameraError(message);
                 setIsCameraLoading(false);
                 setVideoStream(null); // Ensure stream state is clear on error
             }
        }
    };
    enableStream();

    // Cleanup
    return () => {
        isMounted = false;
        console.log("RealTimeMirror: Camera useEffect - Cleaning up.");
        const currentStream = videoStream || stream; // Get stream from state or local var
        currentStream?.getTracks().forEach(track => track.stop());
        console.log("   - MediaStream tracks stopped.");
        if (videoRef.current) {
             // Remove listeners to prevent memory leaks
             videoRef.current.onloadedmetadata = null;
             videoRef.current.onerror = null;
             videoRef.current.onloadeddata = null;
             videoRef.current.oncanplay = null;
             videoRef.current.srcObject = null;
             console.log("   - videoRef listeners and srcObject cleared.");
        }
        setVideoStream(null); // Clear stream state
        setIsCameraLoading(true); // Reset loading state for potential remount
        setCameraError(null);
        setVideoDimensions({ width: 0, height: 0 }); // Reset dimensions
    };
   // Rerun if faceLandmarker becomes available after initial mount
   }, [faceLandmarker]);


  // Prediction Loop Callback (No changes needed)
  const predictWebcam = useCallback(() => { /* ... */ }, [faceLandmarker, imageSegmenter]);
  // Effect to manage loop start/stop (No changes needed)
  useEffect(() => { /* ... */ }, [videoStream, faceLandmarker, imageSegmenter, predictWebcam]);


  // Determine if renderer should be shown
  const shouldRenderTryOn = !isCameraLoading && !cameraError && videoDimensions.width > 0;
  console.log("RealTimeMirror: Rendering Check. isCameraLoading:", isCameraLoading, "cameraError:", cameraError, "videoDimensions:", videoDimensions, "shouldRenderTryOn:", shouldRenderTryOn);

  // JSX - Pass results down
  return (
    <div className="border p-4 rounded bg-blue-50 relative">
       <h2 className="text-xl font-semibold mb-2 text-center">Real-Time Mirror Mode</h2>
       {isCameraLoading && <p className="text-center py-4">Starting camera...</p>}
       {cameraError && <p className="text-red-500 text-center py-4">{cameraError}</p>}
      <div className="relative w-full max-w-md mx-auto" style={{ paddingTop: `${videoDimensions.width > 0 ? (videoDimensions.height / videoDimensions.width) * 100 : 75}%` }}>
        <video ref={videoRef} autoPlay playsInline muted className="absolute top-0 left-0 w-0 h-0 -z-10" />
        {shouldRenderTryOn ? (
          <TryOnRenderer
            videoRefProp={videoRef}
            imageElement={null}
            mediaPipeResults={latestLandmarkResults}
            segmentationResults={latestSegmentationResults}
            isStatic={false}
            effectIntensity={effectIntensity}
            className="absolute top-0 left-0 w-full h-full rounded shadow overflow-hidden"
          />
        ) : ( // Fallback UI
           <div className="absolute inset-0 flex items-center justify-center bg-gray-200 rounded shadow">
              {/* Show more specific status in fallback */}
              <p className="text-gray-500">
                  {cameraError ? cameraError : (isCameraLoading ? 'Loading Camera...' : 'Waiting for video dimensions...')}
              </p>
           </div>
        )}
      </div>
      {(!faceLandmarker || !imageSegmenter) && <p className="text-red-500 mt-2 text-center">Waiting for AI Models...</p>}
    </div>
  );
});
RealTimeMirror.displayName = 'RealTimeMirror';
export default RealTimeMirror;