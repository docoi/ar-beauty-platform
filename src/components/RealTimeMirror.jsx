// src/components/RealTimeMirror.jsx - CORRECTED Camera Logic + Results Logging

import React, { useRef, useEffect, useState, useCallback, forwardRef } from 'react';
import TryOnRenderer from './TryOnRenderer'; // Expects the version with detailed mask logging

const RealTimeMirror = forwardRef(({
  faceLandmarker,
  effectIntensity
}, ref) => {
  const videoRef = useRef(null); // Correct ref for the hidden video element
  const animationFrameRef = useRef({ count: 0, rafId: null }); // Initialize ref object
  const [videoStream, setVideoStream] = useState(null); // Correct state setter
  const [isCameraLoading, setIsCameraLoading] = useState(true);
  const [cameraError, setCameraError] = useState(null);
  const [videoDimensions, setVideoDimensions] = useState({ width: 640, height: 480 }); // Correct state setter
  const [latestResults, setLatestResults] = useState(null);

  // ***** CORRECTED Camera Access Effect *****
  useEffect(() => {
    let isMounted = true;
    let stream = null; // Keep stream variable local to the effect scope

    const enableStream = async () => {
      // Check faceLandmarker readiness first
      if (!faceLandmarker || !navigator.mediaDevices?.getUserMedia) {
        if (isMounted) {
          setCameraError("getUserMedia not supported or FaceLandmarker not ready.");
          setIsCameraLoading(false);
        }
        return;
      }

      // Set loading states
      setIsCameraLoading(true);
      setCameraError(null);
      setVideoStream(null); // Clear previous stream state

      try {
        // Request camera stream
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 720 } },
          audio: false
        });

        // If component is still mounted and video element exists...
        if (isMounted && videoRef.current) {
          videoRef.current.srcObject = stream; // Use correct videoRef
          setVideoStream(stream); // Use correct state setter

          // Handle metadata loading
          videoRef.current.onloadedmetadata = () => {
            if (isMounted && videoRef.current) {
              console.log(`Mirror video dims: ${videoRef.current.videoWidth}x${videoRef.current.videoHeight}`);
              setVideoDimensions({ // Use correct state setter
                width: videoRef.current.videoWidth,
                height: videoRef.current.videoHeight
              });
              setIsCameraLoading(false); // Camera is ready
              console.log("RealTimeMirror: Metadata loaded, starting prediction loop.");
              // Loop will be started/restarted by the other useEffect hook reacting to videoStream state change
            }
          };

          // Handle potential video errors
          videoRef.current.onerror = (e) => {
            console.error("Mirror Mode: Video Element Error:", e);
            if (isMounted) {
              setCameraError("Video element encountered an error.");
              setIsCameraLoading(false);
            }
          };

        } else {
          // Component unmounted or videoRef missing after stream acquired, stop tracks
          stream?.getTracks().forEach(track => track.stop());
        }
      } catch (err) {
        console.error("Mirror Mode: enableStream - Camera Error:", err);
        if (isMounted) {
          let message = "Failed to access camera.";
          if (err.name === "NotAllowedError") message = "Camera permission denied.";
          else if (err.name === "NotFoundError") message = "No camera found.";
          else if (err.name === "NotReadableError") message = "Camera already in use or hardware error.";
          setCameraError(message);
          setIsCameraLoading(false);
        }
      }
    };

    // Call enableStream when the component mounts or faceLandmarker is ready
    enableStream();

    // Cleanup function
    return () => {
      isMounted = false;
      console.log("Cleaning up RealTimeMirror Camera Effect...");
      cancelAnimationFrame(animationFrameRef.current?.rafId); // Stop prediction loop if running

      // Use the stream variable captured in the effect's closure for cleanup
      // or fallback to the state variable if needed (though stream variable should be sufficient)
      const currentStream = stream || videoStream;
      currentStream?.getTracks().forEach(track => {
        console.log(`Stopping track: ${track.label}`);
        track.stop();
      });

      // Clean up video element
      if (videoRef.current) {
        videoRef.current.srcObject = null;
        videoRef.current.onloadedmetadata = null;
        videoRef.current.onerror = null;
      }
      // Clear state variables related to the stream
      setVideoStream(null);
      setIsCameraLoading(true); // Reset loading state for potential remount/retry
    };
    // Depend only on faceLandmarker readiness (runs once after landmarker is available)
  }, [faceLandmarker]);
  // ******************************************


  // Prediction Loop Callback - UNCONDITIONAL LOGGING
  const predictWebcam = useCallback(() => {
    animationFrameRef.current.count = (animationFrameRef.current.count || 0) + 1;
    const frameCount = animationFrameRef.current.count;
    animationFrameRef.current.rafId = requestAnimationFrame(predictWebcam);

    if (!faceLandmarker || !videoRef.current || videoRef.current.readyState < 2 ) { return; }
    const video = videoRef.current;
    let results = null;

    try {
      const startTime = performance.now();
      results = faceLandmarker.detectForVideo(video, startTime);

      // UNCONDITIONAL LOGGING for the first 20 frames
      if (results && frameCount <= 20) {
          console.log(`--- [Frame ${frameCount}] RealTimeMirror: detectForVideo results ---`, results);
          if (results.segmentationMasks) {
              console.log(` -> [Frame ${frameCount}] segmentationMasks:`, results.segmentationMasks);
              if (results.segmentationMasks.length > 0 && results.segmentationMasks[0]) {
                   const maskData = results.segmentationMasks[0]?.maskData;
                   console.log(` -> [Frame ${frameCount}] maskData type: ${maskData?.constructor?.name}, instanceof WebGLTexture: ${maskData instanceof WebGLTexture}`);
              } else { console.log(` -> [Frame ${frameCount}] segmentationMasks: Array is empty.`); }
          } else { console.log(` -> [Frame ${frameCount}] segmentationMasks: Not found in results.`); }
          console.log(`-----------------------------------------`);
      }

      setLatestResults(results);
    }
    catch (error) {
       console.error(`PredictWebcam: Error during faceLandmarker.detectForVideo (Frame ${frameCount}):`, error);
       setLatestResults(null);
    }
  }, [faceLandmarker]);


  // Effect to manage loop start/stop
  useEffect(() => {
       if (videoStream && faceLandmarker) {
           console.log("RealTimeMirror: Starting prediction loop (triggered by videoStream/faceLandmarker).");
           cancelAnimationFrame(animationFrameRef.current?.rafId);
           animationFrameRef.current.count = 0;
           animationFrameRef.current.rafId = requestAnimationFrame(predictWebcam);
       } else {
           // Stop loop if stream or landmarker is not ready
           cancelAnimationFrame(animationFrameRef.current?.rafId);
       }
       return () => {
           // Cleanup: stop loop when dependencies change or component unmounts
           cancelAnimationFrame(animationFrameRef.current?.rafId);
       };
   }, [videoStream, faceLandmarker, predictWebcam]); // Dependencies that control the loop


  const shouldRenderTryOn = !isCameraLoading && !cameraError && videoDimensions.width > 0;

  // --- JSX ---
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
            mediaPipeResults={latestResults}
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
        )}
      </div>
      {!faceLandmarker && <p className="text-red-500 mt-2 text-center">Waiting for AI Model...</p>}
    </div>
  );
});
RealTimeMirror.displayName = 'RealTimeMirror';
export default RealTimeMirror;