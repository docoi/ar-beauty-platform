// src/components/StaticSelfieTryOn.jsx

import React, { useState, useRef, useEffect, useCallback } from 'react';
import TryOnRenderer from './TryOnRenderer';

// --- Accept new props ---
const StaticSelfieTryOn = ({
    faceLandmarker,
    selfieBrightness,
    selfieContrast
}) => {
  console.log("StaticSelfieTryOn rendering. Correction props:", { selfieBrightness, selfieContrast });

  // ... (keep existing state and refs) ...
  const [debugInfo, setDebugInfo] = useState(''); // Keep debug state

  // ... (keep camera useEffect) ...

  // ... (keep handleTakeSelfie) ...

  // ... (keep detection useEffect) ...

  // --- Effect to Trigger Rendering ---
  useEffect(() => {
    console.log("Render Trigger Effect:", { isPreviewing, isDetecting, hasRenderer: !!rendererRef.current, hasImage: !!staticImageRef.current, hasResults: !!detectedSelfieResults });
    if (!isPreviewing && rendererRef.current && staticImageRef.current) {
        if (!isDetecting) {
            console.log("Render Trigger: Calling renderStaticImageResults.");
            // --- Pass correction values to renderer ---
            rendererRef.current.renderStaticImageResults(
                staticImageRef.current,
                detectedSelfieResults,
                selfieBrightness, // Pass brightness
                selfieContrast    // Pass contrast
            );
        } else {
             console.log("Render Trigger: Rendering base image while detecting.");
             // Pass defaults or current correction values even while detecting?
             rendererRef.current.renderStaticImageResults(
                 staticImageRef.current,
                 null,
                 selfieBrightness,
                 selfieContrast
             );
        }
    } else if (isPreviewing && rendererRef.current){
        console.log("Render Trigger: Clearing canvas for preview.");
        rendererRef.current.clearCanvas();
    }
  // --- Add brightness/contrast to dependencies ---
  }, [isPreviewing, isDetecting, detectedSelfieResults, selfieDimensions, selfieBrightness, selfieContrast]);


  // ... (keep handleRetakeSelfie) ...

  // --- JSX ---
  return (
    // ... (keep existing JSX structure) ...
    <div className="border p-4 rounded bg-green-50">
     {/* ... rest of JSX ... */}
         {/* Display Debug Info */}
         <div className="mt-2 p-2 border bg-gray-100 text-xs overflow-auto max-h-20 max-w-md mx-auto rounded">
           <p className="font-semibold mb-1">Debug Info:</p>
           <pre className="whitespace-pre-wrap break-words">{isDetecting ? 'Analyzing selfie...' : (debugInfo || 'N/A')}</pre>
         </div>
      {/* ... rest of JSX ... */}
    </div>
  );
};

export default StaticSelfieTryOn;