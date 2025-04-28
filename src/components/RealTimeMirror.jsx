// src/components/RealTimeMirror.jsx - Run BOTH Landmarker and Segmenter

import React, { useRef, useEffect, useState, useCallback, forwardRef } from 'react';
import TryOnRenderer from './TryOnRenderer';

const RealTimeMirror = forwardRef(({
  faceLandmarker,
  imageSegmenter, // <<< Accept segmenter prop
  effectIntensity
}, ref) => {
  const videoRef = useRef(null);
  const animationFrameRef = useRef({ count: 0, rafId: null });
  const [videoStream, setVideoStream] = useState(null);
  const [isCameraLoading, setIsCameraLoading] = useState(true);
  const [cameraError, setCameraError] = useState(null);
  const [videoDimensions, setVideoDimensions] = useState({ width: 640, height: 480 });
  // --- Separate state for results ---
  const [latestLandmarkResults, setLatestLandmarkResults] = useState(null);
  const [latestSegmentationResults, setLatestSegmentationResults] = useState(null); // <<< New state for segmentation
  // ----------------------------------

  // Camera Access Effect (No changes needed)
  useEffect(() => { /* ... (Keep original camera logic) ... */ }, [faceLandmarker]); // Dependency might not be needed if checking inside loop

  // Prediction Loop Callback - Run BOTH tasks
  const predictWebcam = useCallback(async () => { // Make async if segmenter is async (it usually isn't for video)
    animationFrameRef.current.count = (animationFrameRef.current.count || 0) + 1;
    const frameCount = animationFrameRef.current.count;
    animationFrameRef.current.rafId = requestAnimationFrame(predictWebcam);

    // Check models and video are ready
    if (!faceLandmarker || !imageSegmenter || !videoRef.current || videoRef.current.readyState < 2 ) {
         // Log if models aren't ready periodically
         if(frameCount % 100 === 1) console.warn("PredictWebcam: Models or video not ready.");
         return;
    }
    const video = videoRef.current;
    const startTime = performance.now();

    try {
      // --- Run BOTH detection tasks ---
      // Note: Running them sequentially. Could potentially run in parallel if performance critical.
      const landmarkResults = faceLandmarker.detectForVideo(video, startTime);
      const segmentationResults = imageSegmenter.segmentForVideo(video, startTime); // <<< Run segmentation
      // --------------------------------

      // *** Log results separately (periodically) ***
      if (frameCount % 100 === 1) {
          console.log(`--- [Frame ${frameCount}] RealTimeMirror Results ---`);
          console.log(" -> landmarkResults:", landmarkResults);
          console.log(" -> segmentationResults:", segmentationResults); // <<< Log new results
          if (segmentationResults?.confidenceMasks) { // Check for confidenceMasks (based on config)
               console.log(" -> segmentationResults.confidenceMasks:", segmentationResults.confidenceMasks);
               if(segmentationResults.confidenceMasks.length > 0) {
                    console.log(" -> Mask 0 Type:", segmentationResults.confidenceMasks[0]?.mask?.constructor?.name); // Check the actual mask data type
                    console.log(" -> Mask 0 Dims:", `${segmentationResults.confidenceMasks[0]?.width}x${segmentationResults.confidenceMasks[0]?.height}`);
               }
          } else {
               console.log(" -> segmentationResults: confidenceMasks not found.");
          }
          console.log(`-----------------------------------------`);
      }
      // *******************************************

      // --- Update BOTH state variables ---
      setLatestLandmarkResults(landmarkResults);
      setLatestSegmentationResults(segmentationResults); // <<< Update segmentation state
      // ---------------------------------
    }
    catch (error) {
       console.error(`PredictWebcam: Error during detection/segmentation (Frame ${frameCount}):`, error);
       setLatestLandmarkResults(null);
       setLatestSegmentationResults(null); // Clear both on error
    }
  }, [faceLandmarker, imageSegmenter]); // <<< Add imageSegmenter dependency


  // Effect to manage loop start/stop
  useEffect(() => {
       // Now depends on both models being ready
       if (videoStream && faceLandmarker && imageSegmenter) {
           console.log("RealTimeMirror: Starting prediction loop (All Models Ready).");
           cancelAnimationFrame(animationFrameRef.current?.rafId);
           animationFrameRef.current.count = 0;
           animationFrameRef.current.rafId = requestAnimationFrame(predictWebcam);
       } else {
           cancelAnimationFrame(animationFrameRef.current?.rafId);
       }
       return () => { cancelAnimationFrame(animationFrameRef.current?.rafId); };
   // <<< Add imageSegmenter dependency
   }, [videoStream, faceLandmarker, imageSegmenter, predictWebcam]);


  const shouldRenderTryOn = !isCameraLoading && !cameraError && videoDimensions.width > 0;

  // --- JSX --- Pass BOTH results down
  return (
    <div className="border p-4 rounded bg-blue-50 relative">
       <h2 className="text-xl font-semibold mb-2">Real-Time Mirror Mode</h2>
       {isCameraLoading && <p className="text-center py-4">Starting camera...</p>}
       {cameraError && <p className="text-red-500 text-center py-4">{cameraError}</p>}
      <div className="relative w-full max-w-md mx-auto" style={{ paddingTop: `${videoDimensions.width > 0 ? (videoDimensions.height / videoDimensions.width) * 100 : 75}%` }}>
        <video ref={videoRef} autoPlay playsInline muted className="absolute top-0 left-0 w-0 h-0 -z-10" />
        {shouldRenderTryOn ? (
          <TryOnRenderer
            videoRefProp={videoRef}
            imageElement={null}
            // Pass landmark results (or null if not needed by renderer eventually)
            mediaPipeResults={latestLandmarkResults}
            // *** Pass segmentation results via NEW PROP ***
            segmentationResults={latestSegmentationResults}
            isStatic={false}
            brightness={1.0}
            contrast={1.0}
            effectIntensity={effectIntensity}
            className="absolute top-0 left-0 w-full h-full rounded shadow overflow-hidden"
          />
        ) : ( /* ... Fallback UI ... */ )}
      </div>
      {/* Update check message */}
      {(!faceLandmarker || !imageSegmenter) && <p className="text-red-500 mt-2 text-center">Waiting for AI Models...</p>}
    </div>
  );
});
RealTimeMirror.displayName = 'RealTimeMirror';
export default RealTimeMirror;