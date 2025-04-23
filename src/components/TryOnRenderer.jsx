import React, { useRef, useImperativeHandle, forwardRef, useEffect } from 'react';

const TryOnRenderer = forwardRef(({ videoWidth, videoHeight, className }, ref) => {
  const canvasRef = useRef(null);

  // Expose methods to the parent component via the ref
  useImperativeHandle(ref, () => ({
    // --- Method for Real-time Video ---
    renderResults: (videoElement, results) => {
      if (!canvasRef.current) {
        console.error("Renderer: renderResults - Canvas ref missing.");
        return;
      }
      const canvas = canvasRef.current;
      const canvasCtx = canvas.getContext('2d');
      if (!canvasCtx) {
          console.error("Renderer: renderResults - Failed to get 2D context.");
          return;
      }
       // Ensure canvas has dimensions matching video before drawing
       if (canvas.width !== videoWidth || canvas.height !== videoHeight) {
           console.warn(`Renderer: renderResults - Adjusting canvas size from ${canvas.width}x${canvas.height} to ${videoWidth}x${videoHeight}`);
           canvas.width = videoWidth;
           canvas.height = videoHeight;
           if (canvas.width === 0 || canvas.height === 0) {
               console.error("Renderer: renderResults - Video dimensions are zero, cannot draw.");
               return;
           }
       }


      canvasCtx.save();
      canvasCtx.clearRect(0, 0, canvas.width, canvas.height);
      canvasCtx.scale(-1, 1); // Flip canvas for mirror effect
      canvasCtx.translate(-canvas.width, 0);
      canvasCtx.drawImage(videoElement, 0, 0, canvas.width, canvas.height);

      // Restore transform before drawing overlays if overlays shouldn't be flipped
      canvasCtx.restore(); // Restore to non-flipped state

      // --- DRAW OVERLAYS (e.g., effects) on non-flipped canvas ---
      // Basic results visualization (replace with actual rendering later)
      if (results && results.faceLandmarks && results.faceLandmarks.length > 0) {
          canvasCtx.fillStyle = "rgba(0, 255, 0, 0.5)"; // Semi-transparent green
          canvasCtx.fillRect(10, 10, 110, 30);
          canvasCtx.fillStyle = "black";
          canvasCtx.font = "16px Arial";
          canvasCtx.fillText("Face Detected", 15, 30);
      }
    },

    // --- Method for Static Image ---
    renderStaticImageResults: (imageElement, results) => {
        console.log("Renderer: renderStaticImageResults called.", { hasImage: !!imageElement, hasResults: !!results }); // Keep log

        if (!canvasRef.current) {
             console.error("Renderer: renderStaticImageResults - Canvas ref missing.");
             return;
        }
         if (!imageElement) {
             console.error("Renderer: renderStaticImageResults - Image element missing.");
             return;
         }

        const canvas = canvasRef.current;
        const canvasCtx = canvas.getContext('2d');
         if (!canvasCtx) {
             console.error("Renderer: renderStaticImageResults - Failed to get 2D context.");
             return;
         }

        // Ensure canvas has dimensions matching image before drawing
        if (canvas.width !== imageElement.naturalWidth || canvas.height !== imageElement.naturalHeight) {
             console.warn(`Renderer: renderStaticImageResults - Adjusting canvas size from ${canvas.width}x${canvas.height} to ${imageElement.naturalWidth}x${imageElement.naturalHeight}`);
             canvas.width = imageElement.naturalWidth;
             canvas.height = imageElement.naturalHeight;
              if (canvas.width === 0 || canvas.height === 0) {
                 console.error("Renderer: renderStaticImageResults - Image dimensions are zero, cannot draw.");
                 return;
             }
         }


        canvasCtx.save();
        canvasCtx.clearRect(0, 0, canvas.width, canvas.height);

        // Draw the static image (no flipping needed)
        canvasCtx.drawImage(imageElement, 0, 0, canvas.width, canvas.height);

        // --- DRAW OVERLAYS (e.g., effects) ---
         // Basic results visualization (replace with actual rendering later)
         if (results && results.faceLandmarks && results.faceLandmarks.length > 0) {
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
        } else {
            // Results might be null if detection failed or hasn't run
            console.log("Renderer: renderStaticImageResults - No results provided.");
        }

        canvasCtx.restore();
    },

    // --- Method to clear ---
    clearCanvas: () => {
         if (!canvasRef.current) return;
         const canvasCtx = canvasRef.current.getContext('2d');
         console.log("Renderer: Clearing canvas."); // Log clearing
         canvasCtx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
    }
  }));

  // Effect to set initial canvas dimensions (might be redundant now but safe)
  useEffect(() => {
      if (canvasRef.current && videoWidth > 0 && videoHeight > 0) {
          // Only set if dimensions haven't been set matching current props
          if(canvasRef.current.width !== videoWidth || canvasRef.current.height !== videoHeight) {
              console.log(`Renderer Effect: Setting canvas dimensions from props: ${videoWidth}x${videoHeight}`);
              canvasRef.current.width = videoWidth;
              canvasRef.current.height = videoHeight;
          }
      }
  }, [videoWidth, videoHeight]);

  return (
    <canvas
      ref={canvasRef}
      className={`renderer-canvas ${className || ''}`} // Apply passed class names
      // Set initial size, will be updated by useEffect or render methods
      width={videoWidth || 640}
      height={videoHeight || 480}
      style={{ backgroundColor: '#eee', display: 'block' }} // Add display block
    >
      Your browser does not support the HTML canvas element.
    </canvas>
  );
});

TryOnRenderer.displayName = 'TryOnRenderer';

export default TryOnRenderer;