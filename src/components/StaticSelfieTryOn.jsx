// src/components/StaticSelfieTryOn.jsx - REVISED - Pass Props to Renderer

import React, { useState, useRef, useEffect, useCallback, forwardRef, useImperativeHandle } from 'react';
import TryOnRenderer from './TryOnRenderer'; // Expects prop-driven version

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
  const [selfieDimensions, setSelfieDimensions] = useState({ width: 0, height: 0 });
  const [isDetecting, setIsDetecting] = useState(false);
  const [debugInfo, setDebugInfo] = useState('');
  // State to hold the loaded static image element
  const [staticImageElement, setStaticImageElement] = useState(null);


  // Refs
  const selfieVideoRef = useRef(null);
  // No longer need rendererRef for calling methods
  // const rendererRef = useRef(null);
  // const staticImageRef = useRef(null); // Now using state

  // Expose only intensity update if needed by parent
  useImperativeHandle(ref, () => ({
      // updateEffectIntensity: (intensity) => {
      //     // Parent now passes intensity directly as prop
      // }
  }));


  // Camera Access
  useEffect(() => { /* ... same ... */ }, [isPreviewing, faceLandmarker]);
  // Selfie Capture
  const handleTakeSelfie = useCallback(() => { /* ... same ... */ }, [cameraStream, selfieDimensions]);

  // Face Detection and Image Loading
  useEffect(() => {
    if (!capturedSelfieDataUrl || !faceLandmarker || !isDetecting) {
         setStaticImageElement(null); // Clear image element if no dataUrl
         return;
    }
    setDebugInfo('Loading Image...');
    const imageElement = new Image();
    imageElement.onload = async () => {
        console.log("StaticSelfieTryOn: Image loaded.");
        setSelfieDimensions({width: imageElement.naturalWidth, height: imageElement.naturalHeight}); // Set dimensions from image
        setStaticImageElement(imageElement); // Store image element in state
        setDebugInfo('Image loaded, detecting...');
        try {
            if (faceLandmarker) {
                const results = faceLandmarker.detectForVideo(imageElement, performance.now());
                 console.log("StaticSelfieTryOn: Detection complete.", results);
                if (results?.faceLandmarks?.length > 0) { setDebugInfo(`Detection OK. ${results.faceLandmarks.length} face(s). L[0]: ${results.faceLandmarks[0]?.length}`); }
                else { setDebugInfo('Detection OK. No face found.'); }
                setDetectedSelfieResults(results); // Store results in state
            } else { setDebugInfo('Error: Landmarker gone.'); }
        } catch(err) { setDebugInfo(`Detection Error: ${err.message}`); console.error("Detection Error:", err); }
        finally { setIsDetecting(false); }
    } ;
    imageElement.onerror = () => { setDebugInfo('Error: Img load failed.'); setIsDetecting(false); setStaticImageElement(null); } ;
    imageElement.src = capturedSelfieDataUrl;

    // Cleanup: Revoke object URL if we were using one (not currently)
    // return () => { if (staticImageRef.current && staticImageRef.current.src.startsWith('blob:')) { URL.revokeObjectURL(staticImageRef.current.src); } }

   }, [capturedSelfieDataUrl, faceLandmarker, isDetecting]); // Dependencies


  // --- REMOVED Effect to Trigger Rendering via Handle ---


  // Retake Selfie
  const handleRetakeSelfie = () => {
    setIsPreviewing(true); setCapturedSelfieDataUrl(null); setDetectedSelfieResults(null); setStaticImageElement(null); setCameraError(null); setIsCameraLoading(true); setIsDetecting(false); setDebugInfo('');
   };

  // --- JSX ---
  return (
    <div className="border p-4 rounded bg-green-50">
      <h2 className="text-xl font-semibold mb-2 text-center">Try On Selfie Mode</h2>
      {isPreviewing ? ( /* Preview Mode JSX */ <> {/* ... same ... */} </>
      ) : ( /* Captured Mode JSX */
        <>
          <div className="relative w-full max-w-md mx-auto bg-gray-200 overflow-hidden rounded shadow" style={{ paddingTop: `${selfieDimensions.height && selfieDimensions.width ? (selfieDimensions.height / selfieDimensions.width) * 100 : 75}%` }}>
            {/* Conditionally render TryOnRenderer and pass props */}
            {staticImageElement && selfieDimensions.width > 0 ? (
              <TryOnRenderer
                // No ref needed here anymore
                videoElement={null}                 // No video in static mode
                imageElement={staticImageElement}   // Pass image element from state
                mediaPipeResults={detectedSelfieResults} // Pass results state
                isStatic={true}                    // Indicate it's static
                brightness={FIXED_SELFIE_BRIGHTNESS} // Pass FIXED brightness
                contrast={FIXED_SELFIE_CONTRAST}     // Pass FIXED contrast
                effectIntensity={effectIntensity}    // Pass intensity
                className="absolute top-0 left-0 w-full h-full"
              />
            ) : (
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