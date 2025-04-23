import React from 'react';

// We pass faceLandmarker down, but won't use it yet
const StaticSelfieTryOn = ({ faceLandmarker }) => {
  console.log("StaticSelfieTryOn rendering...");

  return (
    <div className="border p-4 rounded bg-green-50">
      <h2 className="text-xl font-semibold mb-2">Try On Selfie Mode</h2>
      <p>Selfie capture and rendering will go here.</p>
      {/* Placeholder for selfie display/canvas later */}
      <div className="w-full aspect-video bg-gray-300 my-2 flex items-center justify-center">
         <p className="text-gray-500">Selfie/Canvas Area</p>
      </div>
       <button className="bg-indigo-500 text-white px-4 py-2 rounded hover:bg-indigo-600">
           Take Selfie (Not implemented)
       </button>
       {!faceLandmarker && <p className="text-red-500">Waiting for FaceLandmarker...</p>}
    </div>
  );
};

// Add the crucial default export line
export default StaticSelfieTryOn;