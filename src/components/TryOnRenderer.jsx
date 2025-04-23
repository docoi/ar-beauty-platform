// src/components/TryOnRenderer.jsx

import React, { useRef, useImperativeHandle, forwardRef, useEffect } from 'react';
// Import drawing utils from MediaPipe (optional but helpful)
// If you didn't install @mediapipe/drawing_utils, you can skip this import
// and draw manually, otherwise run: npm install @mediapipe/drawing_utils
import { DrawingUtils } from "@mediapipe/drawing_utils";

const TryOnRenderer = forwardRef(({ videoWidth, videoHeight, className }, ref) => {
  const canvasRef = useRef(null);
  const drawingUtilsRef = useRef(null); // Ref to store DrawingUtils instance

  // Initialize DrawingUtils once
  useEffect(() => {
      if (canvasRef.current) {
        const canvasCtx = canvasRef.current.getContext("2d");
        if (canvasCtx) {
            drawingUtilsRef.current = new DrawingUtils(canvasCtx);
            console.log("DrawingUtils initialized.");
        }
      }
  }, []);


  // Expose methods to the parent component via the ref
  useImperativeHandle(ref, () => ({
    // --- Method for Real-time Video ---
    renderResults: (videoElement, results) => {
      if (!canvasRef.current) return;
      const canvas = canvasRef.current;
      const canvasCtx = canvas.getContext('2d');
       if (!canvasCtx) return;
       // Ensure canvas size matches video
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

      // Draw real-time results (using drawing utils if available)
      if (results?.faceLandmarks && drawingUtilsRef.current) {
          for (const landmarks of results.faceLandmarks) {
            // Example: Draw connectors and landmarks
            // drawingUtilsRef.current.drawConnectors(landmarks, FaceLandmarker.FACE_LANDMARKS_TESSELATION, {color: '#C0C0C070', lineWidth: 1});
            // drawingUtilsRef.current.drawConnectors(landmarks, FaceLandmarker.FACE_LANDMARKS_RIGHT_EYE, {color: '#FF3030'});
            // ... add more specific landmark groups ...
            drawingUtilsRef.current.drawLandmarks(landmarks, {color: '#30FF30', radius: 1}); // Simple green dots
          }
      } else if (results?.faceLandmarks) {
          // Manual drawing if drawing_utils not used
           canvasCtx.fillStyle = "rgba(0, 255, 0, 0.7)";
           results.faceLandmarks.forEach(landmarks => {
               landmarks.forEach(point => {
                  canvasCtx.beginPath();
                  canvasCtx.arc(point.x * canvas.width, point.y * canvas.height, 2, 0, 2 * Math.PI);
                  canvasCtx.fill();
               });
           });
      }
    },

    // --- Method for Static Image ---
    renderStaticImageResults: (imageElement, results) => {
        console.log("Renderer: renderStaticImageResults called.", { hasImage: !!imageElement, hasResults: !!results });

        if (!canvasRef.current || !imageElement) return;
        const canvas = canvasRef.current;
        const canvasCtx = canvas.getContext('2d');
         if (!canvasCtx) return;

        // Ensure canvas size matches image
        if (canvas.width !== imageElement.naturalWidth || canvas.height !== imageElement.naturalHeight) {
             canvas.width = imageElement.naturalWidth;
             canvas.height = imageElement.naturalHeight;
             if (canvas.width === 0 || canvas.height === 0) return;
             // Re-initialize drawing utils if canvas size changes
             drawingUtilsRef.current = new DrawingUtils(canvasCtx);
             console.log("DrawingUtils re-initialized after static canvas resize.");
         }


        canvasCtx.save();
        canvasCtx.clearRect(0, 0, canvas.width, canvas.height);
        canvasCtx.drawImage(imageElement, 0, 0, canvas.width, canvas.height); // Draw image first

        // Draw static results (using drawing utils if available)
        if (results?.faceLandmarks && drawingUtilsRef.current) {
             console.log("Renderer: Drawing static landmarks using DrawingUtils...");
             for (const landmarks of results.faceLandmarks) {
               // drawingUtilsRef.current.drawConnectors(landmarks, FaceLandmarker.FACE_LANDMARKS_TESSELATION, {color: '#C0C0C070', lineWidth: 1});
               drawingUtilsRef.current.drawLandmarks(landmarks, {color: '#FF0000', radius: 2}); // Red dots for static
             }
        } else if (results?.faceLandmarks) { // Manual drawing
            console.log("Renderer: Drawing static landmarks manually...");
             canvasCtx.fillStyle = "rgba(255, 0, 0, 0.7)"; // Red dots
             results.faceLandmarks.forEach(landmarks => {
                 landmarks.forEach(point => {
                    canvasCtx.beginPath();
                    canvasCtx.arc(point.x * canvas.width, point.y * canvas.height, 3, 0, 2 * Math.PI);
                    canvasCtx.fill();
                 });
             });
        } else {
            console.log("Renderer: No landmarks found in static results to draw.");
        }

        canvasCtx.restore();
    },

    // --- Method to clear ---
    clearCanvas: () => {
         if (!canvasRef.current) return;
         const canvasCtx = canvasRef.current.getContext('2d');
         console.log("Renderer: Clearing canvas.");
         canvasCtx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
    }
  }));

  // Effect to set initial canvas dimensions
  useEffect(() => {
      if (canvasRef.current && videoWidth > 0 && videoHeight > 0) {
          if(canvasRef.current.width !== videoWidth || canvasRef.current.height !== videoHeight) {
              canvasRef.current.width = videoWidth;
              canvasRef.current.height = videoHeight;
          }
      }
  }, [videoWidth, videoHeight]);

  return (
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