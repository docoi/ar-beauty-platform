// src/components/TryOnRenderer.jsx

import React, { useRef, useImperativeHandle, forwardRef, useEffect } from 'react';
// Keep this import if you installed the package
import { DrawingUtils } from "@mediapipe/drawing_utils";

// Log DrawingUtils at module scope
console.log("TryOnRenderer Module: Is DrawingUtils defined?", typeof DrawingUtils, DrawingUtils);

const TryOnRenderer = forwardRef(({ videoWidth, videoHeight, className }, ref) => {
  const canvasRef = useRef(null);
  const drawingUtilsRef = useRef(null); // Ref to store DrawingUtils instance

  // Function to initialize or re-initialize DrawingUtils
  const initializeDrawingUtils = () => {
      console.log("initializeDrawingUtils: Attempting...");
      if (canvasRef.current) {
        const canvasCtx = canvasRef.current.getContext("2d");
        console.log("initializeDrawingUtils: Canvas context retrieved?", !!canvasCtx);
        if (canvasCtx && typeof DrawingUtils !== 'undefined') {
            try {
                drawingUtilsRef.current = new DrawingUtils(canvasCtx);
                console.log("DrawingUtils initialized/re-initialized successfully.", drawingUtilsRef.current); // Log the instance
                return true;
            } catch (initError) {
                 console.error("Error initializing DrawingUtils:", initError);
                 drawingUtilsRef.current = null;
                 return false;
            }
        } else if (!canvasCtx) {
             console.error("Failed to get canvas context for DrawingUtils.");
             drawingUtilsRef.current = null;
             return false;
        } else {
            console.warn("DrawingUtils class not available (import failed or package not installed?)");
            drawingUtilsRef.current = null;
            return false;
        }
      } else {
          console.warn("initializeDrawingUtils: canvasRef.current is null.");
          return false;
      }
  };

  // Initialize DrawingUtils once on mount
  useEffect(() => {
      console.log("TryOnRenderer Mount Effect: Running initializeDrawingUtils.");
      initializeDrawingUtils();
  }, []);


  // Expose methods to the parent component via the ref
  useImperativeHandle(ref, () => ({
    // --- Method for Real-time Video ---
    renderResults: (videoElement, results) => {
      // ... (Keep this method as it was - drawing still commented out) ...
       if (!canvasRef.current) return;
       const canvas = canvasRef.current;
       const canvasCtx = canvas.getContext('2d');
       if (!canvasCtx) return;
       if (canvas.width !== videoWidth || canvas.height !== videoHeight) {
           canvas.width = videoWidth;
           canvas.height = videoHeight;
            if (canvas.width === 0 || canvas.height === 0) return;
             initializeDrawingUtils();
       }
       canvasCtx.save();
       canvasCtx.clearRect(0, 0, canvas.width, canvas.height);
       canvasCtx.scale(-1, 1);
       canvasCtx.translate(-canvas.width, 0);
       canvasCtx.drawImage(videoElement, 0, 0, canvas.width, canvas.height);
       canvasCtx.restore();
      // --- REAL-TIME LANDMARK DRAWING STILL COMMENTED OUT ---
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
             initializeDrawingUtils(); // Attempt re-initialization
         }

        canvasCtx.save();
        canvasCtx.clearRect(0, 0, canvas.width, canvas.height);
        canvasCtx.drawImage(imageElement, 0, 0, canvas.width, canvas.height);

        // --- Draw static results ---
        if (results?.faceLandmarks && results.faceLandmarks.length > 0) {
            console.log("Renderer: Value of drawingUtilsRef.current before check:", drawingUtilsRef.current);

            if (drawingUtilsRef.current && typeof drawingUtilsRef.current.drawLandmarks === 'function') {
                 console.log("Renderer: DrawingUtils instance confirmed. Attempting drawLandmarks...");
                 console.log("Landmark data structure:", results.faceLandmarks);
                 try {
                     for (const landmarks of results.faceLandmarks) {
                       if (Array.isArray(landmarks) && landmarks.length > 0) {
                           console.log(`Renderer: Calling drawLandmarks for face with ${landmarks.length} landmarks.`); // Log before actual draw call
                           drawingUtilsRef.current.drawLandmarks(landmarks, {color: '#00FFFF', lineWidth: 1, radius: 5}); // Bright Cyan, larger dots
                       } else {
                            console.warn("Renderer: Invalid landmarks structure found:", landmarks);
                       }
                     }
                     console.log("Renderer: Static landmark drawing with DrawingUtils attempted."); // Log after loop finishes
                 } catch(drawError) {
                     console.error("Renderer: Error occurred during DrawingUtils.drawLandmarks:", drawError);
                 }
            } else {
                 // *** MANUAL DRAWING FALLBACK ***
                 console.warn("Renderer: DrawingUtils not available or invalid. Falling back to manual drawing.");
                 try {
                     console.log("Renderer: Attempting manual landmark drawing...");
                     canvasCtx.fillStyle = "rgba(255, 0, 0, 0.7)"; // Red dots
                     let drawnCount = 0;
                     results.faceLandmarks.forEach(landmarks => {
                         if (Array.isArray(landmarks)) {
                             landmarks.forEach(point => {
                                if (point && typeof point.x === 'number' && typeof point.y === 'number') {
                                    canvasCtx.beginPath();
                                    canvasCtx.arc(point.x * canvas.width, point.y * canvas.height, 3, 0, 2 * Math.PI);
                                    canvasCtx.fill();
                                    drawnCount++;
                                }
                             });
                         }
                     });
                     console.log(`Renderer: Manual drawing attempted. Drew ${drawnCount} points.`);
                 } catch (manualDrawError) {
                      console.error("Renderer: Error during manual landmark drawing:", manualDrawError);
                 }
                 // *** END OF MANUAL DRAWING FALLBACK ***
            }
        } else {
            console.log("Renderer: No landmarks found in static results to draw.");
        }

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