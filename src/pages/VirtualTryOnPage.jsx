// src/pages/VirtualTryOnPage.jsx - Reverted (No Sliders/Correction Props)

import React, { useState, useEffect } from 'react';
import useFaceLandmarker from '../hooks/useFaceLandmarker';
import RealTimeMirror from '../components/RealTimeMirror';
import StaticSelfieTryOn from '../components/StaticSelfieTryOn';

const VirtualTryOnPage = () => {
  console.log("VirtualTryOnPage rendering...");

  const [mode, setMode] = useState('mirror');
  const { faceLandmarker, isLoading, error } = useFaceLandmarker();

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
          // Pass only faceLandmarker
          <RealTimeMirror faceLandmarker={faceLandmarker} />
        )}
        {mode === 'selfie' && faceLandmarker && (
          // Pass only faceLandmarker
          <StaticSelfieTryOn faceLandmarker={faceLandmarker} />
        )}
      </div>

        {/* Controls Area (Placeholder) */}
        <div className="mt-4 p-4 border rounded bg-gray-100 max-w-md mx-auto">
           <h3 className="text-lg font-semibold mb-2">Controls</h3>
           <p>Effect controls (like sliders) will go here.</p>
           {/* Basic placeholder slider */}
           <label htmlFor="effect-slider" className="block mb-1">Effect Intensity:</label>
           <input id="effect-slider" type="range" min="0" max="1" step="0.01" defaultValue="0.5" className="w-full"/>
        </div>
    </div>
  );
};

export default VirtualTryOnPage;