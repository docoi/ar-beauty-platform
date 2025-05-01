// src/components/RealTimeMirror.jsx - Use rAF Polling for Video Readiness

import React, { useRef, useEffect, useState, useCallback, forwardRef } from 'react';
import TryOnRenderer from './TryOnRenderer'; // Expects the onBeforeCompile version

const RealTimeMirror = forwardRef(({
  faceLandmarker,
  imageSegmenter,
  effectIntensity
}, ref) => {
  const videoRef = useRef(null);
  const animationFrameRef = useRef({ count: 0, rafId: null }); // For prediction loop
  const checkReadyRafRef = useRef(null); // Separate rAF ID for readiness check
  const [videoStream, setVideoStream] = useState(null);
  const [isCameraLoading, setIsCameraLoading] = useState(true); // True until video is POLLED as ready
  const [cameraError, setCameraError] = useState(null);
  const [videoDimensions, setVideoDimensions] = useState({ width: 0, height: 0 });
  const [latestLandmarkResults, setLatestLandmarkResults] = useState(null);
  const [latestSegmentationResults, setLatestSegmentationResults] = useState(null);

  // Camera Access Effect - Sets up polling check
  useEffect(() => {
    let isMounted = true;
    let stream = null;
    let checkReadyFrameId = null; // Local variable for cleanup
    console.log("RealTimeMirror: Camera useEffect - Mounting/Running (Polling Method).");

    // Polling function to check video readiness
    const checkVideoReady = () => {
        if (!isMounted || !videoRef.current) {
            console.log("checkVideoReady: Exiting (unmounted or no videoRef)");
            return; // Stop polling if component unmounted or ref missing
        }

        const video = videoRef.current;
        // Check conditions based on ChatGPT recommendation
        const readyState = video.readyState;
        const width = video.videoWidth;
        const height = video.videoHeight;
        const hasDimensions = width > 0 && height > 0;
        const isReady = readyState >= 2 && hasDimensions; // HAVE_CURRENT_DATA = 2

        // console.log(`checkVideoReady: State=${readyState}, Dims=${width}x${height}, Ready=${isReady}`); // Verbose log

        if (isReady) {
            console.log(`<<<< RealTimeMirror: Video Ready via Polling! State=${readyState}, Dims=${width}x${height} >>>>`);
            setVideoDimensions({ width, height });
            setIsCameraLoading(false); // <<< Set loading false HERE
            setCameraError(null);
            // No need to cancel this loop explicitly, it will stop calling itself
        } else {
            // Keep polling
            checkReadyFrameId = requestAnimationFrame(checkVideoReady);
            checkReadyRafRef.current = checkReadyFrameId; // Store ID for potential cleanup
        }
    };


    const enableStream = async () => {
        console.log("RealTimeMirror: enableStream called.");
        if (!faceLandmarker) { /* ... readiness guard ... */ if (isMounted) { console.warn("RealTimeMirror: FaceLandmarker not ready."); setCameraError("AI models initializing..."); setIsCameraLoading(false); } return; }
        if (!navigator.mediaDevices?.getUserMedia) { /* ... guard ... */ if (isMounted) { console.error("RealTimeMirror: getUserMedia not supported."); setCameraError("getUserMedia not supported."); setIsCameraLoading(false); } return; }

        console.log("RealTimeMirror: Setting camera STARTING state...");
        setIsCameraLoading(true); setCameraError(null); setVideoStream(null); setVideoDimensions({ width: 0, height: 0 });
        cancelAnimationFrame(checkReadyRafRef.current); // Cancel any previous polling loop

        try {
            console.log("RealTimeMirror: Calling getUserMedia...");
            stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 720 } }, audio: false });
            console.log("RealTimeMirror: getUserMedia SUCCESS.");

            if (isMounted && videoRef.current) {
                console.log("RealTimeMirror: Assigning stream to video element.");
                videoRef.current.srcObject = stream;
                setVideoStream(stream);

                // Remove event listeners - we are polling now
                videoRef.current.onloadedmetadata = null;
                videoRef.current.onloadeddata = null;
                videoRef.current.oncanplay = null;
                videoRef.current.onplaying = null;
                videoRef.current.onerror = (e) => { // Keep basic error handling
                    console.error("RealTimeMirror: Video Element Error Event:", e);
                    if(isMounted) { setCameraError("Video element encountered an error."); setIsCameraLoading(false); }
                     cancelAnimationFrame(checkReadyRafRef.current); // Stop polling on error
                };

                 console.log("RealTimeMirror: Attempting videoRef.current.play()...");
                 videoRef.current.play().then(() => {
                     console.log("RealTimeMirror: video.play() promise resolved. Starting readiness polling...");
                     // Start the polling loop
                     checkReadyFrameId = requestAnimationFrame(checkVideoReady);
                     checkReadyRafRef.current = checkReadyFrameId;
                 }).catch(err => {
                     console.error("RealTimeMirror: video.play() failed:", err);
                     if (isMounted) { setCameraError("Could not play video stream."); setIsCameraLoading(false); }
                 });

            } else { /* ... cleanup stream ... */ }
        } catch (err) { /* ... error handling ... */ }
    };
    enableStream();

    // Cleanup
    return () => {
        isMounted = false; console.log("RealTimeMirror: Camera useEffect - Cleaning up.");
        cancelAnimationFrame(checkReadyRafRef.current); // Stop polling loop
        cancelAnimationFrame(animationFrameRef.current?.rafId); // Stop prediction loop
        const currentStream = videoStream || stream; currentStream?.getTracks().forEach(track => track.stop());
        console.log("   - MediaStream tracks stopped.");
        if (videoRef.current) { videoRef.current.onerror = null; videoRef.current.srcObject = null; console.log("   - videoRef cleared."); }
        setVideoStream(null); setIsCameraLoading(true); setCameraError(null); setVideoDimensions({ width: 0, height: 0 });
    };
   }, [faceLandmarker]); // Re-run on landmarker change


  // Prediction Loop Callback (No changes needed)
  const predictWebcam = useCallback(() => {
      animationFrameRef.current.rafId = requestAnimationFrame(predictWebcam);
      animationFrameRef.current.count++;
      if (!faceLandmarker || !imageSegmenter || !videoRef.current || !videoRef.current.srcObject?.active) { // Check stream activity?
          // Maybe add readyState check back if needed?
          // if (!videoRef.current || videoRef.current.readyState < 2) return;
          return;
      }
      const video = videoRef.current; const startTime = performance.now();
      try {
          const landmarkResults = faceLandmarker.detectForVideo(video, startTime);
          const segmentationResults = imageSegmenter.segmentForVideo(video, startTime);
          setLatestLandmarkResults(landmarkResults);
          setLatestSegmentationResults(segmentationResults);
      } catch (error) { console.error(`PredictWebcam Error:`, error); setLatestLandmarkResults(null); setLatestSegmentationResults(null); setCameraError("AI Prediction Failed."); setIsCameraLoading(false); cancelAnimationFrame(animationFrameRef.current.rafId); }
  }, [faceLandmarker, imageSegmenter]);


  // Effect to manage loop start/stop - Trigger when video is ready (isCameraLoading is false)
  useEffect(() => {
       if (videoStream && faceLandmarker && imageSegmenter && !isCameraLoading && cameraError === null) {
           console.log("RealTimeMirror: Starting prediction loop (Models & Video Ready via Polling).");
           cancelAnimationFrame(animationFrameRef.current?.rafId);
           animationFrameRef.current.count = 0;
           animationFrameRef.current.rafId = requestAnimationFrame(predictWebcam);
       } else {
           cancelAnimationFrame(animationFrameRef.current?.rafId);
       }
       return () => { cancelAnimationFrame(animationFrameRef.current?.rafId); };
   }, [videoStream, faceLandmarker, imageSegmenter, predictWebcam, isCameraLoading, cameraError]);


  // Determine if renderer should be shown
  const shouldRenderTryOn = !isCameraLoading && !cameraError; // Simplified - relies on polling setting isCameraLoading
  console.log("RealTimeMirror: Render() Check. isCameraLoading:", isCameraLoading, "cameraError:", cameraError, "shouldRenderTryOn:", shouldRenderTryOn);

  // JSX
  return (
    <div className="border p-4 rounded bg-blue-50 relative">
       <h2 className="text-xl font-semibold mb-2 text-center">Real-Time Mirror Mode</h2>
       {(isCameraLoading && !cameraError) && <p className="text-center py-4">Initializing Camera & AI...</p>}
       {cameraError && <p className="text-red-500 text-center py-4">{cameraError}</p>}
      <div className="relative w-full max-w-md mx-auto" style={{ paddingTop: `${videoDimensions.width > 0 ? (videoDimensions.height / videoDimensions.width) * 100 : 75}%` }}>
        <video ref={videoRef} autoPlay playsInline muted className="absolute top-0 left-0 -z-10" style={{width:'1px', height:'1px', opacity: 0.1}}/>
        {shouldRenderTryOn ? (
          <>
            {console.log("RealTimeMirror: Rendering TryOnRenderer...")}
            <TryOnRenderer
              videoRefProp={videoRef} imageElement={null}
              mediaPipeResults={latestLandmarkResults}
              segmentationResults={latestSegmentationResults}
              isStatic={false} effectIntensity={effectIntensity}
              className="absolute top-0 left-0 w-full h-full rounded shadow overflow-hidden"
            />
          </>
        ) : ( // Fallback UI
           <div className="absolute inset-0 flex items-center justify-center bg-gray-200 rounded shadow">
              <p className="text-gray-500">
                  {cameraError ? cameraError : 'Initializing...'}
              </p>
           </div>
        )}
      </div>
      {/* Optional Status Text */}
    </div>
  );
});
RealTimeMirror.displayName = 'RealTimeMirror';
export default RealTimeMirror;