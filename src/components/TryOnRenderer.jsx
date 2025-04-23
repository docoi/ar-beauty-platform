// src/components/TryOnRenderer.jsx

import React, { useRef, useImperativeHandle, forwardRef, useEffect } from 'react';
// No DrawingUtils import needed anymore

const TryOnRenderer = forwardRef(({ videoWidth, videoHeight, className }, ref) => {
  const canvasRef = useRef(null);
  // No drawingUtilsRef needed anymore

  // No initializeDrawingUtils needed anymore

  // No useEffect for initializing DrawingUtils needed anymore

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
       }

       canvasCtx.save();
       canvasCtx.clearRect(0, 0, canvas.width, canvas.height);
       canvasCtx.scale(-1, 1); // Flip canvas for mirror effect
       canvasCtx.translate(-canvas.width, 0);
       canvasCtx.drawImage(videoElement, 0, 0, canvas.width, canvas.height);
       canvasCtx.restore(); // Restore to non-flipped state

      // --- MANUAL DRAWING FOR REAL-TIME ---
      if (results?.faceLandmarks) {
          // console.log("Renderer: Drawing real-time landmarks manually..."); // Optional log
          try {
               canvasCtx.fillStyle = "rgba(0, 255, 0, 0.7)"; // Green dots for real-time
               results.faceLandmarks.forEach(landmarks => {
                  if (Array.isArray(landmarks)) {
                      landmarks.forEach(point => {
                         if (point && typeof point.x === 'number' && typeof point.y === 'number') {
                            canvasCtx.beginPath();
                            // Use normalized coordinates directly
                            canvasCtx.arc(point.x * canvas.width, point.y * canvas.height, 2, 0, 2 * Math.PI);
                            canvasCtx.fill();
                         }
                      });
                  }
               });
          } catch (drawError) {
              console.error("Error drawing real-time landmarks manually:", drawError);
          }
      }
      // --- END OF REAL-TIME DRAWING ---
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
         }

        canvasCtx.save();
        canvasCtx.clearRect(0, 0, canvas.width, canvas.height);
        canvasCtx.drawImage(imageElement, 0, 0, canvas.width, canvas.height); // Draw image first

        // --- MANUAL DRAWING FOR STATIC ---
        if (results?.faceLandmarks && results.faceLandmarks.length > 0) {
             console.log("Renderer: Attempting manual landmark drawing...");
             try {
                 canvasCtx.fillStyle = "rgba(255, 0, 0, 0.7)"; // Red dots
                 let drawnCount = 0;
                 results.faceLandmarks.forEach(landmarks => {
                     if (Array.isArray(landmarks)) {
                         landmarks.forEach(point => {
                            if (point && typeof point.x === 'number' && typeof point.y === 'number') {
                                canvasCtx.beginPath();
                                // Use normalized coordinates directly
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
        } else {
            console.log("Renderer: No landmarks found in static results to draw.");
        }
        // --- END OF STATIC DRAWING ---

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