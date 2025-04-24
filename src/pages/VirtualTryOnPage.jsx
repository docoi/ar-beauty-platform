// src/pages/VirtualTryOnPage.jsx - Controls Effect Intensity

import React, { useState, useEffect } from 'react';
import useFaceLandmarker from '../hooks/useFaceLandmarker';
import RealTimeMirror from '../components/RealTimeMirror';
import StaticSelfieTryOn from '../components/StaticSelfieTryOn';

const VirtualTryOnPage = () => {
  console.log("VirtualTryOnPage rendering...");

  const [mode, setMode] = useState('mirror');
  const { faceLandmarker, isLoading, error } = useFaceLandmarker();

  // --- State for Effect Intensity ---
  const [effectIntensity, setEffectIntensity] = useState(0.5); // Default intensity (0 to 1)

  useEffect(() => {
    console.log("Hook State Update:", { isLoading, error: error?.message, faceLandmarker: !!faceLandmarker });
  }, [isLoading, error, faceLandmarker]);

  if (isLoading) { return <div className="flex justify-center items-center h-screen"><p>Loading AI Model...</p></div>; }
  if (error) { return <div className="flex flex-col justify-center items-center h-screen text-red-500"><p className="font-bold mb-2">Error loading model:</p><p>{error.message}</p></div>; }
  if (!faceLandmarker) { return <div className="flex justify-center items-center h-screen"><p>Initializing...</p></div>; }

  console.log("Rendering: Main content - FaceLandmarker ready.");
  return (
    <div className="container mx-auto p-4">
      <h1 className="text-2xl font-bold text-center mb-4">Virtual Try-On</h1>

      {/* Mode Selection Tabs/Buttons */}
      <div className="flex justify-center mb-4 border-b">
         <button onClick={() => setMode('mirror')} className={`px-4 py-2 ${mode === 'mirror' ? 'border-b-2 border-blue-500 font-semibold' : 'text-gray-500'}`}> Try on Mirror </button>
         <button onClick={() => setMode('selfie')} className={`px-4 py-2 ${mode === 'selfie' ? 'border-b-2 border-blue-500 font-semibold' : 'text-gray-500'}`}> Try on Your Selfie </button>
      </div>

      {/* Conditional Rendering based on Mode */}
      <div className="try-on-container mb-4">
        {mode === 'mirror' && faceLandmarker && (
          <RealTimeMirror
            faceLandmarker={faceLandmarker}
            effectIntensity={effectIntensity} // Pass intensity
           />
        )}
        {mode === 'selfie' && faceLandmarker && (
          <StaticSelfieTryOn
            faceLandmarker={faceLandmarker}
            effectIntensity={effectIntensity} // Pass intensity
            // No brightness/contrast props needed now
          />
        )}
      </div>

        {/* Controls Area */}
        <div className="mt-4 p-4 border rounded bg-gray-100 max-w-md mx-auto">
           <h3 className="text-lg font-semibold mb-2">Controls</h3>

           {/* REMOVED Selfie Correction Sliders */}

           {/* Effect Intensity Slider */}
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