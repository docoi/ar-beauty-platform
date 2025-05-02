// src/components/StaticSelfieTryOn.jsx - Layered Canvas Approach (Precise Lipstick Effect)

import React, { useState, useRef, useEffect, useCallback, forwardRef } from 'react';
import TryOnRenderer from './TryOnRenderer'; // The simplified WebGL base renderer

// Define LIP landmark indices
const LIP_OUTLINE_INDICES = [ 61, 146, 91, 181, 84, 17, 314, 405, 321, 375, 291, 409, 270, 269, 267, 0, 37, 39, 40, 185 ];
const INNER_LIP_INDICES = [ 78, 95, 88, 178, 87, 14, 317, 402, 318, 324, 308, 415, 310, 311, 312, 13, 82, 81, 80, 191 ];

const StaticSelfieTryOn = forwardRef(({
    faceLandmarker,
    imageSegmenter,
    effectIntensity // Unused for now
}, ref) => {
  // State
  const [isPreviewing, setIsPreviewing] = useState(true); const [cameraStream, setCameraStream] = useState(null); const [isCameraLoading, setIsCameraLoading] = useState(true); const [cameraError, setCameraError] = useState(null); const [capturedSelfieDataUrl, setCapturedSelfieDataUrl] = useState(null); const [detectedLandmarkResults, setDetectedLandmarkResults] = useState(null); const [detectedSegmentationResults, setDetectedSegmentationResults] = useState(null); const [selfieDimensions, setSelfieDimensions] = useState({ width: 0, height: 0 }); const [isDetecting, setIsDetecting] = useState(false); const [debugInfo, setDebugInfo] = useState(''); const [staticImageElement, setStaticImageElement] = useState(null);
  // Refs
  const selfieVideoRef = useRef(null); const webglCanvasRef = useRef(null); const overlayCanvasRef = useRef(null);

  // Camera Access Effect
  useEffect(() => { /* ... (No change) ... */ }, [isPreviewing, faceLandmarker]);
  // Selfie Capture
  const handleTakeSelfie = useCallback(() => { /* ... (No change) ... */ }, [cameraStream, selfieDimensions]);
  // Image Loading and AI Detection Effect
  useEffect(() => { /* ... (No change) ... */ }, [capturedSelfieDataUrl, faceLandmarker, imageSegmenter]);

  // --- Canvas Drawing Function for Static Selfie (Precise Lipstick) ---
  const drawStaticOverlay = useCallback(() => {
    const overlayCanvas = overlayCanvasRef.current; const image = staticImageElement; const landmarks = detectedLandmarkResults;
    if (!overlayCanvas || !image || !landmarks?.faceLandmarks?.[0] || !selfieDimensions.width || !selfieDimensions.height) { if(overlayCanvas) { const ctx = overlayCanvas.getContext('2d'); if(ctx) ctx.clearRect(0, 0, overlayCanvas.width, overlayCanvas.height); } return; }
    const ctx = overlayCanvas.getContext('2d'); if (!ctx) return; const canvasWidth = selfieDimensions.width; const canvasHeight = selfieDimensions.height; if (overlayCanvas.width !== canvasWidth || overlayCanvas.height !== canvasHeight) { overlayCanvas.width = canvasWidth; overlayCanvas.height = canvasHeight; } ctx.clearRect(0, 0, canvasWidth, canvasHeight);
    // No context mirroring needed
    try {
        const facePoints = landmarks.faceLandmarks[0];
        if (facePoints.length > 0) {
             ctx.fillStyle = "#0000FF"; // Bright Blue Lipstick Color
             ctx.beginPath();
             // Draw Outer Lip Path
             LIP_OUTLINE_INDICES.forEach((index, i) => { if (index < facePoints.length) { const point = facePoints[index]; const x = point.x * canvasWidth; const y = point.y * canvasHeight; if (i === 0) { ctx.moveTo(x, y); } else { ctx.lineTo(x, y); } } });
             ctx.closePath();
             // Draw Inner Lip Path (Reverse Order)
             const innerLastIndex = INNER_LIP_INDICES[INNER_LIP_INDICES.length - 1];
             if (innerLastIndex < facePoints.length) { ctx.moveTo(facePoints[innerLastIndex].x * canvasWidth, facePoints[innerLastIndex].y * canvasHeight); }
             for (let i = INNER_LIP_INDICES.length - 2; i >= 0; i--) { const index = INNER_LIP_INDICES[i]; if (index < facePoints.length) { const point = facePoints[index]; ctx.lineTo(point.x * canvasWidth, point.y * canvasHeight); } }
             ctx.closePath();
             // Fill using even-odd rule
             ctx.fill('evenodd');
        }
    } catch (error) { console.error("Error during static overlay drawing:", error); }
  }, [staticImageElement, detectedLandmarkResults, selfieDimensions]); // Removed effectIntensity

  // Effect to Trigger Static Drawing
  useEffect(() => { if (!isPreviewing && staticImageElement && detectedLandmarkResults) { drawStaticOverlay(); } else if (!isPreviewing && overlayCanvasRef.current) { const ctx = overlayCanvasRef.current.getContext('2d'); if (ctx) ctx.clearRect(0, 0, overlayCanvasRef.current.width, overlayCanvasRef.current.height); } }, [isPreviewing, staticImageElement, detectedLandmarkResults, drawStaticOverlay]);

   // Retake Selfie
   const handleRetakeSelfie = useCallback(() => { /* ... (No change) ... */ }, []);

   // --- JSX ---
   return (
    <div className="border p-4 rounded bg-green-50">
      <h2 className="text-xl font-semibold mb-2 text-center">Try On Selfie Mode</h2>
      {isPreviewing ? ( // Preview UI block
         <> /* ... (Preview UI - No changes) ... */ </>
      ) : ( // Captured UI block
        <>
          {/* Container for Layered Canvases */}
          <div className="relative w-full max-w-md mx-auto bg-gray-700" style={{ paddingTop: `${selfieDimensions.height && selfieDimensions.width ? (selfieDimensions.height / selfieDimensions.width) * 100 : 75}%`, overflow: 'hidden' }} >
                {/* Base WebGL Canvas */}
                {staticImageElement ? ( <TryOnRenderer ref={webglCanvasRef} videoRefProp={null} imageElement={staticImageElement} isStatic={true} className="absolute top-0 left-0 w-full h-full z-0" style={{ objectFit: 'cover' }} /> )
                : ( <div className="absolute inset-0 flex items-center justify-center bg-gray-200 z-20"><p className="text-gray-500">{isDetecting ? 'Analyzing Selfie...' : (capturedSelfieDataUrl ? 'Loading Image...' : 'Initializing...')}</p></div> )}
                 {/* Overlay 2D Canvas */}
                 <canvas ref={overlayCanvasRef} className="absolute top-0 left-0 w-full h-full z-10 pointer-events-none" style={{ objectFit: 'cover' }} />
          </div>
           {/* Debug Info & Retake Button */}
           <div className="mt-2 p-2 border bg-gray-100 text-xs overflow-auto max-h-20 max-w-md mx-auto rounded"><p className="font-semibold mb-1">Debug Info:</p><pre className="whitespace-pre-wrap break-words">{debugInfo || 'N/A'}</pre></div>
           <div className="text-center mt-4"><button onClick={handleRetakeSelfie} className="bg-gray-500 text-white px-4 py-2 rounded hover:bg-gray-600">Retake Selfie</button></div>
        </>
      )}
      {(!faceLandmarker || !imageSegmenter) && <p className="text-red-500 mt-2 text-center">Initializing AI models...</p>}
    </div>
  );
}); // Closing brace and parenthesis for forwardRef

StaticSelfieTryOn.displayName = 'StaticSelfieTryOn';
export default StaticSelfieTryOn;