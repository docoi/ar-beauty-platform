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
        // Check if DrawingUtils class itself is available (import successful?)
        if (canvasCtx && typeof DrawingUtils !== 'undefined') {
            try {
                drawingUtilsRef.current = new DrawingUtils(canvasCtx);
                console.log("DrawingUtils initialized/re-initialized successfully.");
                return true;
            } catch (initError) {
                 console.error("Error initializing DrawingUtils:", initError);
                 drawingUtilsRef.current = null; // Ensure it's null if failed
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
      // Keep this commented until static drawing works reliably
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
             initializeDrawingUtils(); // Attempt re-initialization
         }

        canvasCtx.save();
        canvasCtx.clearRect(0, 0, canvas.width, canvas.height);
        canvasCtx.drawImage(imageElement, 0, 0, canvas.width, canvas.height);

        // --- Draw static results ---
        if (results?.faceLandmarks && results.faceLandmarks.length > 0) {
            // *** ADDED CHECK: Verify drawingUtilsRef.current is valid ***
            if (drawingUtilsRef.current && typeof drawingUtilsRef.current.drawLandmarks === 'function') {
                 console.log("Renderer: DrawingUtils instance confirmed. Attempting to draw static landmarks...");
                 console.log("Landmark data structure:", results.faceLandmarks);
                 try {
                     for (const landmarks of results.faceLandmarks) {
                       if (Array.isArray(landmarks) && landmarks.length > 0) {
                           // Check if the method exists one last time before calling
                           if(typeof drawingUtilsRef.current.drawLandmarks === 'function'){
                               drawingUtilsRef.current.drawLandmarks(landmarks, {color: '#FF0000', radius: 2}); // Red dots for static
                           } else {
                                console.error("Renderer: drawLandmarks method missing from drawingUtilsRef within loop!");
                           }
                       } else {
                            console.warn("Renderer: Invalid landmarks structure found in results.faceLandmarks:", landmarks);
                       }
                     }
                     console.log("Renderer: Static landmark drawing attempted.");
                 } catch(drawError) {
                     console.error("Renderer: Error occurred during DrawingUtils.drawLandmarks:", drawError);
                     if (drawError.message) console.error("Error message:", drawError.message);
                     if (drawError.stack) console.error("Error stack:", drawError.stack);
                 }
            } else {
                 // Log why drawing isn't happening
                 if (!drawingUtilsRef.current) {
                    console.warn("Renderer: Cannot draw static landmarks because drawingUtilsRef.current is null or invalid.");
                 } else {
                     console.warn("Renderer: drawingUtilsRef.current exists but drawLandmarks method is missing?");
                 }
                 // Optionally add manual drawing fallback here if needed
                 // console.log("Renderer: Falling back to manual drawing...");
                 // try { ... manual drawing code ... } catch { ... }
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