import React, { useRef, useImperativeHandle, forwardRef, useEffect } from 'react';

const TryOnRenderer = forwardRef(({ videoWidth, videoHeight, className }, ref) => {
  const canvasRef = useRef(null);

  // Expose methods to the parent component via the ref
  useImperativeHandle(ref, () => ({
    // --- Method for Real-time Video ---
    renderResults: (videoElement, results) => {
      if (!canvasRef.current) return;
      const canvasCtx = canvasRef.current.getContext('2d');

      canvasCtx.save();
      canvasCtx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
      canvasCtx.scale(-1, 1); // Flip canvas for mirror effect
      canvasCtx.translate(-canvasRef.current.width, 0);
      canvasCtx.drawImage(videoElement, 0, 0, canvasRef.current.width, canvasRef.current.height);

      // Restore transform before drawing overlays if overlays shouldn't be flipped
      canvasCtx.restore(); // Restore to non-flipped state

      // --- DRAW OVERLAYS (e.g., effects) on non-flipped canvas ---
      // Basic results visualization (replace with actual rendering later)
      if (results && results.faceLandmarks && results.faceLandmarks.length > 0) {
          // Example: Draw mask or landmarks here
          // For now, just the indicator box
          canvasCtx.fillStyle = "rgba(0, 255, 0, 0.5)"; // Semi-transparent green
          canvasCtx.fillRect(10, 10, 110, 30);
          canvasCtx.fillStyle = "black";
          canvasCtx.font = "16px Arial";
          canvasCtx.fillText("Face Detected", 15, 30);
      }

    },

    // --- Method for Static Image ---
    renderStaticImageResults: (imageElement, results) => {
        if (!canvasRef.current || !imageElement) return;
        const canvasCtx = canvasRef.current.getContext('2d');

        canvasCtx.save();
        canvasCtx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);

        // Draw the static image (no flipping needed)
        canvasCtx.drawImage(imageElement, 0, 0, canvasRef.current.width, canvasRef.current.height);

        // --- DRAW OVERLAYS (e.g., effects) ---
         // Basic results visualization (replace with actual rendering later)
         if (results && results.faceLandmarks && results.faceLandmarks.length > 0) {
            // Example: Draw mask or landmarks here
            // For now, just the indicator box
            canvasCtx.fillStyle = "rgba(0, 0, 255, 0.5)"; // Semi-transparent blue for static
            canvasCtx.fillRect(10, 10, 130, 30);
            canvasCtx.fillStyle = "white";
            canvasCtx.font = "16px Arial";
            canvasCtx.fillText("Selfie Analysed", 15, 30);
        } else if (results) { // results exist but no landmarks
             canvasCtx.fillStyle = "rgba(255, 0, 0, 0.5)"; // Semi-transparent red
             canvasCtx.fillRect(10, 10, 130, 30);
             canvasCtx.fillStyle = "white";
             canvasCtx.font = "16px Arial";
             canvasCtx.fillText("No Face Found", 15, 30);
        }
        // If results are null (still detecting), nothing drawn over image

        canvasCtx.restore();
    },

    // --- Method to clear ---
    clearCanvas: () => {
         if (!canvasRef.current) return;
         const canvasCtx = canvasRef.current.getContext('2d');
         canvasCtx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
    }
  }));

  // Effect to set canvas dimensions once video dimensions are known
  useEffect(() => {
      if (canvasRef.current && videoWidth > 0 && videoHeight > 0) {
          canvasRef.current.width = videoWidth;
          canvasRef.current.height = videoHeight;
          console.log(`Renderer canvas dimensions set: ${videoWidth}x${videoHeight}`);
      }
  }, [videoWidth, videoHeight]);

  return (
    <canvas
      ref={canvasRef}
      className={`renderer-canvas ${className || ''}`} // Apply passed class names
      width={videoWidth || 640}
      height={videoHeight || 480}
      style={{ backgroundColor: '#eee' }} // Placeholder background
    >
      Your browser does not support the HTML canvas element.
    </canvas>
  );
});

TryOnRenderer.displayName = 'TryOnRenderer';

export default TryOnRenderer;// src/components/TryOnRenderer.jsx

import React, { useRef, useImperativeHandle, forwardRef, useEffect } from 'react';

const TryOnRenderer = forwardRef(({ videoWidth, videoHeight, className }, ref) => {
  const canvasRef = useRef(null);

  useImperativeHandle(ref, () => ({
    // ... renderResults method ...

    // --- Method for Static Image ---
    renderStaticImageResults: (imageElement, results) => {
        // Add log here
        console.log("Renderer: renderStaticImageResults called.", { hasImage: !!imageElement, hasResults: !!results });

        if (!canvasRef.current || !imageElement) {
            console.error("Renderer: renderStaticImageResults - Canvas or Image missing.");
            return;
        }
        // Ensure canvas has dimensions
        if(canvasRef.current.width === 0 || canvasRef.current.height === 0) {
            console.error("Renderer: renderStaticImageResults - Canvas dimensions are zero.");
            // Attempt to set dimensions again - might indicate timing issue
            if(imageElement.naturalWidth && imageElement.naturalHeight) {
                canvasRef.current.width = imageElement.naturalWidth;
                canvasRef.current.height = imageElement.naturalHeight;
                console.log("Renderer: Attempted to reset canvas dimensions from image.");
            } else {
                 return; // Cannot draw if canvas has no size
            }
        }

        const canvasCtx = canvasRef.current.getContext('2d');
        // ... rest of the drawing logic ...
         canvasCtx.save();
        canvasCtx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
        canvasCtx.drawImage(imageElement, 0, 0, canvasRef.current.width, canvasRef.current.height);

        if (results && results.faceLandmarks && results.faceLandmarks.length > 0) {
            canvasCtx.fillStyle = "rgba(0, 0, 255, 0.5)";
            canvasCtx.fillRect(10, 10, 130, 30);
            canvasCtx.fillStyle = "white";
            canvasCtx.font = "16px Arial";
            canvasCtx.fillText("Selfie Analysed", 15, 30);
        } else if (results) {
             canvasCtx.fillStyle = "rgba(255, 0, 0, 0.5)";
             canvasCtx.fillRect(10, 10, 130, 30);
             canvasCtx.fillStyle = "white";
             canvasCtx.font = "16px Arial";
             canvasCtx.fillText("No Face Found", 15, 30);
        }
        canvasCtx.restore();
    },

    // ... clearCanvas method ...
  }));

  // ... useEffect for dimensions ...

  // ... return canvas JSX ...
   return (
    <canvas
      ref={canvasRef}
      className={`renderer-canvas ${className || ''}`}
      width={videoWidth || 640}
      height={videoHeight || 480}
      style={{ backgroundColor: '#eee' }}
    >
      Your browser does not support the HTML canvas element.
    </canvas>
  );
});

TryOnRenderer.displayName = 'TryOnRenderer';
export default TryOnRenderer;