// src/components/StaticSelfieTryOn.jsx - COMPLETE - Use Data URL for Condition

import React, { useState, useRef, useEffect, useCallback, forwardRef, useImperativeHandle } from 'react';
import TryOnRenderer from './TryOnRenderer'; // Should use the one with bare-minimum shader

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
  const [capturedSelfieDataUrl, setCapturedSelfieDataUrl] = useState(null); // Keep Data URL state
  const [detectedSelfieResults, setDetectedSelfieResults] = useState(null);
  const [isDetecting, setIsDetecting] = useState(false);
  const [debugInfo, setDebugInfo] = useState('');
  // REMOVE staticImageElement state
  // const [staticImageElement, setStaticImageElement] = useState(null);


  // Refs
  const selfieVideoRef = useRef(null);
  // const staticImageRef = useRef(null); // Can remove if not needed elsewhere

  // Imperative handle
  useImperativeHandle(ref, () => ({ updateEffectIntensity: (intensity) => { /* No-op */ }, }));

  // Camera Access
  useEffect(() => { /* ... */ }, [isPreviewing, faceLandmarker]);
  // Selfie Capture (Sets Data URL)
  const handleTakeSelfie = useCallback(() => { /* ... sets capturedSelfieDataUrl ... */ }, [cameraStream]);

  // Face Detection (Triggered by Data URL, Loads image locally)
  useEffect(() => {
    // Don't proceed if no data url or still previewing/detecting elsewhere
    if (!capturedSelfieDataUrl || isPreviewing || !faceLandmarker || !isDetecting) {
        return;
    }
    setDebugInfo('Loading Image for Detection...');
    const imageElement = new Image();
    imageElement.onload = async () => {
        console.log("StaticSelfieTryOn: Image loaded for detection.");
        setDebugInfo('Image loaded, detecting...');
        try {
            if (faceLandmarker) {
                const results = faceLandmarker.detectForVideo(imageElement, performance.now());
                console.log("StaticSelfieTryOn: Detection complete.", results);
                // Store results in state - This might trigger re-render
                setDetectedSelfieResults(results);
                if (results?.faceLandmarks?.length > 0) { setDebugInfo(`Detection OK. ${results.faceLandmarks.length} face(s).`); }
                else { setDebugInfo('Detection OK. No face found.'); }
            } else { setDebugInfo('Error: Landmarker gone.'); }
        } catch(err) { setDebugInfo(`Detection Error: ${err.message}`); console.error("Detection Error:", err); }
        finally { setIsDetecting(false); } // Mark detection as finished
    } ;
    imageElement.onerror = () => { setDebugInfo('Error: Img load failed.'); setIsDetecting(false); setCapturedSelfieDataUrl(null); } ; // Clear data url on error
    imageElement.src = capturedSelfieDataUrl; // Load from data url

   }, [capturedSelfieDataUrl, faceLandmarker, isDetecting, isPreviewing]); // Added isPreviewing


  // Retake Selfie - Clears Data URL
  const handleRetakeSelfie = () => {
    setIsPreviewing(true); setCapturedSelfieDataUrl(null); /* << Clear Data URL */ setDetectedSelfieResults(null); setCameraError(null); setIsCameraLoading(true); setIsDetecting(false); setDebugInfo('');
   };

  // --- Logging before return ---
  console.log(`StaticSelfieTryOn Rendering: isPreviewing=${isPreviewing}, capturedSelfieDataUrl=${capturedSelfieDataUrl ? 'Exists' : 'null'}`);


  // --- JSX ---
  return (
    <div className="border p-4 rounded bg-green-50">
      <h2 className="text-xl font-semibold mb-2 text-center">Try On Selfie Mode</h2>
      {isPreviewing ? ( // Render Preview UI
         <> {/* ... Preview JSX ... */} </>
      ) : ( // Render Captured UI
        <>
          {/* Container div */}
          <div className="relative w-full max-w-md mx-auto bg-gray-200 overflow-hidden rounded shadow" style={{ paddingTop: `133.33%` }}>
             {/* Log value used in condition */}
             {console.log(`StaticSelfieTryOn JSX Check: capturedSelfieDataUrl is ${capturedSelfieDataUrl ? 'truthy' : 'falsy'}`)}

            {/* Render based ONLY on capturedSelfieDataUrl existence */}
            {capturedSelfieDataUrl ? ( // <--- CONDITION CHANGED
              <TryOnRenderer
                videoRefProp={null}
                // Pass Data URL instead of Image Element
                imageDataUrl={capturedSelfieDataUrl} // NEW PROP
                imageElement={null} // Pass null for image element prop
                mediaPipeResults={detectedSelfieResults}
                isStatic={true}
                brightness={FIXED_SELFIE_BRIGHTNESS}
                contrast={FIXED_SELFIE_CONTRAST}
                effectIntensity={effectIntensity}
                className="absolute top-0 left-0 w-full h-full"
                // No background style needed for this test
              />
            ) : (
               // Show fallback ONLY if not previewing and no data URL
              <div className="absolute inset-0 flex items-center justify-center"><p className="text-gray-500">Loading Image...</p></div>
            )}
          </div>
          {/* ... Debug Info and Retake Button ... */}
        </>
      )}
      {!faceLandmarker && <p className="text-red-500 mt-2 text-center">Initializing AI model...</p>}
    </div>
  );
});

export default StaticSelfieTryOn;