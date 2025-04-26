// src/components/StaticSelfieTryOn.jsx - COMPLETE - Add key Prop

import React, { useState, useRef, useEffect, useCallback, forwardRef, useImperativeHandle } from 'react';
import TryOnRenderer from './TryOnRenderer'; // Using MeshBasicMaterial version

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
  const [selfieDimensions, setSelfieDimensions] = useState({ width: 0, height: 0 }); // Restore dimensions state
  const [isDetecting, setIsDetecting] = useState(false);
  const [debugInfo, setDebugInfo] = useState('');
  const [staticImageElement, setStaticImageElement] = useState(null);
  const [imageLoadCounter, setImageLoadCounter] = useState(0); // State for key prop


  // Refs
  const selfieVideoRef = useRef(null);

  // Imperative handle
  useImperativeHandle(ref, () => ({ updateEffectIntensity: (intensity) => {}, }));

  // Camera Access - Restore setting selfieDimensions
  useEffect(() => {
    let isMounted = true; let stream = null; const enableStream = async () => { if (!isPreviewing || !faceLandmarker || !navigator.mediaDevices?.getUserMedia) { if (isMounted) setIsCameraLoading(false); return; } setIsCameraLoading(true); setCameraError(null); setDebugInfo(''); try { stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 720 } }, audio: false }); if (isMounted && selfieVideoRef.current) { selfieVideoRef.current.srcObject = stream; setCameraStream(stream); selfieVideoRef.current.onloadedmetadata = () => { if (isMounted && selfieVideoRef.current) { setSelfieDimensions({ width: selfieVideoRef.current.videoWidth, height: selfieVideoRef.current.videoHeight }); setIsCameraLoading(false); } }; } else if (stream) { stream.getTracks().forEach(track => track.stop()); } } catch (err) { /* ... */ } }; if (isPreviewing) { enableStream(); } else { setIsCameraLoading(false); } return () => { /* ... cleanup ... */ };
   }, [isPreviewing, faceLandmarker]);

  // Selfie Capture - Restore dependency on selfieDimensions state
  const handleTakeSelfie = useCallback(() => {
    if (!selfieVideoRef.current || selfieVideoRef.current.readyState < 2) { /*...*/ return; }
    if (!selfieDimensions.width || !selfieDimensions.height){ /*...*/ return; }
    setDebugInfo("Capturing..."); const video = selfieVideoRef.current; const tempCanvas = document.createElement('canvas'); /*...*/ const dataUrl = tempCanvas.toDataURL('image/png'); setCapturedSelfieDataUrl(dataUrl); setIsPreviewing(false); setDetectedSelfieResults(null); setStaticImageElement(null); setIsDetecting(true); setDebugInfo('Capture complete. Analyzing...'); cameraStream?.getTracks().forEach(track => track.stop()); setCameraStream(null);
   }, [cameraStream, selfieDimensions]); // Restore dependency

  // Face Detection and Image Loading - Restore setting selfieDimensions, increment counter
  useEffect(() => {
    if (!capturedSelfieDataUrl || !faceLandmarker || !isDetecting) { setStaticImageElement(null); return; }
    setDebugInfo('Loading Image...'); const imageElement = new Image();
    imageElement.onload = async () => { console.log("StaticSelfieTryOn: Image loaded."); setSelfieDimensions({width: imageElement.naturalWidth, height: imageElement.naturalHeight}); setStaticImageElement(imageElement); setImageLoadCounter(count => count + 1); /* << Increment key counter */ setDebugInfo('Image loaded, detecting...'); try { if (faceLandmarker) { const results = faceLandmarker.detectForVideo(imageElement, performance.now()); setDetectedSelfieResults(results); /*...*/ } else { /*...*/ } } catch(err) { /*...*/ } finally { setIsDetecting(false); } } ;
    imageElement.onerror = () => { setDebugInfo('Error: Img load failed.'); setIsDetecting(false); setStaticImageElement(null); setCapturedSelfieDataUrl(null); } ; // Clear URL on error
    imageElement.src = capturedSelfieDataUrl;
   }, [capturedSelfieDataUrl, faceLandmarker, isDetecting]); // Dependencies


  // Retake Selfie - Reset counter
  const handleRetakeSelfie = () => {
    setIsPreviewing(true); setCapturedSelfieDataUrl(null); setDetectedSelfieResults(null); setStaticImageElement(null); setCameraError(null); setIsCameraLoading(true); setIsDetecting(false); setDebugInfo(''); setImageLoadCounter(0); /* << Reset key counter */
   };

  // --- Logging before return ---
  console.log(`StaticSelfieTryOn Rendering: isPreviewing=${isPreviewing}, staticImageElement=${staticImageElement ? 'Exists' : 'null'}, keyCounter=${imageLoadCounter}`);


  // --- JSX --- (Restore original structure)
  return (
    <div className="border p-4 rounded bg-green-50">
      <h2 className="text-xl font-semibold mb-2 text-center">Try On Selfie Mode</h2>
      {isPreviewing ? ( // Render Preview UI
         <> {/* ... Preview JSX ... */} </>
      ) : ( // Render Captured UI
        <>
          <div className="relative w-full max-w-md mx-auto bg-gray-200 overflow-hidden rounded shadow" style={{ paddingTop: `${selfieDimensions.height && selfieDimensions.width ? (selfieDimensions.height / selfieDimensions.width) * 100 : 75}%` }}>
            {console.log(`StaticSelfieTryOn JSX Check: staticImageElement is ${staticImageElement ? 'truthy' : 'falsy'}`)}
            {/* Render based ONLY on staticImageElement existence */}
            {staticImageElement ? (
              <TryOnRenderer
                // *** ADD UNIQUE KEY PROP ***
                key={`static-image-${imageLoadCounter}`} // Force re-mount on new image
                videoRefProp={null}
                imageElement={staticImageElement}
                mediaPipeResults={detectedSelfieResults}
                isStatic={true}
                brightness={FIXED_SELFIE_BRIGHTNESS}
                contrast={FIXED_SELFIE_CONTRAST}
                effectIntensity={effectIntensity}
                className="absolute top-0 left-0 w-full h-full"
              />
            ) : (
              <div className="absolute inset-0 flex items-center justify-center"><p className="text-gray-500">Loading Image...</p></div> // Restore fallback
            )}
          </div>
          {/* ... Debug Info and Retake Button ... */}
           <div className="mt-2 p-2 border bg-gray-100 text-xs overflow-auto max-h-20 max-w-md mx-auto rounded"> <p className="font-semibold mb-1">Debug Info:</p> <pre className="whitespace-pre-wrap break-words">{isDetecting ? 'Analyzing selfie...' : (debugInfo || 'N/A')}</pre> </div>
           <div className="text-center mt-4"> <button onClick={handleRetakeSelfie} className="bg-gray-500 text-white px-4 py-2 rounded hover:bg-gray-600"> Retake Selfie </button> </div>
        </>
      )}
      {!faceLandmarker && <p className="text-red-500 mt-2 text-center">Initializing AI model...</p>}
    </div>
  );
});

export default StaticSelfieTryOn;