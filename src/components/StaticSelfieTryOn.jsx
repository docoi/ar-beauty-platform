// src/components/StaticSelfieTryOn.jsx - ADDED results logging

import React, { useState, useRef, useEffect, useCallback, forwardRef } from 'react';
import TryOnRenderer from './TryOnRenderer'; // Expects the version with detailed mask logging

const FIXED_SELFIE_BRIGHTNESS = 2.15;
const FIXED_SELFIE_CONTRAST = 0.55;

const StaticSelfieTryOn = forwardRef(({
    faceLandmarker,
    effectIntensity
}, ref) => {
  // console.log("StaticSelfieTryOn rendering. Intensity prop:", effectIntensity ); // Reduce noise

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
  const [staticImageElement, setStaticImageElement] = useState(null);


  // Refs
  const selfieVideoRef = useRef(null);

  // Camera Access Effect
  useEffect(() => {
    let isMounted = true; let stream = null;
    const enableStream = async () => { if (!isPreviewing || !faceLandmarker || !navigator.mediaDevices?.getUserMedia) { if (isMounted) setIsCameraLoading(false); return; } setIsCameraLoading(true); setCameraError(null); setDebugInfo(''); try { stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 720 } }, audio: false }); if (isMounted && selfieVideoRef.current) { selfieVideoRef.current.srcObject = stream; setCameraStream(stream); selfieVideoRef.current.onloadedmetadata = () => { if (isMounted && selfieVideoRef.current) { setSelfieDimensions({ width: selfieVideoRef.current.videoWidth, height: selfieVideoRef.current.videoHeight }); setIsCameraLoading(false); } }; } else if (stream) { stream?.getTracks().forEach(track => track.stop()); } } catch (err) { if (isMounted) { let message = "Camera Error."; /* ... */ setCameraError(message); setIsCameraLoading(false); setDebugInfo(`Camera Error: ${message}`); } } };
    if (isPreviewing) { /*console.log("StaticSelfieTryOn: Enabling camera stream for preview.");*/ enableStream(); } else { /*console.log("StaticSelfieTryOn: Not previewing, ensuring camera is off.");*/ setIsCameraLoading(false); const currentStream = cameraStream || stream; currentStream?.getTracks().forEach(track => track.stop()); if (selfieVideoRef.current) { selfieVideoRef.current.srcObject = null; } setCameraStream(null); }
    return () => { isMounted = false; const currentStream = cameraStream || stream; currentStream?.getTracks().forEach(track => track.stop()); if (selfieVideoRef.current) { selfieVideoRef.current.srcObject = null; selfieVideoRef.current.onloadedmetadata = null; } setCameraStream(null); /*console.log("StaticSelfieTryOn: Camera effect cleanup.");*/ };
   }, [isPreviewing, faceLandmarker]);


  // Selfie Capture
  const handleTakeSelfie = useCallback(() => {
    if (!selfieVideoRef.current || selfieVideoRef.current.readyState < 2) { setCameraError("Cam not ready."); setDebugInfo("Error: Cam not ready."); return; }
    if (!selfieDimensions.width || !selfieDimensions.height){ setCameraError("No dims."); setDebugInfo("Error: No camera dims."); return; }
    setDebugInfo("Capturing..."); const video = selfieVideoRef.current; const tempCanvas = document.createElement('canvas'); tempCanvas.width = selfieDimensions.width; tempCanvas.height = selfieDimensions.height; const ctx = tempCanvas.getContext('2d'); ctx.save(); ctx.scale(-1, 1); ctx.translate(-tempCanvas.width, 0); ctx.drawImage(video, 0, 0, tempCanvas.width, tempCanvas.height); ctx.restore(); const dataUrl = tempCanvas.toDataURL('image/png');

    // console.log("StaticSelfieTryOn: Selfie Captured. Setting state.");
    setCapturedSelfieDataUrl(dataUrl);
    setIsPreviewing(false);
    setDetectedSelfieResults(null);
    setStaticImageElement(null);
    // Don't set isDetecting here, set it in the effect when loading starts
    setDebugInfo('Capture complete. Loading image...');

    cameraStream?.getTracks().forEach(track => track.stop());
    setCameraStream(null);
    if (selfieVideoRef.current) { selfieVideoRef.current.srcObject = null; }

   }, [cameraStream, selfieDimensions]);


  // Image Loading and Face Detection Effect - ADDED LOGGING
  useEffect(() => {
    if (!capturedSelfieDataUrl || !faceLandmarker) {
        if (staticImageElement !== null) { setStaticImageElement(null); }
        if (isDetecting) setIsDetecting(false); // Reset if URL removed
        return;
    }

    console.log("StaticSelfieTryOn Effect: Valid data URL found. Loading image...");
    setIsDetecting(true); // Set detecting TRUE now
    setDebugInfo('Loading captured image...');
    const imageElement = new Image();

    imageElement.onload = async () => {
      console.log("StaticSelfieTryOn: Image loaded via imageElement.onload.");
      setSelfieDimensions({width: imageElement.naturalWidth, height: imageElement.naturalHeight});
      setStaticImageElement(imageElement); // Set the image element state
      setDebugInfo('Image loaded, detecting face...'); // Update UI

      // Detection logic moved here, inside onload
      try {
        if (faceLandmarker) {
          console.log("StaticSelfieTryOn: Starting face detection for static image...");
          const startTime = performance.now();
          const results = faceLandmarker.detectForVideo(imageElement, startTime); // Use loaded imageElement
          const endTime = performance.now();

          // *** ADDED LOGGING HERE ***
          console.log(`--- StaticSelfieTryOn: detectForVideo results (took ${endTime - startTime}ms) ---`, results);
           // Specifically log the segmentationMasks part if it exists
          if (results?.segmentationMasks) {
              console.log(" -> segmentationMasks:", results.segmentationMasks);
              if (results.segmentationMasks.length > 0 && results.segmentationMasks[0]) { // Check index 0 exists
                   const maskData = results.segmentationMasks[0]?.maskData;
                   console.log(" -> segmentationMasks[0].maskData type:", maskData?.constructor?.name);
                   // Check specifically for WebGLTexture using instanceof
                   console.log(" -> segmentationMasks[0].maskData instanceof WebGLTexture:", maskData instanceof WebGLTexture);
              } else {
                  console.log(" -> segmentationMasks: Array is empty.");
              }
          } else {
               console.log(" -> segmentationMasks: Not found in results.");
          }
          // *************************

          setDetectedSelfieResults(results); // Update state with results
          setDebugInfo(`Analysis complete: ${results?.faceLandmarks?.[0]?.length || 0} landmarks found.`);
        } else {
          console.warn("StaticSelfieTryOn: FaceLandmarker became unavailable during detection?");
          setDebugInfo('Analysis skipped: FaceLandmarker unavailable.');
          setDetectedSelfieResults(null);
        }
      } catch(err) {
         console.error("StaticSelfieTryOn: Error during face detection:", err);
         setDebugInfo(`Error during analysis: ${err.message}`);
         setDetectedSelfieResults(null);
      } finally {
         // Set detecting false AFTER detection attempt completes (success or error)
         console.log("StaticSelfieTryOn: Setting isDetecting to false.");
         setIsDetecting(false);
      }
    }; // End of imageElement.onload

    imageElement.onerror = () => {
      console.error("StaticSelfieTryOn: imageElement.onerror triggered.");
      setDebugInfo('Error: Failed to load captured image.');
      setStaticImageElement(null);
      setIsDetecting(false);
    };

    // console.log("StaticSelfieTryOn Effect: Setting imageElement.src");
    imageElement.src = capturedSelfieDataUrl;

    // Cleanup function
    return () => {
      // console.log("StaticSelfieTryOn Effect Cleanup: Resetting image callbacks and src");
      imageElement.onload = null;
      imageElement.onerror = null;
      imageElement.src = '';
    };

  }, [capturedSelfieDataUrl, faceLandmarker]); // Dependency on dataURL and landmarker


   // Retake Selfie
   const handleRetakeSelfie = () => {
    // console.log("StaticSelfieTryOn: Retake Selfie clicked.");
    setIsPreviewing(true);
    setCapturedSelfieDataUrl(null); // Clear data URL, triggers effect cleanup
    setDetectedSelfieResults(null);
    // setStaticImageElement(null); // Effect will clear this
    setSelfieDimensions({ width: 0, height: 0 });
    setCameraError(null);
    setIsCameraLoading(true);
    setIsDetecting(false);
    setDebugInfo('');
   };

  // Logging before return (reduced noise)
  // console.log(`StaticSelfieTryOn RENDERING: isPreviewing=${isPreviewing}, isDetecting=${isDetecting}, staticImageElement is ${staticImageElement ? 'TRUTHY' : 'FALSY'}`);

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
          {/* Container with aspect ratio */}
          <div className="relative w-full max-w-md mx-auto bg-gray-200 overflow-hidden rounded shadow" style={{ paddingTop: `${selfieDimensions.height && selfieDimensions.width ? (selfieDimensions.height / selfieDimensions.width) * 100 : 75}%` }}>
            {/* Logging check (reduced noise) */}
            {/* {console.log(`StaticSelfieTryOn JSX Check: staticImageElement value is:`, staticImageElement)} */}
            {staticImageElement ? ( // Render Renderer if image element exists
              <TryOnRenderer
                videoRefProp={null}
                imageElement={staticImageElement}
                mediaPipeResults={detectedSelfieResults} // Pass results for static image
                isStatic={true}
                brightness={FIXED_SELFIE_BRIGHTNESS}
                contrast={FIXED_SELFIE_CONTRAST}
                effectIntensity={effectIntensity} // Pass slider value
                className="absolute top-0 left-0 w-full h-full"
              />
            ) : (
              // Fallback UI
              <div className="absolute inset-0 flex items-center justify-center">
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