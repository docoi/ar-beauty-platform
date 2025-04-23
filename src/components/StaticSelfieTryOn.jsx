// src/components/StaticSelfieTryOn.jsx

import React, { useState, useRef, useEffect, useCallback } from 'react';
import TryOnRenderer from './TryOnRenderer'; // We will render this once selfie is taken

const StaticSelfieTryOn = ({ faceLandmarker }) => {
  console.log("StaticSelfieTryOn rendering...");

  // --- State ---
  const [isPreviewing, setIsPreviewing] = useState(true); // Start in preview mode
  const [cameraStream, setCameraStream] = useState(null);
  const [isCameraLoading, setIsCameraLoading] = useState(true);
  const [cameraError, setCameraError] = useState(null);
  const [capturedSelfieDataUrl, setCapturedSelfieDataUrl] = useState(null);
  const [detectedSelfieResults, setDetectedSelfieResults] = useState(null);
  const [selfieDimensions, setSelfieDimensions] = useState({ width: 0, height: 0 });
  const [isDetecting, setIsDetecting] = useState(false); // State for detection status
  const [debugInfo, setDebugInfo] = useState(''); // State for debugging info

  // --- Refs ---
  const selfieVideoRef = useRef(null);
  const rendererRef = useRef(null); // Ref for the renderer component
  const staticImageRef = useRef(null); // Ref for the loaded image element used for detection

  // --- Camera Access Logic (only when previewing) ---
  useEffect(() => {
    let isMounted = true;
    let stream = null;

    const enableStream = async () => {
      // Only run if in preview mode
      if (!isPreviewing || !faceLandmarker || !navigator.mediaDevices?.getUserMedia) {
        if (isPreviewing && !faceLandmarker) console.warn("Selfie Mode: FaceLandmarker not ready yet.");
        if (isPreviewing && !navigator.mediaDevices?.getUserMedia) console.warn("Selfie Mode: getUserMedia not supported.");
        if (isMounted) setIsCameraLoading(false); // Stop loading if we can't start
        return;
      }

      console.log("Selfie Mode: Requesting camera stream...");
      setIsCameraLoading(true);
      setCameraError(null);
      setDebugInfo(''); // Clear debug on camera start

      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: 'user',
             width: { ideal: 1280 },
             height: { ideal: 720 }
          },
          audio: false,
        });
        console.log("Selfie Mode: Camera stream acquired.");

        if (isMounted && selfieVideoRef.current) {
          selfieVideoRef.current.srcObject = stream;
          setCameraStream(stream); // Store stream for cleanup
          selfieVideoRef.current.onloadedmetadata = () => {
             console.log("Selfie Mode: Video metadata loaded.");
             if (isMounted && selfieVideoRef.current) {
                console.log(`Selfie video dimensions: ${selfieVideoRef.current.videoWidth}x${selfieVideoRef.current.videoHeight}`);
                setSelfieDimensions({
                  width: selfieVideoRef.current.videoWidth,
                  height: selfieVideoRef.current.videoHeight,
                });
                setIsCameraLoading(false); // Stop loading indicator
             }
          };
        } else if (stream) { // If component unmounted before assigning
             stream.getTracks().forEach(track => track.stop());
        }

      } catch (err) {
        console.error("Selfie Mode: Error accessing camera:", err);
        if (isMounted) {
            let message = "Failed to access camera for selfie.";
           if (err.name === "NotFoundError" || err.name === "DevicesNotFoundError") {
              message = "No camera found. Please connect a camera.";
          } else if (err.name === "NotAllowedError" || err.name === "PermissionDeniedError") {
              message = "Camera permission denied. Please allow access.";
          } else if (err.name === "NotReadableError" || err.name === "TrackStartError") {
              message = "Camera is already in use or could not be started.";
          }
          setCameraError(message);
          setIsCameraLoading(false);
          setDebugInfo(`Camera Error: ${message}`); // Show error in debug
        }
      }
    };

    if (isPreviewing) {
      enableStream();
    } else {
       // If switching away from preview, ensure loading state is false
       setIsCameraLoading(false);
    }

    // Cleanup function
    return () => {
      isMounted = false;
      console.log("Cleaning up Selfie Camera: Stopping stream.");
      // Use the state variable for cleanup as it might be more reliable
      const currentStream = cameraStream || stream; // Get stream from state or local var
      currentStream?.getTracks().forEach(track => track.stop());
      if (selfieVideoRef.current) {
          selfieVideoRef.current.srcObject = null;
          selfieVideoRef.current.onloadedmetadata = null;
      }
      setCameraStream(null); // Clear state on cleanup
    };
  // Rerun when switching between preview/capture or if landmarker becomes available
  }, [isPreviewing, faceLandmarker]);

  // --- Selfie Capture ---
  const handleTakeSelfie = useCallback(() => {
    if (!selfieVideoRef.current || selfieVideoRef.current.readyState < 2) {
      console.error("Selfie video element not ready for capture.");
      setCameraError("Camera not ready, please wait.");
      setDebugInfo("Error: Camera not ready for capture.");
      return;
    }
    if (!selfieDimensions.width || !selfieDimensions.height){
        console.error("Selfie video dimensions not set.");
        setCameraError("Could not get camera dimensions.");
        setDebugInfo("Error: Could not get camera dimensions.");
        return;
    }

    console.log("Taking selfie...");
    setDebugInfo("Capturing..."); // Update debug
    const video = selfieVideoRef.current;
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = selfieDimensions.width;
    tempCanvas.height = selfieDimensions.height;
    const ctx = tempCanvas.getContext('2d');

    // Draw mirrored frame
    ctx.save();
    ctx.scale(-1, 1);
    ctx.translate(-tempCanvas.width, 0);
    ctx.drawImage(video, 0, 0, tempCanvas.width, tempCanvas.height);
    ctx.restore();

    // Get data URL
    const dataUrl = tempCanvas.toDataURL('image/png');
    console.log("Selfie Captured. Data URL length:", dataUrl.length);
    setCapturedSelfieDataUrl(dataUrl);
    setIsPreviewing(false); // Switch view
    setDetectedSelfieResults(null); // Clear previous results
    setIsDetecting(true); // Start detecting indicator
    setDebugInfo('Capture complete. Starting analysis...'); // Update debug

    // Stop the preview stream AFTER capturing
    console.log("Stopping selfie preview stream.");
    cameraStream?.getTracks().forEach(track => track.stop());
    setCameraStream(null); // Clear stream state

  }, [cameraStream, selfieDimensions]); // Dependencies needed

  // --- Face Detection on Captured Selfie ---
  useEffect(() => {
      // This effect runs when a selfie is captured and we need to detect
      if (!capturedSelfieDataUrl || !faceLandmarker || !isDetecting) {
          // Don't log waiting message here, it's handled by the isDetecting state in JSX
          return;
      }

      console.log("Detection Effect: Starting detection process...");
      // Debug info already set to 'Analyzing selfie...' via isDetecting state in JSX
      const imageElement = new Image();

      imageElement.onload = async () => {
          console.log("Detection Effect: Selfie image loaded into Image element.");
          staticImageRef.current = imageElement; // Store ref to the loaded image
          setDebugInfo('Image loaded, calling detectForVideo()...'); // Update debug info
          try {
                if (faceLandmarker) {
                    console.log("Detection Effect: Calling faceLandmarker.detectForVideo()...");
                    // **********************************************************
                    // *** THE FIX: Use detectForVideo instead of detect ***
                    // **********************************************************
                    const results = faceLandmarker.detectForVideo(imageElement, performance.now());
                    // **********************************************************

                    console.log("Detection Effect: Detection finished. Results:", results);
                    // --- Store results/status in debug info ---
                    if (results?.faceLandmarks?.length > 0) {
                        setDebugInfo(`Detection OK. Found ${results.faceLandmarks.length} face(s). Landmarks[0]: ${results.faceLandmarks[0]?.length}`);
                    } else {
                        setDebugInfo('Detection OK. No face/landmarks found.');
                    }
                    // --- End of debug info update ---
                    setDetectedSelfieResults(results);
                } else {
                     setDebugInfo('Error: FaceLandmarker unavailable during detection.');
                     console.error("Detection Effect: FaceLandmarker became unavailable.");
                }
          } catch(err) {
               // Add check for the specific error we previously encountered (though unlikely now)
               if (err.message.includes("runningMode")) {
                    setDebugInfo(`Internal Error: detect() called on VIDEO mode landmarker.`);
               } else {
                    setDebugInfo(`Error during detectForVideo(): ${err.message}`); // Update debug info
               }
               console.error("Detection Effect: Error during faceLandmarker.detectForVideo():", err);
          } finally {
               // Crucially, set detecting to false whether detection succeeded or failed
               console.log("Detection Effect: Setting isDetecting to false.");
               setIsDetecting(false); // Finished detecting (success or fail)
          }
      }
      imageElement.onerror = () => {
          setDebugInfo('Error: Failed to load selfie image element.'); // Update debug info
          console.error("Detection Effect: Failed to load captured selfie data URL into image element.");
          setIsDetecting(false); // Stop detecting on error
      }
      console.log("Detection Effect: Setting imageElement.src");
      imageElement.src = capturedSelfieDataUrl; // Set src AFTER defining onload/onerror

  // Rerun only when the source data changes, or we explicitly start detecting
  }, [capturedSelfieDataUrl, faceLandmarker, isDetecting]);

   // --- Effect to draw initial state or update renderer ---
  useEffect(() => {
    // This effect's job is solely to call the renderer when the state is right
    console.log("Render Effect Triggered:", { isPreviewing, isDetecting, renderer: !!rendererRef.current, image: !!staticImageRef.current, results: !!detectedSelfieResults });

    if (!isPreviewing && rendererRef.current && staticImageRef.current) {
        // Only render if detection is NOT actively in progress
        if (!isDetecting) {
            console.log("Render Effect: Calling renderStaticImageResults...");
            // Pass current results (could be null if detection failed or found no faces)
            rendererRef.current.renderStaticImageResults(staticImageRef.current, detectedSelfieResults);
        } else {
             console.log("Render Effect: Waiting for detection to finish before rendering static image.");
             // Renderer should ideally show just the image while waiting? Or clear?
             // Let's draw just the image while detecting
              rendererRef.current.renderStaticImageResults(staticImageRef.current, null);
        }
    } else if (isPreviewing && rendererRef.current){
        console.log("Render Effect: Clearing canvas for preview mode.");
        rendererRef.current.clearCanvas();
    }
  // Dependencies: Changes that should trigger a re-render decision
  }, [isPreviewing, isDetecting, detectedSelfieResults, selfieDimensions]); // selfieDimensions added


  // --- Retake Selfie ---
  const handleRetakeSelfie = () => {
    console.log("Retaking selfie...");
    setIsPreviewing(true); // Switch back to preview mode
    setCapturedSelfieDataUrl(null); // Clear captured image data
    setDetectedSelfieResults(null); // Clear detection results
    staticImageRef.current = null; // Clear image ref
    setCameraError(null); // Clear previous errors
    setIsCameraLoading(true); // Show loading for camera restart
    setIsDetecting(false); // Reset detection flag
    setDebugInfo(''); // Clear debug info
    // The camera useEffect will re-run because isPreviewing changed to true
  };

  // --- JSX Return Block ---
  return (
    <div className="border p-4 rounded bg-green-50">
      <h2 className="text-xl font-semibold mb-2 text-center">Try On Selfie Mode</h2>

      {isPreviewing ? (
        // --- Preview Mode ---
        <>
          {isCameraLoading && <p className="text-center py-4">Starting camera...</p>}
          {cameraError && <p className="text-red-500 text-center py-4">{cameraError}</p>}
          {/* Camera Preview Container */}
          {/* Use a fixed aspect ratio container for preview consistency */}
          <div className="relative w-full max-w-md mx-auto aspect-[9/16] bg-gray-200 overflow-hidden rounded shadow">
            {/* Video Element */}
            <video
              ref={selfieVideoRef}
              autoPlay
              playsInline
              muted
              className={`absolute top-0 left-0 w-full h-full ${isCameraLoading || cameraError ? 'opacity-0' : 'opacity-100'}`}
              style={{ transform: 'scaleX(-1)', transition: 'opacity 0.3s', objectFit: 'cover' }} // Mirror preview
            ></video>
            {/* Loading/Error Overlay */}
            {(isCameraLoading || cameraError) && (
                 <div className="absolute inset-0 flex items-center justify-center">
                    <p className="text-gray-500 bg-white px-2 py-1 rounded shadow">{cameraError ? 'Error starting camera' : 'Loading Camera...'}</p>
                 </div>
            )}
          </div>
          {/* Take Selfie Button */}
          <div className="text-center mt-4">
            <button
                onClick={handleTakeSelfie}
                disabled={isCameraLoading || !!cameraError || !cameraStream}
                className="bg-indigo-500 text-white px-4 py-2 rounded hover:bg-indigo-600 disabled:bg-gray-400 disabled:cursor-not-allowed"
            >
                Take Selfie
            </button>
          </div>
        </>
      ) : (
        // --- Selfie Captured Mode ---
        <>
          {/* Selfie Display Area */}
          {/* Container aspect ratio based on captured dimensions */}
          <div className="relative w-full max-w-md mx-auto bg-gray-200 overflow-hidden rounded shadow" style={{ paddingTop: `${selfieDimensions.height && selfieDimensions.width ? (selfieDimensions.height / selfieDimensions.width) * 100 : 75}%` }}>
           {/* Render the TryOnRenderer only when dimensions are known */}
           {selfieDimensions.width > 0 ? (
                 <TryOnRenderer
                    ref={rendererRef}
                    videoWidth={selfieDimensions.width} // Use selfie dimensions
                    videoHeight={selfieDimensions.height}
                    className="absolute top-0 left-0 w-full h-full"
                 />
           ) : (
               <div className="absolute inset-0 flex items-center justify-center">
                   <p className="text-gray-500">Loading Image...</p> {/* Show loading message */}
               </div>
           )}
          </div>

          {/* --- Display Debug Info --- */}
          <div className="mt-2 p-2 border bg-gray-100 text-xs overflow-auto max-h-20 max-w-md mx-auto rounded">
            <p className="font-semibold mb-1">Debug Info:</p>
            {/* Use <pre> for better formatting of potential object outputs later */}
            <pre className="whitespace-pre-wrap break-words">{isDetecting ? 'Analyzing selfie...' : (debugInfo || 'N/A')}</pre>
          </div>
          {/* --- End Debug Info --- */}

          {/* Retake Selfie Button */}
          <div className="text-center mt-4">
            <button
                onClick={handleRetakeSelfie}
                className="bg-gray-500 text-white px-4 py-2 rounded hover:bg-gray-600"
            >
                Retake Selfie
            </button>
          </div>
        </>
      )}
      {/* Display message if FaceLandmarker isn't ready */}
      {!faceLandmarker && <p className="text-red-500 mt-2 text-center">Initializing AI model...</p>}
    </div>
  ); // End of the return statement
};

export default StaticSelfieTryOn;