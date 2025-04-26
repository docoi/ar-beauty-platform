// src/components/RealTimeMirror.jsx - Render TryOnRenderer Sooner

import React, { useRef, useEffect, useState, useCallback, forwardRef, useImperativeHandle } from 'react';
import TryOnRenderer from './TryOnRenderer'; // Using bare-minimum shader version

// ... (Keep forwardRef wrapper, state, refs, useEffect for ref sync, useImperativeHandle, useEffect for camera access, predictWebcam, loop stop effect) ...
const RealTimeMirror = forwardRef(({ faceLandmarker, effectIntensity }, ref) => {
    // ... state, refs ...
    const videoStreamRef = useRef(null);
    const [latestResults, setLatestResults] = useState(null);


    useEffect(() => { /* ... sync ref ... */ }, [videoStream]);
    useImperativeHandle(ref, () => ({ /* ... */ }));
    useEffect(() => { /* ... camera access ... */ }, [faceLandmarker]);
    const predictWebcam = useCallback(() => { /* ... detection logic ... */ }, [faceLandmarker]);
    useEffect(() => { /* ... loop start/stop ... */ }, [videoStream, faceLandmarker, predictWebcam]);


    // Log check remains useful
    const shouldRenderTryOn_OriginalCheck = videoStream && !isCameraLoading && !cameraError && videoDimensions.width > 0;
    console.log("RealTimeMirror render check:", {
        hasStream: !!videoStream,
        isLoading: isCameraLoading,
        hasError: !!cameraError,
        hasDims: videoDimensions.width > 0,
        shouldRender_Original: shouldRenderTryOn_OriginalCheck
    });

    // *** SIMPLIFIED RENDER CONDITION ***
    // Render TryOnRenderer as soon as loading is done, dimensions are known, and there's no error.
    // TryOnRenderer's internal loop should handle waiting for the videoElement prop via the texture logic.
    const shouldRenderTryOn_Simplified = !isCameraLoading && !cameraError && videoDimensions.width > 0;
    console.log("Simplified Render Check:", shouldRenderTryOn_Simplified);
    // *** END SIMPLIFIED CONDITION ***

    // --- JSX ---
    return (
      <div className="border p-4 rounded bg-blue-50 relative">
         <h2 className="text-xl font-semibold mb-2">Real-Time Mirror Mode</h2>
         {/* Show explicit loading/error text *outside* the main container if needed */}
         {isCameraLoading && <p className="text-center py-4">Starting camera...</p>}
         {cameraError && <p className="text-red-500 text-center py-4">{cameraError}</p>}

        <div className="relative w-full max-w-md mx-auto" style={{ paddingTop: `${videoDimensions.width > 0 ? (videoDimensions.height / videoDimensions.width) * 100 : 75}%` }}>
          {/* Hidden video element */}
          <video ref={videoRef} autoPlay playsInline muted className="absolute top-0 left-0 w-0 h-0 -z-10" />

          {/* Use the SIMPLIFIED condition */}
          {shouldRenderTryOn_Simplified ? (
            <TryOnRenderer // Pass props
              videoElement={videoRef.current} // Pass ref, TryOnRenderer loop will handle if it's ready
              imageElement={null}
              mediaPipeResults={latestResults}
              isStatic={false}
              brightness={1.0}
              contrast={1.0}
              effectIntensity={effectIntensity}
              className="absolute top-0 left-0 w-full h-full rounded shadow overflow-hidden"
            />
          ) : (
             <div className="absolute inset-0 flex items-center justify-center bg-gray-200 rounded shadow">
                 {/* Keep fallback UI, but it should appear less often now */}
                <p className="text-gray-500">{cameraError || (isCameraLoading ? 'Loading Camera...' : 'Initializing...')}</p>
             </div>
          )}
        </div>
        {!faceLandmarker && <p className="text-red-500 mt-2 text-center">Waiting for AI Model...</p>}
      </div>
    );
});
RealTimeMirror.displayName = 'RealTimeMirror';
export default RealTimeMirror;