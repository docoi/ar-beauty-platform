// src/components/RealTimeMirror.jsx - Use Intermediate Canvas

import React, { useRef, useEffect, useState, useCallback, forwardRef, useImperativeHandle } from 'react';
import TryOnRenderer from './TryOnRenderer'; // Expects prop-driven version

const RealTimeMirror = forwardRef(({
  faceLandmarker,
  effectIntensity
}, ref) => {
  console.log("RealTimeMirror rendering...");
  const videoRef = useRef(null); // For hidden video source
  const intermediateCanvasRef = useRef(null); // *** ADDED: Ref for 2D canvas ***
  const animationFrameRef = useRef(null);
  const [videoStream, setVideoStream] = useState(null);
  const videoStreamRef = useRef(null);
  const [isCameraLoading, setIsCameraLoading] = useState(true);
  const [cameraError, setCameraError] = useState(null);
  const [videoDimensions, setVideoDimensions] = useState({ width: 640, height: 480 });
  const [latestResults, setLatestResults] = useState(null);

  // Effect to keep ref in sync with state
  useEffect(() => { videoStreamRef.current = videoStream; /* ... */ }, [videoStream]);
  // Imperative handle for parent
  useImperativeHandle(ref, () => ({ /* ... */ }));

  // Effect for camera access
  useEffect(() => {
    let isMounted = true; let stream = null;
    const enableStream = async () => { /* ... */ console.log("Mirror Mode: enableStream - Requesting stream..."); try { /* ... */ if (isMounted && videoRef.current) { videoRef.current.srcObject = stream; setVideoStream(stream); videoRef.current.onloadedmetadata = () => { console.log("Mirror Mode: enableStream - Metadata loaded."); if (isMounted && videoRef.current) { const vWidth = videoRef.current.videoWidth; const vHeight = videoRef.current.videoHeight; console.log(`Mirror video dims: ${vWidth}x${vHeight}`); setVideoDimensions({ width: vWidth, height: vHeight });
                    // *** ADDED: Set intermediate canvas size ***
                    if (intermediateCanvasRef.current) {
                        intermediateCanvasRef.current.width = vWidth;
                        intermediateCanvasRef.current.height = vHeight;
                        console.log("Intermediate canvas size set.");
                    }
                    // *** END ADDED ***
                    setIsCameraLoading(false); console.log("RealTimeMirror: Starting initial prediction loop from onloadedmetadata."); cancelAnimationFrame(animationFrameRef.current); animationFrameRef.current = requestAnimationFrame(predictWebcam); } }; /* ... error handler ... */ } else { /* ... */ } } catch (err) { /* ... */ } }; enableStream();
    return () => { /* ... cleanup ... */ };
  }, [faceLandmarker]);


  // Prediction Loop Callback (Draw to Canvas, Set State)
  const predictWebcam = useCallback(() => {
    animationFrameRef.current = requestAnimationFrame(predictWebcam); // Schedule next

    if (!faceLandmarker || !videoRef.current || videoRef.current.readyState < 2 || !videoStreamRef.current || !intermediateCanvasRef.current ) {
        return; // Skip if not ready
    }

    const video = videoRef.current;
    const canvas = intermediateCanvasRef.current; // Get the 2D canvas
    const ctx = canvas.getContext('2d');

    try {
        // *** ADDED: Draw video frame to intermediate canvas ***
        ctx.save();
        // Flip horizontally IF NEEDED (TryOnRenderer handles mirroring now)
        // ctx.scale(-1, 1);
        // ctx.translate(-canvas.width, 0);
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        ctx.restore();
        // *** END ADDED ***

        const results = faceLandmarker.detectForVideo(canvas, performance.now()); // Detect on canvas
        setLatestResults(results); // Update state

        // *** Notify TryOnRenderer that canvas updated (implicit via props) ***
        // The TryOnRenderer's renderLoop will pick up the intermediateCanvasRef.current

    } catch (error) {
        console.error(`PredictWebcam: Error during draw/detection:`, error);
        setLatestResults(null);
    }
  }, [faceLandmarker]); // Depends only on landmarker


  // Effect to manage loop start/stop
  useEffect(() => { /* ... same ... */ }, [videoStream, faceLandmarker, predictWebcam]);


  // --- JSX ---
  return (
    <div className="border p-4 rounded bg-blue-50 relative">
       <h2 className="text-xl font-semibold mb-2">Real-Time Mirror Mode</h2>
       {isCameraLoading && <p className="text-center py-4">Starting camera...</p>}
       {cameraError && <p className="text-red-500 text-center py-4">{cameraError}</p>}
      <div className="relative w-full max-w-md mx-auto" style={{ paddingTop: `${videoDimensions.width > 0 ? (videoDimensions.height / videoDimensions.width) * 100 : 75}%` }}>
        {/* Hidden video element */}
        <video ref={videoRef} autoPlay playsInline muted className="absolute top-0 left-0 w-0 h-0 -z-10" />
        {/* *** ADDED: Hidden Intermediate Canvas *** */}
        <canvas ref={intermediateCanvasRef} className="absolute top-0 left-0 w-0 h-0 -z-10" />
        {/* *** END ADDED *** */}

        {/* Conditionally render TryOnRenderer */}
        {!isCameraLoading && !cameraError && videoDimensions.width > 0 ? (
          <TryOnRenderer
            // *** CHANGED: Pass INTERMEDIATE CANVAS as imageElement ***
            videoElement={null}                     // No direct video element needed
            imageElement={intermediateCanvasRef.current} // Pass the canvas
            // *** END CHANGED ***
            mediaPipeResults={latestResults}
            isStatic={false} // Treat canvas source like static image for texture updates
            brightness={1.0}
            contrast={1.0}
            effectIntensity={effectIntensity}
            className="absolute top-0 left-0 w-full h-full rounded shadow overflow-hidden"
          />
        ) : (
           <div className="absolute inset-0 flex items-center justify-center bg-gray-200 rounded shadow">
              <p className="text-gray-500">{cameraError || (isCameraLoading ? 'Loading Camera...' : 'Initializing...')}</p>
           </div>
        )}
      </div>
      {!faceLandmarker && <p className="text-red-500 mt-2 text-center">Waiting for AI Model...</p>}
    </div>
  );
});
RealTimeMirror.displayName = 'RealTimeMirror';
export default RealTimeMirror;