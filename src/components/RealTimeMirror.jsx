import React, { useRef, useEffect, useState, useCallback } from 'react';
import TryOnRenderer from './TryOnRenderer'; // We'll create this component next

const RealTimeMirror = ({ faceLandmarker }) => {
  console.log("RealTimeMirror rendering...");
  const videoRef = useRef(null);
  const rendererRef = useRef(null); // Ref to control the renderer component
  const animationFrameRef = useRef(null);
  const [videoStream, setVideoStream] = useState(null);
  const [isCameraLoading, setIsCameraLoading] = useState(true);
  const [cameraError, setCameraError] = useState(null);
  const [videoDimensions, setVideoDimensions] = useState({ width: 640, height: 480 }); // Default

  // --- Camera Access ---
  useEffect(() => {
    let isMounted = true;
    let stream = null;

    const enableStream = async () => {
      if (!faceLandmarker || !navigator.mediaDevices?.getUserMedia) {
        console.warn("FaceLandmarker not ready or getUserMedia not supported.");
        if (isMounted) {
          setCameraError("getUserMedia not supported or FaceLandmarker not ready.");
          setIsCameraLoading(false);
        }
        return;
      }

      try {
        console.log("Requesting camera stream...");
        // Request a stream - use flexible constraints
        stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: 'user', // Prefer front camera
            // Optional: Add ideal width/height/aspectRatio if needed, but be flexible
             width: { ideal: 1280 },
             height: { ideal: 720 }
          },
          audio: false,
        });
        console.log("Camera stream acquired.");

        if (isMounted && videoRef.current) {
          videoRef.current.srcObject = stream;
          setVideoStream(stream); // Store the stream for cleanup
          // Wait for metadata to get actual dimensions
          videoRef.current.onloadedmetadata = () => {
            console.log("Video metadata loaded.");
             if (isMounted && videoRef.current) {
                console.log(`Actual video dimensions: ${videoRef.current.videoWidth}x${videoRef.current.videoHeight}`);
                setVideoDimensions({
                  width: videoRef.current.videoWidth,
                  height: videoRef.current.videoHeight,
                });
                setIsCameraLoading(false);
                // Start detection loop ONLY after metadata is loaded
                requestAnimationFrame(predictWebcam);
             }
          };
        } else {
            // Cleanup if component unmounted before stream assigned
             stream?.getTracks().forEach(track => track.stop());
        }

      } catch (err) {
        console.error("Error accessing camera:", err);
        if (isMounted) {
          let message = "Failed to access camera.";
           if (err.name === "NotFoundError" || err.name === "DevicesNotFoundError") {
              message = "No camera found. Please connect a camera.";
          } else if (err.name === "NotAllowedError" || err.name === "PermissionDeniedError") {
              message = "Camera permission denied. Please allow access.";
          } else if (err.name === "NotReadableError" || err.name === "TrackStartError") {
              message = "Camera is already in use or could not be started.";
          }
          setCameraError(message);
          setIsCameraLoading(false);
        }
      }
    };

    enableStream();

    // Cleanup function
    return () => {
      isMounted = false;
      console.log("Cleaning up RealTimeMirror: Stopping stream and animation.");
      cancelAnimationFrame(animationFrameRef.current);
      videoStream?.getTracks().forEach(track => track.stop()); // Use state variable
      if (videoRef.current) {
          videoRef.current.srcObject = null; // Release video element resource
          videoRef.current.onloadedmetadata = null; // Remove listener
      }
      setVideoStream(null);
    };
    // Re-run if faceLandmarker becomes available later (though unlikely with current setup)
  }, [faceLandmarker]);


  // --- MediaPipe Detection Loop ---
  const predictWebcam = useCallback(async () => {
    // Ensure everything is ready
    if (!faceLandmarker || !videoRef.current || videoRef.current.readyState < 2 || !rendererRef.current) {
       // If video is not ready, wait a bit and try again
       if(videoRef.current && videoRef.current.readyState < 2) {
          console.log("Video not ready, retrying frame...");
          animationFrameRef.current = requestAnimationFrame(predictWebcam);
       } else if (!rendererRef.current) {
           console.log("Renderer not ready, retrying frame...");
           animationFrameRef.current = requestAnimationFrame(predictWebcam);
       } else {
           console.log("Prerequisites not met for prediction.");
           // Optionally schedule another frame if landmarker is expected soon
           // animationFrameRef.current = requestAnimationFrame(predictWebcam);
       }
      return;
    }

    const video = videoRef.current;
    const startTimeMs = performance.now();

    // Use detectForVideo for continuous processing
    const results = faceLandmarker.detectForVideo(video, startTimeMs);

    // Pass results to the Renderer component instance
    if (results && rendererRef.current) {
        rendererRef.current.renderResults(video, results);
    } else {
        // If no results, maybe clear the canvas or draw just the video
        // rendererRef.current?.clearCanvas();
    }


    // Loop recursively
    animationFrameRef.current = requestAnimationFrame(predictWebcam);

  }, [faceLandmarker]); // Dependency: faceLandmarker instance

  return (
    <div className="border p-4 rounded bg-blue-50 relative">
      <h2 className="text-xl font-semibold mb-2">Real-Time Mirror Mode</h2>

      {isCameraLoading && <p>Starting camera...</p>}
      {cameraError && <p className="text-red-500">{cameraError}</p>}

      {/* We need a container for positioning */}
      <div className="relative w-full" style={{ paddingTop: `${(videoDimensions.height / videoDimensions.width) * 100}%` /* Maintain aspect ratio */ }}>
        {/* Hidden video element to capture the stream */}
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted // Muted is important for autoplay policies
          className="absolute top-0 left-0 w-full h-full opacity-0 pointer-events-none -z-10"
          style={{ transform: 'scaleX(-1)' }} // Flip video horizontally for mirror effect
        ></video>

        {/* Visible TryOnRenderer Component */}
        {/* Render only when video dimensions are known */}
        {!isCameraLoading && !cameraError && videoDimensions.width > 0 && (
          <TryOnRenderer
            ref={rendererRef} // Assign ref
            videoWidth={videoDimensions.width}
            videoHeight={videoDimensions.height}
            className="absolute top-0 left-0 w-full h-full"
          />
        )}

      </div>

      {!faceLandmarker && <p className="text-red-500 mt-2">Waiting for FaceLandmarker...</p>}
    </div>
  );
};

export default RealTimeMirror;