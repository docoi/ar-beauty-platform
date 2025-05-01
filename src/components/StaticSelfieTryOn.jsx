// src/components/StaticSelfieTryOn.jsx - BASELINE COMPATIBLE
// Only handles camera preview/capture and passes image element, does NOT run AI.

import React, { useState, useRef, useEffect, useCallback, forwardRef } from 'react';
import TryOnRenderer from './TryOnRenderer'; // Expects the BASELINE version

const StaticSelfieTryOn = forwardRef(({
    // REMOVED: faceLandmarker, imageSegmenter, effectIntensity props
}, ref) => {
  // State
  const [isPreviewing, setIsPreviewing] = useState(true);
  const [cameraStream, setCameraStream] = useState(null);
  const [isCameraLoading, setIsCameraLoading] = useState(true);
  const [cameraError, setCameraError] = useState(null);
  const [capturedSelfieDataUrl, setCapturedSelfieDataUrl] = useState(null);
  const [selfieDimensions, setSelfieDimensions] = useState({ width: 0, height: 0 });
  // const [isDetecting, setIsDetecting] = useState(false); // Not needed for baseline
  const [debugInfo, setDebugInfo] = useState('');
  const [staticImageElement, setStaticImageElement] = useState(null); // Used by renderer

  // REMOVED: AI results state

  // Refs
  const selfieVideoRef = useRef(null);

  // Camera Access Effect (No AI dependency)
  useEffect(() => {
    let isMounted = true; let stream = null;
    const enableStream = async () => {
        if (!isPreviewing || !navigator.mediaDevices?.getUserMedia) {
             if(isMounted) setIsCameraLoading(false); return;
        }
        setIsCameraLoading(true); setCameraError(null); setDebugInfo('');
        try {
            stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 720 } }, audio: false });
            if (isMounted && selfieVideoRef.current) {
                selfieVideoRef.current.srcObject = stream;
                setCameraStream(stream);
                selfieVideoRef.current.onloadedmetadata = () => {
                    if (isMounted && selfieVideoRef.current) {
                        setSelfieDimensions({ width: selfieVideoRef.current.videoWidth, height: selfieVideoRef.current.videoHeight });
                        setIsCameraLoading(false);
                    }
                };
            } else if(stream) { stream?.getTracks().forEach(track => track.stop()); }
        } catch (err) {
            if(isMounted){ let message = "Camera Error."; setCameraError(message); setIsCameraLoading(false); setDebugInfo(`Camera Error: ${message}`); }
        }
    };

    if (isPreviewing) { enableStream(); }
    else {
         // Stop stream if switching away from preview
         setIsCameraLoading(false);
         const currentStream = cameraStream || stream; // Get stream from state or local var
         currentStream?.getTracks().forEach(track => track.stop());
         if (selfieVideoRef.current) { selfieVideoRef.current.srcObject = null; }
         setCameraStream(null); // Clear stream state
    }

    // Cleanup
    return () => {
        isMounted = false;
        const currentStream = cameraStream || stream;
        currentStream?.getTracks().forEach(track => track.stop());
        if (selfieVideoRef.current) { selfieVideoRef.current.srcObject = null; selfieVideoRef.current.onloadedmetadata = null; }
        setCameraStream(null);
    };
   }, [isPreviewing]); // Only depends on isPreviewing

  // Selfie Capture (No change needed here)
  const handleTakeSelfie = useCallback(() => {
    if (!selfieVideoRef.current || selfieVideoRef.current.readyState < 2) { setCameraError("Cam not ready."); setDebugInfo("Error: Cam not ready."); return; }
    if (!selfieDimensions.width || !selfieDimensions.height){ setCameraError("No dims."); setDebugInfo("Error: No camera dims."); return; }
    setDebugInfo("Capturing..."); const video = selfieVideoRef.current; const tempCanvas = document.createElement('canvas'); tempCanvas.width = selfieDimensions.width; tempCanvas.height = selfieDimensions.height; const ctx = tempCanvas.getContext('2d'); ctx.save(); ctx.scale(-1, 1); ctx.translate(-tempCanvas.width, 0); ctx.drawImage(video, 0, 0, tempCanvas.width, tempCanvas.height); ctx.restore(); const dataUrl = tempCanvas.toDataURL('image/png');
    setCapturedSelfieDataUrl(dataUrl);
    setIsPreviewing(false); // Switch view
    // Clear AI results state if we had it
    setStaticImageElement(null); // Reset image element until loaded
    setDebugInfo('Capture complete. Loading image...');
    // Stop camera stream after capture
    cameraStream?.getTracks().forEach(track => track.stop());
    setCameraStream(null);
    if (selfieVideoRef.current) { selfieVideoRef.current.srcObject = null; }
   }, [cameraStream, selfieDimensions]);

  // Image Loading Effect (NO AI detection)
  useEffect(() => {
    if (!capturedSelfieDataUrl) {
        // Clear image element if data URL is removed
        if (staticImageElement) setStaticImageElement(null);
        return;
    }

    console.log("StaticSelfieTryOn Baseline: Loading captured image...");
    setDebugInfo('Loading captured image...');
    // setIsDetecting(true); // Not detecting

    const imageElement = new Image();
    imageElement.onload = () => {
      console.log("StaticSelfieTryOn Baseline: Image loaded.");
      setSelfieDimensions({width: imageElement.naturalWidth, height: imageElement.naturalHeight});
      setStaticImageElement(imageElement); // Set the image element for the renderer
      setDebugInfo(`Image loaded: ${imageElement.naturalWidth}x${imageElement.naturalHeight}`);
      // setIsDetecting(false);
    };
    imageElement.onerror = () => {
      console.error("StaticSelfieTryOn Baseline: Error loading captured image.");
      setDebugInfo('Error loading image.');
      // setIsDetecting(false);
      setStaticImageElement(null);
    };
    imageElement.src = capturedSelfieDataUrl;

    // Cleanup for image load effect
    return () => {
        imageElement.onload = null; imageElement.onerror = null; imageElement.src = '';
    };
  }, [capturedSelfieDataUrl]); // Only depends on captured URL


   // Retake Selfie (Clear image state)
   const handleRetakeSelfie = () => {
    setIsPreviewing(true); setCapturedSelfieDataUrl(null);
    // Clear AI results if we had them
    setStaticImageElement(null); // Clear image element
    setSelfieDimensions({ width: 0, height: 0 }); setCameraError(null);
    setIsCameraLoading(true);
    // setIsDetecting(false);
    setDebugInfo('');
   };

   // JSX - Pass ONLY imageElement and isStatic
   return (
    <div className="border p-4 rounded bg-green-50">
      <h2 className="text-xl font-semibold mb-2 text-center">Try On Selfie Mode</h2>
      {isPreviewing ? ( // Render Preview UI block
         <>
            {isCameraLoading && <p className="text-center py-4">Starting camera...</p>}
            {cameraError && <p className="text-red-500 text-center py-4">{cameraError}</p>}
            {/* Aspect ratio container */}
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
          {/* Aspect ratio container */}
          <div className="relative w-full max-w-md mx-auto bg-gray-200 overflow-hidden rounded shadow" style={{ paddingTop: `${selfieDimensions.height && selfieDimensions.width ? (selfieDimensions.height / selfieDimensions.width) * 100 : 75}%` }}>
            {/* Use staticImageElement state to drive rendering */}
            {staticImageElement ? (
              <TryOnRenderer
                videoRefProp={null}         // No video ref
                imageElement={staticImageElement} // Pass the loaded image element
                isStatic={true}            // Indicate static mode
                // REMOVED: mediaPipeResults, segmentationResults, effectIntensity
                className="absolute top-0 left-0 w-full h-full"
              />
            ) : ( /* Fallback UI while image loads */
                 <div className="absolute inset-0 flex items-center justify-center">
                    <p className="text-gray-500">
                        {capturedSelfieDataUrl ? 'Loading Image...' : 'Initializing...'}
                    </p>
                 </div>
             )}
          </div>
          {/* Debug Info & Retake Button */}
           <div className="mt-2 p-2 border bg-gray-100 text-xs overflow-auto max-h-20 max-w-md mx-auto rounded"><p className="font-semibold mb-1">Debug Info:</p><pre className="whitespace-pre-wrap break-words">{debugInfo || 'N/A'}</pre></div>
           <div className="text-center mt-4"><button onClick={handleRetakeSelfie} className="bg-gray-500 text-white px-4 py-2 rounded hover:bg-gray-600">Retake Selfie</button></div>
        </>
      )}
      {/* Removed AI model status text */}
    </div>
  );

});
StaticSelfieTryOn.displayName = 'StaticSelfieTryOn';
export default StaticSelfieTryOn;