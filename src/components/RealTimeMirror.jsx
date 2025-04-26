// src/components/RealTimeMirror.jsx - Add Camera State Logging (FULL CODE)

import React, { useRef, useEffect, useState, useCallback, forwardRef, useImperativeHandle } from 'react';
import TryOnRenderer from './TryOnRenderer'; // Bare-minimum shader

const RealTimeMirror = forwardRef(({
  faceLandmarker,
  effectIntensity
}, ref) => {
  console.log("RealTimeMirror rendering...");
  const videoRef = useRef(null); // For hidden video source
  const intermediateCanvasRef = useRef(null); // Ref for 2D canvas
  const animationFrameRef = useRef(null); // Ref for animation frame handle
  const [videoStream, setVideoStream] = useState(null); // State for the stream object
  const videoStreamRef = useRef(null); // Ref to hold current stream for loop check
  const [isCameraLoading, setIsCameraLoading] = useState(true); // State for loading indicator
  const [cameraError, setCameraError] = useState(null); // State for camera errors
  const [videoDimensions, setVideoDimensions] = useState({ width: 0, height: 0 }); // State for video dimensions
  const [latestResults, setLatestResults] = useState(null); // State for MediaPipe results

  // Effect to keep ref in sync with state
  useEffect(() => {
    videoStreamRef.current = videoStream;
    console.log("VideoStream Ref updated:", videoStreamRef.current ? 'Stream Set' : 'Stream Cleared');
  }, [videoStream]);

  // Imperative handle for parent (currently unused but kept for structure)
  useImperativeHandle(ref, () => ({
      // updateEffectIntensity: (intensity) => {
      //     // Parent now passes intensity directly as prop
      // }
  }));

  // Effect for camera access
  useEffect(() => {
    let isMounted = true;
    let stream = null;
    const enableStream = async () => {
        if (!faceLandmarker || !navigator.mediaDevices?.getUserMedia) {
             if (isMounted) { setCameraError("getUserMedia not supported or FaceLandmarker not ready."); setIsCameraLoading(false); }
             return;
        }
        console.log("Mirror: enableStream - Setting camera loading TRUE.");
        setIsCameraLoading(true); // Set loading before async call
        setCameraError(null);
        setVideoStream(null); // Clear previous stream state
        console.log("Mirror: enableStream - Requesting stream...");
        try {
            stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 720 } }, audio: false });
            console.log("Mirror: enableStream - Stream acquired.");
            if (isMounted && videoRef.current) {
                videoRef.current.srcObject = stream;
                console.log("Mirror: enableStream - Setting videoStream state.");
                setVideoStream(stream); // Update state

                videoRef.current.onloadedmetadata = () => {
                    console.log("Mirror: ONLOADEDMETADATA executing."); // *** Log execution ***
                    if (isMounted && videoRef.current) {
                        const vWidth = videoRef.current.videoWidth;
                        const vHeight = videoRef.current.videoHeight;
                        console.log(`Mirror: ONLOADEDMETADATA - Dims: ${vWidth}x${vHeight}`);
                        console.log("Mirror: ONLOADEDMETADATA - Setting videoDimensions state.");
                        setVideoDimensions({ width: vWidth, height: vHeight });
                        if (intermediateCanvasRef.current) {
                            intermediateCanvasRef.current.width = vWidth;
                            intermediateCanvasRef.current.height = vHeight;
                            console.log("Mirror: ONLOADEDMETADATA - Intermediate canvas size set.");
                        }
                        console.log("Mirror: ONLOADEDMETADATA - Setting camera loading FALSE.");
                        setIsCameraLoading(false); // *** Ensure this runs ***
                        console.log("Mirror: ONLOADEDMETADATA - Starting initial prediction loop.");
                        cancelAnimationFrame(animationFrameRef.current); // Use correct ref name
                        animationFrameRef.current = requestAnimationFrame(predictWebcam);
                    } else {
                         console.log("Mirror: ONLOADEDMETADATA - Unmounted or videoRef gone.");
                    }
                };
                videoRef.current.onerror = (e) => {
                    console.error("Mirror: Video Element Error:", e);
                    if(isMounted) {
                        setCameraError("Video element encountered an error.");
                        setIsCameraLoading(false); // Set loading false on error
                    }
                }
            } else {
                // If component unmounted quickly or videoRef gone, stop tracks
                console.log("Mirror: enableStream - Component unmounted or videoRef missing after stream aquisition. Stopping tracks.");
                stream?.getTracks().forEach(track => track.stop());
            }
        } catch (err) {
            console.error("Mirror: enableStream - Camera Error:", err);
            if (isMounted) {
                let message = "Failed to access camera.";
                if (err.name === "NotFoundError") message = "No camera found.";
                else if (err.name === "NotAllowedError") message = "Permission denied.";
                else if (err.name === "NotReadableError") message = "Camera in use or hardware error.";
                else if (err.name === "AbortError") message = "Camera request aborted.";
                else if (err.name === "OverconstrainedError") message = `Ideal resolution not supported: ${err.constraint}`;
                else message = `Camera Error: ${err.name}`;
                setCameraError(message);
                setIsCameraLoading(false); // Set loading false on error
            }
        }
    };

    enableStream(); // Call the async function

    // Cleanup function for the camera effect
    return () => {
      isMounted = false;
      console.log("Cleaning up RealTimeMirror (camera useEffect cleanup)...");
      cancelAnimationFrame(animationFrameRef.current); // Stop loop
      const currentStream = videoStreamRef.current; // Use ref for cleanup
      console.log("Stopping tracks for stream (cleanup):", currentStream ? 'Exists' : 'None');
      currentStream?.getTracks().forEach(track => {
          console.log(`Stopping track (cleanup): ${track.label} (${track.readyState})`);
          track.stop();
      });
      if (videoRef.current) {
          console.log("Resetting video srcObject (cleanup).");
          videoRef.current.srcObject = null;
          videoRef.current.onloadedmetadata = null;
          videoRef.current.onerror = null;
      }
      setVideoStream(null); // Clear state
      setLatestResults(null); // Clear results
      // No need to call renderer clearCanvas, TryOnRenderer handles its own cleanup now
      console.log("RealTimeMirror camera cleanup complete.");
    };
  }, [faceLandmarker]); // Re-run only when faceLandmarker changes


  // Prediction Loop Callback
  const predictWebcam = useCallback(() => {
    animationFrameRef.current = requestAnimationFrame(predictWebcam); // Schedule next

    // Check necessary refs/state
    if (!faceLandmarker || !videoRef.current || videoRef.current.readyState < 2 || !videoStreamRef.current || !intermediateCanvasRef.current ) {
        return; // Skip if not ready
    }

    const video = videoRef.current;
    const canvas = intermediateCanvasRef.current;
    const ctx = canvas.getContext('2d');

    try {
        // Draw video frame to intermediate canvas
        ctx.save();
        // No flipping needed here, TryOnRenderer handles mirroring based on isStatic prop
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        ctx.restore();

        // Detect on the intermediate canvas
        const results = faceLandmarker.detectForVideo(canvas, performance.now());
        setLatestResults(results); // Update state

    } catch (error) {
        console.error(`PredictWebcam: Error during draw/detection:`, error);
        setLatestResults(null);
    }
  }, [faceLandmarker]); // Only depends on landmarker


  // Effect to manage loop start/stop based on stream/landmarker state
  useEffect(() => {
       if (videoStream && faceLandmarker) {
            console.log("RealTimeMirror: Starting prediction loop (stream/landmarker ready).");
           cancelAnimationFrame(animationFrameRef.current);
           animationFrameRef.current = requestAnimationFrame(predictWebcam);
       } else {
           console.log("RealTimeMirror: Stopping prediction loop (stream/landmarker not ready).");
           cancelAnimationFrame(animationFrameRef.current);
       }
       // Cleanup for this specific effect
       return () => {
           console.log("RealTimeMirror: Cleaning up loop start/stop effect.");
           cancelAnimationFrame(animationFrameRef.current);
       };
   // Add predictWebcam back as dependency since it's called inside
   }, [videoStream, faceLandmarker, predictWebcam]);


  // --- JSX ---
  return (
    <div className="border p-4 rounded bg-blue-50 relative">
       <h2 className="text-xl font-semibold mb-2">Real-Time Mirror Mode</h2>
       {/* Show explicit loading/error text *outside* the main container if needed */}
        {isCameraLoading && !cameraError && <p className="text-center py-4">Starting camera...</p>}
        {cameraError && <p className="text-red-500 text-center py-4">{cameraError}</p>}

      <div className="relative w-full max-w-md mx-auto" style={{ paddingTop: `${videoDimensions.width > 0 ? (videoDimensions.height / videoDimensions.width) * 100 : 75}%` }}>
        {/* Hidden video element */}
        <video ref={videoRef} autoPlay playsInline muted className="absolute top-0 left-0 w-0 h-0 -z-10" />
        {/* Hidden Intermediate Canvas */}
        <canvas ref={intermediateCanvasRef} className="absolute top-0 left-0 w-0 h-0 -z-10" />

        {/* Conditionally render TryOnRenderer */}
        {!isCameraLoading && !cameraError && videoDimensions.width > 0 ? (
          <TryOnRenderer
            // Pass INTERMEDIATE CANVAS as imageElement
            videoElement={null}
            imageElement={intermediateCanvasRef.current} // Pass the canvas ref's current value
            mediaPipeResults={latestResults}
            isStatic={false} // Treat canvas source like static image for texture updates in renderer loop
            brightness={1.0} // Not used by bare-minimum shader
            contrast={1.0}   // Not used by bare-minimum shader
            effectIntensity={effectIntensity} // Pass intensity (even if not used by current shader)
            className="absolute top-0 left-0 w-full h-full rounded shadow overflow-hidden"
          />
        ) : (
           // Fallback UI - Show this ONLY if TryOnRenderer shouldn't render
           <div className="absolute inset-0 flex items-center justify-center bg-gray-200 rounded shadow">
              {/* Don't show "Loading Camera..." if there's an error */}
              <p className="text-gray-500">{cameraError ? 'Camera Error' : (isCameraLoading ? 'Loading Camera...' : 'Initializing...')}</p>
           </div>
        )}
      </div>
      {!faceLandmarker && <p className="text-red-500 mt-2 text-center">Waiting for AI Model...</p>}
    </div>
  );
});
RealTimeMirror.displayName = 'RealTimeMirror';
export default RealTimeMirror; // Line 219