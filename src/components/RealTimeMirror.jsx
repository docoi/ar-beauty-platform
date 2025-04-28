// src/components/RealTimeMirror.jsx - Stabilize Loop + Run BOTH Tasks

import React, { useRef, useEffect, useState, useCallback, forwardRef } from 'react';
import TryOnRenderer from './TryOnRenderer';

const RealTimeMirror = forwardRef(({
  faceLandmarker,
  imageSegmenter, // Accept segmenter prop
  effectIntensity
}, ref) => {
  const videoRef = useRef(null);
  const animationFrameRef = useRef({ count: 0, rafId: null });
  const [videoStream, setVideoStream] = useState(null);
  const [isCameraLoading, setIsCameraLoading] = useState(true);
  const [cameraError, setCameraError] = useState(null);
  const [videoDimensions, setVideoDimensions] = useState({ width: 640, height: 480 });
  const [latestLandmarkResults, setLatestLandmarkResults] = useState(null);
  const [latestSegmentationResults, setLatestSegmentationResults] = useState(null);

  // Camera Access Effect (Corrected Version)
  useEffect(() => {
    let isMounted = true; let stream = null;
    const enableStream = async () => { if (!faceLandmarker || !navigator.mediaDevices?.getUserMedia) { if (isMounted) { setCameraError("getUserMedia not supported or FaceLandmarker not ready."); setIsCameraLoading(false); } return; } setIsCameraLoading(true); setCameraError(null); setVideoStream(null); try { stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 720 } }, audio: false }); if (isMounted && videoRef.current) { videoRef.current.srcObject = stream; setVideoStream(stream); videoRef.current.onloadedmetadata = () => { if (isMounted && videoRef.current) { console.log(`Mirror video dims: ${videoRef.current.videoWidth}x${videoRef.current.videoHeight}`); setVideoDimensions({ width: videoRef.current.videoWidth, height: videoRef.current.videoHeight }); setIsCameraLoading(false); console.log("RealTimeMirror: Metadata loaded."); } }; videoRef.current.onerror = (e) => { console.error("Mirror Mode: Video Element Error:", e); if(isMounted) setCameraError("Video element encountered an error."); setIsCameraLoading(false); }; } else { stream?.getTracks().forEach(track => track.stop()); } } catch (err) { console.error("Mirror Mode: enableStream - Camera Error:", err); if (isMounted) { let message = "Failed to access camera."; /* ... */ setCameraError(message); setIsCameraLoading(false); } } };
    enableStream();
    return () => { isMounted = false; console.log("Cleaning up RealTimeMirror Camera Effect..."); cancelAnimationFrame(animationFrameRef.current?.rafId); stream?.getTracks().forEach(track => track.stop()); if (videoRef.current) { videoRef.current.srcObject = null; videoRef.current.onloadedmetadata = null; videoRef.current.onerror = null; } setVideoStream(null); setIsCameraLoading(true); };
  }, [faceLandmarker]); // Keep original dependency

  // Prediction Loop Callback - Run BOTH tasks
  const predictWebcam = useCallback(() => {
    animationFrameRef.current.count = (animationFrameRef.current.count || 0) + 1;
    const frameCount = animationFrameRef.current.count;
    animationFrameRef.current.rafId = requestAnimationFrame(predictWebcam);

    // Check models and video are ready *inside* the loop
    if (!faceLandmarker || !imageSegmenter || !videoRef.current || videoRef.current.readyState < 2 ) {
        // Don't log spam, just return if not ready
        return;
    }
    const video = videoRef.current;
    const startTime = performance.now();

    try {
      const landmarkResults = faceLandmarker.detectForVideo(video, startTime);
      const segmentationResults = imageSegmenter.segmentForVideo(video, startTime);

      // Log results periodically
      if (frameCount % 100 === 1) {
          console.log(`--- [Frame ${frameCount}] RealTimeMirror Results ---`);
          console.log(" -> landmarkResults:", landmarkResults);
          console.log(" -> segmentationResults:", segmentationResults);
          if (segmentationResults?.confidenceMasks) {
               console.log(" -> segmentationResults.confidenceMasks:", segmentationResults.confidenceMasks);
               if(segmentationResults.confidenceMasks.length > 0 && segmentationResults.confidenceMasks[0]) {
                    const mask = segmentationResults.confidenceMasks[0];
                    console.log(" -> Mask 0 Type:", mask?.constructor?.name);
                    console.log(" -> Mask 0 Data Type:", mask?.mask?.constructor?.name); // Check .mask property
                    console.log(" -> Mask 0 Dims:", `${mask?.width}x${mask?.height}`);
               } else { console.log(" -> segmentationResults: confidenceMasks array is empty."); }
          } else { console.log(" -> segmentationResults: confidenceMasks not found."); }
          console.log(`-----------------------------------------`);
      }
      setLatestLandmarkResults(landmarkResults);
      setLatestSegmentationResults(segmentationResults);
    }
    catch (error) { /* ... error handling ... */ }
  // Ensure dependencies include both models
  }, [faceLandmarker, imageSegmenter]);


  // Effect to manage loop start/stop - SIMPLIFIED Dependency
  useEffect(() => {
       // Start loop ONLY when camera stream is ready.
       // Checks for models happen inside the loop itself.
       if (videoStream) {
           console.log("RealTimeMirror: Starting prediction loop (videoStream ready).");
           cancelAnimationFrame(animationFrameRef.current?.rafId);
           animationFrameRef.current.count = 0;
           animationFrameRef.current.rafId = requestAnimationFrame(predictWebcam);
       } else {
           // Stop loop if stream stops
           cancelAnimationFrame(animationFrameRef.current?.rafId);
       }
       return () => { cancelAnimationFrame(animationFrameRef.current?.rafId); };
   // Depend ONLY on videoStream and the callback function itself
   }, [videoStream, predictWebcam]);


  const shouldRenderTryOn = !isCameraLoading && !cameraError && videoDimensions.width > 0;

  // JSX - Pass BOTH results down
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
            mediaPipeResults={latestLandmarkResults} // Keep passing landmarks (might be useful later)
            segmentationResults={latestSegmentationResults} // <<< Pass NEW segmentation results
            isStatic={false}
            brightness={1.0} contrast={1.0}
            effectIntensity={effectIntensity}
            className="absolute top-0 left-0 w-full h-full rounded shadow overflow-hidden"
          />
        ) : ( <div className="absolute inset-0 flex items-center justify-center bg-gray-200 rounded shadow"><p className="text-gray-500">{cameraError ? 'Camera Error' : (isCameraLoading ? 'Loading Camera...' : 'Initializing...')}</p></div> )}
      </div>
      {/* Keep check for models, but loop manages readiness internally */}
      {(!faceLandmarker || !imageSegmenter) && <p className="text-red-500 mt-2 text-center">Waiting for AI Models...</p>}
    </div>
  );
});
RealTimeMirror.displayName = 'RealTimeMirror';
export default RealTimeMirror;