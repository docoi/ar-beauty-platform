// src/components/StaticSelfieTryOn.jsx - CORRECTED SYNTAX + REMOVED ImageSegmenter Logic

import React, { useState, useRef, useEffect, useCallback, forwardRef } from 'react';
import TryOnRenderer from './TryOnRenderer'; // Expecting the "Direct Rendering" version

const FIXED_SELFIE_BRIGHTNESS = 1.0; // Reset B/C as renderer ignores them now
const FIXED_SELFIE_CONTRAST = 1.0;

const StaticSelfieTryOn = forwardRef(({
    faceLandmarker, // Keep this
    // Removed imageSegmenter prop
    effectIntensity
}, ref) => {
  // State
  const [isPreviewing, setIsPreviewing] = useState(true);
  const [cameraStream, setCameraStream] = useState(null);
  const [isCameraLoading, setIsCameraLoading] = useState(true);
  const [cameraError, setCameraError] = useState(null);
  const [capturedSelfieDataUrl, setCapturedSelfieDataUrl] = useState(null);
  // Only need state for landmarker results
  const [detectedLandmarkResults, setDetectedLandmarkResults] = useState(null);
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
    if (isPreviewing) { enableStream(); } else { setIsCameraLoading(false); const currentStream = cameraStream || stream; currentStream?.getTracks().forEach(track => track.stop()); if (selfieVideoRef.current) { selfieVideoRef.current.srcObject = null; } setCameraStream(null); }
    return () => { isMounted = false; const currentStream = cameraStream || stream; currentStream?.getTracks().forEach(track => track.stop()); if (selfieVideoRef.current) { selfieVideoRef.current.srcObject = null; selfieVideoRef.current.onloadedmetadata = null; } setCameraStream(null); };
   }, [isPreviewing, faceLandmarker]);

  // Selfie Capture
  const handleTakeSelfie = useCallback(() => {
    if (!selfieVideoRef.current || selfieVideoRef.current.readyState < 2) { setCameraError("Cam not ready."); setDebugInfo("Error: Cam not ready."); return; }
    if (!selfieDimensions.width || !selfieDimensions.height){ setCameraError("No dims."); setDebugInfo("Error: No camera dims."); return; }
    setDebugInfo("Capturing..."); const video = selfieVideoRef.current; const tempCanvas = document.createElement('canvas'); tempCanvas.width = selfieDimensions.width; tempCanvas.height = selfieDimensions.height; const ctx = tempCanvas.getContext('2d'); ctx.save(); ctx.scale(-1, 1); ctx.translate(-tempCanvas.width, 0); ctx.drawImage(video, 0, 0, tempCanvas.width, tempCanvas.height); ctx.restore(); const dataUrl = tempCanvas.toDataURL('image/png');
    setCapturedSelfieDataUrl(dataUrl);
    setIsPreviewing(false);
    setDetectedLandmarkResults(null);
    setStaticImageElement(null);
    setDebugInfo('Capture complete. Loading image...');
    cameraStream?.getTracks().forEach(track => track.stop());
    setCameraStream(null);
    if (selfieVideoRef.current) { selfieVideoRef.current.srcObject = null; }
   }, [cameraStream, selfieDimensions]);

  // Image Loading and Face Detection Effect - Only run Landmarker
  useEffect(() => {
    if (!capturedSelfieDataUrl || !faceLandmarker) { if (staticImageElement !== null) { setStaticImageElement(null); } if (isDetecting) setIsDetecting(false); return; }
    console.log("StaticSelfieTryOn Effect: Loading image for detection...");
    setIsDetecting(true); setDebugInfo('Loading captured image...'); const imageElement = new Image();
    imageElement.onload = () => {
      console.log("StaticSelfieTryOn: Image loaded.");
      setSelfieDimensions({width: imageElement.naturalWidth, height: imageElement.naturalHeight});
      setStaticImageElement(imageElement); setDebugInfo('Image loaded, detecting face...');
      try {
        if (faceLandmarker) {
          console.log("StaticSelfieTryOn: Running detectForVideo()...");
          const startTime = performance.now();
          const landmarkResults = faceLandmarker.detectForVideo(imageElement, startTime);
          const endTime = performance.now();
          console.log(`--- StaticSelfieTryOn: Results (took ${endTime - startTime}ms) ---`);
          console.log(" -> landmarkResults:", landmarkResults); console.log(`-----------------------------------------`);
          setDetectedLandmarkResults(landmarkResults);
          setDebugInfo(`Analysis complete: ${landmarkResults?.faceLandmarks?.[0]?.length || 0} landmarks found.`);
        } else { /*...*/ setDetectedLandmarkResults(null); }
      } catch(err) { /*...*/ setDetectedLandmarkResults(null); }
      finally { setIsDetecting(false); }
    };
    imageElement.onerror = () => { /*...*/ }; imageElement.src = capturedSelfieDataUrl;
    return () => { /*...*/ };
  }, [capturedSelfieDataUrl, faceLandmarker]);


   // Retake Selfie
   const handleRetakeSelfie = () => {
    setIsPreviewing(true); setCapturedSelfieDataUrl(null); setDetectedLandmarkResults(null);
    setStaticImageElement(null); setSelfieDimensions({ width: 0, height: 0 }); setCameraError(null);
    setIsCameraLoading(true); setIsDetecting(false); setDebugInfo('');
   };

   // --- ***** JSX (Preview UI Restored) ***** ---
   return (
    <div className="border p-4 rounded bg-green-50">
      <h2 className="text-xl font-semibold mb-2 text-center">Try On Selfie Mode</h2>
      {isPreviewing ? ( // Render Preview UI block
         <>
            {isCameraLoading && <p className="text-center py-4">Starting camera...</p>}
            {cameraError && <p className="text-red-500 text-center py-4">{cameraError}</p>}
            {/* Container for aspect ratio */}
            <div className="relative w-full max-w-md mx-auto aspect-[9/16] bg-gray-200 overflow-hidden rounded shadow">
               {/* Live video preview */}
               <video ref={selfieVideoRef} autoPlay playsInline muted className={`absolute top-0 left-0 w-full h-full ${isCameraLoading || cameraError ? 'opacity-0' : 'opacity-100'}`} style={{ transform: 'scaleX(-1)', transition: 'opacity 0.3s', objectFit: 'cover' }}></video>
               {/* Loading/Error overlay */}
               {(isCameraLoading || cameraError) && ( <div className="absolute inset-0 flex items-center justify-center"><p className="text-gray-500 bg-white px-2 py-1 rounded shadow">{cameraError ? 'Error' : 'Loading...'}</p></div> )}
            </div>
            {/* Capture button */}
            <div className="text-center mt-4">
               <button onClick={handleTakeSelfie} disabled={isCameraLoading || !!cameraError || !cameraStream} className="bg-indigo-500 text-white px-4 py-2 rounded hover:bg-indigo-600 disabled:bg-gray-400 disabled:cursor-not-allowed"> Take Selfie </button>
            </div>
         </>
      ) : ( // Render Captured UI block
        <>
          <div className="relative w-full max-w-md mx-auto bg-gray-200 overflow-hidden rounded shadow" style={{ paddingTop: `${selfieDimensions.height && selfieDimensions.width ? (selfieDimensions.height / selfieDimensions.width) * 100 : 75}%` }}>
            {staticImageElement ? (
              <TryOnRenderer
                videoRefProp={null}
                imageElement={staticImageElement}
                mediaPipeResults={detectedLandmarkResults} // Pass only landmarks
                // Removed segmentationResults prop
                isStatic={true}
                brightness={FIXED_SELFIE_BRIGHTNESS}
                contrast={FIXED_SELFIE_CONTRAST}
                effectIntensity={effectIntensity}
                className="absolute top-0 left-0 w-full h-full"
              />
            ) : ( /* ... Fallback UI ... */
                 <div className="absolute inset-0 flex items-center justify-center"><p className="text-gray-500">{isDetecting ? 'Analyzing Selfie...' : (capturedSelfieDataUrl ? 'Loading Image...' : 'Initializing...')}</p></div>
             )}
          </div>
          <div className="mt-2 p-2 border bg-gray-100 text-xs overflow-auto max-h-20 max-w-md mx-auto rounded">
             <p className="font-semibold mb-1">Debug Info:</p>
             <pre className="whitespace-pre-wrap break-words">{debugInfo || 'N/A'}</pre>
          </div>
          <div className="text-center mt-4">
             <button onClick={handleRetakeSelfie} className="bg-gray-500 text-white px-4 py-2 rounded hover:bg-gray-600">
               Retake Selfie
             </button>
          </div>
        </>
      )}
      {!faceLandmarker && <p className="text-red-500 mt-2 text-center">Initializing AI model...</p>}
    </div>
  );
  // --- **************************************** ---

}); // End of forwardRef

StaticSelfieTryOn.displayName = 'StaticSelfieTryOn';
export default StaticSelfieTryOn;