// src/components/RealTimeMirror.jsx - Layered Canvas Approach (Precise Lipstick - Detailed Indices)

import React, { useRef, useEffect, useState, useCallback, forwardRef } from 'react';
import TryOnRenderer from './TryOnRenderer'; // The simplified WebGL base renderer

// Define LIP landmark indices (MORE DETAILED SET)
// Outer Lips - Upper
const LIP_OUTLINE_UPPER_INDICES = [ 61, 185, 40, 39, 37, 0, 267, 269, 270, 409 ];
// Outer Lips - Lower
const LIP_OUTLINE_LOWER_INDICES = [ 291, 375, 321, 405, 314, 17, 84, 181, 91, 146 ];
// Inner Lips - Upper
const INNER_LIP_UPPER_INDICES = [ 78, 191, 80, 81, 82, 13, 312, 311, 310, 415 ];
// Inner Lips - Lower
const INNER_LIP_LOWER_INDICES = [ 308, 324, 318, 402, 317, 14, 87, 178, 88, 95 ];
// Combined and ordered for drawing outer path then reverse inner path
const DETAILED_LIP_OUTER_INDICES = [ ...LIP_OUTLINE_UPPER_INDICES, ...LIP_OUTLINE_LOWER_INDICES.slice().reverse() ]; // Combine upper and reversed lower outer
const DETAILED_LIP_INNER_INDICES = [ ...INNER_LIP_UPPER_INDICES, ...INNER_LIP_LOWER_INDICES.slice().reverse() ]; // Combine upper and reversed lower inner


const RealTimeMirror = forwardRef(({
  faceLandmarker,
  imageSegmenter,
  effectIntensity // Unused for now
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

  // --- Canvas Drawing Function (Precise Lipstick - Detailed) ---
  const drawOverlay = useCallback((landmarks, segmentationMask) => {
    const overlayCanvas = overlayCanvasRef.current;
    const video = videoRef.current;
    if (!overlayCanvas || !video || !videoDimensions.width || !videoDimensions.height) return;
    const ctx = overlayCanvas.getContext('2d');
    if (!ctx) return;
    const canvasWidth = videoDimensions.width;
    const canvasHeight = videoDimensions.height;
    if (overlayCanvas.width !== canvasWidth || overlayCanvas.height !== canvasHeight) {
        overlayCanvas.width = canvasWidth; overlayCanvas.height = canvasHeight;
    }
    ctx.clearRect(0, 0, canvasWidth, canvasHeight);
    ctx.save(); ctx.scale(-1, 1); ctx.translate(-canvasWidth, 0); // Mirror context
    try {
        const facePoints = landmarks?.faceLandmarks?.[0];
        if (facePoints && facePoints.length > 0) {
            ctx.fillStyle = "#0000FF"; // Bright Blue

            ctx.beginPath();
            // --- Draw Outer Lip Path (Detailed) ---
            DETAILED_LIP_OUTER_INDICES.forEach((index, i) => {
                if (index < facePoints.length) { const point = facePoints[index]; const x = point.x * canvasWidth; const y = point.y * canvasHeight; if (i === 0) { ctx.moveTo(x, y); } else { ctx.lineTo(x, y); } }
                 else { console.warn(`Outer Lip index ${index} out of bounds`); }
            });
            ctx.closePath();

            // --- Draw Inner Lip Path (Detailed - Reverse Order for Hole) ---
            const innerLastIndex = DETAILED_LIP_INNER_INDICES[DETAILED_LIP_INNER_INDICES.length - 1];
            if (innerLastIndex < facePoints.length) {
                 ctx.moveTo(facePoints[innerLastIndex].x * canvasWidth, facePoints[innerLastIndex].y * canvasHeight);
            }
            for (let i = DETAILED_LIP_INNER_INDICES.length - 2; i >= 0; i--) { // Loop backwards
                 const index = DETAILED_LIP_INNER_INDICES[i];
                 if (index < facePoints.length) { const point = facePoints[index]; ctx.lineTo(point.x * canvasWidth, point.y * canvasHeight); }
                 else { console.warn(`Inner Lip index ${index} out of bounds`); }
            }
            ctx.closePath();

            // Fill using the even-odd rule
            ctx.fill('evenodd');
        }
    } catch (error) { console.error("Error during overlay drawing:", error); }
    finally { ctx.restore(); } // Restore mirror transform
  }, [videoDimensions]); // Removed intensity dependency


  // --- Camera Access Effect (Polling) --- (No change)
  useEffect(() => { /* ... */ }, [faceLandmarker]);
  // --- Prediction & Drawing Loop --- (No change)
  const predictionDrawLoop = useCallback(() => { /* ... */ }, [faceLandmarker, imageSegmenter, isCameraLoading, cameraError, drawOverlay]);
  // --- Effect to manage prediction/draw loop start/stop --- (No change)
  useEffect(() => { /* ... */ }, [videoStream, faceLandmarker, imageSegmenter, isCameraLoading, cameraError, predictionDrawLoop]);
  // --- Determine if base WebGL renderer should be shown --- (No change)
  const shouldRenderTryOnBase = !isCameraLoading && !cameraError;
  // --- JSX --- (No change)
  return ( /* ... layered canvas JSX ... */ );
});
RealTimeMirror.displayName = 'RealTimeMirror';
export default RealTimeMirror;