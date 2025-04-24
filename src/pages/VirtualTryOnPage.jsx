// src/pages/VirtualTryOnPage.jsx - With Correction Sliders

import React, { useState, useEffect } from 'react';
import useFaceLandmarker from '../hooks/useFaceLandmarker';
import RealTimeMirror from '../components/RealTimeMirror';
import StaticSelfieTryOn from '../components/StaticSelfieTryOn';

const VirtualTryOnPage = () => {
  console.log("VirtualTryOnPage rendering...");

  const [mode, setMode] = useState('mirror');
  const { faceLandmarker, isLoading, error } = useFaceLandmarker();

  // --- State for Selfie Correction ---
  const [selfieBrightness, setSelfieBrightness] = useState(1.0); // Start neutral (1.0 = no change)
  const [selfieContrast, setSelfieContrast] = useState(1.0);   // Start neutral (1.0 = no change)

  useEffect(() => {
    console.log("Hook State Update:", { isLoading, error: error?.message, faceLandmarker: !!faceLandmarker });
  }, [isLoading, error, faceLandmarker]);

  if (isLoading) { return <div className="flex justify-center items-center h-screen"><p>Loading AI Model...</p></div>; }
  if (error) { return <div className="flex flex-col justify-center items-center h-screen text-red-500"><p className="font-bold mb-2">Error loading model:</p><p>{error.message}</p><p>WASM files in public/wasm? Model path OK?</p></div>; }
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
        <div className="mt-4 p-4 border rounded bg-gray-100 max-w-md mx-auto">
           <h3 className="text-lg font-semibold mb-2">Controls</h3>

           {/* --- Selfie Correction Sliders --- */}
           {/* Conditionally show or disable based on mode */}
           <div className={`mb-4 p-3 border rounded ${mode === 'selfie' ? 'bg-yellow-50' : 'bg-gray-200 opacity-50'}`}>
                <h4 className={`text-md font-semibold mb-1 ${mode === 'selfie' ? 'text-yellow-800' : 'text-gray-500'}`}>Selfie Correction</h4>
                <label htmlFor="brightness-slider" className="block mb-1 text-sm">Brightness: {selfieBrightness.toFixed(2)}</label>
                <input
                    id="brightness-slider"
                    type="range" min="0.5" max="2.5" step="0.05"
                    value={selfieBrightness}
                    onChange={(e) => setSelfieBrightness(parseFloat(e.target.value))}
                    className="w-full accent-yellow-600 disabled:accent-gray-400"
                    disabled={mode !== 'selfie'} // Disable if not in selfie mode
                    />
                <label htmlFor="contrast-slider" className="block mb-1 mt-2 text-sm">Contrast: {selfieContrast.toFixed(2)}</label>
                <input
                    id="contrast-slider"
                    type="range" min="0.5" max="2.5" step="0.05"
                    value={selfieContrast}
                    onChange={(e) => setSelfieContrast(parseFloat(e.target.value))}
                    className="w-full accent-yellow-600 disabled:accent-gray-400"
                    disabled={mode !== 'selfie'} // Disable if not in selfie mode
                />
             </div>
            {/* --- END NEW SLIDERS --- */}

           <p className="mt-4">Effect controls will go here.</p>
           {/* Example Effect Slider Placeholder */}
           {/* <label htmlFor="effect-slider" className="block mb-1">Effect Intensity:</label>
           <input id="effect-slider" type="range" min="0" max="1" step="0.01" defaultValue="0.5" className="w-full"/> */}
        </div>
    </div>
  );
};

export default VirtualTryOnPage;