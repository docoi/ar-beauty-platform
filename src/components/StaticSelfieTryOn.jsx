// src/components/StaticSelfieTryOn.jsx - CORRECTED IMAGE EFFECT LOGIC

import React, { useState, useRef, useEffect, useCallback, forwardRef, useImperativeHandle } from 'react';
import TryOnRenderer from './TryOnRenderer';

const FIXED_SELFIE_BRIGHTNESS = 2.15;
const FIXED_SELFIE_CONTRAST = 0.55;

const StaticSelfieTryOn = forwardRef(({
    faceLandmarker,
    effectIntensity
}, ref) => {
  console.log("StaticSelfieTryOn rendering. Intensity prop:", effectIntensity );

  // State
  const [isPreviewing, setIsPreviewing] = useState(true);
  const [cameraStream, setCameraStream] = useState(null);
  const [isCameraLoading, setIsCameraLoading] = useState(true);
  const [cameraError, setCameraError] = useState(null);
  const [capturedSelfieDataUrl, setCapturedSelfieDataUrl] = useState(null);
  const [detectedSelfieResults, setDetectedSelfieResults] = useState(null);
  const [selfieDimensions, setSelfieDimensions] = useState({ width: 0, height: 0 });
  const [isDetecting, setIsDetecting] = useState(false); // Still useful for UI text
  const [debugInfo, setDebugInfo] = useState('');
  const [staticImageElement, setStaticImageElement] = useState(null);


  // Refs
  const selfieVideoRef = useRef(null);

  useImperativeHandle(ref, () => ({
      updateEffectIntensity: (intensity) => {},
  }));


  // Camera Access Effect
  useEffect(() => {
    let isMounted = true; let stream = null;
    const enableStream = async () => { /* ... (no changes needed in camera access logic) ... */ if (!isPreviewing || !faceLandmarker || !navigator.mediaDevices?.getUserMedia) { if (isMounted) setIsCameraLoading(false); return; } setIsCameraLoading(true); setCameraError(null); setDebugInfo(''); try { stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 720 } }, audio: false }); if (isMounted && selfieVideoRef.current) { selfieVideoRef.current.srcObject = stream; setCameraStream(stream); selfieVideoRef.current.onloadedmetadata = () => { if (isMounted && selfieVideoRef.current) { setSelfieDimensions({ width: selfieVideoRef.current.videoWidth, height: selfieVideoRef.current.videoHeight }); setIsCameraLoading(false); } }; } else if (stream) { stream.getTracks().forEach(track => track.stop()); } } catch (err) { if (isMounted) { let message = "Camera Error."; /* ... error messages ... */ setCameraError(message); setIsCameraLoading(false); setDebugInfo(`Camera Error: ${message}`); } } };
    if (isPreviewing) {
        console.log("StaticSelfieTryOn: Enabling camera stream for preview.");
        enableStream();
    } else {
        console.log("StaticSelfieTryOn: Not previewing, ensuring camera is off.");
        setIsCameraLoading(false); // Ensure loading is false if not previewing
        // Cleanup potentially running stream from previous state if needed
        const currentStream = cameraStream || stream;
        currentStream?.getTracks().forEach(track => track.stop());
        if (selfieVideoRef.current) { selfieVideoRef.current.srcObject = null; }
        setCameraStream(null);
    }
    return () => { isMounted = false; const currentStream = cameraStream || stream; currentStream?.getTracks().forEach(track => track.stop()); if (selfieVideoRef.current) { selfieVideoRef.current.srcObject = null; selfieVideoRef.current.onloadedmetadata = null; } setCameraStream(null); console.log("StaticSelfieTryOn: Camera effect cleanup."); };
   }, [isPreviewing, faceLandmarker]); // Keep dependencies


  // Selfie Capture
  const handleTakeSelfie = useCallback(() => {
    if (!selfieVideoRef.current || selfieVideoRef.current.readyState < 2) { setCameraError("Cam not ready."); setDebugInfo("Error: Cam not ready."); return; }
    if (!selfieDimensions.width || !selfieDimensions.height){ setCameraError("No dims."); setDebugInfo("Error: No camera dims."); return; }
    setDebugInfo("Capturing..."); const video = selfieVideoRef.current; const tempCanvas = document.createElement('canvas'); tempCanvas.width = selfieDimensions.width; tempCanvas.height = selfieDimensions.height; const ctx = tempCanvas.getContext('2d'); ctx.save(); ctx.scale(-1, 1); ctx.translate(-tempCanvas.width, 0); ctx.drawImage(video, 0, 0, tempCanvas.width, tempCanvas.height); ctx.restore(); const dataUrl = tempCanvas.toDataURL('image/png');

    console.log("StaticSelfieTryOn: Selfie Captured. Setting state.");
    setCapturedSelfieDataUrl(dataUrl); // <<<< Trigger the image loading effect
    setIsPreviewing(false);         // Stop preview, hide video
    setDetectedSelfieResults(null); // Clear previous results
    setStaticImageElement(null);    // <<<< Explicitly clear any previous image element state
    setIsDetecting(true);           // <<<< Set detecting to TRUE - used for UI text now
    setDebugInfo('Capture complete. Loading image...'); // Update initial debug info

    // Stop camera stream immediately after capture
    cameraStream?.getTracks().forEach(track => track.stop());
    setCameraStream(null);
    if (selfieVideoRef.current) { selfieVideoRef.current.srcObject = null; }

   }, [cameraStream, selfieDimensions]);


  // --- CORRECTED Image Loading and Face Detection Effect ---
  useEffect(() => {
    // Run only if we have a data URL and the landmarker is ready
    if (!capturedSelfieDataUrl || !faceLandmarker) {
        // If the data URL was cleared (e.g., by Retake), ensure the image element is also cleared.
        if (staticImageElement !== null) {
             console.log("StaticSelfieTryOn Effect: Clearing staticImageElement because data URL is null.");
             setStaticImageElement(null);
        }
         // Reset detecting flag if data URL is removed
         if (isDetecting) setIsDetecting(false);
        return; // Exit: Nothing to load
    }

    // We have a data URL, start the process
    // Note: isDetecting was set true in handleTakeSelfie
    console.log("StaticSelfieTryOn Effect: Valid data URL found. Starting image load & detection.");
    setDebugInfo('Loading captured image...'); // Update UI
    const imageElement = new Image();

    imageElement.onload = async () => {
      console.log("StaticSelfieTryOn: >>> Image loaded via imageElement.onload.");
      // Set dimensions based on loaded image
      setSelfieDimensions({width: imageElement.naturalWidth, height: imageElement.naturalHeight});

      console.log("StaticSelfieTryOn: Calling setStaticImageElement with image:", imageElement);
      // ***** SET THE IMAGE STATE *****
      setStaticImageElement(imageElement); // This should now persist!

      setDebugInfo('Image loaded, detecting face...'); // Update UI
      try {
        if (faceLandmarker) {
          console.log("StaticSelfieTryOn: Starting face detection...");
          const startTime = performance.now();
          const results = faceLandmarker.detectForVideo(imageElement, startTime);
          const endTime = performance.now();
          console.log(`StaticSelfieTryOn: Detection complete in ${endTime - startTime}ms. Results:`, results);
          setDetectedSelfieResults(results);
          setDebugInfo(`Analysis complete: ${results?.faceLandmarks?.[0]?.length || 0} landmarks found.`);
        } else {
          // Should not happen due to outer check, but good practice
          console.log("StaticSelfieTryOn: FaceLandmarker not ready during detection phase.");
          setDebugInfo('Analysis skipped: FaceLandmarker unavailable.');
          setDetectedSelfieResults(null);
        }
      } catch(err) {
         console.error("StaticSelfieTryOn: Error during face detection:", err);
         setDebugInfo(`Error during analysis: ${err.message}`);
         setDetectedSelfieResults(null);
      } finally {
         // ***** Mark detection as finished *****
         console.log("StaticSelfieTryOn: Setting isDetecting to false.");
         setIsDetecting(false); // Set detecting to FALSE - stops "Analyzing..." message
      }
    };

    imageElement.onerror = () => {
      console.error("StaticSelfieTryOn: imageElement.onerror triggered.");
      setDebugInfo('Error: Failed to load captured image.');
      setStaticImageElement(null); // Clear image state on error
      setIsDetecting(false);       // Stop detection process on error
    };

    console.log("StaticSelfieTryOn Effect: Setting imageElement.src");
    imageElement.src = capturedSelfieDataUrl;

    // Cleanup function for this effect
    return () => {
      console.log("StaticSelfieTryOn Effect Cleanup: Resetting image callbacks and src");
      imageElement.onload = null;
      imageElement.onerror = null;
      imageElement.src = '';
      // If using URL.createObjectURL, revoke it here:
      // if (imageElement.src.startsWith('blob:')) { URL.revokeObjectURL(imageElement.src); }
    };

  // ***** DEPENDENCIES CHANGED *****
  // Run ONLY when the data URL or the landmarker changes.
  }, [capturedSelfieDataUrl, faceLandmarker]);
  // ***** isDetecting is REMOVED from dependencies *****


   // Retake Selfie
   const handleRetakeSelfie = () => {
    console.log("StaticSelfieTryOn: Retake Selfie clicked.");
    setIsPreviewing(true);         // Go back to preview mode
    setCapturedSelfieDataUrl(null); // <<<< Clear the data URL (triggers effect cleanup)
    setDetectedSelfieResults(null);
    // staticImageElement will be cleared by the effect reacting to capturedSelfieDataUrl becoming null
    // setStaticImageElement(null); // Optional: can set explicitly here too
    setSelfieDimensions({ width: 0, height: 0 });
    setCameraError(null);
    setIsCameraLoading(true); // Will trigger camera useEffect to restart
    setIsDetecting(false);    // Ensure detecting is false
    setDebugInfo('');
   };

  // --- Logging before return ---
  console.log(`StaticSelfieTryOn RENDERING: isPreviewing=${isPreviewing}, isDetecting=${isDetecting}, staticImageElement is ${staticImageElement ? 'TRUTHY (Image Object Exists)' : 'FALSY (null or undefined)'}`);

  // --- JSX ---
  return (
    <div className="border p-4 rounded bg-green-50">
      <h2 className="text-xl font-semibold mb-2 text-center">Try On Selfie Mode</h2>
      {isPreviewing ? ( // Render Preview UI
         <>
            {isCameraLoading && <p className="text-center py-4">Starting camera...</p>}
            {cameraError && <p className="text-red-500 text-center py-4">{cameraError}</p>}
            <div className="relative w-full max-w-md mx-auto aspect-[9/16] bg-gray-200 overflow-hidden rounded shadow">
               <video ref={selfieVideoRef} autoPlay playsInline muted className={`absolute top-0 left-0 w-full h-full ${isCameraLoading || cameraError ? 'opacity-0' : 'opacity-100'}`} style={{ transform: 'scaleX(-1)', transition: 'opacity 0.3s', objectFit: 'cover' }}></video>
               {(isCameraLoading || cameraError) && ( <div className="absolute inset-0 flex items-center justify-center"><p className="text-gray-500 bg-white px-2 py-1 rounded shadow">{cameraError ? 'Error' : 'Loading...'}</p></div> )}
            </div>
            <div className="text-center mt-4">
               <button onClick={handleTakeSelfie} disabled={isCameraLoading || !!cameraError || !cameraStream} className="bg-indigo-500 text-white px-4 py-2 rounded hover:bg-indigo-600 disabled:bg-gray-400 disabled:cursor-not-allowed"> Take Selfie </button>
            </div>
         </>
      ) : ( // Render Captured UI
        <>
          <div className="relative w-full max-w-md mx-auto bg-gray-200 overflow-hidden rounded shadow" style={{ paddingTop: `${selfieDimensions.height && selfieDimensions.width ? (selfieDimensions.height / selfieDimensions.width) * 100 : 75}%` }}>
            {console.log(`StaticSelfieTryOn JSX Check: staticImageElement value is:`, staticImageElement)}
            {/* Render based ONLY on staticImageElement existence */}
            {staticImageElement ? ( // <--- Condition uses state
              <TryOnRenderer
                videoRefProp={null}
                imageElement={staticImageElement} // <<<< Should now reliably receive the image
                mediaPipeResults={detectedSelfieResults}
                isStatic={true}
                brightness={FIXED_SELFIE_BRIGHTNESS}
                contrast={FIXED_SELFIE_CONTRAST}
                effectIntensity={effectIntensity}
                className="absolute top-0 left-0 w-full h-full" // Make sure canvas fills the container
              />
            ) : (
              // Fallback UI
              <div className="absolute inset-0 flex items-center justify-center">
                 {/* Show "Analyzing" only if isDetecting is true, otherwise "Loading" (or could show detection results briefly) */}
                 <p className="text-gray-500">{isDetecting ? 'Analyzing Selfie...' : (capturedSelfieDataUrl ? 'Loading Image...' : 'Initializing...')}</p>
              </div>
            )}
          </div>
          {/* Debug Info Area */}
          <div className="mt-2 p-2 border bg-gray-100 text-xs overflow-auto max-h-20 max-w-md mx-auto rounded">
             <p className="font-semibold mb-1">Debug Info:</p>
             <pre className="whitespace-pre-wrap break-words">{debugInfo || 'N/A'}</pre>
          </div>
          {/* Retake Button */}
          <div className="text-center mt-4">
             <button onClick={handleRetakeSelfie} className="bg-gray-500 text-white px-4 py-2 rounded hover:bg-gray-600">
               Retake Selfie
             </button>
          </div>
        </>
      )}
      {/* AI Model Status */}
      {!faceLandmarker && <p className="text-red-500 mt-2 text-center">Initializing AI model...</p>}
    </div>
  );
});
StaticSelfieTryOn.displayName = 'StaticSelfieTryOn';
export default StaticSelfieTryOn;