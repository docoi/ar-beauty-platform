// src/components/StaticSelfieTryOn.jsx - Layered Canvas Approach

import React, { useState, useRef, useEffect, useCallback, forwardRef } from 'react';
import TryOnRenderer from './TryOnRenderer'; // The simplified WebGL base renderer

// Define face outline landmarks (same as Mirror mode)
const FACE_OUTLINE_INDICES = [ 10, 338, 297, 332, 284, 251, 389, 356, 454, 323, 361, 288, 397, 365, 379, 378, 400, 377, 152, 148, 176, 149, 150, 136, 172, 58, 132, 93, 234, 127, 162, 21, 54, 103, 67, 109 ];

const StaticSelfieTryOn = forwardRef(({
    faceLandmarker,
    imageSegmenter,
    effectIntensity
}, ref) => {
  // State
  const [isPreviewing, setIsPreviewing] = useState(true);
  const [cameraStream, setCameraStream] = useState(null);
  const [isCameraLoading, setIsCameraLoading] = useState(true);
  const [cameraError, setCameraError] = useState(null);
  const [capturedSelfieDataUrl, setCapturedSelfieDataUrl] = useState(null);
  const [detectedLandmarkResults, setDetectedLandmarkResults] = useState(null);
  const [detectedSegmentationResults, setDetectedSegmentationResults] = useState(null);
  const [selfieDimensions, setSelfieDimensions] = useState({ width: 0, height: 0 });
  const [isDetecting, setIsDetecting] = useState(false);
  const [debugInfo, setDebugInfo] = useState('');
  const [staticImageElement, setStaticImageElement] = useState(null);

  // Refs
  const selfieVideoRef = useRef(null);
  const webglCanvasRef = useRef(null); // Ref for base WebGL canvas
  const overlayCanvasRef = useRef(null); // Ref for 2D overlay canvas

  // Camera Access Effect (No change needed)
  useEffect(() => { /* ... */ }, [isPreviewing, faceLandmarker]);
  // Selfie Capture (No change needed)
  const handleTakeSelfie = useCallback(() => { /* ... */ }, [cameraStream, selfieDimensions]);

  // Image Loading and AI Detection Effect (No change needed here)
  useEffect(() => {
    if (!capturedSelfieDataUrl || !faceLandmarker || !imageSegmenter) { /* ... cleanup/return ... */ if (staticImageElement) setStaticImageElement(null); if (isDetecting) setIsDetecting(false); return; }
    console.log("StaticSelfieTryOn: Loading image for detection/segmentation..."); setIsDetecting(true); setDebugInfo('Loading captured image...'); const imageElement = new Image();
    imageElement.onload = () => {
      console.log("StaticSelfieTryOn: Image loaded."); setSelfieDimensions({width: imageElement.naturalWidth, height: imageElement.naturalHeight}); setStaticImageElement(imageElement); setDebugInfo('Image loaded, running AI...');
      try {
        if (faceLandmarker && imageSegmenter) {
          console.log("StaticSelfieTryOn: Running detectForVideo() and segmentForVideo()..."); const startTime = performance.now();
          const landmarkResults = faceLandmarker.detectForVideo(imageElement, startTime); const segmentationResults = imageSegmenter.segmentForVideo(imageElement, startTime);
          const endTime = performance.now(); console.log(`StaticSelfieTryOn: AI Processing took ${endTime - startTime}ms`);
          setDetectedLandmarkResults(landmarkResults); setDetectedSegmentationResults(segmentationResults); setDebugInfo(`Analysis complete: ${landmarkResults?.faceLandmarks?.[0]?.length || 0} landmarks found.`);
        } else { setDetectedLandmarkResults(null); setDetectedSegmentationResults(null); setDebugInfo('AI models not ready for analysis.'); }
      } catch(err) { console.error("StaticSelfieTryOn: Error during AI processing:", err); setDetectedLandmarkResults(null); setDetectedSegmentationResults(null); setDebugInfo(`AI Error: ${err.message}`); }
      finally { setIsDetecting(false); } // Analysis finished (or failed)
    };
    imageElement.onerror = () => { console.error("StaticSelfieTryOn: imageElement.onerror triggered."); setDebugInfo('Error: Failed to load captured image.'); setStaticImageElement(null); setIsDetecting(false); }; imageElement.src = capturedSelfieDataUrl;
    return () => { imageElement.onload = null; imageElement.onerror = null; imageElement.src = ''; };
  }, [capturedSelfieDataUrl, faceLandmarker, imageSegmenter]);


  // --- Canvas Drawing Function for Static Selfie ---
  const drawStaticOverlay = useCallback(() => {
    const overlayCanvas = overlayCanvasRef.current;
    const image = staticImageElement; // Source dimensions from image
    const landmarks = detectedLandmarkResults; // Source landmarks
    // const segmentationMask = detectedSegmentationResults; // Source mask (unused for now)

    if (!overlayCanvas || !image || !landmarks?.faceLandmarks?.[0] || !selfieDimensions.width || !selfieDimensions.height) {
         console.log("drawStaticOverlay: Skipping, missing canvas, image, landmarks, or dimensions.");
         // Clear canvas if conditions aren't met but canvas exists
         if(overlayCanvas) {
            const ctx = overlayCanvas.getContext('2d');
            if(ctx) ctx.clearRect(0, 0, overlayCanvas.width, overlayCanvas.height);
         }
         return;
    }

    console.log("drawStaticOverlay: Drawing...");
    const ctx = overlayCanvas.getContext('2d');
    if (!ctx) return;

    const canvasWidth = selfieDimensions.width;
    const canvasHeight = selfieDimensions.height;

    // Ensure overlay canvas matches image dimensions
    if (overlayCanvas.width !== canvasWidth || overlayCanvas.height !== canvasHeight) {
        overlayCanvas.width = canvasWidth;
        overlayCanvas.height = canvasHeight;
        console.log(`Resized Static Overlay Canvas to ${canvasWidth}x${canvasHeight}`);
    }

    // Clear canvas
    ctx.clearRect(0, 0, canvasWidth, canvasHeight);

    // --- IMPORTANT: DO NOT Mirror the context for static selfie ---

    // --- Draw Effects ---
    try {
        const facePoints = landmarks.faceLandmarks[0];

        // 1. Create clipping path for the face outline
        if (facePoints.length > 0) {
            ctx.beginPath();
            FACE_OUTLINE_INDICES.forEach((index, i) => {
                if (index < facePoints.length) {
                    const point = facePoints[index];
                    const x = point.x * canvasWidth; // Scale normalized coords
                    const y = point.y * canvasHeight;
                    if (i === 0) { ctx.moveTo(x, y); } else { ctx.lineTo(x, y); }
                }
            });
            ctx.closePath();
            ctx.save(); // Save context state before clipping
            ctx.clip(); // Apply the face polygon as a clipping mask
        }

        // 2. Apply Hydration Effect (Example: semi-transparent white overlay)
        if (effectIntensity > 0.01) {
            ctx.fillStyle = `rgba(255, 255, 255, ${0.15 * effectIntensity})`;
            ctx.fillRect(0, 0, canvasWidth, canvasHeight); // Fill the clipped area
        }

        // Restore context state if clipped
        if (facePoints.length > 0) {
            ctx.restore(); // Remove the clipping mask
        }

    } catch (error) {
        console.error("Error during static overlay drawing:", error);
    }
    // No final ctx.restore() needed as we didn't ctx.save() for mirroring

  }, [staticImageElement, detectedLandmarkResults, effectIntensity, selfieDimensions]);


  // --- Effect to Trigger Static Drawing ---
  useEffect(() => {
      // Draw whenever the required data changes and we are *not* previewing
      if (!isPreviewing && staticImageElement && detectedLandmarkResults) {
          drawStaticOverlay();
      } else if (!isPreviewing && overlayCanvasRef.current) {
          // Clear overlay if we lose landmarks or image while in result view
           const ctx = overlayCanvasRef.current.getContext('2d');
           if (ctx) ctx.clearRect(0, 0, overlayCanvasRef.current.width, overlayCanvasRef.current.height);
      }
  }, [isPreviewing, staticImageElement, detectedLandmarkResults, drawStaticOverlay]); // Rerun draw when data changes


   // Retake Selfie
   const handleRetakeSelfie = useCallback(() => {
       setIsPreviewing(true); setCapturedSelfieDataUrl(null); setDetectedLandmarkResults(null); setDetectedSegmentationResults(null); setStaticImageElement(null); setSelfieDimensions({ width: 0, height: 0 }); setCameraError(null); setIsCameraLoading(true); setIsDetecting(false); setDebugInfo('');
       // Clear overlay canvas on retake
       if(overlayCanvasRef.current) {
           const ctx = overlayCanvasRef.current.getContext('2d');
           if(ctx) ctx.clearRect(0, 0, overlayCanvasRef.current.width, overlayCanvasRef.current.height);
       }
   }, []); // Added useCallback wrapper

   // JSX - Includes Overlay Canvas
   return (
    <div className="border p-4 rounded bg-green-50">
      <h2 className="text-xl font-semibold mb-2 text-center">Try On Selfie Mode</h2>
      {isPreviewing ? ( // Render Preview UI block
         <> /* ... (Preview UI - No changes needed) ... */ </>
      ) : ( // Render Captured UI block
        <>
          {/* --- Container for Layered Canvases --- */}
          <div
              className="relative w-full max-w-md mx-auto bg-gray-700" // Added bg color
              style={{
                  paddingTop: `${selfieDimensions.height && selfieDimensions.width ? (selfieDimensions.height / selfieDimensions.width) * 100 : 75}%`, // Aspect Ratio
                  overflow: 'hidden'
              }}
           >
                {/* Base WebGL Canvas (Renders static image) */}
                {staticImageElement ? (
                  <TryOnRenderer
                    ref={webglCanvasRef}
                    videoRefProp={null}
                    imageElement={staticImageElement}
                    isStatic={true}
                    className="absolute top-0 left-0 w-full h-full z-0" // Base layer
                    style={{ objectFit: 'cover' }}
                  />
                ) : ( /* Fallback UI while image loads/analyzes */
                     <div className="absolute inset-0 flex items-center justify-center bg-gray-200 z-20"><p className="text-gray-500">{isDetecting ? 'Analyzing Selfie...' : (capturedSelfieDataUrl ? 'Loading Image...' : 'Initializing...')}</p></div>
                 )}

                 {/* Overlay 2D Canvas */}
                 {/* Render overlay canvas only when not previewing */}
                 <canvas
                    ref={overlayCanvasRef}
                    className="absolute top-0 left-0 w-full h-full z-10 pointer-events-none"
                    // Width/Height set dynamically in drawStaticOverlay
                    style={{ objectFit: 'cover' }}
                 />
          </div>
           {/* --- End Container --- */}

          {/* Debug Info & Retake Button */}
           <div className="mt-2 p-2 border bg-gray-100 text-xs overflow-auto max-h-20 max-w-md mx-auto rounded"><p className="font-semibold mb-1">Debug Info:</p><pre className="whitespace-pre-wrap break-words">{debugInfo || 'N/A'}</pre></div>
           <div className="text-center mt-4"><button onClick={handleRetakeSelfie} className="bg-gray-500 text-white px-4 py-2 rounded hover:bg-gray-600">Retake Selfie</button></div>
        </>
      )}
      {/* AI Model Status */}
      {(!faceLandmarker || !imageSegmenter) && <p className="text-red-500 mt-2 text-center">Initializing AI models...</p>}
    </div>
  );

});
StaticSelfieTryOn.displayName = 'StaticSelfieTryOn';
export default StaticSelfieTryOn;