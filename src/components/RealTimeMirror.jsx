// src/components/RealTimeMirror.jsx - Layered Canvas Approach

import React, { useRef, useEffect, useState, useCallback, forwardRef } from 'react';
import TryOnRenderer from './TryOnRenderer'; // The simplified WebGL base renderer

// Define which landmarks form the outer face contour.
const FACE_OUTLINE_INDICES = [ 10, 338, 297, 332, 284, 251, 389, 356, 454, 323, 361, 288, 397, 365, 379, 378, 400, 377, 152, 148, 176, 149, 150, 136, 172, 58, 132, 93, 234, 127, 162, 21, 54, 103, 67, 109 ];

const RealTimeMirror = forwardRef(({
  faceLandmarker,
  imageSegmenter,
  effectIntensity
}, ref) => {
  const videoRef = useRef(null);
  const webglCanvasRef = useRef(null); // Ref for the WebGL canvas (passed to TryOnRenderer)
  const overlayCanvasRef = useRef(null); // Ref for the 2D overlay canvas
  const animationFrameRef = useRef({ count: 0, rafId: null });
  const [videoStream, setVideoStream] = useState(null);
  const [isCameraLoading, setIsCameraLoading] = useState(true);
  const [cameraError, setCameraError] = useState(null);
  const [videoDimensions, setVideoDimensions] = useState({ width: 0, height: 0 });
  // No need for separate AI results state, process directly in draw loop
  // const [latestLandmarkResults, setLatestLandmarkResults] = useState(null);
  // const [latestSegmentationResults, setLatestSegmentationResults] = useState(null);
  const videoReadyRef = useRef(false);

  // --- Canvas Drawing Function ---
  const drawOverlay = useCallback((landmarks, segmentationMask) => {
    const overlayCanvas = overlayCanvasRef.current;
    const video = videoRef.current; // Needed for potential size matching
    if (!overlayCanvas || !video || !videoDimensions.width || !videoDimensions.height) return;

    const ctx = overlayCanvas.getContext('2d');
    if (!ctx) return;

    const canvasWidth = videoDimensions.width;
    const canvasHeight = videoDimensions.height;

    // Ensure overlay canvas matches video dimensions
    if (overlayCanvas.width !== canvasWidth || overlayCanvas.height !== canvasHeight) {
        overlayCanvas.width = canvasWidth;
        overlayCanvas.height = canvasHeight;
        console.log(`Resized Overlay Canvas to ${canvasWidth}x${canvasHeight}`);
    }

    // Clear canvas
    ctx.clearRect(0, 0, canvasWidth, canvasHeight);

    // --- IMPORTANT: Mirror the 2D canvas context horizontally ---
    // This makes drawing with original landmark coordinates align with the mirrored video
    ctx.save();
    ctx.scale(-1, 1);
    ctx.translate(-canvasWidth, 0);
    // -----------------------------------------------------------

    // --- Draw Effects ---
    try {
        const facePoints = landmarks?.faceLandmarks?.[0];

        // 1. Create a clipping path for the face outline
        if (facePoints && facePoints.length > 0) {
            ctx.beginPath();
            FACE_OUTLINE_INDICES.forEach((index, i) => {
                if (index < facePoints.length) {
                    const point = facePoints[index];
                    const x = point.x * canvasWidth;
                    const y = point.y * canvasHeight;
                    if (i === 0) { ctx.moveTo(x, y); } else { ctx.lineTo(x, y); }
                }
            });
            ctx.closePath();
            ctx.save(); // Save context state before clipping
            ctx.clip(); // Apply the face polygon as a clipping mask
        }

        // 2. Draw the silhouette mask (optional - for refining edges or effects)
        // This part is complex and potentially slow - skip for initial test?
        // Or draw it first then use globalCompositeOperation?
        // Example: Draw silhouette mask (requires processing mask data into ImageData)
        /*
        if (segmentationMask && segmentationMask.confidenceMasks?.[0]) {
             // ... (Code to get Float32Array, create ImageData, putImageData) ...
             // You might need an intermediate canvas to process the float mask
             // ctx.globalCompositeOperation = 'source-in'; // Example: Keep only parts overlapping the clip
             // ctx.drawImage(processedMaskCanvas, 0, 0, canvasWidth, canvasHeight);
             // ctx.globalCompositeOperation = 'source-over'; // Reset
        }
        */

        // 3. Apply Hydration Effect (Example: semi-transparent white overlay)
        if (effectIntensity > 0.01) {
            // Apply effect only where clipping mask (face) is active
            // (And potentially where silhouette mask was also active if implemented)
            ctx.fillStyle = `rgba(255, 255, 255, ${0.15 * effectIntensity})`; // Adjust alpha based on intensity
            ctx.fillRect(0, 0, canvasWidth, canvasHeight); // Fill the clipped area
        }


        // Restore context state if clipped
        if (facePoints && facePoints.length > 0) {
            ctx.restore(); // Remove the clipping mask
        }


    } catch (error) {
        console.error("Error during overlay drawing:", error);
    } finally {
         // --- IMPORTANT: Restore the transformation ---
         ctx.restore(); // Restore the original non-mirrored context state
         // ------------------------------------------
    }


  }, [effectIntensity, videoDimensions]); // Dependencies for drawing logic

  // --- Camera Access Effect (Uses polling) ---
  useEffect(() => { /* ... (Use polling logic from Message #307 - NO CHANGE NEEDED) ... */ }, [faceLandmarker]);

  // --- Prediction & Drawing Loop ---
  const predictionDrawLoop = useCallback(() => {
    animationFrameRef.current.rafId = requestAnimationFrame(predictionDrawLoop);
    animationFrameRef.current.count++;

    // Check if video is ready (based on polling setting state)
    if (isCameraLoading || cameraError || !videoRef.current || !faceLandmarker || !imageSegmenter) {
        return; // Exit if camera/models not ready
    }

    const video = videoRef.current;
    const startTime = performance.now();

    try {
      // Run predictions
      const landmarkResults = faceLandmarker.detectForVideo(video, startTime);
      const segmentationResults = imageSegmenter.segmentForVideo(video, startTime);

      // Call the draw function with the latest results
      drawOverlay(landmarkResults, segmentationResults);

    } catch (error) {
        console.error(`Prediction/Draw Error:`, error);
        // Optionally stop loop or set error state
        // setCameraError("AI Prediction Failed.");
        // cancelAnimationFrame(animationFrameRef.current.rafId);
    }
  }, [faceLandmarker, imageSegmenter, isCameraLoading, cameraError, drawOverlay]); // Dependencies

  // Effect to manage prediction/draw loop start/stop
  useEffect(() => {
       // Start loop when models & video are ready
       if (!isCameraLoading && !cameraError && videoStream && faceLandmarker && imageSegmenter) {
           console.log("RealTimeMirror: Starting Prediction & Draw Loop.");
           cancelAnimationFrame(animationFrameRef.current?.rafId);
           animationFrameRef.current.count = 0;
           animationFrameRef.current.rafId = requestAnimationFrame(predictionDrawLoop);
       } else {
           cancelAnimationFrame(animationFrameRef.current?.rafId);
       }
       return () => { cancelAnimationFrame(animationFrameRef.current?.rafId); };
   }, [videoStream, faceLandmarker, imageSegmenter, isCameraLoading, cameraError, predictionDrawLoop]); // Depends on readiness flags


  const shouldRenderTryOn = !isCameraLoading && !cameraError; // Render base WebGL when camera is ready

  return (
    <div className="border p-4 rounded bg-blue-50 relative">
       <h2 className="text-xl font-semibold mb-2 text-center">Real-Time Mirror Mode</h2>
       {/* Status Indicators */}
       {(isCameraLoading && !cameraError) && <p className="text-center py-4">Initializing Camera & AI...</p>}
       {cameraError && <p className="text-red-500 text-center py-4">{cameraError}</p>}

      {/* --- Container for Layered Canvases --- */}
      <div
          className="relative w-full max-w-md mx-auto bg-gray-700" // Added bg color for visibility
          style={{
              aspectRatio: `${videoDimensions.width || 16}/${videoDimensions.height || 9}`, // Maintain aspect ratio
              overflow: 'hidden' // Hide parts of canvases outside the aspect ratio
           }}
      >
          {/* Hidden Video Element */}
          <video ref={videoRef} autoPlay playsInline muted className="absolute top-0 left-0 w-[1px] h-[1px] opacity-5" />

          {/* Base WebGL Canvas (using simplified TryOnRenderer) */}
          {/* Render it only when dimensions are known to set correct size */}
          {videoDimensions.width > 0 && (
              <TryOnRenderer
                  ref={webglCanvasRef} // Assign ref if needed, not strictly necessary for baseline
                  videoRefProp={videoRef}
                  imageElement={null}
                  isStatic={false}
                  // Pass dimensions to potentially help sizing? (TryOnRenderer needs update to use them)
                  // initialWidth={videoDimensions.width}
                  // initialHeight={videoDimensions.height}
                  className="absolute top-0 left-0 w-full h-full z-0" // Base layer
                  style={{ objectFit: 'cover' }}
              />
          )}

          {/* Overlay 2D Canvas */}
           <canvas
              ref={overlayCanvasRef}
              className="absolute top-0 left-0 w-full h-full z-10 pointer-events-none" // Overlay layer, ignore mouse
              // Width/Height set dynamically in drawOverlay
              style={{ objectFit: 'cover' }}
           />

           {/* Fallback UI if needed (e.g., while loading) */}
           {!shouldRenderTryOn && (
               <div className="absolute inset-0 flex items-center justify-center bg-gray-200 z-20">
                  <p className="text-gray-500">{cameraError ? cameraError : 'Initializing...'}</p>
               </div>
           )}
      </div>
      {/* --- End Container --- */}

      {/* AI Model Status */}
      {(!faceLandmarker || !imageSegmenter) && !cameraError && !isCameraLoading && <p className="text-red-500 mt-2 text-center">Waiting for AI Models...</p>}
    </div>
  );
});
RealTimeMirror.displayName = 'RealTimeMirror';
export default RealTimeMirror;