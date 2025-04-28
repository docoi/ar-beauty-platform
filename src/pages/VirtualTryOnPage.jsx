// src/pages/VirtualTryOnPage.jsx - Use BOTH FaceLandmarker and ImageSegmenter hooks

import React, { useState, useEffect, useRef } from 'react';
import useFaceLandmarker from '../hooks/useFaceLandmarker'; // Import the hook
import useImageSegmenter from '../hooks/useImageSegmenter'; // Import the NEW hook
import RealTimeMirror from '../components/RealTimeMirror';
import StaticSelfieTryOn from '../components/StaticSelfieTryOn';

const VirtualTryOnPage = () => {
  console.log("VirtualTryOnPage rendering...");

  const [mode, setMode] = useState('mirror');
  const [effectIntensity, setEffectIntensity] = useState(0.5);

  // --- Initialize BOTH hooks ---
  const { faceLandmarker, isLoading: isLoadingLandmarker, error: landmarkerError } = useFaceLandmarker();
  const { imageSegmenter, isLoadingSegmenter, segmenterError } = useImageSegmenter();
  // -----------------------------

  const activeRendererRef = useRef(null); // Keep for potential future use

  // Combined loading and error state
  const isAnythingLoading = isLoadingLandmarker || isLoadingSegmenter;
  const anyError = landmarkerError || segmenterError;

  useEffect(() => {
    console.log("Hook State Update:", {
        isLoadingLandmarker, isLoadingSegmenter,
        landmarkerError: landmarkerError?.message,
        segmenterError: segmenterError?.message,
        faceLandmarkerReady: !!faceLandmarker,
        imageSegmenterReady: !!imageSegmenter
    });
  }, [isLoadingLandmarker, isLoadingSegmenter, landmarkerError, segmenterError, faceLandmarker, imageSegmenter]);


  // --- Handle Loading and Error States for BOTH models ---
  if (isAnythingLoading) {
    return <div className="flex justify-center items-center h-screen"><p>Loading AI Models...</p></div>;
  }
  if (anyError) {
    return (
        <div className="flex flex-col justify-center items-center h-screen text-red-500">
            <p className="font-bold mb-2">Error loading AI model(s):</p>
            {landmarkerError && <p>FaceLandmarker: {landmarkerError.message}</p>}
            {segmenterError && <p>ImageSegmenter: {segmenterError.message}</p>}
      </div>
    );
  }
  // Check if BOTH models are ready before proceeding
  if (!faceLandmarker || !imageSegmenter) {
    return <div className="flex justify-center items-center h-screen"><p>Initializing AI models...</p></div>;
  }
  // --------------------------------------------------------

  console.log(`Rendering Main Content - Mode: ${mode}, Models Ready: Landmarker=${!!faceLandmarker}, Segmenter=${!!imageSegmenter}`);

  return (
    <div className="container mx-auto p-4">
      <h1 className="text-2xl font-bold text-center mb-4">Virtual Try-On</h1>

      {/* Mode Selection Tabs/Buttons */}
      <div className="flex justify-center mb-4 border-b">
         <button
            onClick={() => setMode('mirror')}
            className={`px-4 py-2 ${mode === 'mirror' ? 'border-b-2 border-blue-500 font-semibold text-blue-600' : 'text-gray-500 hover:text-blue-600'}`}
         >
             Try on Mirror
         </button>
         <button
            onClick={() => setMode('selfie')}
            className={`px-4 py-2 ${mode === 'selfie' ? 'border-b-2 border-blue-500 font-semibold text-blue-600' : 'text-gray-500 hover:text-blue-600'}`}
         >
             Try on Your Selfie
         </button>
      </div>

      {/* Conditional Rendering based on Mode */}
      <div className="try-on-container mb-4">
        {/* Check Mirror Mode */}
        {mode === 'mirror' && faceLandmarker && imageSegmenter && ( // Check both are ready
          <RealTimeMirror
            ref={activeRendererRef}
            // *** Pass BOTH models down ***
            faceLandmarker={faceLandmarker}
            imageSegmenter={imageSegmenter}
            effectIntensity={effectIntensity}
           />
        )}

        {/* Check Selfie Mode */}
        {mode === 'selfie' && faceLandmarker && imageSegmenter && ( // Check both are ready
          <StaticSelfieTryOn
            ref={activeRendererRef}
             // *** Pass BOTH models down ***
            faceLandmarker={faceLandmarker}
            imageSegmenter={imageSegmenter}
            effectIntensity={effectIntensity}
          />
        )}

        {/* Fallback Message if models failed after initial check (shouldn't happen often) */}
        {(!faceLandmarker || !imageSegmenter) && (
            <p className="text-center text-red-500">AI Models not available.</p>
        )}

      </div>

      {/* Controls Area */}
      <div className="mt-4 p-4 border rounded bg-gray-100 max-w-md mx-auto">
         <h3 className="text-lg font-semibold mb-2">Controls</h3>
         <div className="mb-4 p-3 border rounded bg-blue-50">
              <h4 className="text-md font-semibold mb-1 text-blue-800">Serum Effect</h4>
              <label htmlFor="effect-slider" className="block mb-1 text-sm">Intensity: {effectIntensity.toFixed(2)}</label>
              <input
                  id="effect-slider"
                  type="range" min="0" max="1" step="0.01"
                  value={effectIntensity}
                  onChange={(e) => setEffectIntensity(parseFloat(e.target.value))}
                  className="w-full accent-blue-600"
              />
         </div>
      </div>
    </div>
  );
};

export default VirtualTryOnPage;