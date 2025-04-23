import React, { useState, useEffect } from 'react'; // Add useEffect for logging
import useFaceLandmarker from '../hooks/useFaceLandmarker';
import RealTimeMirror from '../components/RealTimeMirror'; // Assuming this file exists but might be empty
import StaticSelfieTryOn from '../components/StaticSelfieTryOn'; // Assuming this file exists but might be empty
// import TryOnRenderer from '../components/TryOnRenderer'; // Keep commented for now

const VirtualTryOnPage = () => {
  console.log("VirtualTryOnPage rendering..."); // Log entry

  const [mode, setMode] = useState('mirror'); // 'mirror' or 'selfie'
  const { faceLandmarker, isLoading, error } = useFaceLandmarker();

  // Log hook state changes
  useEffect(() => {
    console.log("Hook State Update:", { isLoading, error: error?.message, faceLandmarker: !!faceLandmarker });
  }, [isLoading, error, faceLandmarker]);


  if (isLoading) {
    console.log("Rendering: Loading state");
    return <div className="flex justify-center items-center h-screen"><p>Loading AI Model...</p></div>;
  }

  if (error) {
    console.error("Rendering: Error state", error); // Log the full error object
    return <div className="flex flex-col justify-center items-center h-screen text-red-500">
      <p className="font-bold mb-2">Error loading model:</p>
      <p className="mb-2">{error.message}</p>
      <p>Ensure WASM files are in the public/wasm directory and model path is correct.</p>
      <p>Check network connection.</p>
    </div>;
  }

  if (!faceLandmarker) {
    // This case might happen if initialization finishes but landmarker is still null briefly, or on cleanup
     console.log("Rendering: FaceLandmarker is null/undefined");
     return <div className="flex justify-center items-center h-screen"><p>Initializing model components...</p></div>;
  }

  // If we reach here, loading is false, error is null, and faceLandmarker exists
  console.log("Rendering: Main content - FaceLandmarker ready.");
  return (
    <div className="container mx-auto p-4">
      <h1 className="text-2xl font-bold text-center mb-4">Virtual Try-On</h1>

      {/* Mode Selection Tabs/Buttons */}
      <div className="flex justify-center mb-4 border-b">
        <button
          onClick={() => setMode('mirror')}
          className={`px-4 py-2 ${mode === 'mirror' ? 'border-b-2 border-blue-500 font-semibold' : 'text-gray-500'}`}
        >
          Try on Mirror
        </button>
        <button
          onClick={() => setMode('selfie')}
          className={`px-4 py-2 ${mode === 'selfie' ? 'border-b-2 border-blue-500 font-semibold' : 'text-gray-500'}`}
        >
          Try on Your Selfie
        </button>
      </div>

      {/* Conditional Rendering based on Mode */}
      <div className="try-on-container">
        {/* Ensure these components exist, even if empty */}
        {mode === 'mirror' && faceLandmarker && (
          <RealTimeMirror faceLandmarker={faceLandmarker} />
        )}
        {mode === 'selfie' && faceLandmarker && (
          <StaticSelfieTryOn faceLandmarker={faceLandmarker} />
        )}
      </div>

        {/* Placeholder for Controls (e.g., slider) */}
        <div className="mt-4 p-4 border rounded bg-gray-100">
           <h3 className="text-lg font-semibold mb-2">Controls</h3>
           <p>Effect controls (like sliders) will go here.</p>
           {/* Example Slider */}
           <label htmlFor="effect-slider" className="block mb-1">Effect Intensity:</label>
           <input id="effect-slider" type="range" min="0" max="1" step="0.01" defaultValue="0.5" className="w-full"/>
        </div>
    </div>
  );
};

export default VirtualTryOnPage;