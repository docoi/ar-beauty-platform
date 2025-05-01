// src/components/RealTimeMirror.jsx - Start Polling Immediately

import React, { useRef, useEffect, useState, useCallback, forwardRef } from 'react';
import TryOnRenderer from './TryOnRenderer'; // The simplified WebGL base renderer

// Define which landmarks form the outer face contour. (Still needed for drawOverlay)
const FACE_OUTLINE_INDICES = [ 10, 338, 297, 332, 284, 251, 389, 356, 454, 323, 361, 288, 397, 365, 379, 378, 400, 377, 152, 148, 176, 149, 150, 136, 172, 58, 132, 93, 234, 127, 162, 21, 54, 103, 67, 109 ];

const RealTimeMirror = forwardRef(({
  faceLandmarker,
  imageSegmenter,
  effectIntensity
}, ref) => {
  const videoRef = useRef(null);
  const webglCanvasRef = useRef(null);
  const overlayCanvasRef = useRef(null);
  const animationFrameRef = useRef({ count: 0, rafId: null });
  const checkReadyRafRef = useRef(null); // Separate rAF ID for readiness check
  const [videoStream, setVideoStream] = useState(null);
  const [isCameraLoading, setIsCameraLoading] = useState(true);
  const [cameraError, setCameraError] = useState(null);
  const [videoDimensions, setVideoDimensions] = useState({ width: 0, height: 0 });
  // const videoReadyRef = useRef(false); // Not needed with polling state change

  // --- Canvas Drawing Function --- (No change needed here)
  const drawOverlay = useCallback((landmarks, segmentationMask) => { /* ... */ }, [effectIntensity, videoDimensions]);

  // --- Camera Access Effect (Start polling immediately) ---
  useEffect(() => {
    let isMounted = true;
    let stream = null;
    let checkReadyFrameId = null;
    console.log("RealTimeMirror: Camera useEffect - Mounting/Running (Immediate Polling).");

    // Polling function
    const checkVideoReady = () => {
        if (!isMounted || !videoRef.current) return;
        const video = videoRef.current;
        const readyState = video.readyState;
        const width = video.videoWidth;
        const height = video.videoHeight;
        const hasDimensions = width > 0 && height > 0;
        const isReady = readyState >= 2 && hasDimensions; // HAVE_CURRENT_DATA

        if (isReady) {
            console.log(`<<<< RealTimeMirror: Video Ready via Polling! State=${readyState}, Dims=${width}x${height} >>>>`);
            setVideoDimensions({ width, height });
            setIsCameraLoading(false); // Stop loading, trigger render
            setCameraError(null);
            // Stop polling once ready
            cancelAnimationFrame(checkReadyRafRef.current);
            checkReadyRafRef.current = null;
        } else {
            // Keep polling only if component still mounted
            if (isMounted) {
                checkReadyFrameId = requestAnimationFrame(checkVideoReady);
                checkReadyRafRef.current = checkReadyFrameId;
            }
        }
    };

    const enableStream = async () => {
        console.log("RealTimeMirror: enableStream called.");
        if (!faceLandmarker) { if (isMounted) { setCameraError("AI models initializing..."); setIsCameraLoading(false); } return; }
        if (!navigator.mediaDevices?.getUserMedia) { if (isMounted) { setCameraError("getUserMedia not supported."); setIsCameraLoading(false); } return; }

        console.log("RealTimeMirror: Setting camera STARTING state...");
        setIsCameraLoading(true); setCameraError(null); setVideoStream(null); setVideoDimensions({ width: 0, height: 0 });
        cancelAnimationFrame(checkReadyRafRef.current); // Cancel previous polling

        try {
            console.log("RealTimeMirror: Calling getUserMedia...");
            stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 720 } }, audio: false });
            console.log("RealTimeMirror: getUserMedia SUCCESS.");

            if (isMounted && videoRef.current) {
                console.log("RealTimeMirror: Assigning stream to video element.");
                videoRef.current.srcObject = stream;
                setVideoStream(stream);

                // Remove potentially problematic event listeners
                videoRef.current.onloadedmetadata = null; videoRef.current.onloadeddata = null; videoRef.current.oncanplay = null; videoRef.current.onplaying = null;
                videoRef.current.onerror = (e) => { if(isMounted) { console.error("Video Error:", e); setCameraError("Video element error."); setIsCameraLoading(false); cancelAnimationFrame(checkReadyRafRef.current); } };

                // --- Start polling IMMEDIATELY ---
                console.log("RealTimeMirror: Starting readiness polling...");
                checkReadyFrameId = requestAnimationFrame(checkVideoReady);
                checkReadyRafRef.current = checkReadyFrameId;
                // ----------------------------------

                 // Still try to play, but don't gate polling on its success
                 console.log("RealTimeMirror: Attempting videoRef.current.play()...");
                 videoRef.current.play().catch(err => {
                     console.warn("RealTimeMirror: video.play() failed (may be expected for hidden element):", err);
                     // Don't set error state here, rely on polling
                 });

            } else { stream?.getTracks().forEach(track => track.stop()); }
        } catch (err) { console.error("RealTimeMirror: enableStream Error:", err); if (isMounted) { /* ... error handling ... */ setCameraError("Failed to access camera."); setIsCameraLoading(false); } }
    };
    enableStream();

    // Cleanup
    return () => {
        isMounted = false; console.log("RealTimeMirror: Camera useEffect - Cleaning up.");
        cancelAnimationFrame(checkReadyRafRef.current); cancelAnimationFrame(animationFrameRef.current?.rafId);
        const currentStream = videoStream || stream; currentStream?.getTracks().forEach(track => track.stop());
        if (videoRef.current) { videoRef.current.onerror = null; videoRef.current.srcObject = null; }
        setVideoStream(null); setIsCameraLoading(true); setCameraError(null); setVideoDimensions({ width: 0, height: 0 });
    };
   }, [faceLandmarker]);


  // --- Prediction & Drawing Loop --- (No change needed here) ---
  const predictionDrawLoop = useCallback((landmarks, segmentationMask) => { /* ... drawOverlay logic ... */ }, [effectIntensity, videoDimensions]);
  // --- Effect to manage prediction/draw loop start/stop --- (No change needed here) ---
  useEffect(() => { /* ... start/stop predictionDrawLoop based on !isCameraLoading ... */ }, [videoStream, faceLandmarker, imageSegmenter, isCameraLoading, cameraError, predictionDrawLoop]);


  // --- Determine if renderer should be shown --- (No change needed here) ---
  const shouldRenderTryOn = !isCameraLoading && !cameraError;
  console.log("RealTimeMirror: Render() Check. isCameraLoading:", isCameraLoading, "cameraError:", cameraError, "shouldRenderTryOn:", shouldRenderTryOn);

  // --- JSX --- (No change needed here) ---
  return ( /* ... layered canvas JSX ... */ );
});
RealTimeMirror.displayName = 'RealTimeMirror';
export default RealTimeMirror;