// src/components/RealTimeMirror.jsx - Layered Canvas Approach (Precise Lipstick - Detailed Indices - Corrected JSX)

import React, { useRef, useEffect, useState, useCallback, forwardRef } from 'react';
import TryOnRenderer from './TryOnRenderer'; // The simplified WebGL base renderer

// Define LIP landmark indices (MORE DETAILED SET)
const LIP_OUTLINE_UPPER_INDICES = [ 61, 185, 40, 39, 37, 0, 267, 269, 270, 409 ];
const LIP_OUTLINE_LOWER_INDICES = [ 291, 375, 321, 405, 314, 17, 84, 181, 91, 146 ];
const INNER_LIP_UPPER_INDICES = [ 78, 191, 80, 81, 82, 13, 312, 311, 310, 415 ];
const INNER_LIP_LOWER_INDICES = [ 308, 324, 318, 402, 317, 14, 87, 178, 88, 95 ];
const DETAILED_LIP_OUTER_INDICES = [ ...LIP_OUTLINE_UPPER_INDICES, ...LIP_OUTLINE_LOWER_INDICES.slice().reverse() ]; // Combine upper and reversed lower outer
const DETAILED_LIP_INNER_INDICES = [ ...INNER_LIP_UPPER_INDICES, ...INNER_LIP_LOWER_INDICES.slice().reverse() ]; // Combine upper and reversed lower inner


