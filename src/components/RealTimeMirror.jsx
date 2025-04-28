// src/components/RealTimeMirror.jsx - CORRECTED SYNTAX + Run BOTH Landmarker and Segmenter

import React, { useRef, useEffect, useState, useCallback, forwardRef } from 'react';
import TryOnRenderer from './TryOnRenderer'; // Expects the version with detailed mask logging

const RealTimeMirror = forwardRef(({
  faceLandmarker,
  imageSegmenter, // <<< Accept segmenter prop
  effectIntensity
}, ref) => {
  const videoRef = useRef(null); // Ref for the hidden video element
  const animationFrameRef = useRef({ count: 0, rafId: null }); // Ref for loop and counter
  const [videoStream, setVideoStream] = useState(null);
  const [isCameraLoading, setIsCameraLoading] = useState(true);
  const [cameraError, setCameraError] = useState(null);
  const [videoDimensions, setVideoDimensions] = useState({ width: 640, height: 480 });
  // --- Separate state for results ---
  const [latestLandmarkResults, setLatestLandmarkResults] = useState(null); // For landmarks/blendshapes if needed
  const [latestSegmentationResults, setLatestSegmentationResults] = useState(null); // <<< New state for segmentation results
  // ----------------------------------

  // ***** CORRECTED Camera Access Effect (Original RealTimeMirror Logic) *****
  useEffect(() => {
    let isMounted = true;
    let stream = null; // Local stream variable for cleanup

    const enableStream = async () => {
      // Ensure FaceLandmarker is ready (Segmenter isn't needed for camera start)
      if (!faceLandmarker || !navigator.mediaDevices?.getUserMedia) {
        if (isMounted) {
          setCameraError("getUserMedia not supported or FaceLandmarker not ready.");
          setIsCameraLoading(false);
        }
        return;
      }

      setIsCameraLoading(true);
      setCameraError(null);
      setVideoStream(null); // Clear previous stream state

      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 720 } },
          audio: false
        });

        if (isMounted && videoRef.current) {
          videoRef.current.srcObject = stream;
          setVideoStream(stream); // Set the state for the prediction loop dependency

          videoRef.current.onloadedmetadata = () => {
            if (isMounted && videoRef.current) {
              console.log(`Mirror video dims: ${videoRef.current.videoWidth}x${videoRef.current.videoHeight}`);
              setVideoDimensions({
                width: videoRef.current.videoWidth,
                height: videoRef.current.videoHeight
              });
              setIsCameraLoading(false); // Camera ready
              // Prediction loop will start based on videoStream state change
              console.log("RealTimeMirror: Metadata loaded.");
            }
          };

          videoRef.current.onerror = (e) => {
            console.error("Mirror Mode: Video Element Error:", e);
            if (isMounted) {
              setCameraError("Video element encountered an error.");
              setIsCameraLoading(false);
            }
          };
        } else {
          // Stop tracks if component unmounted before assignment
          stream?.getTracks().forEach(track => track.stop());
        }
      } catch (err) {
        console.error("Mirror Mode: enableStream - Camera Error:", err);
        if (isMounted) {
          let message = "Failed to access camera."; /* ... specific errors ... */
          setCameraError(message);
          setIsCameraLoading(false);
        }
      }
    };

    enableStream();

    // Cleanup function
    return () => {
      isMounted = false;
      console.log("Cleaning up RealTimeMirror Camera Effect...");
      cancelAnimationFrame(animationFrameRef.current?.rafId);

      // Use the local stream variable for cleanup
      stream?.getTracks().forEach(track => {
        // console.log(`Stopping track: ${track.label}`);
        track.stop();
      });

      // Clean up video element
      if (videoRef.current) {
        videoRef.current.srcObject = null;
        videoRef.current.onloadedmetadata = null;
        videoRef.current.onerror = null;
      }
      setVideoStream(null);
      setIsCameraLoading(true); // Reset loading state
    };
    // Depend only on faceLandmarker readiness (runs once after landmarker is available)
  }, [faceLandmarker]); // <<< CORRECT Dependency
  // ***********************************************************************


  // Prediction Loop Callback - Run BOTH tasks
  const predictWebcam = useCallback(() => { // Removed async as detect/segmentForVideo are sync
    animationFrameRef.current.count = (animationFrameRef.current.count || 0) + 1;
    const frameCount = animationFrameRef.current.count;
    // Request next frame FIRST
    animationFrameRef.current.rafId = requestAnimationFrame(predictWebcam);

    if (!faceLandmarker || !imageSegmenter || !videoRef.current || videoRef.current.readyState < 2 ) { return; }
    const video = videoRef.current;
    const startTime = performance.now();

    try {
      // Run BOTH detection tasks
      const landmarkResults = faceLandmarker.detectForVideo(video, startTime);
      const segmentationResults = imageSegmenter.segmentForVideo(video, startTime); // <<< Run segmentation

      // Log results periodically
      if (frameCount % 100 === 1) { // Log on frame 1 and then every 100 frames
          console.log(`--- [Frame ${frameCount}] RealTimeMirror Results ---`);
          console.log(" -> landmarkResults:", landmarkResults);
          console.log(" -> segmentationResults:", segmentationResults); // <<< Log new results
          if (segmentationResults?.confidenceMasks) {
               console.log(" -> segmentationResults.confidenceMasks:", segmentationResults.confidenceMasks);
               if(segmentationResults.confidenceMasks.length > 0 && segmentationResults.confidenceMasks[0]) {
                    const mask = segmentationResults.confidenceMasks[0]; // Get the first mask object
                    console.log(" -> Mask 0 Type:", mask?.constructor?.name); // Log mask object type
                    // Access the actual mask data via .mask property (MediaPipe v0.10+)
                    console.log(" -> Mask 0 Data Type:", mask?.mask?.constructor?.name);
                    console.log(" -> Mask 0 Dims:", `${mask?.width}x${mask?.height}`);
               } else {
                    console.log(" -> segmentationResults: confidenceMasks array is empty.");
               }
          } else {
               console.log(" -> segmentationResults: confidenceMasks not found.");
          }
          console.log(`-----------------------------------------`);
      }

      // Update BOTH state variables
      setLatestLandmarkResults(landmarkResults);
      setLatestSegmentationResults(segmentationResults); // <<< Update segmentation state
    }
    catch (error) {
       console.error(`PredictWebcam: Error during detection/segmentation (Frame ${frameCount}):`, error);
       setLatestLandmarkResults(null);
       setLatestSegmentationResults(null);
    }
  }, [faceLandmarker, imageSegmenter]); // <<< Add imageSegmenter dependency


  // Effect to manage loop start/stop
  useEffect(() => {
       if (videoStream && faceLandmarker && imageSegmenter) { // Depend on both models now
           console.log("RealTimeMirror: Starting prediction loop (All Models Ready).");
           cancelAnimationFrame(animationFrameRef.current?.rafId);
           animationFrameRef.current.count = 0;
           animationFrameRef.current.rafId = requestAnimationFrame(predictWebcam);
       } else {
           cancelAnimationFrame(animationFrameRef.current?.rafId);
       }
       return () => { cancelAnimationFrame(animationFrameRef.current?.rafId); };
   }, [videoStream, faceLandmarker, imageSegmenter, predictWebcam]); // <<< Add imageSegmenter dependency


  const shouldRenderTryOn = !isCameraLoading && !cameraError && videoDimensions.width > 0;

  // --- JSX --- (Corrected structure)
  return (
    <div className="border p-4 rounded bg-blue-50 relative">
       <h2 className="text-xl font-semibold mb-2 text-center">Real-Time Mirror Mode</h2>
       {isCameraLoading && <p className="text-center py-4">Starting camera...</p>}
       {cameraError && <p className="text-red-500 text-center py-4">{cameraError}</p>}
      {/* Container for aspect ratio */}
      <div className="relative w-full max-w-md mx-auto" style={{ paddingTop: `${videoDimensions.width > 0 ? (videoDimensions.height / videoDimensions.width) * 100 : 75}%` }}>
        {/* Hidden video element */}
        <video ref={videoRef} autoPlay playsInline muted className="absolute top-0 left-0 w-0 h-0 -z-10" />

        {/* Conditional rendering of TryOnRenderer or fallback */}
        {shouldRenderTryOn ? (
          <TryOnRenderer
            videoRefProp={videoRef}
            imageElement={null}
            mediaPipeResults={latestLandmarkResults} // Pass landmark results (or null)
            segmentationResults={latestSegmentationResults} // <<< Pass NEW segmentation results
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
        )} {/* End of conditional rendering block */}
      </div> {/* End of container div */}

      {/* Check if BOTH models are ready */}
      {(!faceLandmarker || !imageSegmenter) && <p className="text-red-500 mt-2 text-center">Waiting for AI Models...</p>}

    </div> // End of main component div
  ); // End of return

}); // End of forwardRef

RealTimeMirror.displayName = 'RealTimeMirror';
export default RealTimeMirror;