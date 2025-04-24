// src/pages/VirtualTryOnPage.jsx

import React, { useState, useEffect } from 'react';
import useFaceLandmarker from '../hooks/useFaceLandmarker';
import RealTimeMirror from '../components/RealTimeMirror';
import StaticSelfieTryOn from '../components/StaticSelfieTryOn';

const VirtualTryOnPage = () => {
  console.log("VirtualTryOnPage rendering...");

  const [mode, setMode] = useState('mirror');
  const { faceLandmarker, isLoading, error } = useFaceLandmarker();

  // --- NEW: State for Selfie Correction ---
  const [selfieBrightness, setSelfieBrightness] = useState(1.2); // Initial value from shader
  const [selfieContrast, setSelfieContrast] = useState(1.1);   // Initial value from shader
  // --- END NEW STATE ---

  useEffect(() => {
    console.log("Hook State Update:", { isLoading, error: error?.message, faceLandmarker: !!faceLandmarker });
  }, [isLoading, error, faceLandmarker]);

  if (isLoading) { /* ... Loading ... */ }
  if (error) { /* ... Error ... */ }
  if (!faceLandmarker) { /* ... Initializing ... */ }

  console.log("Rendering: Main content - FaceLandmarker ready.");
  return (
    <div className="container mx-auto p-4">
      <h1 className="text-2xl font-bold text-center mb-4">Virtual Try-On</h1>

      {/* Mode Selection Tabs/Buttons */}
      <div className="flex justify-center mb-4 border-b">
        {/* ... buttons ... */}
         <button onClick={() => setMode('mirror')} className={`px-4 py-2 ${mode === 'mirror' ? 'border-b-2 border-blue-500 font-semibold' : 'text-gray-500'}`}> Try on Mirror </button>
         <button onClick={() => setMode('selfie')} className={`px-4 py-2 ${mode === 'selfie' ? 'border-b-2 border-blue-500 font-semibold' : 'text-gray-500'}`}> Try on Your Selfie </button>
      </div>

      {/* Conditional Rendering based on Mode */}
      <div className="try-on-container mb-4">
        {mode === 'mirror' && faceLandmarker && (
          // Pass props even if not used yet by mirror, for consistency
          <RealTimeMirror
            faceLandmarker={faceLandmarker}
            // selfieBrightness={selfieBrightness} // Not needed for mirror effect
            // selfieContrast={selfieContrast}
           />
        )}
        {mode === 'selfie' && faceLandmarker && (
          <StaticSelfieTryOn
            faceLandmarker={faceLandmarker}
            // --- PASS PROPS ---
            selfieBrightness={selfieBrightness}
            selfieContrast={selfieContrast}
            // --- END PASS PROPS ---
          />
        )}
      </div>

        {/* Controls Area */}
        <div className="mt-4 p-4 border rounded bg-gray-100">
           <h3 className="text-lg font-semibold mb-2">Controls</h3>

           {/* --- NEW: Selfie Correction Sliders (Only show in Selfie mode?) --- */}
           {/* {mode === 'selfie' && ( // Optional: Show only when selfie tab active */}
             <div className="mb-4 p-3 border rounded bg-yellow-50">
                <h4 className="text-md font-semibold mb-1 text-yellow-800">Selfie Correction (Debug)</h4>
                <label htmlFor="brightness-slider" className="block mb-1 text-sm">Brightness: {selfieBrightness.toFixed(2)}</label>
                <input
                    id="brightness-slider"
                    type="range" min="0.5" max="2.5" step="0.05"
                    value={selfieBrightness}
                    onChange={(e) => setSelfieBrightness(parseFloat(e.target.value))}
                    className="w-full"
                    />
                <label htmlFor="contrast-slider" className="block mb-1 mt-2 text-sm">Contrast: {selfieContrast.toFixed(2)}</label>
                <input
                    id="contrast-slider"
                    type="range" min="0.5" max="2.5" step="0.05"
                    value={selfieContrast}
                    onChange={(e) => setSelfieContrast(parseFloat(e.target.value))}
                    className="w-full"
                />
             </div>
           {/* )} */}
            {/* --- END NEW SLIDERS --- */}

           <p className="mt-4">Effect controls (like sliders) will go here.</p>
           <label htmlFor="effect-slider" className="block mb-1">Effect Intensity:</label>
           <input id="effect-slider" type="range" min="0" max="1" step="0.01" defaultValue="0.5" className="w-full"/>
        </div>
    </div>
  );
};

export default VirtualTryOnPage;