// src/components/StaticSelfieTryOn.jsx - Layered Canvas Approach (Lipstick via Clipping - STRAIGHT LINES - VERIFIED JSX)

import React, { useState, useRef, useEffect, useCallback, forwardRef } from 'react';
import TryOnRenderer from './TryOnRenderer'; // The simplified WebGL base renderer

// Define LIP landmark indices (DETAILED SET)
const LIP_OUTLINE_UPPER_INDICES = [ 61, 185, 40, 39, 37, 0, 267, 269, 270, 409 ];
const LIP_OUTLINE_LOWER_INDICES = [ 291, 375, 321, 405, 314, 17, 84, 181, 91, 146 ];
const INNER_LIP_UPPER_INDICES = [ 78, 191, 80, 81, 82, 13, 312, 311, 310, 415 ];
const INNER_LIP_LOWER_INDICES = [ 308, 324, 318, 402, 317, 14, 87, 178, 88, 95 ];
const DETAILED_LIP_OUTER_INDICES = [ ...LIP_OUTLINE_UPPER_INDICES, ...LIP_OUTLINE_LOWER_INDICES.slice().reverse() ];
// Inner indices used directly now for lineTo

// REMOVED drawSmoothPath helper

const StaticSelfieTryOn = forwardRef(({
    faceLandmarker, imageSegmenter, effectIntensity // Unused for now
}, ref) => {
  // State
  const [isPreviewing, setIsPreviewing] = useState(true); const [cameraStream, setCameraStream] = useState(null); const [isCameraLoading, setIsCameraLoading] = useState(true); const [cameraError, setCameraError] = useState(null); const [capturedSelfieDataUrl, setCapturedSelfieDataUrl] = useState(null); const [detectedLandmarkResults, setDetectedLandmarkResults] = useState(null); const [detectedSegmentationResults, setDetectedSegmentationResults] = useState(null); const [selfieDimensions, setSelfieDimensions] = useState({ width: 0, height: 0 }); const [isDetecting, setIsDetecting] = useState(false); const [debugInfo, setDebugInfo] = useState(''); const [staticImageElement, setStaticImageElement] = useState(null);
  // Refs
  const selfieVideoRef = useRef(null); const webglCanvasRef = useRef(null); const overlayCanvasRef = useRef(null);

  // Camera Access Effect
  useEffect(() => { let isMounted = true; let stream = null; const enableStream = async () => { if (!isPreviewing || !faceLandmarker || !navigator.mediaDevices?.getUserMedia) { if (isMounted) setIsCameraLoading(false); return; } setIsCameraLoading(true); setCameraError(null); setDebugInfo(''); try { stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 720 } }, audio: false }); if (isMounted && selfieVideoRef.current) { selfieVideoRef.current.srcObject = stream; setCameraStream(stream); selfieVideoRef.current.onloadedmetadata = () => { if (isMounted && selfieVideoRef.current) { setSelfieDimensions({ width: selfieVideoRef.current.videoWidth, height: selfieVideoRef.current.videoHeight }); setIsCameraLoading(false); } }; } else if (stream) { stream?.getTracks().forEach(track => track.stop()); } } catch (err) { if (isMounted) { let message = "Camera Error."; setCameraError(message); setIsCameraLoading(false); setDebugInfo(`Camera Error: ${message}`); } } }; if (isPreviewing) { enableStream(); } else { setIsCameraLoading(false); const currentStream = cameraStream || stream; currentStream?.getTracks().forEach(track => track.stop()); if (selfieVideoRef.current) { selfieVideoRef.current.srcObject = null; } setCameraStream(null); } return () => { isMounted = false; const currentStream = cameraStream || stream; currentStream?.getTracks().forEach(track => track.stop()); if (selfieVideoRef.current) { selfieVideoRef.current.srcObject = null; selfieVideoRef.current.onloadedmetadata = null; } setCameraStream(null); }; }, [isPreviewing, faceLandmarker]);

  // Selfie Capture
  const handleTakeSelfie = useCallback(() => { if (!selfieVideoRef.current || selfieVideoRef.current.readyState < 2) { setCameraError("Cam not ready."); setDebugInfo("Error: Cam not ready."); return; } if (!selfieDimensions.width || !selfieDimensions.height){ setCameraError("No dims."); setDebugInfo("Error: No camera dims."); return; } setDebugInfo("Capturing..."); const video = selfieVideoRef.current; const tempCanvas = document.createElement('canvas'); tempCanvas.width = selfieDimensions.width; tempCanvas.height = selfieDimensions.height; const ctx = tempCanvas.getContext('2d'); ctx.save(); ctx.scale(-1, 1); ctx.translate(-tempCanvas.width, 0); ctx.drawImage(video, 0, 0, tempCanvas.width, tempCanvas.height); ctx.restore(); const dataUrl = tempCanvas.toDataURL('image/png'); setCapturedSelfieDataUrl(dataUrl); setIsPreviewing(false); setDetectedLandmarkResults(null); setDetectedSegmentationResults(null); setStaticImageElement(null); setDebugInfo('Capture complete. Loading image...'); cameraStream?.getTracks().forEach(track => track.stop()); setCameraStream(null); if (selfieVideoRef.current) { selfieVideoRef.current.srcObject = null; } }, [cameraStream, selfieDimensions]);

  // Image Loading and AI Detection Effect
  useEffect(() => { if (!capturedSelfieDataUrl || !faceLandmarker || !imageSegmenter) { if (staticImageElement) setStaticImageElement(null); if (isDetecting) setIsDetecting(false); return; } console.log("StaticSelfieTryOn: Loading image..."); setIsDetecting(true); setDebugInfo('Loading image...'); const imageElement = new Image(); imageElement.onload = () => { console.log("StaticSelfieTryOn: Image loaded."); setSelfieDimensions({width: imageElement.naturalWidth, height: imageElement.naturalHeight}); setStaticImageElement(imageElement); setDebugInfo('Running AI...'); try { if (faceLandmarker && imageSegmenter) { const startTime = performance.now(); const landmarkResults = faceLandmarker.detectForVideo(imageElement, startTime); const segmentationResults = imageSegmenter.segmentForVideo(imageElement, startTime); const endTime = performance.now(); console.log(`StaticSelfieTryOn: AI took ${endTime - startTime}ms`); setDetectedLandmarkResults(landmarkResults); setDetectedSegmentationResults(segmentationResults); setDebugInfo(`Analysis complete: ${landmarkResults?.faceLandmarks?.[0]?.length || 0} landmarks.`); } else { setDetectedLandmarkResults(null); setDetectedSegmentationResults(null); setDebugInfo('AI models not ready.'); } } catch(err) { console.error("AI Error:", err); setDetectedLandmarkResults(null); setDetectedSegmentationResults(null); setDebugInfo(`AI Error: ${err.message}`); } finally { setIsDetecting(false); } }; imageElement.onerror = () => { console.error("Image load error."); setDebugInfo('Error loading image.'); setStaticImageElement(null); setIsDetecting(false); }; imageElement.src = capturedSelfieDataUrl; return () => { imageElement.onload = null; imageElement.onerror = null; imageElement.src = ''; }; }, [capturedSelfieDataUrl, faceLandmarker, imageSegmenter]);


  // --- Canvas Drawing Function for Static Selfie (Lipstick via Clipping - STRAIGHT LINES) ---
  const drawStaticOverlay = useCallback(() => {
    const overlayCanvas = overlayCanvasRef.current; const image = staticImageElement; const landmarks = detectedLandmarkResults; if (!overlayCanvas || !image || !landmarks?.faceLandmarks?.[0] || !selfieDimensions.width || !selfieDimensions.height) { if(overlayCanvas) { const ctx = overlayCanvas.getContext('2d'); if(ctx) ctx.clearRect(0, 0, overlayCanvas.width, overlayCanvas.height); } return; } const ctx = overlayCanvas.getContext('2d'); if (!ctx) return; const canvasWidth = selfieDimensions.width; const canvasHeight = selfieDimensions.height; if (overlayCanvas.width !== canvasWidth || overlayCanvas.height !== canvasHeight) { overlayCanvas.width = canvasWidth; overlayCanvas.height = canvasHeight; } ctx.clearRect(0, 0, canvasWidth, canvasHeight);
    try {
        const facePoints = landmarks.faceLandmarks[0];
        if (facePoints.length > 0) {
             ctx.fillStyle = "#0000FF"; // Bright Blue

             // --- Draw Outer Lip Path (Straight) and Fill ---
             ctx.beginPath();
             DETAILED_LIP_OUTER_INDICES.forEach((index, i) => { if (index < facePoints.length) { const point = facePoints[index]; const x = point.x * canvasWidth; const y = point.y * canvasHeight; if (i === 0) { ctx.moveTo(x, y); } else { ctx.lineTo(x, y); } } }); // USE lineTo
             ctx.closePath();
             ctx.fill(); // Fill outer shape

             // --- Erase Inner Lip Area using STRAIGHT LINES ---
             ctx.save();
             ctx.globalCompositeOperation = 'destination-out'; // Erase mode
             ctx.beginPath();
             INNER_LIP_UPPER_INDICES.forEach((index, i) => { if (index < facePoints.length) { const p = facePoints[index]; const x = p.x * canvasWidth; const y = p.y * canvasHeight; if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y); } }); // USE lineTo
             INNER_LIP_LOWER_INDICES.slice().reverse().forEach((index, i) => { if (index < facePoints.length) { const p = facePoints[index]; const x = p.x * canvasWidth; const y = p.y * canvasHeight; ctx.lineTo(x, y); } }); // USE lineTo
             ctx.closePath(); // Close inner path
             ctx.fill(); // Erase inner shape
             ctx.restore(); // Restore composite operation
             // --- End Erase Inner Lip ---
        }
    } catch (error) { console.error("Error during static overlay drawing:", error); }
  }, [staticImageElement, detectedLandmarkResults, selfieDimensions]);

  // Effect to Trigger Static Drawing
  useEffect(() => { if (!isPreviewing && staticImageElement && detectedLandmarkResults) { drawStaticOverlay(); } else if (!isPreviewing && overlayCanvasRef.current) { const ctx = overlayCanvasRef.current.getContext('2d'); if (ctx) ctx.clearRect(0, 0, overlayCanvasRef.current.width, overlayCanvasRef.current.height); } }, [isPreviewing, staticImageElement, detectedLandmarkResults, drawStaticOverlay]);

   // Retake Selfie
   const handleRetakeSelfie = useCallback(() => { setIsPreviewing(true); setCapturedSelfieDataUrl(null); setDetectedLandmarkResults(null); setDetectedSegmentationResults(null); setStaticImageElement(null); setSelfieDimensions({ width: 0, height: 0 }); setCameraError(null); setIsCameraLoading(true); setIsDetecting(false); setDebugInfo(''); if(overlayCanvasRef.current) { const ctx = overlayCanvasRef.current.getContext('2d'); if(ctx) ctx.clearRect(0, 0, overlayCanvasRef.current.width, overlayCanvasRef.current.height); } }, []);

   // --- JSX --- (VERIFIED COMPLETE)
   return (
    <div className="border p-4 rounded bg-green-50">
      <h2 className="text-xl font-semibold mb-2 text-center">Try On Selfie Mode</h2>
      {isPreviewing ? ( // Preview UI block
         <>
            {isCameraLoading && <p className="text-center py-4">Starting camera...</p>}
            {cameraError && <p className="text-red-500 text-center py-4">{cameraError}</p>}
            <div className="relative w-full max-w-md mx-auto aspect-[9/16] bg-gray-200 overflow-hidden rounded shadow">
               <video ref={selfieVideoRef} autoPlay playsInline muted className={`absolute top-0 left-0 w-full h-full ${isCameraLoading || cameraError ? 'opacity-0' : 'opacity-100'}`} style={{ transform: 'scaleX(-1)', transition: 'opacity 0.3s', objectFit: 'cover' }}></video>
               {(isCameraLoading || cameraError) && ( <div className="absolute inset-0 flex items-center justify-center"><p className="text-gray-500 bg-white px-2 py-1 rounded shadow">{cameraError ? 'Error' : 'Loading...'}</p></div> )}
            </div>
            <div className="text-center mt-4">
               <button onClick={handleTakeSelfie} disabled={isCameraLoading || !!cameraError || !cameraStream} className="bg-indigo-500 text-white px-4 py-2 rounded hover:bg-indigo-600 disabled:bg-gray-400 disabled:cursor-not-allowed"> Take Selfie </button>
            </div>
         </> // End Preview block
      ) : ( // Captured UI block
        <>
          {/* Container for Layered Canvases */}
          <div className="relative w-full max-w-md mx-auto bg-gray-700" style={{ paddingTop: `${selfieDimensions.height && selfieDimensions.width ? (selfieDimensions.height / selfieDimensions.width) * 100 : 75}%`, overflow: 'hidden' }} >
                {/* Base WebGL Canvas */}
                {staticImageElement ? ( <TryOnRenderer ref={webglCanvasRef} videoRefProp={null} imageElement={staticImageElement} isStatic={true} className="absolute top-0 left-0 w-full h-full z-0" style={{ objectFit: 'cover' }} /> )
                : ( <div className="absolute inset-0 flex items-center justify-center bg-gray-200 z-20"><p className="text-gray-500">{isDetecting ? 'Analyzing Selfie...' : (capturedSelfieDataUrl ? 'Loading Image...' : 'Initializing...')}</p></div> )}
                 {/* Overlay 2D Canvas */}
                 <canvas ref={overlayCanvasRef} className="absolute top-0 left-0 w-full h-full z-10 pointer-events-none" style={{ objectFit: 'cover' }} />
          </div>
           {/* Debug Info & Retake Button */}
           <div className="mt-2 p-2 border bg-gray-100 text-xs overflow-auto max-h-20 max-w-md mx-auto rounded"><p className="font-semibold mb-1">Debug Info:</p><pre className="whitespace-pre-wrap break-words">{debugInfo || 'N/A'}</pre></div>
           <div className="text-center mt-4"><button onClick={handleRetakeSelfie} className="bg-gray-500 text-white px-4 py-2 rounded hover:bg-gray-600">Retake Selfie</button></div>
        </> // End Captured block
      )}
      {(!faceLandmarker || !imageSegmenter) && <p className="text-red-500 mt-2 text-center">Initializing AI models...</p>}
    </div>
  ); // Closing parenthesis for return
}); // Closing brace and parenthesis for forwardRef

StaticSelfieTryOn.displayName = 'StaticSelfieTryOn';
export default StaticSelfieTryOn;