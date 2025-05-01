// src/components/RealTimeMirror.jsx - Added Logging INSIDE predictWebcam (Corrected JSX)

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
  // const metadataLoadedRef = useRef(false); // No longer using event listeners

  // Camera Access Effect - Simpler, no event listeners needed here
  useEffect(() => {
    let isMounted = true;
    let stream = null;
    console.log("RealTimeMirror: Camera useEffect - Mounting/Running.");

    const enableStream = async () => {
        console.log("RealTimeMirror: enableStream called.");
        if (!faceLandmarker) { if (isMounted) { console.warn("RealTimeMirror: FaceLandmarker not ready."); setCameraError("AI models initializing..."); setIsCameraLoading(false); } return; }
        if (!navigator.mediaDevices?.getUserMedia) { if (isMounted) { console.error("RealTimeMirror: getUserMedia not supported."); setCameraError("getUserMedia not supported."); setIsCameraLoading(false); } return; }

        console.log("RealTimeMirror: Setting camera STARTING state (will wait for AI result for dimensions)...");
        setIsCameraLoading(true); setCameraError(null); setVideoStream(null); setVideoDimensions({ width: 0, height: 0 });
        animationFrameRef.current.hasGottenDims = false; // Reset flag

        try {
            console.log("RealTimeMirror: Calling getUserMedia...");
            stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 720 } }, audio: false });
            console.log("RealTimeMirror: getUserMedia SUCCESS.");

            if (isMounted && videoRef.current) {
                console.log("RealTimeMirror: Assigning stream to video element.");
                videoRef.current.srcObject = stream;
                setVideoStream(stream);

                 console.log("RealTimeMirror: Attempting videoRef.current.play()...");
                 videoRef.current.play().then(() => {
                     console.log("RealTimeMirror: video.play() promise resolved. Ready for prediction loop.");
                 }).catch(err => {
                     console.error("RealTimeMirror: video.play() failed:", err);
                     if (isMounted) { setCameraError("Could not play video stream."); setIsCameraLoading(false); }
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
        isMounted = false; console.log("RealTimeMirror: Camera useEffect - Cleaning up.");
        const currentStream = videoStream || stream; currentStream?.getTracks().forEach(track => track.stop());
        console.log("   - MediaStream tracks stopped.");
        if (videoRef.current) { videoRef.current.srcObject = null; console.log("   - videoRef srcObject cleared."); }
        cancelAnimationFrame(animationFrameRef.current?.rafId);
        setVideoStream(null); setIsCameraLoading(true); setCameraError(null); setVideoDimensions({ width: 0, height: 0 });
    };
   }, [faceLandmarker]);


  // Prediction Loop Callback - ADDED INTERNAL LOGGING
  const predictWebcam = useCallback(() => {
    animationFrameRef.current.rafId = requestAnimationFrame(predictWebcam);
    animationFrameRef.current.count++;
    const frameCount = animationFrameRef.current.count;
    const logThisFrame = frameCount <= 5 || frameCount % 60 === 0; // Log frequently at start

    // --- >>> ADDED LOGGING <<< ---
    if (logThisFrame) {
        console.log(`>>> predictWebcam Frame ${frameCount}: Checking conditions...`);
        console.log(`    - faceLandmarker ready?: ${!!faceLandmarker}`);
        console.log(`    - imageSegmenter ready?: ${!!imageSegmenter}`);
        console.log(`    - videoRef exists?: ${!!videoRef.current}`);
        if (videoRef.current) {
            console.log(`    - videoRef.readyState: ${videoRef.current.readyState}`);
        } else {
             console.log(`    - videoRef.readyState: N/A (videoRef null)`);
        }
    }
    // --- >>> END ADDED LOGGING <<< ---

    // Ensure models and video are ready
    if (!faceLandmarker || !imageSegmenter || !videoRef.current || videoRef.current.readyState < 2 ) { // HAVE_CURRENT_DATA = 2
        if (logThisFrame && animationFrameRef.current.rafId) console.log(`--- predictWebcam Frame ${frameCount}: EXITING - Conditions not met.`);
        return; // Exit if not ready
    }

     // If conditions are met, proceed
    if (logThisFrame) console.log(`--- predictWebcam Frame ${frameCount}: Conditions MET - Running detection...`);

    const video = videoRef.current;
    const startTime = performance.now();

    try {
        if (logThisFrame) console.log("    - Calling detectForVideo/segmentForVideo...");
        // Run predictions
        const landmarkResults = faceLandmarker.detectForVideo(video, startTime);
        const segmentationResults = imageSegmenter.segmentForVideo(video, startTime);
        if (logThisFrame) console.log("    - Detection calls complete.");

        // Get Dimensions from First Successful Landmark Result
        if (!animationFrameRef.current.hasGottenDims && landmarkResults?.image) {
            const width = landmarkResults.image.width; const height = landmarkResults.image.height;
            if (width > 0 && height > 0) {
                console.log(`<<<< RealTimeMirror: Got Dimensions from MediaPipe Result! (${width}x${height}) >>>>`);
                setVideoDimensions({ width, height }); setIsCameraLoading(false); animationFrameRef.current.hasGottenDims = true;
                console.log("     State updated: isCameraLoading=false, videoDimensions set from result.");
            } else { console.warn("     MediaPipe result present, but image dimensions are zero?"); }
        }

        // Update results state
        setLatestLandmarkResults(landmarkResults);
        setLatestSegmentationResults(segmentationResults);

        // Timeout check
       if (!animationFrameRef.current.hasGottenDims && frameCount > 200) { // Approx 3-4 seconds
            console.error("RealTimeMirror: Failed to get video dimensions from MediaPipe after 200 frames.");
            setCameraError("Could not determine video size."); setIsCameraLoading(false); cancelAnimationFrame(animationFrameRef.current.rafId);
       }

    } catch (error) {
        console.error(`PredictWebcam Error (Frame ${frameCount}):`, error);
        setLatestLandmarkResults(null); setLatestSegmentationResults(null);
        setCameraError("AI Prediction Failed."); setIsCameraLoading(false); cancelAnimationFrame(animationFrameRef.current.rafId);
    }
  }, [faceLandmarker, imageSegmenter]); // Depends on models


  // Effect to manage loop start/stop
  useEffect(() => {
       if (videoStream && faceLandmarker && imageSegmenter) {
           console.log("RealTimeMirror: Starting prediction loop (All Models Ready, waiting for first result for dims)...");
           cancelAnimationFrame(animationFrameRef.current?.rafId);
           animationFrameRef.current.count = 0;
           animationFrameRef.current.hasGottenDims = false;
           animationFrameRef.current.rafId = requestAnimationFrame(predictWebcam);
       } else {
           cancelAnimationFrame(animationFrameRef.current?.rafId);
       }
       return () => {
            console.log("RealTimeMirror: Prediction loop useEffect cleanup.");
            cancelAnimationFrame(animationFrameRef.current?.rafId);
       };
   }, [videoStream, faceLandmarker, imageSegmenter, predictWebcam]);


  // Determine if renderer should be shown
  const shouldRenderTryOn = !isCameraLoading && !cameraError && videoDimensions.width > 0;
  console.log("RealTimeMirror: Render() Check. isCameraLoading:", isCameraLoading, "cameraError:", cameraError, "videoDimensions:", videoDimensions, "shouldRenderTryOn:", shouldRenderTryOn);

  // *** Corrected JSX Return Block ***
  return (
    <div className="border p-4 rounded bg-blue-50 relative">
       <h2 className="text-xl font-semibold mb-2 text-center">Real-Time Mirror Mode</h2>
       {isCameraLoading && !cameraError && <p className="text-center py-4">Starting camera & AI...</p>}
       {cameraError && <p className="text-red-500 text-center py-4">{cameraError}</p>}

      <div className="relative w-full max-w-md mx-auto" style={{ paddingTop: `${videoDimensions.width > 0 ? (videoDimensions.height / videoDimensions.width) * 100 : 75}%` }}>
        {/* Video element still needed */}
        <video ref={videoRef} autoPlay playsInline muted className="absolute top-0 left-0 -z-10" style={{width:'1px', height:'1px', opacity: 0.1}}/>

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
              {!cameraError && !isCameraLoading && videoDimensions.width === 0 && console.log("RealTimeMirror: Rendering Fallback (Waiting for dimensions from AI)...")}
              {!cameraError && isCameraLoading && console.log("RealTimeMirror: Rendering Fallback (Camera Loading)...")}
              {cameraError && console.log("RealTimeMirror: Rendering Fallback (Error State)...")}
              <p className="text-gray-500">
                  {cameraError ? cameraError : (isCameraLoading ? 'Initializing Camera & AI...' : 'Processing first frame...')}
              </p>
           </div>
        )}
      </div>
      {(!faceLandmarker || !imageSegmenter) && !cameraError && !isCameraLoading && <p className="text-red-500 mt-2 text-center">AI Models loaded, waiting for camera...</p>}
    </div>
  );
  // *********************************

});
RealTimeMirror.displayName = 'RealTimeMirror';
export default RealTimeMirror;