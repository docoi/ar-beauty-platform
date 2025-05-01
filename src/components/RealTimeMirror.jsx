// src/components/RealTimeMirror.jsx - Get Dimensions from MediaPipe Results

import React, { useRef, useEffect, useState, useCallback, forwardRef } from 'react';
import TryOnRenderer from './TryOnRenderer'; // Expects the onBeforeCompile version

const RealTimeMirror = forwardRef(({
  faceLandmarker,
  imageSegmenter,
  effectIntensity
}, ref) => {
  const videoRef = useRef(null);
  const animationFrameRef = useRef({ count: 0, rafId: null, hasGottenDims: false }); // Add flag
  const [videoStream, setVideoStream] = useState(null);
  const [isCameraLoading, setIsCameraLoading] = useState(true); // Start true
  const [cameraError, setCameraError] = useState(null);
  const [videoDimensions, setVideoDimensions] = useState({ width: 0, height: 0 });
  const [latestLandmarkResults, setLatestLandmarkResults] = useState(null);
  const [latestSegmentationResults, setLatestSegmentationResults] = useState(null);

  // Camera Access Effect - Simpler, no event listeners needed here
  useEffect(() => {
    let isMounted = true;
    let stream = null;
    console.log("RealTimeMirror: Camera useEffect - Mounting/Running.");

    const enableStream = async () => {
        console.log("RealTimeMirror: enableStream called.");
        if (!faceLandmarker) { if (isMounted) { console.warn("RealTimeMirror: FaceLandmarker not ready."); setCameraError("AI models initializing..."); setIsCameraLoading(false); } return; } // Show error if AI isn't ready
        if (!navigator.mediaDevices?.getUserMedia) { if (isMounted) { console.error("RealTimeMirror: getUserMedia not supported."); setCameraError("getUserMedia not supported."); setIsCameraLoading(false); } return; }

        console.log("RealTimeMirror: Setting camera STARTING state (will wait for AI result for dimensions)...");
        setIsCameraLoading(true); // Keep true until AI gives dimensions
        setCameraError(null);
        setVideoStream(null);
        setVideoDimensions({ width: 0, height: 0 });
        animationFrameRef.current.hasGottenDims = false; // Reset flag

        try {
            console.log("RealTimeMirror: Calling getUserMedia...");
            stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 720 } }, audio: false });
            console.log("RealTimeMirror: getUserMedia SUCCESS.");

            if (isMounted && videoRef.current) {
                console.log("RealTimeMirror: Assigning stream to video element.");
                videoRef.current.srcObject = stream;
                setVideoStream(stream); // We still need the stream for prediction loop

                // Attempt to play video
                console.log("RealTimeMirror: Attempting videoRef.current.play()...");
                videoRef.current.play().then(() => {
                     console.log("RealTimeMirror: video.play() promise resolved. Ready for prediction loop.");
                     // Don't set loading false here, wait for first prediction
                 }).catch(err => {
                     console.error("RealTimeMirror: video.play() failed:", err);
                     if (isMounted) { setCameraError("Could not play video stream."); setIsCameraLoading(false); } // Show error if play fails
                 });

            } else {
                console.log("RealTimeMirror: Component unmounted or videoRef missing after getUserMedia success.");
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
        if (videoRef.current) { videoRef.current.srcObject = null; console.log("   - videoRef srcObject cleared."); }
        cancelAnimationFrame(animationFrameRef.current?.rafId); // Stop prediction loop too
        setVideoStream(null); setIsCameraLoading(true); setCameraError(null); setVideoDimensions({ width: 0, height: 0 });
    };
   }, [faceLandmarker]); // Only depends on landmarker for initial readiness


  // Prediction Loop Callback - Gets Dimensions from first result
  const predictWebcam = useCallback(() => {
    animationFrameRef.current.rafId = requestAnimationFrame(predictWebcam); // Request next frame first
    animationFrameRef.current.count++;
    const frameCount = animationFrameRef.current.count;

    // Ensure models and video are ready
    if (!faceLandmarker || !imageSegmenter || !videoRef.current || videoRef.current.readyState < 2 ) {
        // Optionally log if waiting long
        // if (frameCount % 100 === 0) console.log("predictWebcam waiting for models/video...");
        return;
    }

    const video = videoRef.current;
    const startTime = performance.now();

    try {
      // Run predictions
      const landmarkResults = faceLandmarker.detectForVideo(video, startTime);
      const segmentationResults = imageSegmenter.segmentForVideo(video, startTime);

      // --- Get Dimensions from First Successful Landmark Result ---
      if (!animationFrameRef.current.hasGottenDims && landmarkResults?.image) {
          const width = landmarkResults.image.width;
          const height = landmarkResults.image.height;
          if (width > 0 && height > 0) {
                console.log(`<<<< RealTimeMirror: Got Dimensions from MediaPipe Result! (${width}x${height}) >>>>`);
                setVideoDimensions({ width, height });
                setIsCameraLoading(false); // <<<--- Trigger rendering HERE
                animationFrameRef.current.hasGottenDims = true; // Set flag
                 console.log("     State updated: isCameraLoading=false, videoDimensions set from result.");
          } else {
               console.warn("     MediaPipe result present, but image dimensions are zero?");
          }
      }
      // -----------------------------------------------------------

      // Update results state regardless of dimensions being set yet
      setLatestLandmarkResults(landmarkResults);
      setLatestSegmentationResults(segmentationResults);

      // Add a timeout check: if dimensions not found after X frames, show error
       if (!animationFrameRef.current.hasGottenDims && frameCount > 200) { // Approx 3-4 seconds
            console.error("RealTimeMirror: Failed to get video dimensions from MediaPipe after 200 frames.");
            setCameraError("Could not determine video size.");
            setIsCameraLoading(false); // Stop loading, show error
            cancelAnimationFrame(animationFrameRef.current.rafId); // Stop loop
       }

    } catch (error) {
        console.error(`PredictWebcam Error (Frame ${frameCount}):`, error);
        setLatestLandmarkResults(null); setLatestSegmentationResults(null);
        // Optionally stop loop or set error state on prediction error
         setCameraError("AI Prediction Failed.");
         setIsCameraLoading(false);
         cancelAnimationFrame(animationFrameRef.current.rafId);
    }
  }, [faceLandmarker, imageSegmenter]); // Depends on models


  // Effect to manage loop start/stop
  useEffect(() => {
       // Start loop only when stream is ready AND models are ready
       // Dimensions will be handled *inside* the loop now
       if (videoStream && faceLandmarker && imageSegmenter) {
           console.log("RealTimeMirror: Starting prediction loop (All Models Ready, waiting for first result for dims)...");
           cancelAnimationFrame(animationFrameRef.current?.rafId); // Clear previous loops
           animationFrameRef.current.count = 0;
           animationFrameRef.current.hasGottenDims = false; // Reset flag
           animationFrameRef.current.rafId = requestAnimationFrame(predictWebcam); // Start
       } else {
            // Ensure loop is stopped if dependencies aren't met
           cancelAnimationFrame(animationFrameRef.current?.rafId);
       }
       // Cleanup function for this effect instance
       return () => {
            console.log("RealTimeMirror: Prediction loop useEffect cleanup.");
            cancelAnimationFrame(animationFrameRef.current?.rafId);
       };
   }, [videoStream, faceLandmarker, imageSegmenter, predictWebcam]); // Dependencies


  // Determine if renderer should be shown (logic remains the same)
  const shouldRenderTryOn = !isCameraLoading && !cameraError && videoDimensions.width > 0;
  console.log("RealTimeMirror: Render() Check. isCameraLoading:", isCameraLoading, "cameraError:", cameraError, "videoDimensions:", videoDimensions, "shouldRenderTryOn:", shouldRenderTryOn);

  // JSX
  return (
    <div className="border p-4 rounded bg-blue-50 relative">
       <h2 className="text-xl font-semibold mb-2 text-center">Real-Time Mirror Mode</h2>
       {/* Keep conditional rendering based on loading/error states */}
       {isCameraLoading && !cameraError && <p className="text-center py-4">Starting camera & AI...</p>}
       {cameraError && <p className="text-red-500 text-center py-4">{cameraError}</p>}

      <div className="relative w-full max-w-md mx-auto" style={{ paddingTop: `${videoDimensions.width > 0 ? (videoDimensions.height / videoDimensions.width) * 100 : 75}%` }}>
        {/* Make video slightly visible for debugging? Optional. */}
        <video ref={videoRef} autoPlay playsInline muted className="absolute top-0 left-0 -z-10" style={{width:'1px', height:'1px', opacity: 0.1}}/>

        {/* Render TryOnRenderer or fallback */}
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
        ) : ( // Fallback UI shows while !shouldRenderTryOn
           <div className="absolute inset-0 flex items-center justify-center bg-gray-200 rounded shadow">
              {!cameraError && !isCameraLoading && videoDimensions.width === 0 && console.log("RealTimeMirror: Rendering Fallback (Waiting for dimensions from AI)...")}
              {!cameraError && isCameraLoading && console.log("RealTimeMirror: Rendering Fallback (Camera Loading)...")}
              {cameraError && console.log("RealTimeMirror: Rendering Fallback (Error State)...")}

              <p className="text-gray-500">
                   {/* Display more informative message */}
                  {cameraError ? cameraError : (isCameraLoading ? 'Initializing Camera & AI...' : 'Processing first frame...')}
              </p>
           </div>
        )}
      </div>
      {(!faceLandmarker || !imageSegmenter) && !cameraError && !isCameraLoading && <p className="text-red-500 mt-2 text-center">AI Models loaded, waiting for camera...</p>}
    </div>
  );
});
RealTimeMirror.displayName = 'RealTimeMirror';
export default RealTimeMirror;