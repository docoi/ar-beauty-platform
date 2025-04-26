// src/components/StaticSelfieTryOn.jsx - Simplify Render Condition

import React, { useState, useRef, useEffect, useCallback, forwardRef, useImperativeHandle } from 'react';
import TryOnRenderer from './TryOnRenderer'; // Should use the one with bare-minimum shader for now

// *** Define the best-found correction values ***
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
  // const [selfieDimensions, setSelfieDimensions] = useState({ width: 0, height: 0 }); // REMOVE state for dimensions
  const [isDetecting, setIsDetecting] = useState(false);
  const [debugInfo, setDebugInfo] = useState('');
  // State to hold the loaded static image element
  const [staticImageElement, setStaticImageElement] = useState(null); // Keep this


  // Refs
  const selfieVideoRef = useRef(null);
  // const rendererRef = useRef(null); // No longer used

  // Imperative handle
  useImperativeHandle(ref, () => ({ /* ... intensity update ... */ }));

  // Camera Access - REMOVE setting selfieDimensions here
  useEffect(() => {
    let isMounted = true; let stream = null; const enableStream = async () => { if (!isPreviewing || !faceLandmarker || !navigator.mediaDevices?.getUserMedia) { if (isMounted) setIsCameraLoading(false); return; } setIsCameraLoading(true); setCameraError(null); setDebugInfo(''); try { stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 720 } }, audio: false }); if (isMounted && selfieVideoRef.current) { selfieVideoRef.current.srcObject = stream; setCameraStream(stream); selfieVideoRef.current.onloadedmetadata = () => { if (isMounted && selfieVideoRef.current) { /* setSelfieDimensions({ width: selfieVideoRef.current.videoWidth, height: selfieVideoRef.current.videoHeight }); */ setIsCameraLoading(false); } }; } else if (stream) { stream.getTracks().forEach(track => track.stop()); } } catch (err) { /* ... */ } }; if (isPreviewing) { enableStream(); } else { setIsCameraLoading(false); } return () => { /* ... */ };
   }, [isPreviewing, faceLandmarker]);

  // Selfie Capture - REMOVE dependency on selfieDimensions
  const handleTakeSelfie = useCallback(() => {
    if (!selfieVideoRef.current || selfieVideoRef.current.readyState < 2) { /*...*/ return; }
    // We need video dimensions just for capture canvas, get them directly
    const videoWidth = selfieVideoRef.current.videoWidth;
    const videoHeight = selfieVideoRef.current.videoHeight;
    if (!videoWidth || !videoHeight){ setCameraError("No video dims for capture."); setDebugInfo("Error: No video dims for capture."); return; }
    setDebugInfo("Capturing..."); const video = selfieVideoRef.current; const tempCanvas = document.createElement('canvas'); tempCanvas.width = videoWidth; tempCanvas.height = videoHeight; const ctx = tempCanvas.getContext('2d'); ctx.save(); ctx.scale(-1, 1); ctx.translate(-tempCanvas.width, 0); ctx.drawImage(video, 0, 0, tempCanvas.width, tempCanvas.height); ctx.restore(); const dataUrl = tempCanvas.toDataURL('image/png'); setCapturedSelfieDataUrl(dataUrl); setIsPreviewing(false); setDetectedSelfieResults(null); setIsDetecting(true); setDebugInfo('Capture complete. Analyzing...'); cameraStream?.getTracks().forEach(track => track.stop()); setCameraStream(null);
   }, [cameraStream]); // Removed selfieDimensions dependency

  // Face Detection and Image Loading - REMOVE setting selfieDimensions
  useEffect(() => {
    if (!capturedSelfieDataUrl || !faceLandmarker || !isDetecting) { setStaticImageElement(null); return; }
    setDebugInfo('Loading Image...'); const imageElement = new Image();
    imageElement.onload = async () => { console.log("StaticSelfieTryOn: Image loaded."); /* setSelfieDimensions({width: imageElement.naturalWidth, height: imageElement.naturalHeight}); */ setStaticImageElement(imageElement); setDebugInfo('Image loaded, detecting...'); try { if (faceLandmarker) { const results = faceLandmarker.detectForVideo(imageElement, performance.now()); console.log("StaticSelfieTryOn: Detection complete.", results); /*...*/ setDetectedSelfieResults(results); } else { /*...*/ } } catch(err) { /*...*/ } finally { setIsDetecting(false); } } ;
    imageElement.onerror = () => { setDebugInfo('Error: Img load failed.'); setIsDetecting(false); setStaticImageElement(null); } ;
    imageElement.src = capturedSelfieDataUrl;
   }, [capturedSelfieDataUrl, faceLandmarker, isDetecting]); // Dependencies


   // --- REMOVED Effect to Trigger Rendering via Handle ---


  // Retake Selfie - Ensure staticImageElement is cleared
  const handleRetakeSelfie = () => {
    setIsPreviewing(true); setCapturedSelfieDataUrl(null); setDetectedSelfieResults(null); setStaticImageElement(null); /* << Clear image element */ setCameraError(null); setIsCameraLoading(true); setIsDetecting(false); setDebugInfo('');
   };

  // --- JSX ---
  return (
    <div className="border p-4 rounded bg-green-50">
      <h2 className="text-xl font-semibold mb-2 text-center">Try On Selfie Mode</h2>
      {isPreviewing ? ( /* Preview Mode */ <> {/* ... same ... */} </>
      ) : ( /* Captured Mode */
        <>
          {/* *** SIMPLIFIED RENDER CONDITION for TryOnRenderer container *** */}
          <div className="relative w-full max-w-md mx-auto bg-gray-200 overflow-hidden rounded shadow" style={{ paddingTop: `75%` }}> {/* Use fixed aspect ratio or calculate differently if needed */}
            {/* Render based ONLY on staticImageElement existence */}
            {staticImageElement ? (
              <TryOnRenderer
                // Pass props as before
                videoElement={null}
                imageElement={staticImageElement}
                mediaPipeResults={detectedSelfieResults}
                isStatic={true}
                brightness={FIXED_SELFIE_BRIGHTNESS}
                contrast={FIXED_SELFIE_CONTRAST}
                effectIntensity={effectIntensity}
                className="absolute top-0 left-0 w-full h-full"
              />
            ) : (
              // Show "Loading Image..." only if not previewing and image isn't ready
              <div className="absolute inset-0 flex items-center justify-center"><p className="text-gray-500">Loading Image...</p></div>
            )}
          </div>
          <div className="mt-2 p-2 border bg-gray-100 text-xs overflow-auto max-h-20 max-w-md mx-auto rounded"> <p className="font-semibold mb-1">Debug Info:</p> <pre className="whitespace-pre-wrap break-words">{isDetecting ? 'Analyzing selfie...' : (debugInfo || 'N/A')}</pre> </div>
          <div className="text-center mt-4"> <button onClick={handleRetakeSelfie} className="bg-gray-500 text-white px-4 py-2 rounded hover:bg-gray-600"> Retake Selfie </button> </div>
        </>
      )}
      {!faceLandmarker && <p className="text-red-500 mt-2 text-center">Initializing AI model...</p>}
    </div>
  );
});

export default StaticSelfieTryOn;