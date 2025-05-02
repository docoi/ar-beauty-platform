// src/components/RealTimeMirror.jsx - Layered Canvas Approach (Smooth Lipstick Effect using Curves)

import React, { useRef, useEffect, useState, useCallback, forwardRef } from 'react';
import TryOnRenderer from './TryOnRenderer'; // The simplified WebGL base renderer

// Define LIP landmark indices (DETAILED SET - Same as before)
const LIP_OUTLINE_UPPER_INDICES = [ 61, 185, 40, 39, 37, 0, 267, 269, 270, 409 ];
const LIP_OUTLINE_LOWER_INDICES = [ 291, 375, 321, 405, 314, 17, 84, 181, 91, 146 ];
const INNER_LIP_UPPER_INDICES = [ 78, 191, 80, 81, 82, 13, 312, 311, 310, 415 ];
const INNER_LIP_LOWER_INDICES = [ 308, 324, 318, 402, 317, 14, 87, 178, 88, 95 ];
const DETAILED_LIP_OUTER_INDICES = [ ...LIP_OUTLINE_UPPER_INDICES, ...LIP_OUTLINE_LOWER_INDICES.slice().reverse() ];
const DETAILED_LIP_INNER_INDICES = [ ...INNER_LIP_UPPER_INDICES, ...INNER_LIP_LOWER_INDICES.slice().reverse() ];

// Helper function to draw a smooth path through points
const drawSmoothPath = (ctx, points, isClosed = true) => {
    if (!points || points.length < 2) return;

    ctx.moveTo(points[0].x, points[0].y);

    for (let i = 0; i < points.length - (isClosed ? 0 : 1); i++) {
        const p0 = points[i];
        // Use modulo for wrapping index for closed paths
        const p1 = points[(i + 1) % points.length];
        // Control point is the midpoint between current and next point
        const midPointX = (p0.x + p1.x) / 2;
        const midPointY = (p0.y + p1.y) / 2;
        // Draw quadratic curve from current point, using the *next* point as control, to the midpoint
        // This creates curves that pass *near* the original points, resulting in smoothing.
        // For curves passing *through* points, Bezier (cubic) is often needed with calculated control points.
        // Let's start simpler with quadratic.
        ctx.quadraticCurveTo(p0.x, p0.y, midPointX, midPointY);
    }

    if (isClosed) {
         // Curve back to the start for closed shapes
         const lastPoint = points[points.length - 1];
         const firstPoint = points[0];
         const midPointX = (lastPoint.x + firstPoint.x) / 2;
         const midPointY = (lastPoint.y + firstPoint.y) / 2;
         ctx.quadraticCurveTo(lastPoint.x, lastPoint.y, midPointX, midPointY);
         // Optionally, curve fully back to start
         // ctx.quadraticCurveTo(midPointX, midPointY, firstPoint.x, firstPoint.y);
         // ctx.closePath(); // Not strictly needed if fill follows
    }
};


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

  // --- Canvas Drawing Function (Smooth Lipstick) ---
  const drawOverlay = useCallback((landmarks, segmentationMask) => {
    const overlayCanvas = overlayCanvasRef.current; const video = videoRef.current; if (!overlayCanvas || !video || !videoDimensions.width || !videoDimensions.height) return; const ctx = overlayCanvas.getContext('2d'); if (!ctx) return; const canvasWidth = videoDimensions.width; const canvasHeight = videoDimensions.height; if (overlayCanvas.width !== canvasWidth || overlayCanvas.height !== canvasHeight) { overlayCanvas.width = canvasWidth; overlayCanvas.height = canvasHeight; } ctx.clearRect(0, 0, canvasWidth, canvasHeight);
    ctx.save(); ctx.scale(-1, 1); ctx.translate(-canvasWidth, 0); // Mirror context
    try {
        const facePoints = landmarks?.faceLandmarks?.[0];
        if (facePoints && facePoints.length > 0) {
            ctx.fillStyle = "#0000FF"; // Bright Blue
            ctx.beginPath();

            // --- Get points for outer path ---
            const outerPoints = DETAILED_LIP_OUTER_INDICES.map(index => {
                 if (index < facePoints.length) { const p = facePoints[index]; return { x: p.x * canvasWidth, y: p.y * canvasHeight }; } return null;
            }).filter(p => p !== null); // Filter out nulls if index was bad

            // --- Draw smooth outer path ---
            drawSmoothPath(ctx, outerPoints, true); // True for closed path

            // --- Get points for inner path (in reverse for hole) ---
            const innerPointsReverse = DETAILED_LIP_INNER_INDICES.slice().reverse().map(index => {
                 if (index < facePoints.length) { const p = facePoints[index]; return { x: p.x * canvasWidth, y: p.y * canvasHeight }; } return null;
            }).filter(p => p !== null);

             // --- Draw smooth inner path ---
             // Start from the effective "first" point of the reversed inner loop
             if(innerPointsReverse.length > 0) {
                 ctx.moveTo(innerPointsReverse[0].x, innerPointsReverse[0].y);
                 drawSmoothPath(ctx, innerPointsReverse, true); // True for closed path
             }

             // Fill using the even-odd rule
             ctx.fill('evenodd');
        }
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
  // --- JSX --- (No change)
  return ( /* ... layered canvas JSX ... */ );
});
RealTimeMirror.displayName = 'RealTimeMirror';
export default RealTimeMirror;