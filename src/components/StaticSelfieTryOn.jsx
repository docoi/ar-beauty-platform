// src/components/StaticSelfieTryOn.jsx - Reverted (No Correction Props)

import React, { useState, useRef, useEffect, useCallback } from 'react';
import TryOnRenderer from './TryOnRenderer';

// No extra props needed for correction yet
const StaticSelfieTryOn = ({ faceLandmarker }) => {
  console.log("StaticSelfieTryOn rendering.");

  // State
  const [isPreviewing, setIsPreviewing] = useState(true);
  const [cameraStream, setCameraStream] = useState(null);
  const [isCameraLoading, setIsCameraLoading] = useState(true);
  const [cameraError, setCameraError] = useState(null);
  const [capturedSelfieDataUrl, setCapturedSelfieDataUrl] = useState(null);
  const [detectedSelfieResults, setDetectedSelfieResults] = useState(null);
  const [selfieDimensions, setSelfieDimensions] = useState({ width: 0, height: 0 });
  const [isDetecting, setIsDetecting] = useState(false);
  const [debugInfo, setDebugInfo] = useState('');

  // Refs
  const selfieVideoRef = useRef(null);
  const rendererRef = useRef(null);
  const staticImageRef = useRef(null);

  // --- Camera Access Logic ---
  useEffect(() => {
    let isMounted = true; let stream = null; const enableStream = async () => { if (!isPreviewing || !faceLandmarker || !navigator.mediaDevices?.getUserMedia) { if (isMounted) setIsCameraLoading(false); return; } console.log("Selfie Mode: Requesting camera..."); setIsCameraLoading(true); setCameraError(null); setDebugInfo(''); try { stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 720 } }, audio: false }); console.log("Selfie Mode: Stream acquired."); if (isMounted && selfieVideoRef.current) { selfieVideoRef.current.srcObject = stream; setCameraStream(stream); selfieVideoRef.current.onloadedmetadata = () => { if (isMounted && selfieVideoRef.current) { setSelfieDimensions({ width: selfieVideoRef.current.videoWidth, height: selfieVideoRef.current.videoHeight }); setIsCameraLoading(false); } }; } else if (stream) { stream.getTracks().forEach(track => track.stop()); } } catch (err) { console.error("Selfie Mode: Camera Error:", err); if (isMounted) { let message = "Camera Error."; if (err.name === "NotFoundError") message = "No camera found."; else if (err.name === "NotAllowedError") message = "Permission denied."; else if (err.name === "NotReadableError") message = "Camera in use."; setCameraError(message); setIsCameraLoading(false); setDebugInfo(`Camera Error: ${message}`); } } };
    if (isPreviewing) { enableStream(); } else { setIsCameraLoading(false); }
    return () => { isMounted = false; console.log("Cleaning up Selfie Camera..."); const currentStream = cameraStream || stream; currentStream?.getTracks().forEach(track => track.stop()); if (selfieVideoRef.current) { selfieVideoRef.current.srcObject = null; selfieVideoRef.current.onloadedmetadata = null; } setCameraStream(null); };
  }, [isPreviewing, faceLandmarker]);

  // --- Selfie Capture (NO FILTER) ---
  const handleTakeSelfie = useCallback(() => {
    if (!selfieVideoRef.current || selfieVideoRef.current.readyState < 2) { setCameraError("Cam not ready."); setDebugInfo("Error: Cam not ready."); return; } if (!selfieDimensions.width || !selfieDimensions.height){ setCameraError("No dims."); setDebugInfo("Error: No camera dims."); return; } console.log("Taking selfie..."); setDebugInfo("Capturing..."); const video = selfieVideoRef.current; const tempCanvas = document.createElement('canvas'); tempCanvas.width = selfieDimensions.width; tempCanvas.height = selfieDimensions.height; const ctx = tempCanvas.getContext('2d'); ctx.save(); ctx.scale(-1, 1); ctx.translate(-tempCanvas.width, 0); ctx.drawImage(video, 0, 0, tempCanvas.width, tempCanvas.height); ctx.restore(); const dataUrl = tempCanvas.toDataURL('image/png'); console.log("Selfie Captured. URL length:", dataUrl.length); setCapturedSelfieDataUrl(dataUrl); setIsPreviewing(false); setDetectedSelfieResults(null); setIsDetecting(true); setDebugInfo('Capture complete. Analyzing...'); cameraStream?.getTracks().forEach(track => track.stop()); setCameraStream(null);
  }, [cameraStream, selfieDimensions]);

  // --- Face Detection ---
  useEffect(() => {
    if (!capturedSelfieDataUrl || !faceLandmarker || !isDetecting) return; console.log("Detection Effect: Starting..."); setDebugInfo('Detecting...'); const imageElement = new Image(); imageElement.onload = async () => { console.log("Detection Effect: Image loaded."); staticImageRef.current = imageElement; setDebugInfo('Image loaded, detecting...'); try { if (faceLandmarker) { const results = faceLandmarker.detectForVideo(imageElement, performance.now()); console.log("Detection Effect: Finished."); if (results?.faceLandmarks?.length > 0) { setDebugInfo(`Detection OK. ${results.faceLandmarks.length} face(s). L[0]: ${results.faceLandmarks[0]?.length}`); } else { setDebugInfo('Detection OK. No face found.'); } setDetectedSelfieResults(results); } else { setDebugInfo('Error: Landmarker gone.'); } } catch(err) { setDebugInfo(`Detection Error: ${err.message}`); console.error("Detection Error:", err); } finally { setIsDetecting(false); } } ; imageElement.onerror = () => { setDebugInfo('Error: Img load failed.'); setIsDetecting(false); } ; imageElement.src = capturedSelfieDataUrl;
  }, [capturedSelfieDataUrl, faceLandmarker, isDetecting]);

   // --- Effect to Trigger Rendering ---
  useEffect(() => {
    // console.log("Render Trigger Effect:", { isPreviewing, isDetecting, hasRenderer: !!rendererRef.current, hasImage: !!staticImageRef.current, hasResults: !!detectedSelfieResults }); // Reduce noise
    if (!isPreviewing && rendererRef.current && staticImageRef.current) {
        if (!isDetecting) {
            // console.log("Render Trigger: Calling renderStaticImageResults."); // Reduce noise
            // Call WITHOUT brightness/contrast props
            rendererRef.current.renderStaticImageResults(staticImageRef.current, detectedSelfieResults);
        } else {
             // console.log("Render Trigger: Rendering base image while detecting."); // Reduce noise
             // Call WITHOUT brightness/contrast props
             rendererRef.current.renderStaticImageResults(staticImageRef.current, null);
        }
    } else if (isPreviewing && rendererRef.current){
        // console.log("Render Trigger: Clearing canvas for preview."); // Reduce noise
        rendererRef.current.clearCanvas(); // Clear renderer when switching back to preview
    }
  }, [isPreviewing, isDetecting, detectedSelfieResults, selfieDimensions]); // Removed correction props from deps

  // --- Retake Selfie ---
  const handleRetakeSelfie = () => {
    console.log("Retaking selfie..."); setIsPreviewing(true); setCapturedSelfieDataUrl(null); setDetectedSelfieResults(null); staticImageRef.current = null; setCameraError(null); setIsCameraLoading(true); setIsDetecting(false); setDebugInfo('');
  };

  // --- JSX ---
  return (
    <div className="border p-4 rounded bg-green-50">
      <h2 className="text-xl font-semibold mb-2 text-center">Try On Selfie Mode</h2>
      {isPreviewing ? (
        // --- Preview Mode JSX ---
        <>
          {isCameraLoading && <p className="text-center py-4">Starting camera...</p>}
          {cameraError && <p className="text-red-500 text-center py-4">{cameraError}</p>}
          <div className="relative w-full max-w-md mx-auto aspect-[9/16] bg-gray-200 overflow-hidden rounded shadow">
            <video ref={selfieVideoRef} autoPlay playsInline muted className={`absolute top-0 left-0 w-full h-full ${isCameraLoading || cameraError ? 'opacity-0' : 'opacity-100'}`} style={{ transform: 'scaleX(-1)', transition: 'opacity 0.3s', objectFit: 'cover' }}></video>
            {(isCameraLoading || cameraError) && ( <div className="absolute inset-0 flex items-center justify-center"><p className="text-gray-500 bg-white px-2 py-1 rounded shadow">{cameraError ? 'Error' : 'Loading...'}</p></div> )}
          </div>
          <div className="text-center mt-4"> <button onClick={handleTakeSelfie} disabled={isCameraLoading || !!cameraError || !cameraStream} className="bg-indigo-500 text-white px-4 py-2 rounded hover:bg-indigo-600 disabled:bg-gray-400 disabled:cursor-not-allowed"> Take Selfie </button> </div>
        </>
      ) : (
        // --- Captured Mode JSX ---
        <>
          {/* Selfie Display Area */}
          <div className="relative w-full max-w-md mx-auto bg-gray-200 overflow-hidden rounded shadow" style={{ paddingTop: `${selfieDimensions.height && selfieDimensions.width ? (selfieDimensions.height / selfieDimensions.width) * 100 : 75}%` }}>
           {selfieDimensions.width > 0 ? ( <TryOnRenderer ref={rendererRef} videoWidth={selfieDimensions.width} videoHeight={selfieDimensions.height} className="absolute top-0 left-0 w-full h-full" /> )
           : ( <div className="absolute inset-0 flex items-center justify-center"><p className="text-gray-500">Loading Image...</p></div> )}
          </div>
           {/* Debug Info Box */}
          <div className="mt-2 p-2 border bg-gray-100 text-xs overflow-auto max-h-20 max-w-md mx-auto rounded">
            <p className="font-semibold mb-1">Debug Info:</p>
            <pre className="whitespace-pre-wrap break-words">{isDetecting ? 'Analyzing selfie...' : (debugInfo || 'N/A')}</pre>
          </div>
           {/* Retake Selfie Button */}
          <div className="text-center mt-4">
            <button onClick={handleRetakeSelfie} className="bg-gray-500 text-white px-4 py-2 rounded hover:bg-gray-600"> Retake Selfie </button>
          </div>
        </>
      )}
      {/* Fallback message if landmarker is not ready */}
      {!faceLandmarker && <p className="text-red-500 mt-2 text-center">Initializing AI model...</p>}
    </div>
  );
};

export default StaticSelfieTryOn;