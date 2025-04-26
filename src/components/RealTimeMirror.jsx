// src/components/RealTimeMirror.jsx - COMPLETE - Prop-Driven, Passes videoRefProp

import React, { useRef, useEffect, useState, useCallback, forwardRef, useImperativeHandle } from 'react';
import TryOnRenderer from './TryOnRenderer'; // Expects prop-driven version

const RealTimeMirror = forwardRef(({
  faceLandmarker,
  effectIntensity
}, ref) => {
  console.log("RealTimeMirror rendering...");
  const videoRef = useRef(null); // Keep ref for the hidden video element
  const animationFrameRef = useRef(null);
  const [videoStream, setVideoStream] = useState(null);
  // const videoStreamRef = useRef(null); // No longer strictly needed by loop check
  const [isCameraLoading, setIsCameraLoading] = useState(true);
  const [cameraError, setCameraError] = useState(null);
  const [videoDimensions, setVideoDimensions] = useState({ width: 640, height: 480 });
  const [latestResults, setLatestResults] = useState(null);

  // No imperative handle needed by default now
  // useImperativeHandle(ref, () => ({ /* ... */ }));

  // Effect for camera access
   useEffect(() => {
    let isMounted = true; let stream = null;
    const enableStream = async () => { if (!faceLandmarker || !navigator.mediaDevices?.getUserMedia) { if (isMounted) { setCameraError("getUserMedia not supported or FaceLandmarker not ready."); setIsCameraLoading(false); } return; } setIsCameraLoading(true); setCameraError(null); setVideoStream(null); console.log("Mirror Mode: enableStream - Requesting stream..."); try { stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 720 } }, audio: false }); console.log("Mirror Mode: enableStream - Stream acquired."); if (isMounted && videoRef.current) { videoRef.current.srcObject = stream; setVideoStream(stream); /* << SET STATE */ videoRef.current.onloadedmetadata = () => { console.log("Mirror Mode: enableStream - Metadata loaded."); if (isMounted && videoRef.current) { console.log(`Mirror video dims: ${videoRef.current.videoWidth}x${videoRef.current.videoHeight}`); setVideoDimensions({ width: videoRef.current.videoWidth, height: videoRef.current.videoHeight }); setIsCameraLoading(false); console.log("RealTimeMirror: Starting initial prediction loop from onloadedmetadata."); cancelAnimationFrame(animationFrameRef.current); animationFrameRef.current = requestAnimationFrame(predictWebcam); } }; videoRef.current.onerror = (e) => { console.error("Mirror Mode: Video Element Error:", e); if(isMounted) setCameraError("Video element encountered an error."); setIsCameraLoading(false); } } else { console.log("Mirror Mode: enableStream - Component unmounted or videoRef missing after stream aquisition. Stopping tracks."); stream?.getTracks().forEach(track => track.stop()); } } catch (err) { console.error("Mirror Mode: enableStream - Camera Error:", err); if (isMounted) { let message = "Failed to access camera."; /* ... error messages ... */ setCameraError(message); setIsCameraLoading(false); } } }; enableStream();
    // Cleanup function
    return () => { isMounted = false; console.log("Cleaning up RealTimeMirror (useEffect cleanup)..."); cancelAnimationFrame(animationFrameRef.current); /* USE REF */ const currentStream = videoStream; /* Use state here for cleanup intent? */ console.log("Stopping tracks for stream:", currentStream ? 'Exists' : 'None'); currentStream?.getTracks().forEach(track => { console.log(`Stopping track: ${track.label} (${track.readyState})`); track.stop(); }); if (videoRef.current) { console.log("Resetting video srcObject."); videoRef.current.srcObject = null; videoRef.current.onloadedmetadata = null; videoRef.current.onerror = null; } setVideoStream(null); setLatestResults(null); /* Clear results */ console.log("RealTimeMirror cleanup complete."); };
  }, [faceLandmarker]); // Only depends on faceLandmarker


  // Prediction Loop Callback
  const predictWebcam = useCallback(() => {
    animationFrameRef.current = requestAnimationFrame(predictWebcam);
    // Check videoRef directly now
    if (!faceLandmarker || !videoRef.current || videoRef.current.readyState < 2 ) { return; }
    const video = videoRef.current;
    try { const results = faceLandmarker.detectForVideo(video, performance.now()); setLatestResults(results); }
    catch (error) { console.error(`PredictWebcam: Error during faceLandmarker.detectForVideo:`, error); setLatestResults(null); }
  }, [faceLandmarker]);


  // Effect to manage loop start/stop
  useEffect(() => {
       if (videoStream && faceLandmarker) {
            console.log("RealTimeMirror: Starting prediction loop (stream/landmarker ready).");
           cancelAnimationFrame(animationFrameRef.current);
           animationFrameRef.current = requestAnimationFrame(predictWebcam);
       } else {
           console.log("RealTimeMirror: Stopping prediction loop (stream/landmarker not ready).");
           cancelAnimationFrame(animationFrameRef.current);
       }
       return () => {
           console.log("RealTimeMirror: Cleaning up loop start/stop effect.");
           cancelAnimationFrame(animationFrameRef.current);
       };
   }, [videoStream, faceLandmarker, predictWebcam]);


  // Determine if TryOnRenderer should render
  const shouldRenderTryOn = !isCameraLoading && !cameraError && videoDimensions.width > 0;

  // --- JSX ---
  return (
    <div className="border p-4 rounded bg-blue-50 relative">
       <h2 className="text-xl font-semibold mb-2">Real-Time Mirror Mode</h2>
       {isCameraLoading && <p className="text-center py-4">Starting camera...</p>}
       {cameraError && <p className="text-red-500 text-center py-4">{cameraError}</p>}
      <div className="relative w-full max-w-md mx-auto" style={{ paddingTop: `${videoDimensions.width > 0 ? (videoDimensions.height / videoDimensions.width) * 100 : 75}%` }}>
        {/* Hidden video element IS needed */}
        <video ref={videoRef} autoPlay playsInline muted className="absolute top-0 left-0 w-0 h-0 -z-10" />

        {/* Use the simplified condition */}
        {shouldRenderTryOn ? (
          <TryOnRenderer
            // *** Pass videoRef itself as a prop ***
            videoRefProp={videoRef} // Pass the ref object
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