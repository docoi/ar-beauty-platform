// src/components/StaticSelfieTryOn.jsx - REVERTED to code matching Msg #89 state

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
  // REMOVED state for dimensions previously, keep it removed for now
  // const [selfieDimensions, setSelfieDimensions] = useState({ width: 0, height: 0 });
  const [isDetecting, setIsDetecting] = useState(false);
  const [debugInfo, setDebugInfo] = useState('');
  // State to hold the loaded static image element
  const [staticImageElement, setStaticImageElement] = useState(null); // Keep this


  // Refs
  const selfieVideoRef = useRef(null);
  // const rendererRef = useRef(null); // Not used

  // Imperative handle
  useImperativeHandle(ref, () => ({
      updateEffectIntensity: (intensity) => { /* No-op for now */ },
  }));


  // Camera Access - REMOVE setting selfieDimensions here
  useEffect(() => {
    let isMounted = true; let stream = null; const enableStream = async () => { if (!isPreviewing || !faceLandmarker || !navigator.mediaDevices?.getUserMedia) { if (isMounted) setIsCameraLoading(false); return; } setIsCameraLoading(true); setCameraError(null); setDebugInfo(''); try { stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 720 } }, audio: false }); if (isMounted && selfieVideoRef.current) { selfieVideoRef.current.srcObject = stream; setCameraStream(stream); selfieVideoRef.current.onloadedmetadata = () => { if (isMounted && selfieVideoRef.current) { /* NO setSelfieDimensions here */ setIsCameraLoading(false); } }; } else if (stream) { stream.getTracks().forEach(track => track.stop()); } } catch (err) { if (isMounted) { let message = "Camera Error."; /* ... error messages ... */ setCameraError(message); setIsCameraLoading(false); setDebugInfo(`Camera Error: ${message}`); } } }; if (isPreviewing) { enableStream(); } else { setIsCameraLoading(false); } return () => { isMounted = false; const currentStream = cameraStream || stream; currentStream?.getTracks().forEach(track => track.stop()); if (selfieVideoRef.current) { selfieVideoRef.current.srcObject = null; selfieVideoRef.current.onloadedmetadata = null; } setCameraStream(null); };
   }, [isPreviewing, faceLandmarker]);

  // Selfie Capture - REMOVE dependency on selfieDimensions state
  const handleTakeSelfie = useCallback(() => {
    if (!selfieVideoRef.current || selfieVideoRef.current.readyState < 2) { setCameraError("Cam not ready."); setDebugInfo("Error: Cam not ready."); return; }
    const videoWidth = selfieVideoRef.current.videoWidth; // Get dims directly
    const videoHeight = selfieVideoRef.current.videoHeight;
    if (!videoWidth || !videoHeight){ setCameraError("No video dims for capture."); setDebugInfo("Error: No video dims for capture."); return; }
    setDebugInfo("Capturing..."); const video = selfieVideoRef.current; const tempCanvas = document.createElement('canvas'); tempCanvas.width = videoWidth; tempCanvas.height = videoHeight; const ctx = tempCanvas.getContext('2d'); ctx.save(); ctx.scale(-1, 1); ctx.translate(-tempCanvas.width, 0); ctx.drawImage(video, 0, 0, tempCanvas.width, tempCanvas.height); ctx.restore(); const dataUrl = tempCanvas.toDataURL('image/png'); setCapturedSelfieDataUrl(dataUrl); setIsPreviewing(false); setDetectedSelfieResults(null); setStaticImageElement(null); setIsDetecting(true); setDebugInfo('Capture complete. Analyzing...'); cameraStream?.getTracks().forEach(track => track.stop()); setCameraStream(null);
   }, [cameraStream]); // Removed selfieDimensions dependency

  // Face Detection and Image Loading - REMOVE setting selfieDimensions
  useEffect(() => {
    if (!capturedSelfieDataUrl || !faceLandmarker || !isDetecting) { setStaticImageElement(null); return; }
    setDebugInfo('Loading Image...'); const imageElement = new Image();
    imageElement.onload = async () => { console.log("StaticSelfieTryOn: Image loaded."); /* NO setSelfieDimensions here */ setStaticImageElement(imageElement); setDebugInfo('Image loaded, detecting...'); try { if (faceLandmarker) { const results = faceLandmarker.detectForVideo(imageElement, performance.now()); console.log("StaticSelfieTryOn: Detection complete.", results); /*...*/ setDetectedSelfieResults(results); } else { /*...*/ } } catch(err) { /*...*/ } finally { setIsDetecting(false); } } ;
    imageElement.onerror = () => { setDebugInfo('Error: Img load failed.'); setIsDetecting(false); setStaticImageElement(null); } ;
    imageElement.src = capturedSelfieDataUrl;
   }, [capturedSelfieDataUrl, faceLandmarker, isDetecting]); // Dependencies


   // --- NO Effect needed to Trigger Rendering ---


  // Retake Selfie - Ensure staticImageElement is cleared
  const handleRetakeSelfie = () => {
    setIsPreviewing(true); setCapturedSelfieDataUrl(null); setDetectedSelfieResults(null); setStaticImageElement(null); /* << Clear image element */ setCameraError(null); setIsCameraLoading(true); setIsDetecting(false); setDebugInfo('');
   };

  // --- JSX --- (Restore structure from before Msg #95)
  return (
    <div className="border p-4 rounded bg-green-50">
      <h2 className="text-xl font-semibold mb-2 text-center">Try On Selfie Mode</h2>
      {isPreviewing ? ( // Render Preview UI when isPreviewing is true
         <>
            {isCameraLoading && <p className="text-center py-4">Starting camera...</p>}
            {cameraError && <p className="text-red-500 text-center py-4">{cameraError}</p>}
            {/* Ensure container aspect ratio matches typical selfie */}
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
          {/* Use a fixed aspect ratio for container or calculate dynamically */}
          <div className="relative w-full max-w-md mx-auto bg-gray-200 overflow-hidden rounded shadow" style={{ paddingTop: `133.33%` }}> {/* Example: 4:3 Aspect ratio */}
             {console.log(`StaticSelfieTryOn JSX Check: staticImageElement is ${staticImageElement ? 'truthy' : 'falsy'}`)}
            {/* Render based ONLY on staticImageElement existence */}
            {staticImageElement ? (
              <TryOnRenderer
                videoRefProp={null}
                imageElement={staticImageElement}
                mediaPipeResults={detectedSelfieResults}
                isStatic={true}
                brightness={FIXED_SELFIE_BRIGHTNESS} // Passed but not used by bare shader yet
                contrast={FIXED_SELFIE_CONTRAST}   // Passed but not used by bare shader yet
                effectIntensity={effectIntensity}
                className="absolute top-0 left-0 w-full h-full"
                // No background style needed now
              />
            ) : (
              // Render "Loading Image..." fallback
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