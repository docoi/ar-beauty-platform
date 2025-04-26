// src/components/RealTimeMirror.jsx - Add Render Condition Log

import React, { useRef, useEffect, useState, useCallback, forwardRef, useImperativeHandle } from 'react';
import TryOnRenderer from './TryOnRenderer'; // Should use the one with bare-minimum shader for now

const RealTimeMirror = forwardRef(({
  faceLandmarker,
  effectIntensity
}, ref) => {
  console.log("RealTimeMirror rendering...");
  const videoRef = useRef(null);
  const animationFrameRef = useRef(null);
  const [videoStream, setVideoStream] = useState(null);
  const videoStreamRef = useRef(null);
  const [isCameraLoading, setIsCameraLoading] = useState(true);
  const [cameraError, setCameraError] = useState(null);
  const [videoDimensions, setVideoDimensions] = useState({ width: 0, height: 0 });
  const [latestResults, setLatestResults] = useState(null);

  // Effect to keep ref in sync with state
  useEffect(() => { /* ... */ }, [videoStream]);
  // Imperative handle for parent
  useImperativeHandle(ref, () => ({ /* ... */ }));
  // Effect for camera access
  useEffect(() => { /* ... */ }, [faceLandmarker]);
  // Prediction Loop Callback
  const predictWebcam = useCallback(() => { /* ... */ }, [faceLandmarker]);
  // Effect to manage loop start/stop
  useEffect(() => { /* ... */ }, [videoStream, faceLandmarker, predictWebcam]);


  // *** ADD LOG BEFORE RETURN ***
  const shouldRenderTryOn = videoStream && !isCameraLoading && !cameraError && videoDimensions.width > 0;
  console.log("RealTimeMirror render check:", {
      hasStream: !!videoStream,
      isLoading: isCameraLoading,
      hasError: !!cameraError,
      hasDims: videoDimensions.width > 0,
      shouldRender: shouldRenderTryOn // Log the combined condition
  });
  // *** END LOG ***

  // --- JSX ---
  return (
    <div className="border p-4 rounded bg-blue-50 relative">
       <h2 className="text-xl font-semibold mb-2">Real-Time Mirror Mode</h2>
       {isCameraLoading && <p className="text-center py-4">Starting camera...</p>}
       {cameraError && <p className="text-red-500 text-center py-4">{cameraError}</p>}
      <div className="relative w-full max-w-md mx-auto" style={{ paddingTop: `${videoDimensions.width > 0 ? (videoDimensions.height / videoDimensions.width) * 100 : 75}%` }}>
        <video ref={videoRef} autoPlay playsInline muted className="absolute top-0 left-0 w-0 h-0 -z-10" />
        {/* Use the pre-calculated boolean */}
        {shouldRenderTryOn ? (
          <TryOnRenderer // Pass props
            videoElement={videoRef.current}
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
               {/* Simplify loading message display */}
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