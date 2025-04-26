// src/components/StaticSelfieTryOn.jsx - COMPLETE - Remove Fallback, Add BG Color

import React, { useState, useRef, useEffect, useCallback, forwardRef, useImperativeHandle } from 'react';
import TryOnRenderer from './TryOnRenderer'; // Should use the one with bare-minimum shader

const FIXED_SELFIE_BRIGHTNESS = 2.15;
const FIXED_SELFIE_CONTRAST = 0.55;

const StaticSelfieTryOn = forwardRef(({
    faceLandmarker,
    effectIntensity
}, ref) => {
  // ... state variables (including staticImageElement) ...
  const [isPreviewing, setIsPreviewing] = useState(true);
  const [cameraStream, setCameraStream] = useState(null);
  const [isCameraLoading, setIsCameraLoading] = useState(true);
  const [cameraError, setCameraError] = useState(null);
  const [capturedSelfieDataUrl, setCapturedSelfieDataUrl] = useState(null);
  const [detectedSelfieResults, setDetectedSelfieResults] = useState(null);
  const [isDetecting, setIsDetecting] = useState(false);
  const [debugInfo, setDebugInfo] = useState('');
  const [staticImageElement, setStaticImageElement] = useState(null);

  // ... refs ...
  const selfieVideoRef = useRef(null);

  // ... useImperativeHandle ...
   useImperativeHandle(ref, () => ({ updateEffectIntensity: (intensity) => { /* No-op */ }, }));

  // ... useEffect for Camera Access ...
   useEffect(() => { /* ... */ }, [isPreviewing, faceLandmarker]);
  // ... useCallback for handleTakeSelfie ...
   const handleTakeSelfie = useCallback(() => { /* ... */ }, [cameraStream]);
  // ... useEffect for Face Detection / Image Loading ...
   useEffect(() => { /* ... */ }, [capturedSelfieDataUrl, faceLandmarker, isDetecting]);
  // ... handleRetakeSelfie ...
   const handleRetakeSelfie = () => { setIsPreviewing(true); setCapturedSelfieDataUrl(null); setDetectedSelfieResults(null); setStaticImageElement(null); setCameraError(null); setIsCameraLoading(true); setIsDetecting(false); setDebugInfo(''); };

  // --- Logging before return ---
  console.log(`StaticSelfieTryOn Rendering: isPreviewing=${isPreviewing}, staticImageElement=${staticImageElement ? 'Exists' : 'null'}`);

  // --- JSX ---
  return (
    <div className="border p-4 rounded bg-green-50">
      <h2 className="text-xl font-semibold mb-2 text-center">Try On Selfie Mode</h2>
      {isPreviewing ? ( // Render Preview UI
         <> {/* ... Preview JSX ... */} </>
      ) : ( // Render Captured UI
        <>
          <div className="relative w-full max-w-md mx-auto bg-gray-200 overflow-hidden rounded shadow" style={{ paddingTop: `133.33%` }}>
             {/* Log value used in condition */}
             {console.log(`StaticSelfieTryOn JSX Check: staticImageElement is ${staticImageElement ? 'truthy' : 'falsy'}`)}

            {/* Render TryOnRenderer or null - REMOVE the loading fallback div */}
            {staticImageElement ? (
              <TryOnRenderer
                videoRefProp={null}
                imageElement={staticImageElement}
                mediaPipeResults={detectedSelfieResults}
                isStatic={true}
                brightness={FIXED_SELFIE_BRIGHTNESS}
                contrast={FIXED_SELFIE_CONTRAST}
                effectIntensity={effectIntensity}
                className="absolute top-0 left-0 w-full h-full"
                // *** ADD TEMP BACKGROUND STYLE ***
                style={{ backgroundColor: 'rgba(0, 255, 0, 0.5)' }} // Semi-transparent green
              />
            ) : (
               null // Render nothing if image isn't ready (container bg shows)
            )}
             {/* *** END CHANGE *** */}
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