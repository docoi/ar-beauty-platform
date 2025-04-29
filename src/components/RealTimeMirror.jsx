// src/components/RealTimeMirror.jsx - CORRECTED Fallback UI + REMOVED ImageSegmenter Logic

import React, { useRef, useEffect, useState, useCallback, forwardRef } from 'react';
import TryOnRenderer from './TryOnRenderer'; // Expecting the "Direct Rendering" version

const RealTimeMirror = forwardRef(({
  faceLandmarker, // Keep this
  // Removed imageSegmenter prop
  effectIntensity
}, ref) => {
  const videoRef = useRef(null);
  const animationFrameRef = useRef({ count: 0, rafId: null });
  const [videoStream, setVideoStream] = useState(null);
  const [isCameraLoading, setIsCameraLoading] = useState(true);
  const [cameraError, setCameraError] = useState(null);
  const [videoDimensions, setVideoDimensions] = useState({ width: 640, height: 480 });
  // Only need state for landmarker results now
  const [latestLandmarkResults, setLatestLandmarkResults] = useState(null);

  // Camera Access Effect
  useEffect(() => {
    let isMounted = true; let stream = null;
    const enableStream = async () => { if (!faceLandmarker || !navigator.mediaDevices?.getUserMedia) { if (isMounted) { setCameraError("getUserMedia not supported or FaceLandmarker not ready."); setIsCameraLoading(false); } return; } setIsCameraLoading(true); setCameraError(null); setVideoStream(null); try { stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 720 } }, audio: false }); if (isMounted && videoRef.current) { videoRef.current.srcObject = stream; setVideoStream(stream); videoRef.current.onloadedmetadata = () => { if (isMounted && videoRef.current) { console.log(`Mirror video dims: ${videoRef.current.videoWidth}x${videoRef.current.videoHeight}`); setVideoDimensions({ width: videoRef.current.videoWidth, height: videoRef.current.videoHeight }); setIsCameraLoading(false); console.log("RealTimeMirror: Metadata loaded."); } }; videoRef.current.onerror = (e) => { console.error("Mirror Mode: Video Element Error:", e); if(isMounted) setCameraError("Video element encountered an error."); setIsCameraLoading(false); }; } else { stream?.getTracks().forEach(track => track.stop()); } } catch (err) { console.error("Mirror Mode: enableStream - Camera Error:", err); if (isMounted) { let message = "Failed to access camera."; /* ... */ setCameraError(message); setIsCameraLoading(false); } } };
    enableStream();
    return () => { isMounted = false; /*console.log("Cleaning up RealTimeMirror Camera Effect...");*/ cancelAnimationFrame(animationFrameRef.current?.rafId); stream?.getTracks().forEach(track => track.stop()); if (videoRef.current) { videoRef.current.srcObject = null; videoRef.current.onloadedmetadata = null; videoRef.current.onerror = null; } setVideoStream(null); setIsCameraLoading(true); };
   }, [faceLandmarker]);

  // Prediction Loop Callback - Only run FaceLandmarker
  const predictWebcam = useCallback(() => {
    animationFrameRef.current.count = (animationFrameRef.current.count || 0) + 1;
    const frameCount = animationFrameRef.current.count;
    animationFrameRef.current.rafId = requestAnimationFrame(predictWebcam);
    if (!faceLandmarker || !videoRef.current || videoRef.current.readyState < 2 ) { return; }
    const video = videoRef.current; const startTime = performance.now();
    try {
      const landmarkResults = faceLandmarker.detectForVideo(video, startTime);
      // Log periodically
      // if (frameCount % 100 === 1) { console.log(`--- [Frame ${frameCount}] RealTimeMirror Results ---`); console.log(" -> landmarkResults:", landmarkResults); console.log(`-----------------------------------------`); }
      setLatestLandmarkResults(landmarkResults);
    } catch (error) { console.error(`PredictWebcam: Error during detection (Frame ${frameCount}):`, error); setLatestLandmarkResults(null); }
  }, [faceLandmarker]);


  // Effect to manage loop start/stop
  useEffect(() => {
       if (videoStream && faceLandmarker) { console.log("RealTimeMirror: Starting prediction loop (Landmarker Ready)."); cancelAnimationFrame(animationFrameRef.current?.rafId); animationFrameRef.current.count = 0; animationFrameRef.current.rafId = requestAnimationFrame(predictWebcam); } else { cancelAnimationFrame(animationFrameRef.current?.rafId); }
       return () => { cancelAnimationFrame(animationFrameRef.current?.rafId); };
   }, [videoStream, faceLandmarker, predictWebcam]);


  const shouldRenderTryOn = !isCameraLoading && !cameraError && videoDimensions.width > 0;

  // --- ***** JSX (Fallback UI Restored) ***** ---
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
            mediaPipeResults={latestLandmarkResults} // Pass only landmarks
            // Removed segmentationResults prop
            isStatic={false}
            brightness={1.0} contrast={1.0}
            effectIntensity={effectIntensity}
            className="absolute top-0 left-0 w-full h-full rounded shadow overflow-hidden"
          />
        ) : (
           // *** Restored Fallback UI Block ***
           <div className="absolute inset-0 flex items-center justify-center bg-gray-200 rounded shadow">
              <p className="text-gray-500">{cameraError ? 'Camera Error' : (isCameraLoading ? 'Loading Camera...' : 'Initializing...')}</p>
           </div>
           // **********************************
        )}
      </div>
      {!faceLandmarker && <p className="text-red-500 mt-2 text-center">Waiting for AI Model...</p>}
    </div>
  );
  // --- *************************************** ---

});
RealTimeMirror.displayName = 'RealTimeMirror';
export default RealTimeMirror;