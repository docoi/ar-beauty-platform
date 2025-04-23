import React, { useState, useRef, useEffect, useCallback } from 'react';
import TryOnRenderer from './TryOnRenderer'; // We will render this once selfie is taken

const StaticSelfieTryOn = ({ faceLandmarker }) => {
  console.log("StaticSelfieTryOn rendering...");

  // State
  const [isPreviewing, setIsPreviewing] = useState(true); // Start in preview mode
  const [cameraStream, setCameraStream] = useState(null);
  const [isCameraLoading, setIsCameraLoading] = useState(true);
  const [cameraError, setCameraError] = useState(null);
  const [capturedSelfieDataUrl, setCapturedSelfieDataUrl] = useState(null);
  const [detectedSelfieResults, setDetectedSelfieResults] = useState(null);
  const [selfieDimensions, setSelfieDimensions] = useState({ width: 0, height: 0 });
  const [isDetecting, setIsDetecting] = useState(false); // Add state for detection status


  // Refs
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
        } else {
             stream?.getTracks().forEach(track => track.stop());
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
        }
      }
    };

    if (isPreviewing) {
      enableStream();
    }

    // Cleanup function
    return () => {
      isMounted = false;
      console.log("Cleaning up Selfie Camera: Stopping stream.");
      cameraStream?.getTracks().forEach(track => track.stop());
      if (selfieVideoRef.current) {
          selfieVideoRef.current.srcObject = null;
          selfieVideoRef.current.onloadedmetadata = null;
      }
      // Don't clear cameraStream state here, might be needed by handleTakeSelfie just before cleanup
    };
  }, [isPreviewing, faceLandmarker]); // Re-run when switching between preview/capture

  // --- Selfie Capture ---
  const handleTakeSelfie = useCallback(() => {
    if (!selfieVideoRef.current || selfieVideoRef.current.readyState < 2) {
      console.error("Selfie video element not ready for capture.");
      setCameraError("Camera not ready, please wait.");
      return;
    }
    if (!selfieDimensions.width || !selfieDimensions.height){
        console.error("Selfie video dimensions not set.");
        setCameraError("Could not get camera dimensions.");
        return;
    }

    console.log("Taking selfie...");
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
    const dataUrl = tempCanvas.toDataURL('image/png'); // Use PNG for potentially better quality
    console.log("Selfie Captured. Data URL length:", dataUrl.length); // Log data URL length
    setCapturedSelfieDataUrl(dataUrl);
    setIsPreviewing(false); // Switch view
    setDetectedSelfieResults(null); // Clear previous results
    setIsDetecting(true); // Start detecting indicator

    // Stop the preview stream AFTER capturing
    console.log("Stopping selfie preview stream.");
    cameraStream?.getTracks().forEach(track => track.stop());
    setCameraStream(null); // Clear stream state

  }, [cameraStream, selfieDimensions]); // Dependencies needed

  // --- Face Detection on Captured Selfie ---
  useEffect(() => {
      // Check isDetecting flag which is set only after selfie is taken
      if (!capturedSelfieDataUrl || !faceLandmarker || !isDetecting) {
          if (isDetecting) {
              console.log("Detection Effect: Waiting for prerequisites (selfieDataUrl, faceLandmarker).");
          }
          return; // Only run when we have a selfie to process and landmarker is ready
      }

      console.log("Detection Effect: Starting detection process...");
      const imageElement = new Image();

      imageElement.onload = async () => {
          console.log("Detection Effect: Selfie image loaded into Image element.");
          staticImageRef.current = imageElement; // Store ref to the loaded image
          try {
                if (faceLandmarker) {
                    console.log("Detection Effect: Calling faceLandmarker.detect()...");
                    // If landmarker was created with VIDEO mode, detect() should work on image.
                    const results = faceLandmarker.detect(imageElement);
                    console.log("Detection Effect: Detection finished. Results:", results); // Log the results
                    setDetectedSelfieResults(results);
                    // No need to call renderer here, let the other effect handle it
                } else {
                     console.error("Detection Effect: FaceLandmarker became unavailable.");
                }
          } catch(err) {
              console.error("Detection Effect: Error during faceLandmarker.detect():", err);
              // Optionally set an error state to display to the user
          } finally {
               // Crucially, set detecting to false whether detection succeeded or failed
               console.log("Detection Effect: Setting isDetecting to false.");
               setIsDetecting(false);
          }
      }
      imageElement.onerror = () => {
          console.error("Detection Effect: Failed to load captured selfie data URL into image element.");
          setIsDetecting(false); // Stop detecting on error
           // Optionally set an error state
      }
      console.log("Detection Effect: Setting imageElement.src");
      imageElement.src = capturedSelfieDataUrl; // Set src AFTER defining onload/onerror

  // Rerun only when the source data changes, or we explicitly want to detect
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
             // Optionally clear or show placeholder while detecting
             // rendererRef.current.clearCanvas(); // Or draw just the image without results yet?
        }
    } else if (isPreviewing && rendererRef.current){
        console.log("Render Effect: Clearing canvas for preview mode.");
        rendererRef.current.clearCanvas();
    }
  // Dependencies: Changes that should trigger a re-render decision
  }, [isPreviewing, isDetecting, detectedSelfieResults, selfieDimensions]);


  // --- Retake Selfie ---
  const handleRetakeSelfie = () => {
    console.log("Retaking selfie...");
    setIsPreviewing(true);
    setCapturedSelfieDataUrl(null);
    setDetectedSelfieResults(null);
    staticImageRef.current = null;
    setCameraError(null); // Clear previous errors
    setIsCameraLoading(true); // Show loading for camera restart
    setIsDetecting(false); // Reset detection flag
    // The camera useEffect will re-run because isPreviewing changed
  };

  return (
    <div className="border p-4 rounded bg-green-50">
      <h2 className="text-xl font-semibold mb-2">Try On Selfie Mode</h2>

      {isPreviewing ? (
        // --- Preview Mode ---
        <>
          {isCameraLoading && <p className="text-center py-4">Starting camera for selfie...</p>}
          {cameraError && <p className="text-red-500 text-center py-4">{cameraError}</p>}
          <div className="relative w-full" style={{ paddingTop: `${selfieDimensions.height && selfieDimensions.width ? (selfieDimensions.height / selfieDimensions.width) * 100 : (9/16)*100}%` }}>
            <video
              ref={selfieVideoRef}
              autoPlay
              playsInline
              muted
              className={`absolute top-0 left-0 w-full h-full ${isCameraLoading || cameraError ? 'opacity-0' : 'opacity-100'}`}
              style={{ transform: 'scaleX(-1)', transition: 'opacity 0.3s', objectFit: 'cover' }} // Mirror preview
            ></video>
            {(isCameraLoading || cameraError) && (
                 <div className="absolute inset-0 flex items-center justify-center bg-gray-200">
                    <p className="text-gray-500">{cameraError ? 'Error starting camera' : 'Loading Camera...'}</p>
                 </div>
            )}
          </div>
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
          <div className="relative w-full" style={{ paddingTop: `${selfieDimensions.height && selfieDimensions.width ? (selfieDimensions.height / selfieDimensions.width) * 100 : (4/3)*100}%` }}>
           {/* Ensure dimensions are available before rendering */}
           {selfieDimensions.width > 0 ? (
                 <TryOnRenderer
                    ref={rendererRef}
                    videoWidth={selfieDimensions.width} // Use selfie dimensions
                    videoHeight={selfieDimensions.height}
                    className="absolute top-0 left-0 w-full h-full"
                 />
           ) : (
               <div className="absolute inset-0 flex items-center justify-center bg-gray-200">
                   <p>Loading dimensions...</p> {/* Should be very brief */}
               </div>
           )}
          </div>
           {/* Show detecting status */}
           {isDetecting && <p className="mt-2 text-center animate-pulse">Analyzing selfie...</p>}

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
      {!faceLandmarker && <p className="text-red-500 mt-2 text-center">Waiting for FaceLandmarker model...</p>}
    </div>
  );
};

export default StaticSelfieTryOn;