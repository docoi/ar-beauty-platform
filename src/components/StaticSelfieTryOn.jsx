// src/components/StaticSelfieTryOn.jsx - Layered Canvas Approach (Healthy Glow Effect)

import React, { useState, useRef, useEffect, useCallback, forwardRef } from 'react';
import TryOnRenderer from './TryOnRenderer'; // The simplified WebGL base renderer

// Define face outline landmarks
const FACE_OUTLINE_INDICES = [ 10, 338, 297, 332, 284, 251, 389, 356, 454, 323, 361, 288, 397, 365, 379, 378, 400, 377, 152, 148, 176, 149, 150, 136, 172, 58, 132, 93, 234, 127, 162, 21, 54, 103, 67, 109 ];

const StaticSelfieTryOn = forwardRef(({
    faceLandmarker,
    imageSegmenter,
    effectIntensity
}, ref) => {
  // State
  const [isPreviewing, setIsPreviewing] = useState(true);
  const [cameraStream, setCameraStream] = useState(null);
  const [isCameraLoading, setIsCameraLoading] = useState(true);
  const [cameraError, setCameraError] = useState(null);
  const [capturedSelfieDataUrl, setCapturedSelfieDataUrl] = useState(null);
  const [detectedLandmarkResults, setDetectedLandmarkResults] = useState(null);
  const [detectedSegmentationResults, setDetectedSegmentationResults] = useState(null);
  const [selfieDimensions, setSelfieDimensions] = useState({ width: 0, height: 0 });
  const [isDetecting, setIsDetecting] = useState(false);
  const [debugInfo, setDebugInfo] = useState('');
  const [staticImageElement, setStaticImageElement] = useState(null);

  // Refs
  const selfieVideoRef = useRef(null);
  const webglCanvasRef = useRef(null);
  const overlayCanvasRef = useRef(null);

  // Camera Access Effect
  useEffect(() => { let isMounted = true; let stream = null; const enableStream = async () => { if (!isPreviewing || !faceLandmarker || !navigator.mediaDevices?.getUserMedia) { if (isMounted) setIsCameraLoading(false); return; } setIsCameraLoading(true); setCameraError(null); setDebugInfo(''); try { stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 720 } }, audio: false }); if (isMounted && selfieVideoRef.current) { selfieVideoRef.current.srcObject = stream; setCameraStream(stream); selfieVideoRef.current.onloadedmetadata = () => { if (isMounted && selfieVideoRef.current) { setSelfieDimensions({ width: selfieVideoRef.current.videoWidth, height: selfieVideoRef.current.videoHeight }); setIsCameraLoading(false); } }; } else if (stream) { stream?.getTracks().forEach(track => track.stop()); } } catch (err) { if (isMounted) { let message = "Camera Error."; setCameraError(message); setIsCameraLoading(false); setDebugInfo(`Camera Error: ${message}`); } } }; if (isPreviewing) { enableStream(); } else { setIsCameraLoading(false); const currentStream = cameraStream || stream; currentStream?.getTracks().forEach(track => track.stop()); if (selfieVideoRef.current) { selfieVideoRef.current.srcObject = null; } setCameraStream(null); } return () => { isMounted = false; const currentStream = cameraStream || stream; currentStream?.getTracks().forEach(track => track.stop()); if (selfieVideoRef.current) { selfieVideoRef.current.srcObject = null; selfieVideoRef.current.onloadedmetadata = null; } setCameraStream(null); }; }, [isPreviewing, faceLandmarker]);

  // Selfie Capture
  const handleTakeSelfie = useCallback(() => { if (!selfieVideoRef.current || selfieVideoRef.current.readyState < 2) { setCameraError("Cam not ready."); setDebugInfo("Error: Cam not ready."); return; } if (!selfieDimensions.width || !selfieDimensions.height){ setCameraError("No dims."); setDebugInfo("Error: No camera dims."); return; } setDebugInfo("Capturing..."); const video = selfieVideoRef.current; const tempCanvas = document.createElement('canvas'); tempCanvas.width = selfieDimensions.width; tempCanvas.height = selfieDimensions.height; const ctx = tempCanvas.getContext('2d'); ctx.save(); ctx.scale(-1, 1); ctx.translate(-tempCanvas.width, 0); ctx.drawImage(video, 0, 0, tempCanvas.width, tempCanvas.height); ctx.restore(); const dataUrl = tempCanvas.toDataURL('image/png'); setCapturedSelfieDataUrl(dataUrl); setIsPreviewing(false); setDetectedLandmarkResults(null); setDetectedSegmentationResults(null); setStaticImageElement(null); setDebugInfo('Capture complete. Loading image...'); cameraStream?.getTracks().forEach(track => track.stop()); setCameraStream(null); if (selfieVideoRef.current) { selfieVideoRef.current.srcObject = null; } }, [cameraStream, selfieDimensions]);

  // Image Loading and AI Detection Effect
  useEffect(() => { if (!capturedSelfieDataUrl || !faceLandmarker || !imageSegmenter) { if (staticImageElement) setStaticImageElement(null); if (isDetecting) setIsDetecting(false); return; } console.log("StaticSelfieTryOn: Loading image for detection/segmentation..."); setIsDetecting(true); setDebugInfo('Loading captured image...'); const imageElement = new Image(); imageElement.onload = () => { console.log("StaticSelfieTryOn: Image loaded."); setSelfieDimensions({width: imageElement.naturalWidth, height: imageElement.naturalHeight}); setStaticImageElement(imageElement); setDebugInfo('Image loaded, running AI...'); try { if (faceLandmarker && imageSegmenter) { console.log("StaticSelfieTryOn: Running detectForVideo() and segmentForVideo()..."); const startTime = performance.now(); const landmarkResults = faceLandmarker.detectForVideo(imageElement, startTime); const segmentationResults = imageSegmenter.segmentForVideo(imageElement, startTime); const endTime = performance.now(); console.log(`StaticSelfieTryOn: AI Processing took ${endTime - startTime}ms`); setDetectedLandmarkResults(landmarkResults); setDetectedSegmentationResults(segmentationResults); setDebugInfo(`Analysis complete: ${landmarkResults?.faceLandmarks?.[0]?.length || 0} landmarks found.`); } else { setDetectedLandmarkResults(null); setDetectedSegmentationResults(null); setDebugInfo('AI models not ready for analysis.'); } } catch(err) { console.error("StaticSelfieTryOn: Error during AI processing:", err); setDetectedLandmarkResults(null); setDetectedSegmentationResults(null); setDebugInfo(`AI Error: ${err.message}`); } finally { setIsDetecting(false); } }; imageElement.onerror = () => { console.error("StaticSelfieTryOn: imageElement.onerror triggered."); setDebugInfo('Error: Failed to load captured image.'); setStaticImageElement(null); setIsDetecting(false); }; imageElement.src = capturedSelfieDataUrl; return () => { imageElement.onload = null; imageElement.onerror = null; imageElement.src = ''; }; }, [capturedSelfieDataUrl, faceLandmarker, imageSegmenter]);


  // --- Canvas Drawing Function for Static Selfie (Healthy Glow) ---
  const drawStaticOverlay = useCallback(() => {
    const overlayCanvas = overlayCanvasRef.current; const image = staticImageElement; const landmarks = detectedLandmarkResults;
    if (!overlayCanvas || !image || !landmarks?.faceLandmarks?.[0] || !selfieDimensions.width || !selfieDimensions.height) { if(overlayCanvas) { const ctx = overlayCanvas.getContext('2d'); if(ctx) ctx.clearRect(0, 0, overlayCanvas.width, overlayCanvas.height); } return; }
    // console.log("drawStaticOverlay: Drawing...");
    const ctx = overlayCanvas.getContext('2d'); if (!ctx) return; const canvasWidth = selfieDimensions.width; const canvasHeight = selfieDimensions.height;
    if (overlayCanvas.width !== canvasWidth || overlayCanvas.height !== canvasHeight) { overlayCanvas.width = canvasWidth; overlayCanvas.height = canvasHeight; } ctx.clearRect(0, 0, canvasWidth, canvasHeight);
    try {
        const facePoints = landmarks.faceLandmarks[0];
        if (facePoints.length > 0) {
            // 1. Create clipping path
            ctx.beginPath(); FACE_OUTLINE_INDICES.forEach((index, i) => { if (index < facePoints.length) { const point = facePoints[index]; const x = point.x * canvasWidth; const y = point.y * canvasHeight; if (i === 0) { ctx.moveTo(x, y); } else { ctx.lineTo(x, y); } } }); ctx.closePath();
            ctx.save(); ctx.clip();
            // 2. Apply "Healthy Glow" Effect
            if (effectIntensity > 0.01) {
                 const alpha = 0.25 * effectIntensity; // Max alpha 0.25
                 ctx.fillStyle = `rgba(255, 240, 235, ${alpha})`; // Warm tint
                 ctx.fillRect(0, 0, canvasWidth, canvasHeight);
            }
            ctx.restore(); // Remove clipping mask
        }
    } catch (error) { console.error("Error during static overlay drawing:", error); }
  }, [staticImageElement, detectedLandmarkResults, effectIntensity, selfieDimensions]); // Dependencies

  // Effect to Trigger Static Drawing
  useEffect(() => { if (!isPreviewing && staticImageElement && detectedLandmarkResults) { drawStaticOverlay(); } else if (!isPreviewing && overlayCanvasRef.current) { const ctx = overlayCanvasRef.current.getContext('2d'); if (ctx) ctx.clearRect(0, 0, overlayCanvasRef.current.width, overlayCanvasRef.current.height); } }, [isPreviewing, staticImageElement, detectedLandmarkResults, drawStaticOverlay]);

   // Retake Selfie
   const handleRetakeSelfie = useCallback(() => { setIsPreviewing(true); setCapturedSelfieDataUrl(null); setDetectedLandmarkResults(null); setDetectedSegmentationResults(null); setStaticImageElement(null); setSelfieDimensions({ width: 0, height: 0 }); setCameraError(null); setIsCameraLoading(true); setIsDetecting(false); setDebugInfo(''); if(overlayCanvasRef.current) { const ctx = overlayCanvasRef.current.getContext('2d'); if(ctx) ctx.clearRect(0, 0, overlayCanvasRef.current.width, overlayCanvasRef.current.height); } }, []);

   // --- JSX --- (Includes Overlay Canvas and Preview) ---
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
         </>
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
        </>
      )}
      {(!faceLandmarker || !imageSegmenter) && <p className="text-red-500 mt-2 text-center">Initializing AI models...</p>}
    </div>
  );
  // **********************************

});
StaticSelfieTryOn.displayName = 'StaticSelfieTryOn';
export default StaticSelfieTryOn;