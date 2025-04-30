// src/components/StaticSelfieTryOn.jsx - Run BOTH Landmarker and Segmenter

import React, { useState, useRef, useEffect, useCallback, forwardRef } from 'react';
import TryOnRenderer from './TryOnRenderer'; // Expects the NEW version with HalfFloatType fix

const FIXED_SELFIE_BRIGHTNESS = 1.0; // Reset B/C
const FIXED_SELFIE_CONTRAST = 1.0;

const StaticSelfieTryOn = forwardRef(({
    faceLandmarker,
    imageSegmenter, // <<< Accept segmenter prop
    effectIntensity
}, ref) => {
  // State
  const [isPreviewing, setIsPreviewing] = useState(true);
  const [cameraStream, setCameraStream] = useState(null);
  const [isCameraLoading, setIsCameraLoading] = useState(true);
  const [cameraError, setCameraError] = useState(null);
  const [capturedSelfieDataUrl, setCapturedSelfieDataUrl] = useState(null);
  // Separate state for results
  const [detectedLandmarkResults, setDetectedLandmarkResults] = useState(null);
  const [detectedSegmentationResults, setDetectedSegmentationResults] = useState(null); // <<< New state
  const [selfieDimensions, setSelfieDimensions] = useState({ width: 0, height: 0 });
  const [isDetecting, setIsDetecting] = useState(false);
  const [debugInfo, setDebugInfo] = useState('');
  const [staticImageElement, setStaticImageElement] = useState(null);

  // Refs
  const selfieVideoRef = useRef(null);

  // Camera Access Effect
  useEffect(() => { /* ... (same as previous correct version) ... */ }, [isPreviewing, faceLandmarker]);
  // Selfie Capture
  const handleTakeSelfie = useCallback(() => { /* ... (same as previous correct version) ... */ }, [cameraStream, selfieDimensions]);

  // Image Loading and Face Detection Effect - Run BOTH tasks
  useEffect(() => {
    if (!capturedSelfieDataUrl || !faceLandmarker || !imageSegmenter) { /* ... cleanup/return ... */ return; }
    console.log("StaticSelfieTryOn Effect: Loading image for detection/segmentation...");
    setIsDetecting(true); setDebugInfo('Loading captured image...'); const imageElement = new Image();
    imageElement.onload = () => {
      console.log("StaticSelfieTryOn: Image loaded.");
      setSelfieDimensions({width: imageElement.naturalWidth, height: imageElement.naturalHeight});
      setStaticImageElement(imageElement); setDebugInfo('Image loaded, detecting/segmenting face...');
      try {
        if (faceLandmarker && imageSegmenter) {
          console.log("StaticSelfieTryOn: Running detectForVideo() and segmentForVideo()...");
          const startTime = performance.now();
          // Run BOTH tasks
          const landmarkResults = faceLandmarker.detectForVideo(imageElement, startTime);
          const segmentationResults = imageSegmenter.segmentForVideo(imageElement, startTime);
          const endTime = performance.now();
          // Log results if needed
          // console.log(`--- StaticSelfieTryOn: Results (took ${endTime - startTime}ms) ---`, { landmarkResults, segmentationResults });
          // Update BOTH state variables
          setDetectedLandmarkResults(landmarkResults);
          setDetectedSegmentationResults(segmentationResults); // <<< Update segmentation state
          setDebugInfo(`Analysis complete: ${landmarkResults?.faceLandmarks?.[0]?.length || 0} landmarks found.`);
        } else { /*...*/ setDetectedLandmarkResults(null); setDetectedSegmentationResults(null); }
      } catch(err) { /*...*/ setDetectedLandmarkResults(null); setDetectedSegmentationResults(null); }
      finally { setIsDetecting(false); }
    };
    imageElement.onerror = () => { /*...*/ }; imageElement.src = capturedSelfieDataUrl;
    return () => { /*...*/ };
  }, [capturedSelfieDataUrl, faceLandmarker, imageSegmenter]); // Add imageSegmenter dependency


   // Retake Selfie
   const handleRetakeSelfie = () => { setIsPreviewing(true); setCapturedSelfieDataUrl(null); setDetectedLandmarkResults(null); setDetectedSegmentationResults(null); setStaticImageElement(null); /*...*/ };

   // JSX - Pass BOTH results down
   return (
    <div className="border p-4 rounded bg-green-50">
      <h2 className="text-xl font-semibold mb-2 text-center">Try On Selfie Mode</h2>
      {isPreviewing ? ( // Render Preview UI block
         <>
            {isCameraLoading && <p className="text-center py-4">Starting camera...</p>}
            {cameraError && <p className="text-red-500 text-center py-4">{cameraError}</p>}
            <div className="relative w-full max-w-md mx-auto aspect-[9/16] bg-gray-200 overflow-hidden rounded shadow">
               <video ref={selfieVideoRef} autoPlay playsInline muted className={`absolute top-0 left-0 w-full h-full ${isCameraLoading || cameraError ? 'opacity-0' : 'opacity-100'}`} style={{ transform: 'scaleX(-1)', transition: 'opacity 0.3s', objectFit: 'cover' }}></video>
               {(isCameraLoading || cameraError) && ( <div className="absolute inset-0 flex items-center justify-center"><p className="text-gray-500 bg-white px-2 py-1 rounded shadow">{cameraError ? 'Error' : 'Loading...'}</p></div> )}
            </div>
            <div className="text-center mt-4">
               <button onClick={handleTakeSelfie} disabled={isCameraLoading || !!cameraError || !cameraStream} className="bg-indigo-500 text-white px-4 py-2 rounded hover:bg-indigo-600 disabled:bg-gray-400 disabled:cursor-not-allowed"> Take Selfie </button>
            </div>
         </>
      ) : ( // Render Captured UI block
        <>
          <div className="relative w-full max-w-md mx-auto bg-gray-200 overflow-hidden rounded shadow" style={{ paddingTop: `${selfieDimensions.height && selfieDimensions.width ? (selfieDimensions.height / selfieDimensions.width) * 100 : 75}%` }}>
            {staticImageElement ? (
              <TryOnRenderer
                videoRefProp={null}
                imageElement={staticImageElement}
                mediaPipeResults={detectedLandmarkResults} // Pass landmarks
                segmentationResults={detectedSegmentationResults} // <<< Pass segmentation results
                isStatic={true}
                brightness={FIXED_SELFIE_BRIGHTNESS}
                contrast={FIXED_SELFIE_CONTRAST}
                effectIntensity={effectIntensity}
                className="absolute top-0 left-0 w-full h-full"
              />
            ) : ( /* Fallback UI */
                 <div className="absolute inset-0 flex items-center justify-center"><p className="text-gray-500">{isDetecting ? 'Analyzing Selfie...' : (capturedSelfieDataUrl ? 'Loading Image...' : 'Initializing...')}</p></div>
             )}
          </div>
          {/* ... Debug Info & Retake Button ... */}
           <div className="mt-2 p-2 border bg-gray-100 text-xs overflow-auto max-h-20 max-w-md mx-auto rounded"><p className="font-semibold mb-1">Debug Info:</p><pre className="whitespace-pre-wrap break-words">{debugInfo || 'N/A'}</pre></div>
           <div className="text-center mt-4"><button onClick={handleRetakeSelfie} className="bg-gray-500 text-white px-4 py-2 rounded hover:bg-gray-600">Retake Selfie</button></div>
        </>
      )}
      {(!faceLandmarker || !imageSegmenter) && <p className="text-red-500 mt-2 text-center">Initializing AI models...</p>}
    </div>
  );

});
StaticSelfieTryOn.displayName = 'StaticSelfieTryOn';
export default StaticSelfieTryOn;