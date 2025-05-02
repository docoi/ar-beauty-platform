// src/components/RealTimeMirror.jsx - Layered Canvas Approach (Lipstick via Clipping - Straight Lines + Style Reset)

import React, { useRef, useEffect, useState, useCallback, forwardRef } from 'react';
import TryOnRenderer from './TryOnRenderer'; // The simplified WebGL base renderer

// Define LIP landmark indices (DETAILED SET)
const LIP_OUTLINE_UPPER_INDICES = [ 61, 185, 40, 39, 37, 0, 267, 269, 270, 409 ];
const LIP_OUTLINE_LOWER_INDICES = [ 291, 375, 321, 405, 314, 17, 84, 181, 91, 146 ];
const INNER_LIP_UPPER_INDICES = [ 78, 191, 80, 81, 82, 13, 312, 311, 310, 415 ];
const INNER_LIP_LOWER_INDICES = [ 308, 324, 318, 402, 317, 14, 87, 178, 88, 95 ];
// Combined indices for drawing straight line paths
const DETAILED_LIP_OUTER_INDICES = [ ...LIP_OUTLINE_UPPER_INDICES, ...LIP_OUTLINE_LOWER_INDICES.slice().reverse() ];
const DETAILED_LIP_INNER_INDICES = [ ...INNER_LIP_UPPER_INDICES, ...INNER_LIP_LOWER_INDICES.slice().reverse() ];

// REMOVED drawSmoothPath helper

const RealTimeMirror = forwardRef(({
  faceLandmarker, imageSegmenter, effectIntensity // Unused for now
}, ref) => {
  const videoRef = useRef(null);
  const webglCanvasRef = useRef(null);
  const overlayCanvasRef = useRef(null);
  const animationFrameRef = useRef({ count: 0, rafId: null });
  const checkReadyRafRef = useRef(null);
  const [videoStream, setVideoStream] = useState(null);
  const [isCameraLoading, setIsCameraLoading] = useState(true);
  const [cameraError, setCameraError] = useState(null);
  const [videoDimensions, setVideoDimensions] = useState({ width: 0, height: 0 });

  // --- Canvas Drawing Function (Lipstick via Clipping - STRAIGHT LINES + Style Reset) ---
  const drawOverlay = useCallback((landmarks, segmentationMask) => {
    const overlayCanvas = overlayCanvasRef.current; const video = videoRef.current; if (!overlayCanvas || !video || !videoDimensions.width || !videoDimensions.height) return; const ctx = overlayCanvas.getContext('2d'); if (!ctx) return; const canvasWidth = videoDimensions.width; const canvasHeight = videoDimensions.height; if (overlayCanvas.width !== canvasWidth || overlayCanvas.height !== canvasHeight) { overlayCanvas.width = canvasWidth; overlayCanvas.height = canvasHeight; } ctx.clearRect(0, 0, canvasWidth, canvasHeight);

    ctx.save(); // Save original state
    ctx.scale(-1, 1); ctx.translate(-canvasWidth, 0); // Mirror context

    try {
        const facePoints = landmarks?.faceLandmarks?.[0];
        if (facePoints && facePoints.length > 0) {
            ctx.fillStyle = "#0000FF"; // Bright Blue
            // --- Explicitly set line styles ---
            ctx.lineCap = 'round'; // Use round joins/caps to avoid sharp corners causing issues
            ctx.lineJoin = 'round';
            // ---

            // --- Draw Outer Lip Path (Straight) and Fill ---
            ctx.beginPath();
            DETAILED_LIP_OUTER_INDICES.forEach((index, i) => {
                if (index < facePoints.length) { const point = facePoints[index]; const x = point.x * canvasWidth; const y = point.y * canvasHeight; if (i === 0) { ctx.moveTo(x, y); } else { ctx.lineTo(x, y); } }
                else { console.warn(`Outer Lip index ${index} out of bounds`); }
            });
            ctx.closePath();
            ctx.fill(); // Fill the outer shape first

            // --- Erase Inner Lip Area using STRAIGHT LINES ---
            ctx.save(); // Save before changing composite operation
            ctx.globalCompositeOperation = 'destination-out'; // Erase mode
            ctx.beginPath();
            INNER_LIP_UPPER_INDICES.forEach((index, i) => { if (index < facePoints.length) { const p = facePoints[index]; const x = p.x * canvasWidth; const y = p.y * canvasHeight; if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y); } });
            INNER_LIP_LOWER_INDICES.slice().reverse().forEach((index, i) => { if (index < facePoints.length) { const p = facePoints[index]; const x = p.x * canvasWidth; const y = p.y * canvasHeight; ctx.lineTo(x, y); } });
            ctx.closePath(); // Close the inner path
            ctx.fill(); // Fill inner path (erases)
            ctx.restore(); // Restore composite operation to default ('source-over')
            // --- End Erase Inner Lip ---

        } // End facePoints check
    } catch (error) { console.error("Error during overlay drawing:", error); }
    finally { ctx.restore(); } // Restore mirror transform
  }, [videoDimensions]);


  // --- Camera Access Effect (Polling) --- (No change)
  useEffect(() => { /* ... */ }, [faceLandmarker]);
  // --- Prediction & Drawing Loop --- (No change)
  const predictionDrawLoop = useCallback(() => { /* ... */ }, [faceLandmarker, imageSegmenter, isCameraLoading, cameraError, drawOverlay]);
  // --- Effect to manage prediction/draw loop start/stop --- (No change)
  useEffect(() => { /* ... */ }, [videoStream, faceLandmarker, imageSegmenter, isCameraLoading, cameraError, predictionDrawLoop]);
  // --- Determine if base WebGL renderer should be shown --- (No change)
  const shouldRenderTryOnBase = !isCameraLoading && !cameraError;

  // --- JSX --- (VERIFIED COMPLETE)
  return (
    <div className="border p-4 rounded bg-blue-50 relative">
       <h2 className="text-xl font-semibold mb-2 text-center">Real-Time Mirror Mode</h2>
       {(isCameraLoading && !cameraError) && <p className="text-center py-4">Initializing Camera & AI...</p>}
       {cameraError && <p className="text-red-500 text-center py-4">{cameraError}</p>}
      {/* Container for Layered Canvases */}
      <div className="relative w-full max-w-md mx-auto bg-gray-700" style={{ aspectRatio: `${videoDimensions.width || 16}/${videoDimensions.height || 9}`, overflow: 'hidden' }}>
          <video ref={videoRef} autoPlay playsInline muted className="absolute top-0 left-0 w-[1px] h-[1px] opacity-5 -z-10" />
          {/* Base WebGL Canvas */}
          {shouldRenderTryOnBase && ( <TryOnRenderer ref={webglCanvasRef} videoRefProp={videoRef} imageElement={null} isStatic={false} className="absolute top-0 left-0 w-full h-full z-0" style={{ objectFit: 'cover' }} /> )}
          {/* Overlay 2D Canvas */}
           <canvas ref={overlayCanvasRef} className="absolute top-0 left-0 w-full h-full z-10 pointer-events-none" style={{ objectFit: 'cover' }} />
           {/* Fallback UI */}
           {isCameraLoading && !cameraError && ( <div className="absolute inset-0 flex items-center justify-center bg-gray-200 z-20"><p className="text-gray-500">Initializing...</p></div> )}
      </div>
      {/* AI Model Status */}
    </div>
  );
});
RealTimeMirror.displayName = 'RealTimeMirror';
export default RealTimeMirror;