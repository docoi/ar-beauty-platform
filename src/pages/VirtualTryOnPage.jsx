// src/pages/VirtualTryOnPage.jsx - Use ONLY FaceLandmarker hook

import React, { useState, useEffect, useRef } from 'react';
import useFaceLandmarker from '../hooks/useFaceLandmarker'; // Import the hook
// import useImageSegmenter from '../hooks/useImageSegmenter'; // <<< REMOVED ImageSegmenter import
import RealTimeMirror from '../components/RealTimeMirror';
import StaticSelfieTryOn from '../components/StaticSelfieTryOn';

const VirtualTryOnPage = () => {
  console.log("VirtualTryOnPage rendering (Landmarker Only Mode)...");

  const [mode, setMode] = useState('mirror');
  const [effectIntensity, setEffectIntensity] = useState(0.5); // Keep intensity control

  // --- Initialize ONLY FaceLandmarker hook ---
  const { faceLandmarker, isLoading: isLoadingLandmarker, error: landmarkerError } = useFaceLandmarker();
  // const { imageSegmenter, isLoadingSegmenter, segmenterError } = useImageSegmenter(); // <<< REMOVED Segmenter hook call
  // ------------------------------------------

  const activeRendererRef = useRef(null);

  // Use only Landmarker loading/error states
  const isAnythingLoading = isLoadingLandmarker;
  const anyError = landmarkerError;

  useEffect(() => {
    console.log("Hook State Update (Landmarker Only):", {
        isLoadingLandmarker,
        landmarkerError: landmarkerError?.message,
        faceLandmarkerReady: !!faceLandmarker,
        // imageSegmenterReady: false // No longer tracking
    });
  }, [isLoadingLandmarker, landmarkerError, faceLandmarker]);


  // --- Handle Loading and Error States for FaceLandmarker ONLY ---
  if (isAnythingLoading) {
    return <div className="flex justify-center items-center h-screen"><p>Loading AI Model...</p></div>;
  }
  if (anyError) {
    return (
        <div className="flex flex-col justify-center items-center h-screen text-red-500">
            <p className="font-bold mb-2">Error loading FaceLandmarker:</p>
            {landmarkerError && <p>{landmarkerError.message}</p>}
      </div>
    );
  }
  if (!faceLandmarker) { // Check only for faceLandmarker
    return <div className="flex justify-center items-center h-screen"><p>Initializing AI model...</p></div>;
  }
  // --------------------------------------------------------

  console.log(`Rendering Main Content - Mode: ${mode}, Model Ready: Landmarker=${!!faceLandmarker}`);

  return (
    <div className="container mx-auto p-4">
      <h1 className="text-2xl font-bold text-center mb-4">Virtual Try-On</h1>

      {/* Mode Selection Tabs/Buttons */}
      <div className="flex justify-center mb-4 border-b">
         <button onClick={() => setMode('mirror')} className={`px-4 py-2 ${mode === 'mirror' ? 'border-b-2 border-blue-500 font-semibold text-blue-600' : 'text-gray-500 hover:text-blue-600'}`}>Try on Mirror</button>
         <button onClick={() => setMode('selfie')} className={`px-4 py-2 ${mode === 'selfie' ? 'border-b-2 border-blue-500 font-semibold text-blue-600' : 'text-gray-500 hover:text-blue-600'}`}>Try on Your Selfie</button>
      </div>

      {/* Conditional Rendering based on Mode */}
      <div className="try-on-container mb-4">
        {/* Pass only faceLandmarker down */}
        {mode === 'mirror' && faceLandmarker && ( // Check only for faceLandmarker
          <RealTimeMirror
            ref={activeRendererRef}
            faceLandmarker={faceLandmarker}
            // imageSegmenter={imageSegmenter} // <<< REMOVED prop
            effectIntensity={effectIntensity}
           />
        )}
        {mode === 'selfie' && faceLandmarker && ( // Check only for faceLandmarker
          <StaticSelfieTryOn
            ref={activeRendererRef}
            faceLandmarker={faceLandmarker}
            // imageSegmenter={imageSegmenter} // <<< REMOVED prop
            effectIntensity={effectIntensity}
          />
        )}
        {/* Adjust fallback message */}
        {!faceLandmarker && (<p className="text-center text-red-500">FaceLandmarker not available.</p>)}
      </div>

      {/* Controls Area (remains the same) */}
      <div className="mt-4 p-4 border rounded bg-gray-100 max-w-md mx-auto">
         <h3 className="text-lg font-semibold mb-2">Controls</h3>
         <div className="mb-4 p-3 border rounded bg-blue-50">
              <h4 className="text-md font-semibold mb-1 text-blue-800">Serum Effect</h4>
              <label htmlFor="effect-slider" className="block mb-1 text-sm">Intensity: {effectIntensity.toFixed(2)}</label>
              <input id="effect-slider" type="range" min="0" max="1" step="0.01" value={effectIntensity} onChange={(e) => setEffectIntensity(parseFloat(e.target.value))} className="w-full accent-blue-600"/>
         </div>
      </div>
    </div>
  );
};
export default VirtualTryOnPage;