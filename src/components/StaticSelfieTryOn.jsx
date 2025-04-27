// src/components/StaticSelfieTryOn.jsx - WITH ADDED STATE LOGGING

import React, { useState, useRef, useEffect, useCallback, forwardRef, useImperativeHandle } from 'react';
import TryOnRenderer from './TryOnRenderer'; // Should use the one with bare-minimum shader

// *** Define the best-found correction values (used when rendering static image) ***
const FIXED_SELFIE_BRIGHTNESS = 2.15;
const FIXED_SELFIE_CONTRAST = 0.55;
// *** -------------------------------------- ***


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
  const [isDetecting, setIsDetecting] = useState(false);
  const [debugInfo, setDebugInfo] = useState('');
  // State to hold the loaded static image element
  const [staticImageElement, setStaticImageElement] = useState(null); // Keep this state


  // Refs
  const selfieVideoRef = useRef(null);
  // const rendererRef = useRef(null); // Not used

  // Imperative handle
  useImperativeHandle(ref, () => ({
      updateEffectIntensity: (intensity) => {
          // If TryOnRenderer needed intensity updates via handle
      },
  }));


  // Camera Access - Restore setting selfieDimensions
  useEffect(() => {
    let isMounted = true; let stream = null; const enableStream = async () => { if (!isPreviewing || !faceLandmarker || !navigator.mediaDevices?.getUserMedia) { if (isMounted) setIsCameraLoading(false); return; } setIsCameraLoading(true); setCameraError(null); setDebugInfo(''); try { stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 720 } }, audio: false }); if (isMounted && selfieVideoRef.current) { selfieVideoRef.current.srcObject = stream; setCameraStream(stream); selfieVideoRef.current.onloadedmetadata = () => { if (isMounted && selfieVideoRef.current) { setSelfieDimensions({ width: selfieVideoRef.current.videoWidth, height: selfieVideoRef.current.videoHeight }); setIsCameraLoading(false); } }; } else if (stream) { stream.getTracks().forEach(track => track.stop()); } } catch (err) { if (isMounted) { let message = "Camera Error."; /* ... error messages ... */ setCameraError(message); setIsCameraLoading(false); setDebugInfo(`Camera Error: ${message}`); } } }; if (isPreviewing) { enableStream(); } else { setIsCameraLoading(false); } return () => { isMounted = false; const currentStream = cameraStream || stream; currentStream?.getTracks().forEach(track => track.stop()); if (selfieVideoRef.current) { selfieVideoRef.current.srcObject = null; selfieVideoRef.current.onloadedmetadata = null; } setCameraStream(null); };
   }, [isPreviewing, faceLandmarker]);

  // Selfie Capture - Restore dependency on selfieDimensions state
  const handleTakeSelfie = useCallback(() => {
    if (!selfieVideoRef.current || selfieVideoRef.current.readyState < 2) { setCameraError("Cam not ready."); setDebugInfo("Error: Cam not ready."); return; }
    if (!selfieDimensions.width || !selfieDimensions.height){ setCameraError("No dims."); setDebugInfo("Error: No camera dims."); return; }
    setDebugInfo("Capturing..."); const video = selfieVideoRef.current; const tempCanvas = document.createElement('canvas'); tempCanvas.width = selfieDimensions.width; tempCanvas.height = selfieDimensions.height; const ctx = tempCanvas.getContext('2d'); ctx.save(); ctx.scale(-1, 1); ctx.translate(-tempCanvas.width, 0); ctx.drawImage(video, 0, 0, tempCanvas.width, tempCanvas.height); ctx.restore(); const dataUrl = tempCanvas.toDataURL('image/png'); setCapturedSelfieDataUrl(dataUrl); setIsPreviewing(false); setDetectedSelfieResults(null); setStaticImageElement(null); setIsDetecting(true); setDebugInfo('Capture complete. Analyzing...'); cameraStream?.getTracks().forEach(track => track.stop()); setCameraStream(null);
   }, [cameraStream, selfieDimensions]); // Restore dependency

  // Face Detection and Image Loading - Restore setting selfieDimensions & ADD LOGGING
  useEffect(() => {
    // Check dependencies first
    if (!capturedSelfieDataUrl || !faceLandmarker || !isDetecting) {
        // Clear the element if dependencies change and we shouldn't be loading
        // Check if it's already null to avoid unnecessary state updates
        if (staticImageElement !== null) {
             // *** ADDED LOG ***
             console.log("StaticSelfieTryOn Effect: Clearing staticImageElement because dependencies changed or process aborted.");
             setStaticImageElement(null);
        }
        return; // Exit if dependencies not met
    }

    // Proceed with loading
    setDebugInfo('Loading Image...');
    console.log("StaticSelfieTryOn Effect: Creating new Image() element.");
    const imageElement = new Image();

    imageElement.onload = async () => {
      // *** ADDED LOG ***
      console.log("StaticSelfieTryOn: >>> Image loaded via imageElement.onload.");
      setSelfieDimensions({width: imageElement.naturalWidth, height: imageElement.naturalHeight});

      // *** ADDED LOG ***
      console.log("StaticSelfieTryOn: Calling setStaticImageElement with image:", imageElement);
      // ***** THE CRITICAL STATE UPDATE *****
      setStaticImageElement(imageElement);
      // ***** ADD LOG IMMEDIATELY AFTER *****
      console.log("StaticSelfieTryOn: setStaticImageElement has been called.");
      // **************************************

      setDebugInfo('Image loaded, detecting face...'); // Update debug info
      try {
        if (faceLandmarker) {
          console.log("StaticSelfieTryOn: Starting face detection...");
          const startTime = performance.now();
          // Make sure to pass the loaded imageElement here, not the data URL
          const results = faceLandmarker.detectForVideo(imageElement, startTime);
          const endTime = performance.now();
           // *** ADDED LOG ***
          console.log(`StaticSelfieTryOn: Detection complete in ${endTime - startTime}ms. Results:`, results);
          setDetectedSelfieResults(results);
          // Update debug info based on results
          setDebugInfo(`Analysis complete: ${results?.faceLandmarks?.[0]?.length || 0} landmarks found.`);
        } else {
          // *** ADDED LOG ***
          console.log("StaticSelfieTryOn: FaceLandmarker not ready, skipping detection.");
          setDebugInfo('Analysis skipped: FaceLandmarker not available.');
          setDetectedSelfieResults(null); // Ensure results are cleared
        }
      } catch(err) {
         // *** ADDED LOG ***
         console.error("StaticSelfieTryOn: Error during face detection:", err);
         setDebugInfo(`Error during analysis: ${err.message}`);
         setDetectedSelfieResults(null); // Ensure results are cleared on error
      } finally {
         // *** ADDED LOG ***
         console.log("StaticSelfieTryOn: Setting isDetecting to false.");
         setIsDetecting(false); // Ensure this is set *after* detection attempt
      }
    };

    imageElement.onerror = () => {
      // *** ADDED LOG ***
      console.error("StaticSelfieTryOn: imageElement.onerror triggered.");
      setDebugInfo('Error: Failed to load captured image.');
      setIsDetecting(false);
      setStaticImageElement(null); // Ensure it's null on error
    };

    // *** ADDED LOG ***
    console.log("StaticSelfieTryOn Effect: Setting imageElement.src");
    imageElement.src = capturedSelfieDataUrl;

    // Cleanup function for this effect (optional but good practice)
    return () => {
      console.log("StaticSelfieTryOn Effect Cleanup: Resetting image callbacks and src");
      // Prevent callbacks on unmounted component or if src changes
      imageElement.onload = null;
      imageElement.onerror = null;
      // If using URL.createObjectURL, revoke it here:
      // if (imageElement.src.startsWith('blob:')) {
      //   URL.revokeObjectURL(imageElement.src);
      // }
      imageElement.src = ''; // Help GC maybe?
    };

  // Dependencies: Re-run ONLY if these change. isDetecting ensures it runs once after capture.
  }, [capturedSelfieDataUrl, faceLandmarker, isDetecting]);


   // Retake Selfie - Ensure staticImageElement is cleared
   const handleRetakeSelfie = () => {
    setIsPreviewing(true);
    setCapturedSelfieDataUrl(null);
    setDetectedSelfieResults(null);
    setStaticImageElement(null); // << Clear image element state
    setSelfieDimensions({ width: 0, height: 0 }); // Reset dimensions
    setCameraError(null);
    setIsCameraLoading(true); // Will trigger camera useEffect
    setIsDetecting(false); // Reset detection flag
    setDebugInfo('');
   };

  // --- Logging before return ---
  // ***** ADDED LOG HERE TO SEE STATE ON EACH RENDER *****
  console.log(`StaticSelfieTryOn RENDERING: isPreviewing=${isPreviewing}, isDetecting=${isDetecting}, staticImageElement is ${staticImageElement ? 'TRUTHY (Image Object Exists)' : 'FALSY (null or undefined)'}`);
  // ******************************************************


  // --- JSX ---
  return (
    <div className="border p-4 rounded bg-green-50">
      <h2 className="text-xl font-semibold mb-2 text-center">Try On Selfie Mode</h2>
      {isPreviewing ? ( // Render Preview UI when isPreviewing is true
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
      ) : ( // Render Captured UI when isPreviewing is false
        <>
          {/* Use selfieDimensions state for aspect ratio */}
          <div className="relative w-full max-w-md mx-auto bg-gray-200 overflow-hidden rounded shadow" style={{ paddingTop: `${selfieDimensions.height && selfieDimensions.width ? (selfieDimensions.height / selfieDimensions.width) * 100 : 75}%` }}>
            {/* Log the value again right before the check */}
            {/* *** ADDED LOG *** */}
            {console.log(`StaticSelfieTryOn JSX Check: staticImageElement value is:`, staticImageElement)}
            {/* Render based ONLY on staticImageElement existence */}
            {staticImageElement ? ( // <--- Condition uses state
              <TryOnRenderer
                videoRefProp={null} // Pass null for video ref
                imageElement={staticImageElement} // Pass the loaded image element from state
                mediaPipeResults={detectedSelfieResults}
                isStatic={true}
                brightness={FIXED_SELFIE_BRIGHTNESS} // Passed but not used by bare shader yet
                contrast={FIXED_SELFIE_CONTRAST}   // Passed but not used by bare shader yet
                effectIntensity={effectIntensity}
                className="absolute top-0 left-0 w-full h-full"
              />
            ) : (
              // Render fallback UI
              // *** UPDATED FALLBACK TEXT ***
              <div className="absolute inset-0 flex items-center justify-center">
                 <p className="text-gray-500">{isDetecting ? 'Analyzing Selfie...' : 'Loading Image...'}</p>
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