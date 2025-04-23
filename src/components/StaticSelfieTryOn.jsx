// src/components/StaticSelfieTryOn.jsx

import React, { useState, useRef, useEffect, useCallback } from 'react';
import TryOnRenderer from './TryOnRenderer';

const StaticSelfieTryOn = ({ faceLandmarker }) => {
  // ... (keep existing state: isPreviewing, cameraStream, etc...) ...
  const [debugInfo, setDebugInfo] = useState(''); // NEW STATE FOR DEBUGGING

  // ... (keep existing refs) ...

  // --- Camera Access Logic (only when previewing) ---
  useEffect(() => {
    // ... (keep existing camera access logic) ...
  }, [isPreviewing, faceLandmarker]);

  // --- Selfie Capture ---
  const handleTakeSelfie = useCallback(() => {
    // ... (keep existing capture logic) ...
    const dataUrl = tempCanvas.toDataURL('image/png');
    setCapturedSelfieDataUrl(dataUrl);
    setIsPreviewing(false);
    setDetectedSelfieResults(null);
    setIsDetecting(true);
    setDebugInfo(''); // Clear previous debug info

    cameraStream?.getTracks().forEach(track => track.stop());
    setCameraStream(null);
  }, [cameraStream, selfieDimensions]);

  // --- Face Detection on Captured Selfie ---
  useEffect(() => {
      if (!capturedSelfieDataUrl || !faceLandmarker || !isDetecting) {
          return;
      }

      setDebugInfo('Starting detection...'); // Update debug info
      const imageElement = new Image();

      imageElement.onload = async () => {
          staticImageRef.current = imageElement;
          setDebugInfo('Image loaded, calling detect()...'); // Update debug info
          try {
                if (faceLandmarker) {
                    const results = faceLandmarker.detect(imageElement);
                    // --- Store results/status in debug info ---
                    if (results?.faceLandmarks?.length > 0) {
                        setDebugInfo(`Detection finished. Found ${results.faceLandmarks.length} face(s). Landmarks[0] length: ${results.faceLandmarks[0]?.length}`);
                    } else {
                        setDebugInfo('Detection finished. No landmarks found.');
                    }
                    // --- End of debug info update ---
                    setDetectedSelfieResults(results);
                } else {
                     setDebugInfo('Error: FaceLandmarker unavailable during detection.');
                     console.error("Detection Effect: FaceLandmarker became unavailable.");
                }
          } catch(err) {
               setDebugInfo(`Error during detect(): ${err.message}`); // Update debug info
               console.error("Detection Effect: Error during faceLandmarker.detect():", err);
          } finally {
               setIsDetecting(false);
          }
      }
      imageElement.onerror = () => {
          setDebugInfo('Error: Failed to load selfie image element.'); // Update debug info
          console.error("Detection Effect: Failed to load captured selfie data URL into image element.");
          setIsDetecting(false);
      }
      imageElement.src = capturedSelfieDataUrl;

  }, [capturedSelfieDataUrl, faceLandmarker, isDetecting]);

   // --- Effect to draw initial state or update renderer ---
  useEffect(() => {
    // ... (keep existing render trigger logic) ...
  }, [isPreviewing, isDetecting, detectedSelfieResults, selfieDimensions]);

  // --- Retake Selfie ---
  const handleRetakeSelfie = () => {
    // ... (keep existing retake logic) ...
    setDebugInfo(''); // Clear debug info
  };

  return (
    <div className="border p-4 rounded bg-green-50">
      <h2 className="text-xl font-semibold mb-2">Try On Selfie Mode</h2>

      {isPreviewing ? (
        // --- Preview Mode ---
        <>
         {/* ... keep preview JSX ... */}
         <div className="text-center mt-4">
             <button
                 onClick={handleTakeSelfie}
                 disabled={isCameraLoading || !!cameraError || !cameraStream}
                 className="bg-indigo-500 text-white px-4 py-2 rounded hover:bg-indigo-600 disabled:bg-gray-400 disabled:cursor-not-allowed"
             >
                 Take Selfie
             </button>
           </div>
        </>
      ) : (
        // --- Selfie Captured Mode ---
        <>
          <div className="relative w-full" style={{ paddingTop: `${selfieDimensions.height && selfieDimensions.width ? (selfieDimensions.height / selfieDimensions.width) * 100 : (4/3)*100}%` }}>
           {selfieDimensions.width > 0 ? (
                 <TryOnRenderer
                    ref={rendererRef}
                    videoWidth={selfieDimensions.width}
                    videoHeight={selfieDimensions.height}
                    className="absolute top-0 left-0 w-full h-full"
                 />
           ) : ( /* ... Loading dimensions placeholder ... */ )}
          </div>

          {/* --- Display Debug Info --- */}
          <div className="mt-2 p-2 border bg-gray-100 text-xs overflow-auto max-h-20">
            <p className="font-semibold">Debug Info:</p>
            <pre>{isDetecting ? 'Analyzing selfie...' : (debugInfo || 'N/A')}</pre>
          </div>
          {/* --- End Debug Info --- */}

          <div className="text-center mt-4">
            <button
                onClick={handleRetakeSelfie}
                className="bg-gray-500 text-white px-4 py-2 rounded hover:bg-gray-600"
            >
                Retake Selfie
            </button>
          </div>
        </>
      )}
      {!faceLandmarker && <p className="text-red-500 mt-2 text-center">Waiting for FaceLandmarker model...</p>}
    </div>
  );
};

export default StaticSelfieTryOn;