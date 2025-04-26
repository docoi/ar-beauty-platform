// src/components/StaticSelfieTryOn.jsx - Add Camera State Logging (FULL CODE)

import React, { useState, useRef, useEffect, useCallback, forwardRef, useImperativeHandle } from 'react';
import TryOnRenderer from './TryOnRenderer'; // Bare-minimum shader

// Fixed B/C values (used when rendering static image)
const FIXED_SELFIE_BRIGHTNESS = 2.15;
const FIXED_SELFIE_CONTRAST = 0.55;

const StaticSelfieTryOn = forwardRef(({
    faceLandmarker,
    effectIntensity
}, ref) => {
  console.log("StaticSelfieTryOn rendering. Intensity prop:", effectIntensity );

  // State
  const [isPreviewing, setIsPreviewing] = useState(true); // Controls mode (preview vs static display)
  const [cameraStream, setCameraStream] = useState(null); // Holds the stream for preview
  const [isCameraLoading, setIsCameraLoading] = useState(true); // Loading state for preview camera
  const [cameraError, setCameraError] = useState(null); // Error state for preview camera
  const [capturedSelfieDataUrl, setCapturedSelfieDataUrl] = useState(null); // Holds the captured image data URL
  const [detectedSelfieResults, setDetectedSelfieResults] = useState(null); // Holds MediaPipe results for static image
  const [selfieDimensions, setSelfieDimensions] = useState({ width: 0, height: 0 }); // Dimensions for display container
  const [isDetecting, setIsDetecting] = useState(false); // Flag during MediaPipe processing
  const [debugInfo, setDebugInfo] = useState(''); // Debug messages
  const [staticImageElement, setStaticImageElement] = useState(null); // Holds the loaded static image element

  // Refs
  const selfieVideoRef = useRef(null); // Ref for the preview video element
  // const rendererRef = useRef(null); // No longer needed for method calls

  // Imperative handle (currently unused but kept for structure)
  useImperativeHandle(ref, () => ({
      // updateEffectIntensity: (intensity) => {
      //     // Passed as prop now
      // }
  }));


  // Camera Access Effect (Only for Preview Mode)
  useEffect(() => {
    let isMounted = true;
    let stream = null;
    const enableStream = async () => {
        if (!faceLandmarker || !navigator.mediaDevices?.getUserMedia) { if (isMounted) setIsCameraLoading(false); return; }
        console.log("Selfie: enableStream - Setting camera loading TRUE.");
        setIsCameraLoading(true); // Set loading before async call
        setCameraError(null);
        setDebugInfo('');
        try {
            stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 720 } }, audio: false });
            console.log("Selfie: enableStream - Stream acquired.");
            if (isMounted && selfieVideoRef.current) {
                selfieVideoRef.current.srcObject = stream;
                console.log("Selfie: enableStream - Setting cameraStream state.");
                setCameraStream(stream); // Update state

                selfieVideoRef.current.onloadedmetadata = () => {
                    console.log("Selfie: ONLOADEDMETADATA executing."); // *** Log execution ***
                    if (isMounted && selfieVideoRef.current) {
                        const vWidth = selfieVideoRef.current.videoWidth;
                        const vHeight = selfieVideoRef.current.videoHeight;
                        console.log(`Selfie: ONLOADEDMETADATA - Dims: ${vWidth}x${vHeight}`);
                        console.log("Selfie: ONLOADEDMETADATA - Setting selfieDimensions state.");
                        setSelfieDimensions({ width: vWidth, height: vHeight }); // Store dims for capture/display
                        console.log("Selfie: ONLOADEDMETADATA - Setting camera loading FALSE.");
                        setIsCameraLoading(false); // *** Ensure this runs ***
                    } else {
                         console.log("Selfie: ONLOADEDMETADATA - Unmounted or videoRef gone.");
                    }
                };
                 selfieVideoRef.current.onerror = (e) => {
                     console.error("Selfie: Video Element Error:", e);
                     if(isMounted) {
                         setCameraError("Video element encountered an error.");
                         setIsCameraLoading(false); // Set loading false on error
                     }
                 }
            } else if (stream) {
                // If component unmounted quickly or videoRef gone, stop tracks
                 stream.getTracks().forEach(track => track.stop());
            }
        } catch (err) {
            console.error("Selfie: enableStream - Camera Error:", err);
            if (isMounted) {
                let message = "Camera Error.";
                if (err.name === "NotFoundError") message = "No camera found.";
                else if (err.name === "NotAllowedError") message = "Permission denied.";
                else if (err.name === "NotReadableError") message = "Camera in use or hardware error.";
                else message = `Camera Error: ${err.name}`;
                setCameraError(message);
                setIsCameraLoading(false); // Set loading false on error
                setDebugInfo(`Camera Error: ${message}`);
            }
        }
    };

    if (isPreviewing) { // Only get stream if in preview mode
        enableStream();
    } else {
        // If not previewing, ensure loading is false and stream is cleared
        setIsCameraLoading(false);
        if (cameraStream) {
             cameraStream.getTracks().forEach(track => track.stop());
             setCameraStream(null);
        }
    }

    // Cleanup function for this effect
    return () => {
      isMounted = false;
      console.log("Cleaning up Selfie Camera Effect...");
      const currentStream = cameraStream || stream; // Use state or local var
      currentStream?.getTracks().forEach(track => track.stop());
      if (selfieVideoRef.current) {
          selfieVideoRef.current.srcObject = null;
          selfieVideoRef.current.onloadedmetadata = null;
          selfieVideoRef.current.onerror = null;
      }
      setCameraStream(null); // Clear state on unmount
    };
   }, [isPreviewing, faceLandmarker]); // Re-run if mode changes or landmarker loads


  // Selfie Capture Callback
  const handleTakeSelfie = useCallback(() => {
    if (!selfieVideoRef.current || selfieVideoRef.current.readyState < 2) { setCameraError("Cam not ready."); setDebugInfo("Error: Cam not ready."); return; }
    // Use dimensions from state, which should be set by onloadedmetadata
    if (!selfieDimensions.width || !selfieDimensions.height){ setCameraError("No camera dimensions available."); setDebugInfo("Error: No camera dims."); return; }
    setDebugInfo("Capturing...");
    const video = selfieVideoRef.current;
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = selfieDimensions.width;
    tempCanvas.height = selfieDimensions.height;
    const ctx = tempCanvas.getContext('2d');
    // Draw flipped image like before
    ctx.save();
    ctx.scale(-1, 1);
    ctx.translate(-tempCanvas.width, 0);
    ctx.drawImage(video, 0, 0, tempCanvas.width, tempCanvas.height);
    ctx.restore();
    const dataUrl = tempCanvas.toDataURL('image/png');
    setCapturedSelfieDataUrl(dataUrl);
    setIsPreviewing(false); // Switch to static display mode
    setDetectedSelfieResults(null); // Clear previous results
    setStaticImageElement(null); // Clear previous image element
    setIsDetecting(true); // Start detection phase
    setDebugInfo('Capture complete. Analyzing...');
    // Stop the camera stream now that we have the picture
    cameraStream?.getTracks().forEach(track => track.stop());
    setCameraStream(null);
   }, [cameraStream, selfieDimensions]); // Dependencies


  // Face Detection and Image Loading Effect (for static image)
  useEffect(() => {
    if (!capturedSelfieDataUrl || !faceLandmarker || !isDetecting) {
         setStaticImageElement(null); // Clear image element if no dataUrl or not detecting
         return;
    }
    setDebugInfo('Loading Image...');
    const imageElement = new Image();
    imageElement.onload = async () => {
        console.log("StaticSelfieTryOn: Static image loaded from Data URL.");
        // Update dimensions based on the *actual* loaded image
        setSelfieDimensions({width: imageElement.naturalWidth, height: imageElement.naturalHeight});
        setStaticImageElement(imageElement); // Store image element in state
        setDebugInfo('Image loaded, detecting face...');
        try {
            if (faceLandmarker) {
                const results = faceLandmarker.detectForVideo(imageElement, performance.now());
                 console.log("StaticSelfieTryOn: Detection complete.", results);
                if (results?.faceLandmarks?.length > 0) { setDebugInfo(`Detection OK. ${results.faceLandmarks.length} face(s). L[0]: ${results.faceLandmarks[0]?.length}`); }
                else { setDebugInfo('Detection OK. No face found.'); }
                setDetectedSelfieResults(results); // Store results in state
            } else { setDebugInfo('Error: FaceLandmarker instance missing.'); }
        } catch(err) { setDebugInfo(`Detection Error: ${err.message}`); console.error("Detection Error:", err); }
        finally { setIsDetecting(false); } // Mark detection as finished
    } ;
    imageElement.onerror = () => { setDebugInfo('Error: Image load failed.'); setIsDetecting(false); setStaticImageElement(null); } ;
    imageElement.src = capturedSelfieDataUrl; // Start loading image

   }, [capturedSelfieDataUrl, faceLandmarker, isDetecting]); // Dependencies


   // --- Effect to Trigger Rendering (REMOVED - Handled by passing props) ---


  // Retake Selfie Callback
  const handleRetakeSelfie = () => {
    setIsPreviewing(true); // Go back to preview mode
    setCapturedSelfieDataUrl(null);
    setDetectedSelfieResults(null);
    setStaticImageElement(null);
    setCameraError(null);
    setIsCameraLoading(true); // Set loading for camera restart
    setIsDetecting(false);
    setDebugInfo('');
   };


  // --- JSX ---
  return (
    <div className="border p-4 rounded bg-green-50">
      <h2 className="text-xl font-semibold mb-2 text-center">Try On Selfie Mode</h2>
      {isPreviewing ? (
        /* Preview Mode JSX */
        <>
          {isCameraLoading && <p className="text-center py-4">Starting camera...</p>}
          {cameraError && <p className="text-red-500 text-center py-4">{cameraError}</p>}
          <div className="relative w-full max-w-md mx-auto aspect-[9/16] bg-gray-200 overflow-hidden rounded shadow">
             {/* Video element for preview */}
            <video
                ref={selfieVideoRef}
                autoPlay
                playsInline
                muted
                className={`absolute top-0 left-0 w-full h-full ${isCameraLoading || cameraError || !cameraStream ? 'opacity-0' : 'opacity-100'}`} // Hide until stream ready
                style={{ transform: 'scaleX(-1)', transition: 'opacity 0.3s', objectFit: 'cover' }}
            ></video>
            {/* Loading/Error overlay for preview video area */}
            {(isCameraLoading || cameraError) && (
                 <div className="absolute inset-0 flex items-center justify-center"><p className="text-gray-500 bg-white px-2 py-1 rounded shadow">{cameraError ? 'Error' : 'Loading...'}</p></div>
             )}
          </div>
          <div className="text-center mt-4">
             {/* Enable button only when stream is ready */}
            <button
                onClick={handleTakeSelfie}
                disabled={isCameraLoading || !!cameraError || !cameraStream}
                className="bg-indigo-500 text-white px-4 py-2 rounded hover:bg-indigo-600 disabled:bg-gray-400 disabled:cursor-not-allowed"
            >
                Take Selfie
            </button>
          </div>
        </>
      ) : (
        /* Captured Mode JSX */
        <>
          {/* Container for TryOnRenderer */}
          <div className="relative w-full max-w-md mx-auto bg-gray-200 overflow-hidden rounded shadow" style={{ paddingTop: `${selfieDimensions.height && selfieDimensions.width ? (selfieDimensions.height / selfieDimensions.width) * 100 : 75}%` }}>
            {/* Conditionally render TryOnRenderer */}
            {staticImageElement && selfieDimensions.width > 0 ? (
              <TryOnRenderer
                // No ref needed
                videoElement={null}
                imageElement={staticImageElement} // Pass the loaded image element
                mediaPipeResults={detectedSelfieResults}
                isStatic={true}
                brightness={FIXED_SELFIE_BRIGHTNESS} // Use fixed correction
                contrast={FIXED_SELFIE_CONTRAST}     // Use fixed correction
                effectIntensity={effectIntensity}
                className="absolute top-0 left-0 w-full h-full"
              />
            ) : (
              // Show loading while image loads or detection runs
              <div className="absolute inset-0 flex items-center justify-center">
                    <p className="text-gray-500">{isDetecting ? 'Analyzing...' : 'Loading Image...'}</p>
               </div>
            )}
          </div>
          {/* Debug Info Area */}
          <div className="mt-2 p-2 border bg-gray-100 text-xs overflow-auto max-h-20 max-w-md mx-auto rounded">
            <p className="font-semibold mb-1">Debug Info:</p>
            <pre className="whitespace-pre-wrap break-words">{debugInfo || 'N/A'}</pre>
          </div>
          {/* Retake Button */}
          <div className="text-center mt-4">
            <button onClick={handleRetakeSelfie} className="bg-gray-500 text-white px-4 py-2 rounded hover:bg-gray-600">
                Retake Selfie
            </button>
          </div>
        </>
      )}
      {/* Landmarker Loading Indicator */}
      {!faceLandmarker && <p className="text-red-500 mt-2 text-center">Initializing AI model...</p>}
    </div>
  );
}); // End of forwardRef

export default StaticSelfieTryOn; // Line 211