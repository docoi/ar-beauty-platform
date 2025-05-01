// src/pages/VirtualTryOnPage.jsx - BASELINE COMPATIBLE
// Only checks for FaceLandmarker readiness, does NOT pass results down.

import React, { useState, useEffect, useRef } from 'react';
import useFaceLandmarker from '../hooks/useFaceLandmarker'; // Still needed to know when models are ready
// import useImageSegmenter from '../hooks/useImageSegmenter'; // Not needed for baseline render
import RealTimeMirror from '../components/RealTimeMirror';
import StaticSelfieTryOn from '../components/StaticSelfieTryOn';

const VirtualTryOnPage = () => {
  console.log("VirtualTryOnPage rendering (Baseline Render Test)...");

  const [mode, setMode] = useState('mirror');
  // const [effectIntensity, setEffectIntensity] = useState(0.5); // Not used by baseline

  // --- Initialize ONLY FaceLandmarker hook for readiness check ---
  // We still need to wait for the model files etc., even if not using landmarks yet
  const { faceLandmarker, isLoading: isLoadingLandmarker, error: landmarkerError } = useFaceLandmarker();
  // const { imageSegmenter, isLoadingSegmenter, segmenterError } = useImageSegmenter(); // Not needed now
  // ------------------------------------------

  const activeRendererRef = useRef(null); // Ref might not be needed for baseline

  // Loading/Error states
  const isAnythingLoading = isLoadingLandmarker; // Base loading on landmarker init
  const anyError = landmarkerError; // Base error on landmarker init

  useEffect(() => {
    console.log("Hook State Update (Baseline Render Test):", {
        isLoadingLandmarker,
        landmarkerError: landmarkerError?.message,
        faceLandmarkerReady: !!faceLandmarker,
    });
  }, [isLoadingLandmarker, landmarkerError, faceLandmarker]);


  // --- Handle Loading and Error States ---
  if (isAnythingLoading) {
    return <div className="flex justify-center items-center h-screen"><p>Loading AI Models...</p></div>;
  }
  if (anyError) {
    return (
        <div className="flex flex-col justify-center items-center h-screen text-red-500">
            <p className="font-bold mb-2">Error loading AI model support:</p>
            {landmarkerError && <p>{landmarkerError.message}</p>}
      </div>
    );
  }
  // Wait for landmarker just to ensure WASM etc. is ready before rendering component
  if (!faceLandmarker) {
    return <div className="flex justify-center items-center h-screen"><p>Initializing AI support...</p></div>;
  }
  // --------------------------------------------------------

  console.log(`Rendering Main Content - Mode: ${mode}, AI Support Ready: ${!!faceLandmarker}`);

  return (
    <div className="container mx-auto p-4">
      <h1 className="text-2xl font-bold text-center mb-4">Virtual Try-On (Baseline Test)</h1>

      {/* Mode Selection Tabs/Buttons */}
      <div className="flex justify-center mb-4 border-b">
         <button onClick={() => setMode('mirror')} className={`px-4 py-2 ${mode === 'mirror' ? 'border-b-2 border-blue-500 font-semibold text-blue-600' : 'text-gray-500 hover:text-blue-600'}`}>Try on Mirror</button>
         <button onClick={() => setMode('selfie')} className={`px-4 py-2 ${mode === 'selfie' ? 'border-b-2 border-blue-500 font-semibold text-blue-600' : 'text-gray-500 hover:text-blue-600'}`}>Try on Your Selfie</button>
      </div>

      {/* Conditional Rendering based on Mode */}
      <div className="try-on-container mb-4">
        {/* Pass ONLY necessary props for baseline rendering */}
        {mode === 'mirror' && faceLandmarker && ( // Check readiness
          <RealTimeMirror
            ref={activeRendererRef}
            // REMOVED faceLandmarker={faceLandmarker} prop
            // REMOVED imageSegmenter prop
            // REMOVED effectIntensity prop
           />
        )}
        {mode === 'selfie' && faceLandmarker && ( // Check readiness
          <StaticSelfieTryOn
            ref={activeRendererRef}
            // REMOVED faceLandmarker prop
            // REMOVED imageSegmenter prop
            // REMOVED effectIntensity prop
          />
        )}
        {!faceLandmarker && (<p className="text-center text-red-500">AI Support not ready.</p>)}
      </div>

      {/* Controls Area (Hidden/Disabled for baseline test) */}
      {/*
      <div className="mt-4 p-4 border rounded bg-gray-100 max-w-md mx-auto">
         <h3 className="text-lg font-semibold mb-2">Controls (Disabled)</h3>
         <div className="mb-4 p-3 border rounded bg-blue-50 opacity-50">
              <h4 className="text-md font-semibold mb-1 text-blue-800">Effect</h4>
              <label htmlFor="effect-slider" className="block mb-1 text-sm">Intensity: </label>
              <input id="effect-slider" type="range" min="0" max="1" step="0.01" value={0.5} disabled className="w-full accent-blue-600"/>
         </div>
      </div>
      */}
    </div>
  );
};
export default VirtualTryOnPage;