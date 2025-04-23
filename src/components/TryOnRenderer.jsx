import React, { useRef, useImperativeHandle, forwardRef, useEffect } from 'react';

const TryOnRenderer = forwardRef(({ videoWidth, videoHeight, className }, ref) => {
  const canvasRef = useRef(null);

  // Expose methods to the parent component via the ref
  useImperativeHandle(ref, () => ({
    renderResults: (videoElement, results) => {
      if (!canvasRef.current) return;
      const canvasCtx = canvasRef.current.getContext('2d');

      // Basic drawing: video feed + simple overlay if face detected
      canvasCtx.save();
      canvasCtx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);

      // Flip the canvas drawing horizontally to match the mirrored video source visually
      canvasCtx.scale(-1, 1);
      canvasCtx.translate(-canvasRef.current.width, 0);

      // Draw the video frame
      canvasCtx.drawImage(videoElement, 0, 0, canvasRef.current.width, canvasRef.current.height);

      // Simple results visualization (replace with actual rendering later)
      if (results && results.faceLandmarks && results.faceLandmarks.length > 0) {
        canvasCtx.fillStyle = "rgba(0, 255, 0, 0.5)"; // Semi-transparent green
        canvasCtx.fillRect(10, 10, 100, 50); // Simple indicator box
         canvasCtx.fillStyle = "white";
         canvasCtx.font = "16px Arial";
         // Flip text back to draw normally after canvas flip
         canvasCtx.scale(-1, 1);
         canvasCtx.translate(-canvasRef.current.width, 0);
         canvasCtx.fillText("Face Detected", canvasRef.current.width - 110 -10 , 40); // Adjust text position due to flipping
      }

      canvasCtx.restore();
    },
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
      // Set initial size, will be updated by useEffect
      width={videoWidth || 640}
      height={videoHeight || 480}
      style={{ backgroundColor: '#eee' }} // Placeholder background
    >
      Your browser does not support the HTML canvas element.
    </canvas>
  );
});

// Add display name for React DevTools
TryOnRenderer.displayName = 'TryOnRenderer';

export default TryOnRenderer;