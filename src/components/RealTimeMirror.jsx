// src/components/RealTimeMirror.jsx - Attempt to Force Metadata Load Event

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
  const [videoDimensions, setVideoDimensions] = useState({ width: 0, height: 0 });
  const [latestLandmarkResults, setLatestLandmarkResults] = useState(null);
  const [latestSegmentationResults, setLatestSegmentationResults] = useState(null);
  const metadataLoadedRef = useRef(false); // Prevent multiple updates

  // Camera Access Effect with Debug Logging
  useEffect(() => {
    let isMounted = true;
    let stream = null;
    metadataLoadedRef.current = false; // Reset flag on mount/rerun
    console.log("RealTimeMirror: Camera useEffect - Mounting/Running.");

    // Define the handler function separately
    const handleMetadataLoaded = (eventName) => {
        if (!isMounted || !videoRef.current || metadataLoadedRef.current) {
            // console.log(`RealTimeMirror: ${eventName} handler skipped (unmounted, no ref, or already loaded)`);
            return;
        }
        console.log(`<<<< RealTimeMirror: ${eventName} FIRED! >>>>`);
        const vw = videoRef.current.videoWidth;
        const vh = videoRef.current.videoHeight;
        console.log(`     Video Dimensions from ${eventName}: ${vw}x${vh}`);

        if (vw > 0 && vh > 0) {
            metadataLoadedRef.current = true; // Set flag
            setVideoDimensions({ width: vw, height: vh });
            setIsCameraLoading(false);
            setCameraError(null);
            console.log(`     State updated via ${eventName}: isCameraLoading=false, videoDimensions set.`);
        } else {
            console.warn(`     ${eventName} fired but video dimensions are zero?`);
            // Don't necessarily set error here, maybe another event will work
        }
    };

    const handleVideoError = (e) => {
        console.error("RealTimeMirror: Video Element Error Event:", e);
        if(isMounted) {
            setCameraError("Video element encountered an error.");
            setIsCameraLoading(false);
            setVideoStream(null);
            stream?.getTracks().forEach(track => track.stop()); // Stop tracks from local var if available
        }
    };

    // Attach listeners function
    const attachListeners = () => {
        if(videoRef.current) {
            console.log("RealTimeMirror: Attaching video event listeners...");
            videoRef.current.onloadedmetadata = () => handleMetadataLoaded('onloadedmetadata');
            videoRef.current.onloadeddata = () => handleMetadataLoaded('onloadeddata');
            videoRef.current.oncanplay = () => handleMetadataLoaded('oncanplay');
            videoRef.current.onerror = handleVideoError;
        } else {
            console.error("RealTimeMirror: Cannot attach listeners, videoRef is null.");
        }
    };

    // Detach listeners function
    const detachListeners = () => {
         if (videoRef.current) {
             videoRef.current.onloadedmetadata = null;
             videoRef.current.onloadeddata = null;
             videoRef.current.oncanplay = null;
             videoRef.current.onerror = null;
             console.log("RealTimeMirror: Detached video event listeners.");
         }
    };


    const enableStream = async () => {
        console.log("RealTimeMirror: enableStream called.");
        if (!faceLandmarker) { if (isMounted) { console.warn("RealTimeMirror: FaceLandmarker not ready."); setCameraError("AI models initializing..."); setIsCameraLoading(false); } return; }
        if (!navigator.mediaDevices?.getUserMedia) { if (isMounted) { console.error("RealTimeMirror: getUserMedia not supported."); setCameraError("getUserMedia not supported."); setIsCameraLoading(false); } return; }

        console.log("RealTimeMirror: Setting camera loading state...");
        setIsCameraLoading(true); setCameraError(null); setVideoStream(null); setVideoDimensions({ width: 0, height: 0 }); metadataLoadedRef.current = false;

        try {
            console.log("RealTimeMirror: Calling getUserMedia...");
            stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 720 } }, audio: false });
            console.log("RealTimeMirror: getUserMedia SUCCESS.");

            if (isMounted && videoRef.current) {
                console.log("RealTimeMirror: Assigning stream to video element.");
                videoRef.current.srcObject = stream;
                setVideoStream(stream);

                // Attach listeners *before* trying to play
                attachListeners();

                 // Attempt to play immediately after setting srcObject
                 console.log("RealTimeMirror: Attempting videoRef.current.play()...");
                 videoRef.current.play().then(() => {
                     console.log("RealTimeMirror: video.play() promise resolved.");
                     // Metadata might load after play starts successfully
                 }).catch(err => {
                     console.error("RealTimeMirror: video.play() failed:", err);
                     // Don't set error state here if metadata might still load
                     // if (isMounted) { setCameraError("Could not play video stream."); setIsCameraLoading(false); }
                 });
                console.log("RealTimeMirror: Waiting for metadata events...");

            } else {
                console.log("RealTimeMirror: Component unmounted or videoRef missing after getUserMedia success. Stopping stream.");
                stream?.getTracks().forEach(track => track.stop());
            }
        } catch (err) {
            console.error("RealTimeMirror: enableStream - Camera Access or Setup Error:", err);
            if (isMounted) { let message = "Failed to access camera."; /* ... error handling ... */ setCameraError(message); setIsCameraLoading(false); setVideoStream(null); }
        }
    };
    enableStream();

    // Cleanup
    return () => {
        isMounted = false;
        console.log("RealTimeMirror: Camera useEffect - Cleaning up.");
        const currentStream = videoStream || stream;
        currentStream?.getTracks().forEach(track => track.stop());
        console.log("   - MediaStream tracks stopped.");
        detachListeners(); // Detach listeners
        if (videoRef.current) { videoRef.current.srcObject = null; console.log("   - videoRef srcObject cleared."); }
        setVideoStream(null); setIsCameraLoading(true); setCameraError(null); setVideoDimensions({ width: 0, height: 0 }); metadataLoadedRef.current = false;
    };
   }, [faceLandmarker]); // Rerun if faceLandmarker changes


  // Prediction Loop Callback (No changes needed)
  const predictWebcam = useCallback(() => { /* ... */ }, [faceLandmarker, imageSegmenter]);
  // Effect to manage loop start/stop (No changes needed)
  useEffect(() => { /* ... */ }, [videoStream, faceLandmarker, imageSegmenter, predictWebcam]);


  // Determine if renderer should be shown
  const shouldRenderTryOn = !isCameraLoading && !cameraError && videoDimensions.width > 0;
  // Add logging inside the render return path for clarity
  console.log("RealTimeMirror: Render() Check. isCameraLoading:", isCameraLoading, "cameraError:", cameraError, "videoDimensions:", videoDimensions, "shouldRenderTryOn:", shouldRenderTryOn);

  // JSX - Pass results down
  return (
    <div className="border p-4 rounded bg-blue-50 relative">
       <h2 className="text-xl font-semibold mb-2 text-center">Real-Time Mirror Mode</h2>
       {isCameraLoading && <p className="text-center py-4">Starting camera...</p>}
       {cameraError && <p className="text-red-500 text-center py-4">{cameraError}</p>}
      <div className="relative w-full max-w-md mx-auto" style={{ paddingTop: `${videoDimensions.width > 0 ? (videoDimensions.height / videoDimensions.width) * 100 : 75}%` }}>
        {/* --- DEBUG: Make video slightly visible --- */}
        <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className="absolute top-0 left-0 -z-10"
            style={{ width: '1px', height: '1px', opacity: 0.1 }} // Give it minimal size/opacity
        />
        {/* ----------------------------------------- */}

        {shouldRenderTryOn ? (
          <>
            {console.log("RealTimeMirror: Rendering TryOnRenderer...")}
            <TryOnRenderer
              videoRefProp={videoRef}
              imageElement={null}
              mediaPipeResults={latestLandmarkResults}
              segmentationResults={latestSegmentationResults}
              isStatic={false}
              effectIntensity={effectIntensity}
              className="absolute top-0 left-0 w-full h-full rounded shadow overflow-hidden"
            />
          </>
        ) : ( // Fallback UI
           <div className="absolute inset-0 flex items-center justify-center bg-gray-200 rounded shadow">
              {console.log("RealTimeMirror: Rendering Fallback UI...")}
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