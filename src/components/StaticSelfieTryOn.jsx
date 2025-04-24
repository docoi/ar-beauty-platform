// src/components/StaticSelfieTryOn.jsx

import React, { useState, useRef, useEffect, useCallback } from 'react';
import TryOnRenderer from './TryOnRenderer';

const StaticSelfieTryOn = ({ faceLandmarker }) => {
  console.log("StaticSelfieTryOn rendering...");

  // --- State ---
  const [isPreviewing, setIsPreviewing] = useState(true);
  const [cameraStream, setCameraStream] = useState(null);
  const [isCameraLoading, setIsCameraLoading] = useState(true);
  const [cameraError, setCameraError] = useState(null);
  const [capturedSelfieDataUrl, setCapturedSelfieDataUrl] = useState(null);
  const [detectedSelfieResults, setDetectedSelfieResults] = useState(null);
  const [selfieDimensions, setSelfieDimensions] = useState({ width: 0, height: 0 });
  const [isDetecting, setIsDetecting] = useState(false);
  const [debugInfo, setDebugInfo] = useState('');

  // --- Refs ---
  const selfieVideoRef = useRef(null);
  const rendererRef = useRef(null);
  const staticImageRef = useRef(null);

  // --- Camera Access Logic (only when previewing) ---
  useEffect(() => {
    let isMounted = true;
    let stream = null;

    const enableStream = async () => {
      if (!isPreviewing || !faceLandmarker || !navigator.mediaDevices?.getUserMedia) {
        if (isPreviewing && !faceLandmarker) console.warn("Selfie Mode: FaceLandmarker not ready yet.");
        if (isPreviewing && !navigator.mediaDevices?.getUserMedia) console.warn("Selfie Mode: getUserMedia not supported.");
        if (isMounted) setIsCameraLoading(false);
        return;
      }
      console.log("Selfie Mode: Requesting camera stream...");
      setIsCameraLoading(true); setCameraError(null); setDebugInfo('');
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 720 } }, audio: false });
        console.log("Selfie Mode: Camera stream acquired.");
        if (isMounted && selfieVideoRef.current) {
          selfieVideoRef.current.srcObject = stream; setCameraStream(stream);
          selfieVideoRef.current.onloadedmetadata = () => {
             console.log("Selfie Mode: Video metadata loaded.");
             if (isMounted && selfieVideoRef.current) {
                console.log(`Selfie video dimensions: ${selfieVideoRef.current.videoWidth}x${selfieVideoRef.current.videoHeight}`);
                setSelfieDimensions({ width: selfieVideoRef.current.videoWidth, height: selfieVideoRef.current.videoHeight });
                setIsCameraLoading(false);
             }
          };
        } else if (stream) { stream.getTracks().forEach(track => track.stop()); }
      } catch (err) {
        console.error("Selfie Mode: Error accessing camera:", err);
        if (isMounted) {
            let message = "Failed to access camera for selfie."; /* ... error messages ... */
            if (err.name === "NotFoundError" || err.name === "DevicesNotFoundError") message = "No camera found.";
            else if (err.name === "NotAllowedError" || err.name === "PermissionDeniedError") message = "Camera permission denied.";
            else if (err.name === "NotReadableError" || err.name === "TrackStartError") message = "Camera already in use.";
            setCameraError(message); setIsCameraLoading(false); setDebugInfo(`Camera Error: ${message}`);
        }
      }
    };
    if (isPreviewing) { enableStream(); }
    else { setIsCameraLoading(false); }
    return () => {
      isMounted = false; console.log("Cleaning up Selfie Camera...");
      const currentStream = cameraStream || stream;
      currentStream?.getTracks().forEach(track => track.stop());
      if (selfieVideoRef.current) { selfieVideoRef.current.srcObject = null; selfieVideoRef.current.onloadedmetadata = null; }
      setCameraStream(null);
    };
  }, [isPreviewing, faceLandmarker]);

  // --- Selfie Capture ---
  const handleTakeSelfie = useCallback(() => {
    if (!selfieVideoRef.current || selfieVideoRef.current.readyState < 2) {
      setCameraError("Camera not ready."); setDebugInfo("Error: Camera not ready for capture."); return;
    }
    if (!selfieDimensions.width || !selfieDimensions.height){
      setCameraError("Could not get dims."); setDebugInfo("Error: Could not get camera dimensions."); return;
    }
    console.log("Taking selfie..."); setDebugInfo("Capturing...");
    const video = selfieVideoRef.current;
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = selfieDimensions.width;
    tempCanvas.height = selfieDimensions.height;
    const ctx = tempCanvas.getContext('2d');

    // 1. Draw mirrored frame
    ctx.save();
    ctx.scale(-1, 1);
    ctx.translate(-tempCanvas.width, 0);
    ctx.drawImage(video, 0, 0, tempCanvas.width, tempCanvas.height);
    ctx.restore(); // Restore transform so filter applies correctly

    // *** NEW: Apply brightness/contrast filter ***
    try {
        console.log("Applying brightness/contrast filter...");
        // Adjust these values as needed (e.g., 1.1 = 110%)
        const brightness = 1.1;
        const contrast = 1.1;
        ctx.filter = `brightness(${brightness}) contrast(${contrast})`;
        // IMPORTANT: Redraw the image onto itself for the filter to apply
        ctx.drawImage(tempCanvas, 0, 0);
        ctx.filter = 'none'; // Reset filter for subsequent operations if any
        console.log("Filter applied.");
    } catch (filterError) {
        console.error("Error applying canvas filter:", filterError);
        // Proceed without filter if error occurs
        ctx.filter = 'none';
    }
    // *** END OF FILTER APPLICATION ***

    // 3. Get data URL from the (potentially filtered) canvas
    const dataUrl = tempCanvas.toDataURL('image/png');
    console.log("Selfie Captured. Data URL length:", dataUrl.length);
    setCapturedSelfieDataUrl(dataUrl);
    setIsPreviewing(false); setDetectedSelfieResults(null); setIsDetecting(true);
    setDebugInfo('Capture complete. Starting analysis...');

    // Stop the preview stream AFTER capturing
    console.log("Stopping selfie preview stream.");
    cameraStream?.getTracks().forEach(track => track.stop());
    setCameraStream(null);

  }, [cameraStream, selfieDimensions]);

  // --- Face Detection on Captured Selfie ---
  useEffect(() => {
    if (!capturedSelfieDataUrl || !faceLandmarker || !isDetecting) return;
    console.log("Detection Effect: Starting detection process...");
    setDebugInfo('Starting detection...');
    const imageElement = new Image();
    imageElement.onload = async () => {
        console.log("Detection Effect: Selfie image loaded.");
        staticImageRef.current = imageElement;
        setDebugInfo('Image loaded, calling detectForVideo()...');
        try {
              if (faceLandmarker) {
                  console.log("Detection Effect: Calling faceLandmarker.detectForVideo()...");
                  const results = faceLandmarker.detectForVideo(imageElement, performance.now());
                  console.log("Detection Effect: Detection finished.");
                  if (results?.faceLandmarks?.length > 0) {
                      setDebugInfo(`Detection OK. Found ${results.faceLandmarks.length} face(s). Landmarks[0]: ${results.faceLandmarks[0]?.length}`);
                  } else { setDebugInfo('Detection OK. No face/landmarks found.'); }
                  setDetectedSelfieResults(results);
              } else { setDebugInfo('Error: FaceLandmarker unavailable.'); console.error("Detection Effect: FaceLandmarker unavailable."); }
        } catch(err) {
             setDebugInfo(`Error during detectForVideo(): ${err.message}`);
             console.error("Detection Effect: Error during detectForVideo():", err);
        } finally { setIsDetecting(false); }
    }
    imageElement.onerror = () => {
        setDebugInfo('Error: Failed to load selfie image element.');
        console.error("Detection Effect: Failed to load image element.");
        setIsDetecting(false);
    }
    imageElement.src = capturedSelfieDataUrl;
  }, [capturedSelfieDataUrl, faceLandmarker, isDetecting]);

   // --- Effect to draw initial state or update renderer ---
  useEffect(() => {
    console.log("Render Effect Triggered:", { isPreviewing, isDetecting, renderer: !!rendererRef.current, image: !!staticImageRef.current, results: !!detectedSelfieResults });
    if (!isPreviewing && rendererRef.current && staticImageRef.current) {
        if (!isDetecting) {
            console.log("Render Effect: Calling renderStaticImageResults...");
            rendererRef.current.renderStaticImageResults(staticImageRef.current, detectedSelfieResults);
        } else {
             console.log("Render Effect: Waiting for detection. Drawing image only.");
             rendererRef.current.renderStaticImageResults(staticImageRef.current, null); // Draw base image while detecting
        }
    } else if (isPreviewing && rendererRef.current){
        console.log("Render Effect: Clearing canvas for preview.");
        rendererRef.current.clearCanvas();
    }
  }, [isPreviewing, isDetecting, detectedSelfieResults, selfieDimensions]);

  // --- Retake Selfie ---
  const handleRetakeSelfie = () => {
    console.log("Retaking selfie..."); setIsPreviewing(true);
    setCapturedSelfieDataUrl(null); setDetectedSelfieResults(null);
    staticImageRef.current = null; setCameraError(null);
    setIsCameraLoading(true); setIsDetecting(false); setDebugInfo('');
  };

  // --- JSX Return Block ---
  return (
    <div className="border p-4 rounded bg-green-50">
      <h2 className="text-xl font-semibold mb-2 text-center">Try On Selfie Mode</h2>
      {isPreviewing ? (
        <>
          {/* ... Preview Mode JSX ... */}
          {isCameraLoading && <p className="text-center py-4">Starting camera...</p>}
          {cameraError && <p className="text-red-500 text-center py-4">{cameraError}</p>}
          <div className="relative w-full max-w-md mx-auto aspect-[9/16] bg-gray-200 overflow-hidden rounded shadow">
            <video ref={selfieVideoRef} autoPlay playsInline muted className={`absolute top-0 left-0 w-full h-full ${isCameraLoading || cameraError ? 'opacity-0' : 'opacity-100'}`} style={{ transform: 'scaleX(-1)', transition: 'opacity 0.3s', objectFit: 'cover' }}></video>
            {(isCameraLoading || cameraError) && ( <div className="absolute inset-0 flex items-center justify-center"><p className="text-gray-500 bg-white px-2 py-1 rounded shadow">{cameraError ? 'Error' : 'Loading...'}</p></div> )}
          </div>
          <div className="text-center mt-4"> <button onClick={handleTakeSelfie} disabled={isCameraLoading || !!cameraError || !cameraStream} className="bg-indigo-500 text-white px-4 py-2 rounded hover:bg-indigo-600 disabled:bg-gray-400 disabled:cursor-not-allowed"> Take Selfie </button> </div>
        </>
      ) : (
        <>
          {/* Selfie Display Area */}
          <div className="relative w-full max-w-md mx-auto bg-gray-200 overflow-hidden rounded shadow" style={{ paddingTop: `${selfieDimensions.height && selfieDimensions.width ? (selfieDimensions.height / selfieDimensions.width) * 100 : 75}%` }}>
           {selfieDimensions.width > 0 ? ( <TryOnRenderer ref={rendererRef} videoWidth={selfieDimensions.width} videoHeight={selfieDimensions.height} className="absolute top-0 left-0 w-full h-full" /> )
           : ( <div className="absolute inset-0 flex items-center justify-center"><p className="text-gray-500">Loading Image...</p></div> )}
          </div>
          {/* Display Debug Info */}
          <div className="mt-2 p-2 border bg-gray-100 text-xs overflow-auto max-h-20 max-w-md mx-auto rounded">
            <p className="font-semibold mb-1">Debug Info:</p>
            <pre className="whitespace-pre-wrap break-words">{isDetecting ? 'Analyzing selfie...' : (debugInfo || 'N/A')}</pre>
          </div>
          {/* Retake Selfie Button */}
          <div className="text-center mt-4"> <button onClick={handleRetakeSelfie} className="bg-gray-500 text-white px-4 py-2 rounded hover:bg-gray-600"> Retake Selfie </button> </div>
        </>
      )}
      {!faceLandmarker && <p className="text-red-500 mt-2 text-center">Initializing AI model...</p>}
    </div>
  );
};

export default StaticSelfieTryOn;