const RealTimeMirror = forwardRef(({
  faceLandmarker,
  imageSegmenter,
  effectIntensity // Unused for now
}, ref) => {
  const videoRef = useRef(null);
  const webglCanvasRef = useRef(null);
  const overlayCanvasRef = useRef(null);
  const animationFrameRef = useRef({ count: 0, rafId: null });
  const checkReadyRafRef = useRef(null);
  const [videoStream, setVideoStream] = useState(null);
  const [isCameraLoading, setIsCameraLoading] = useState(true);
  const [cameraError, setCameraError] = useState(null);
  const [videoDimensions, setVideoDimensions] = useState({ width: 0, height: 0 });

  // --- Canvas Drawing Function (Precise Lipstick - Detailed) ---
  const drawOverlay = useCallback((landmarks, segmentationMask) => {
    const overlayCanvas = overlayCanvasRef.current; const video = videoRef.current; if (!overlayCanvas || !video || !videoDimensions.width || !videoDimensions.height) return; const ctx = overlayCanvas.getContext('2d'); if (!ctx) return; const canvasWidth = videoDimensions.width; const canvasHeight = videoDimensions.height; if (overlayCanvas.width !== canvasWidth || overlayCanvas.height !== canvasHeight) { overlayCanvas.width = canvasWidth; overlayCanvas.height = canvasHeight; } ctx.clearRect(0, 0, canvasWidth, canvasHeight); ctx.save(); ctx.scale(-1, 1); ctx.translate(-canvasWidth, 0); // Mirror context
    try {
        const facePoints = landmarks?.faceLandmarks?.[0]; if (facePoints && facePoints.length > 0) {
            ctx.fillStyle = "#0000FF"; ctx.beginPath();
            DETAILED_LIP_OUTER_INDICES.forEach((index, i) => { if (index < facePoints.length) { const point = facePoints[index]; const x = point.x * canvasWidth; const y = point.y * canvasHeight; if (i === 0) { ctx.moveTo(x, y); } else { ctx.lineTo(x, y); } } else { console.warn(`Outer Lip index ${index} out of bounds`); } }); ctx.closePath();
            const innerLastIndex = DETAILED_LIP_INNER_INDICES[DETAILED_LIP_INNER_INDICES.length - 1]; if (innerLastIndex < facePoints.length) { ctx.moveTo(facePoints[innerLastIndex].x * canvasWidth, facePoints[innerLastIndex].y * canvasHeight); } for (let i = DETAILED_LIP_INNER_INDICES.length - 2; i >= 0; i--) { const index = DETAILED_LIP_INNER_INDICES[i]; if (index < facePoints.length) { const point = facePoints[index]; ctx.lineTo(point.x * canvasWidth, point.y * canvasHeight); } else { console.warn(`Inner Lip index ${index} out of bounds`); } } ctx.closePath();
            ctx.fill('evenodd');
        }
    } catch (error) { console.error("Error during overlay drawing:", error); }
    finally { ctx.restore(); }
  }, [videoDimensions]); // Removed intensity dependency

  // --- Camera Access Effect (Polling) ---
  useEffect(() => { let isMounted = true; let stream = null; let checkReadyFrameId = null; const checkVideoReady = () => { if (!isMounted || !videoRef.current) return; const video = videoRef.current; const readyState = video.readyState; const width = video.videoWidth; const height = video.videoHeight; const hasDimensions = width > 0 && height > 0; const isReady = readyState >= 2 && hasDimensions; if (isReady) { console.log(`<<<< RealTimeMirror: Video Ready via Polling! State=${readyState}, Dims=${width}x${height} >>>>`); setVideoDimensions({ width, height }); setIsCameraLoading(false); setCameraError(null); cancelAnimationFrame(checkReadyRafRef.current); checkReadyRafRef.current = null; } else { if (isMounted) { checkReadyFrameId = requestAnimationFrame(checkVideoReady); checkReadyRafRef.current = checkReadyFrameId; } } }; const enableStream = async () => { if (!faceLandmarker) { if (isMounted) { setCameraError("AI models initializing..."); setIsCameraLoading(false); } return; } if (!navigator.mediaDevices?.getUserMedia) { if (isMounted) { setCameraError("getUserMedia not supported."); setIsCameraLoading(false); } return; } setIsCameraLoading(true); setCameraError(null); setVideoStream(null); setVideoDimensions({ width: 0, height: 0 }); cancelAnimationFrame(checkReadyRafRef.current); try { stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 720 } }, audio: false }); if (isMounted && videoRef.current) { videoRef.current.srcObject = stream; setVideoStream(stream); videoRef.current.onloadedmetadata = null; videoRef.current.onloadeddata = null; videoRef.current.oncanplay = null; videoRef.current.onplaying = null; videoRef.current.onerror = (e) => { if(isMounted) { console.error("Video Error:", e); setCameraError("Video element error."); setIsCameraLoading(false); cancelAnimationFrame(checkReadyRafRef.current); } }; checkReadyFrameId = requestAnimationFrame(checkVideoReady); checkReadyRafRef.current = checkReadyFrameId; videoRef.current.play().catch(err => { console.warn("video.play() failed:", err); }); } else { stream?.getTracks().forEach(track => track.stop()); } } catch (err) { console.error("enableStream Error:", err); if (isMounted) { setCameraError("Failed to access camera."); setIsCameraLoading(false); } } }; enableStream(); return () => { isMounted = false; cancelAnimationFrame(checkReadyRafRef.current); cancelAnimationFrame(animationFrameRef.current?.rafId); const currentStream = videoStream || stream; currentStream?.getTracks().forEach(track => track.stop()); if (videoRef.current) { videoRef.current.onerror = null; videoRef.current.srcObject = null; } setVideoStream(null); setIsCameraLoading(true); setCameraError(null); setVideoDimensions({ width: 0, height: 0 }); }; }, [faceLandmarker]);

  // --- Prediction & Drawing Loop ---
  const predictionDrawLoop = useCallback(() => { animationFrameRef.current.rafId = requestAnimationFrame(predictionDrawLoop); animationFrameRef.current.count++; if (isCameraLoading || cameraError || !videoRef.current || !faceLandmarker || !imageSegmenter) { return; } const video = videoRef.current; const startTime = performance.now(); try { const landmarkResults = faceLandmarker.detectForVideo(video, startTime); const segmentationResults = imageSegmenter.segmentForVideo(video, startTime); drawOverlay(landmarkResults, segmentationResults); } catch (error) { console.error(`Prediction/Draw Error:`, error); } }, [faceLandmarker, imageSegmenter, isCameraLoading, cameraError, drawOverlay]);

  // --- Effect to manage prediction/draw loop start/stop ---
  useEffect(() => { if (!isCameraLoading && !cameraError && videoStream && faceLandmarker && imageSegmenter) { console.log("RealTimeMirror: Starting Prediction & Draw Loop."); cancelAnimationFrame(animationFrameRef.current?.rafId); animationFrameRef.current.count = 0; animationFrameRef.current.rafId = requestAnimationFrame(predictionDrawLoop); } else { cancelAnimationFrame(animationFrameRef.current?.rafId); } return () => { cancelAnimationFrame(animationFrameRef.current?.rafId); }; }, [videoStream, faceLandmarker, imageSegmenter, isCameraLoading, cameraError, predictionDrawLoop]);

  // --- Determine if base WebGL renderer should be shown ---
  const shouldRenderTryOnBase = !isCameraLoading && !cameraError;
  // console.log("RealTimeMirror: Render() Check...", shouldRenderTryOnBase);

  // --- JSX --- (Restored)
  return (
    <div className="border p-4 rounded bg-blue-50 relative">
       <h2 className="text-xl font-semibold mb-2 text-center">Real-Time Mirror Mode</h2>
       {(isCameraLoading && !cameraError) && <p className="text-center py-4">Initializing Camera & AI...</p>}
       {cameraError && <p className="text-red-500 text-center py-4">{cameraError}</p>}
      {/* Container for Layered Canvases */}
      <div className="relative w-full max-w-md mx-auto bg-gray-700" style={{ aspectRatio: `${videoDimensions.width || 16}/${videoDimensions.height || 9}`, overflow: 'hidden' }}>
          <video ref={videoRef} autoPlay playsInline muted className="absolute top-0 left-0 w-[1px] h-[1px] opacity-5 -z-10" />
          {/* Base WebGL Canvas */}
          {shouldRenderTryOnBase && ( <TryOnRenderer ref={webglCanvasRef} videoRefProp={videoRef} imageElement={null} isStatic={false} className="absolute top-0 left-0 w-full h-full z-0" style={{ objectFit: 'cover' }} /> )}
          {/* Overlay 2D Canvas */}
           <canvas ref={overlayCanvasRef} className="absolute top-0 left-0 w-full h-full z-10 pointer-events-none" style={{ objectFit: 'cover' }} />
           {/* Fallback UI */}
           {isCameraLoading && !cameraError && ( <div className="absolute inset-0 flex items-center justify-center bg-gray-200 z-20"><p className="text-gray-500">Initializing...</p></div> )}
      </div>
      {/* AI Model Status */}
    </div>
  );
  // ******************
}); // Closing brace and parenthesis for forwardRef
RealTimeMirror.displayName = 'RealTimeMirror';
export default RealTimeMirror;