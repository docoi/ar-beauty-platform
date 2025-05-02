// src/components/StaticSelfieTryOn.jsx - Layered Canvas Approach (Smooth Lipstick Effect using Curves)

import React, { useState, useRef, useEffect, useCallback, forwardRef } from 'react';
import TryOnRenderer from './TryOnRenderer'; // The simplified WebGL base renderer

// Define LIP landmark indices (DETAILED SET - Same as Mirror)
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
        const p0 = points[i]; const p1 = points[(i + 1) % points.length];
        const midPointX = (p0.x + p1.x) / 2; const midPointY = (p0.y + p1.y) / 2;
        ctx.quadraticCurveTo(p0.x, p0.y, midPointX, midPointY);
    }
    if (isClosed) {
         const lastPoint = points[points.length - 1]; const firstPoint = points[0];
         const midPointX = (lastPoint.x + firstPoint.x) / 2; const midPointY = (lastPoint.y + firstPoint.y) / 2;
         ctx.quadraticCurveTo(lastPoint.x, lastPoint.y, midPointX, midPointY);
    }
};


const StaticSelfieTryOn = forwardRef(({
    faceLandmarker, imageSegmenter, effectIntensity // Unused for now
}, ref) => {
  // State (No change)
  const [isPreviewing, setIsPreviewing] = useState(true); /* ... */
  const [cameraStream, setCameraStream] = useState(null); /* ... */
  const [isCameraLoading, setIsCameraLoading] = useState(true); /* ... */
  const [cameraError, setCameraError] = useState(null); /* ... */
  const [capturedSelfieDataUrl, setCapturedSelfieDataUrl] = useState(null); /* ... */
  const [detectedLandmarkResults, setDetectedLandmarkResults] = useState(null); /* ... */
  const [detectedSegmentationResults, setDetectedSegmentationResults] = useState(null); /* ... */
  const [selfieDimensions, setSelfieDimensions] = useState({ width: 0, height: 0 }); /* ... */
  const [isDetecting, setIsDetecting] = useState(false); /* ... */
  const [debugInfo, setDebugInfo] = useState(''); /* ... */
  const [staticImageElement, setStaticImageElement] = useState(null); /* ... */
  // Refs (No change)
  const selfieVideoRef = useRef(null); /* ... */
  const webglCanvasRef = useRef(null); /* ... */
  const overlayCanvasRef = useRef(null); /* ... */

  // Camera Access Effect (No change)
  useEffect(() => { /* ... */ }, [isPreviewing, faceLandmarker]);
  // Selfie Capture (No change)
  const handleTakeSelfie = useCallback(() => { /* ... */ }, [cameraStream, selfieDimensions]);
  // Image Loading and AI Detection Effect (No change)
  useEffect(() => { /* ... */ }, [capturedSelfieDataUrl, faceLandmarker, imageSegmenter]);


  // --- Canvas Drawing Function for Static Selfie (Smooth Lipstick) ---
  const drawStaticOverlay = useCallback(() => {
    const overlayCanvas = overlayCanvasRef.current; const image = staticImageElement; const landmarks = detectedLandmarkResults; if (!overlayCanvas || !image || !landmarks?.faceLandmarks?.[0] || !selfieDimensions.width || !selfieDimensions.height) { if(overlayCanvas) { const ctx = overlayCanvas.getContext('2d'); if(ctx) ctx.clearRect(0, 0, overlayCanvas.width, overlayCanvas.height); } return; } const ctx = overlayCanvas.getContext('2d'); if (!ctx) return; const canvasWidth = selfieDimensions.width; const canvasHeight = selfieDimensions.height; if (overlayCanvas.width !== canvasWidth || overlayCanvas.height !== canvasHeight) { overlayCanvas.width = canvasWidth; overlayCanvas.height = canvasHeight; } ctx.clearRect(0, 0, canvasWidth, canvasHeight);
    try {
        const facePoints = landmarks.faceLandmarks[0];
        if (facePoints.length > 0) {
             ctx.fillStyle = "#0000FF"; ctx.beginPath();
             // Get points for outer path
             const outerPoints = DETAILED_LIP_OUTER_INDICES.map(index => { if (index < facePoints.length) { const p = facePoints[index]; return { x: p.x * canvasWidth, y: p.y * canvasHeight }; } return null; }).filter(p => p !== null);
             // Draw smooth outer path
             drawSmoothPath(ctx, outerPoints, true);
             // Get points for inner path (in reverse for hole)
             const innerPointsReverse = DETAILED_LIP_INNER_INDICES.slice().reverse().map(index => { if (index < facePoints.length) { const p = facePoints[index]; return { x: p.x * canvasWidth, y: p.y * canvasHeight }; } return null; }).filter(p => p !== null);
              // Draw smooth inner path (starting from correct point)
             if(innerPointsReverse.length > 0) { ctx.moveTo(innerPointsReverse[0].x, innerPointsReverse[0].y); drawSmoothPath(ctx, innerPointsReverse, true); }
             // Fill using the even-odd rule
             ctx.fill('evenodd');
        }
    } catch (error) { console.error("Error during static overlay drawing:", error); }
  }, [staticImageElement, detectedLandmarkResults, selfieDimensions]); // Removed effectIntensity


  // Effect to Trigger Static Drawing (No change)
  useEffect(() => { if (!isPreviewing && staticImageElement && detectedLandmarkResults) { drawStaticOverlay(); } else if (!isPreviewing && overlayCanvasRef.current) { const ctx = overlayCanvasRef.current.getContext('2d'); if (ctx) ctx.clearRect(0, 0, overlayCanvasRef.current.width, overlayCanvasRef.current.height); } }, [isPreviewing, staticImageElement, detectedLandmarkResults, drawStaticOverlay]);
   // Retake Selfie (No change)
   const handleRetakeSelfie = useCallback(() => { /* ... */ }, []);

   // --- JSX --- (No change from Message #349)
   return ( /* ... layered canvas JSX with Preview UI ... */ );
});

StaticSelfieTryOn.displayName = 'StaticSelfieTryOn';
export default StaticSelfieTryOn;