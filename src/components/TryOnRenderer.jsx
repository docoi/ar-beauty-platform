// src/components/TryOnRenderer.jsx

import React, { useRef, useImperativeHandle, forwardRef, useEffect } from 'react';
// Keep this import if you installed the package
import { DrawingUtils } from "@mediapipe/drawing_utils";

const TryOnRenderer = forwardRef(({ videoWidth, videoHeight, className }, ref) => {
  const canvasRef = useRef(null);
  const drawingUtilsRef = useRef(null); // Ref to store DrawingUtils instance

  // Function to initialize or re-initialize DrawingUtils
  const initializeDrawingUtils = () => {
      if (canvasRef.current) {
        const canvasCtx = canvasRef.current.getContext("2d");
        if (canvasCtx && typeof DrawingUtils !== 'undefined') { // Check if DrawingUtils is defined
            drawingUtilsRef.current = new DrawingUtils(canvasCtx);
            console.log("DrawingUtils initialized/re-initialized.");
            return true;
        } else {
            console.warn("DrawingUtils not available or canvas context failed.");
            drawingUtilsRef.current = null; // Ensure it's null if failed
            return false;
        }
      }
      return false;
  };

  // Initialize DrawingUtils once on mount
  useEffect(() => {
      initializeDrawingUtils();
  }, []);


  // Expose methods to the parent component via the ref
  useImperativeHandle(ref, () => ({
    // --- Method for Real-time Video ---
    renderResults: (videoElement, results) => {
      // ... (keep this method as it was in the PREVIOUS step - drawing still commented out) ...
       if (!canvasRef.current) return;
      const canvas = canvasRef.current;
      const canvasCtx = canvas.getContext('2d');
       if (!canvasCtx) return;
       if (canvas.width !== videoWidth || canvas.height !== videoHeight) {
           canvas.width = videoWidth;
           canvas.height = videoHeight;
            if (canvas.width === 0 || canvas.height === 0) return;
             // Re-init if size changes
             initializeDrawingUtils();
       }

      canvasCtx.save();
      canvasCtx.clearRect(0, 0, canvas.width, canvas.height);
      canvasCtx.scale(-1, 1);
      canvasCtx.translate(-canvas.width, 0);
      canvasCtx.drawImage(videoElement, 0, 0, canvas.width, canvas.height);
      canvasCtx.restore();

      // --- REAL-TIME LANDMARK DRAWING STILL COMMENTED OUT ---
      // if (results?.faceLandmarks && drawingUtilsRef.current) { ... }
      // --- END OF REAL-TIME COMMENTING ---
    },

    // --- Method for Static Image ---
    renderStaticImageResults: (imageElement, results) => {
        console.log("Renderer: renderStaticImageResults called.", { hasImage: !!imageElement, hasResults: !!results });

        if (!canvasRef.current || !imageElement) return;
        const canvas = canvasRef.current;
        const canvasCtx = canvas.getContext('2d');
         if (!canvasCtx) return;
        if (canvas.width !== imageElement.naturalWidth || canvas.height !== imageElement.naturalHeight) {
             canvas.width = imageElement.naturalWidth;
             canvas.height = imageElement.naturalHeight;
             if (canvas.width === 0 || canvas.height === 0) return;
              // Re-init drawing utils if size changes
             initializeDrawingUtils();
         }

        canvasCtx.save();
        canvasCtx.clearRect(0, 0, canvas.width, canvas.height);
        canvasCtx.drawImage(imageElement, 0, 0, canvas.width, canvas.height);

        // --- RE-ENABLE STATIC LANDMARK DRAWING (DrawingUtils path only) ---
        if (results?.faceLandmarks && results.faceLandmarks.length > 0) {
            if (drawingUtilsRef.current) {
                 console.log("Renderer: Attempting to draw static landmarks using DrawingUtils...");
                 console.log("Landmark data structure:", results.faceLandmarks); // Log data
                 try {
                     // Loop through each detected face's landmarks
                     for (const landmarks of results.faceLandmarks) {
                       // Ensure landmarks is an array and has data
                       if (Array.isArray(landmarks) && landmarks.length > 0) {
                           drawingUtilsRef.current.drawLandmarks(landmarks, {color: '#FF0000', radius: 2}); // Red dots for static
                       } else {
                            console.warn("Renderer: Invalid landmarks structure found in results.faceLandmarks:", landmarks);
                       }
                     }
                     console.log("Renderer: Static landmark drawing attempted.");
                 } catch(drawError) {
                     console.error("Renderer: Error occurred during DrawingUtils.drawLandmarks:", drawError);
                     // Add specific error logging if possible
                     if (drawError.message) {
                         console.error("Error message:", drawError.message);
                     }
                     if (drawError.stack) {
                          console.error("Error stack:", drawError.stack);
                     }
                 }
            } else {
                 console.warn("Renderer: DrawingUtils not available, cannot draw landmarks.");
                 // Optionally add manual drawing fallback here if needed
            }
        } else {
            console.log("Renderer: No landmarks found in static results to draw.");
        }
        // --- END OF RE-ENABLING ---

        canvasCtx.restore();
    },

    // --- Method to clear ---
    clearCanvas: () => {
       // ... (keep clearCanvas method) ...
         if (!canvasRef.current) return;
         const canvasCtx = canvasRef.current.getContext('2d');
         console.log("Renderer: Clearing canvas.");
         canvasCtx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
    }
  }));

  // Effect to set initial canvas dimensions
  useEffect(() => {
    // ... (keep useEffect for dimensions) ...
      if (canvasRef.current && videoWidth > 0 && videoHeight > 0) {
          if(canvasRef.current.width !== videoWidth || canvasRef.current.height !== videoHeight) {
              canvasRef.current.width = videoWidth;
              canvasRef.current.height = videoHeight;
          }
      }
  }, [videoWidth, videoHeight]);


  return (
     // ... (keep return canvas JSX) ...
    <canvas
      ref={canvasRef}
      className={`renderer-canvas ${className || ''}`}
      width={videoWidth || 640}
      height={videoHeight || 480}
      style={{ backgroundColor: '#eee', display: 'block' }}
    >
      Your browser does not support the HTML canvas element.
    </canvas>
  );
});

TryOnRenderer.displayName = 'TryOnRenderer';
export default TryOnRenderer;