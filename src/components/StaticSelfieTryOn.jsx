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
    setCapturedSelfieDataUrl(dataUrl);
    setIsPreviewing(false); // Switch view
    setDetectedSelfieResults(null); // Clear previous results

    // Stop the preview stream AFTER capturing
    console.log("Stopping selfie preview stream.");
    cameraStream?.getTracks().forEach(track => track.stop());
    setCameraStream(null); // Clear stream state

  }, [cameraStream, selfieDimensions]); // Dependencies needed

  // --- Face Detection on Captured Selfie ---
  useEffect(() => {
      if (!capturedSelfieDataUrl || !faceLandmarker) {
          return; // Only run when we have a selfie and the landmarker
      }

      console.log("Selfie captured, preparing for detection...");
      const imageElement = new Image();
      imageElement.onload = async () => {
          console.log("Selfie image loaded, running detection...");
          staticImageRef.current = imageElement; // Store ref to the loaded image
          try {
                // Make sure landmarker is ready (it should be, but check)
                if (faceLandmarker) {
                    // Detect on the static image
                    const results = faceLandmarker.detect(imageElement);
                    console.log("Selfie detection results:", results);
                    setDetectedSelfieResults(results);

                     // // --- Trigger Rendering ---
                     // // We need to wait for the rendererRef to be ready
                     // // A small timeout might be needed, or a more robust check
                    // setTimeout(() => {
                    //     if (rendererRef.current && staticImageRef.current && results) {
                    //         console.log("Pushing static image results to renderer...");
                    //         rendererRef.current.renderStaticImageResults(staticImageRef.current, results);
                    //     } else {
                    //          console.warn("Renderer or static image/results not ready when trying to render.");
                    //     }
                    // }, 100); // Adjust timeout or use state/callback for readiness


                } else {
                     console.error("FaceLandmarker became unavailable before detection.");
                }

          } catch(err) {
              console.error("Error during selfie detection:", err);
              // Handle detection error (e.g., show message)
          }
      }
      imageElement.onerror = () => {
          console.error("Failed to load captured selfie data URL into image element.");
           // Handle image loading error
      }
      imageElement.src = capturedSelfieDataUrl;

  }, [capturedSelfieDataUrl, faceLandmarker]); // Run when selfie or landmarker changes

   // --- Effect to draw initial state or update renderer ---
  useEffect(() => {
    // This effect runs when previewing is false AND results are available
    if (!isPreviewing && rendererRef.current && staticImageRef.current && detectedSelfieResults) {
      console.log("Effect: Pushing static image results to renderer...");
      rendererRef.current.renderStaticImageResults(staticImageRef.current, detectedSelfieResults);
    } else if (!isPreviewing && rendererRef.current && staticImageRef.current && !detectedSelfieResults) {
         // Handle case where selfie is shown but detection hasn't finished/failed
         // Maybe draw just the image initially
         console.log("Effect: Drawing static image without results yet...");
         rendererRef.current.renderStaticImageResults(staticImageRef.current, null); // Pass null results
    } else if (isPreviewing && rendererRef.current){
        // Clear the renderer canvas when going back to preview
        rendererRef.current.clearCanvas();
    }
  }, [isPreviewing, detectedSelfieResults, selfieDimensions]); // Dependencies that determine rendering state


  // --- Retake Selfie ---
  const handleRetakeSelfie = () => {
    console.log("Retaking selfie...");
    setIsPreviewing(true);
    setCapturedSelfieDataUrl(null);
    setDetectedSelfieResults(null);
    staticImageRef.current = null;
    setCameraError(null); // Clear previous errors
    setIsCameraLoading(true); // Show loading for camera restart
    // The camera useEffect will re-run
  };

  return (
    <div className="border p-4 rounded bg-green-50">
      <h2 className="text-xl font-semibold mb-2">Try On Selfie Mode</h2>

      {isPreviewing ? (
        // --- Preview Mode ---
        <>
          {isCameraLoading && <p>Starting camera for selfie...</p>}
          {cameraError && <p className="text-red-500">{cameraError}</p>}
          <div className="relative w-full" style={{ paddingTop: `${selfieDimensions.height && selfieDimensions.width ? (selfieDimensions.height / selfieDimensions.width) * 100 : (9/16)*100}%` /* Maintain aspect ratio, default 16:9 */ }}>
            <video
              ref={selfieVideoRef}
              autoPlay
              playsInline
              muted
              className={`absolute top-0 left-0 w-full h-full ${isCameraLoading || cameraError ? 'opacity-0' : 'opacity-100'}`}
              style={{ transform: 'scaleX(-1)', transition: 'opacity 0.3s' }} // Mirror preview
            ></video>
            {(isCameraLoading || cameraError) && (
                 <div className="absolute inset-0 flex items-center justify-center bg-gray-200">
                    <p className="text-gray-500">{cameraError ? 'Error' : 'Loading...'}</p>
                 </div>
            )}
          </div>
          <button
            onClick={handleTakeSelfie}
            disabled={isCameraLoading || !!cameraError || !cameraStream}
            className="mt-4 bg-indigo-500 text-white px-4 py-2 rounded hover:bg-indigo-600 disabled:bg-gray-400"
          >
            Take Selfie
          </button>
        </>
      ) : (
        // --- Selfie Captured Mode ---
        <>
          <div className="relative w-full" style={{ paddingTop: `${selfieDimensions.height && selfieDimensions.width ? (selfieDimensions.height / selfieDimensions.width) * 100 : (4/3)*100}%` /* Maintain aspect ratio, default 4:3 */ }}>
           {/* Render the TryOnRenderer to display the static image + effects */}
           {/* Ensure dimensions are passed */}
           {selfieDimensions.width > 0 && (
                 <TryOnRenderer
                    ref={rendererRef}
                    videoWidth={selfieDimensions.width}
                    videoHeight={selfieDimensions.height}
                    className="absolute top-0 left-0 w-full h-full"
                 />
           )}
          </div>
           {/* Show loading/message during detection? */}
           {capturedSelfieDataUrl && !detectedSelfieResults && <p className="mt-2">Analyzing selfie...</p>}

          <button
            onClick={handleRetakeSelfie}
            className="mt-4 bg-gray-500 text-white px-4 py-2 rounded hover:bg-gray-600"
          >
            Retake Selfie
          </button>
        </>
      )}
      {!faceLandmarker && <p className="text-red-500 mt-2">Waiting for FaceLandmarker...</p>}
    </div>
  );
};

export default StaticSelfieTryOn;