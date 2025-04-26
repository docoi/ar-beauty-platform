// src/components/RealTimeMirror.jsx - Add setTimeout for renderResults Call

import React, { useRef, useEffect, useState, useCallback, forwardRef, useImperativeHandle } from 'react';
import TryOnRenderer from './TryOnRenderer'; // Using bare-minimum shader version

// ... (Keep forwardRef wrapper, state, refs, useEffect for ref sync, useImperativeHandle, useEffect for camera access) ...
const RealTimeMirror = forwardRef(({ faceLandmarker, effectIntensity }, ref) => {
    // ... state, refs ...
    const videoStreamRef = useRef(null);

    useEffect(() => { /* ... sync ref ... */ }, [videoStream]);
    useImperativeHandle(ref, () => ({ /* ... */ }));
    useEffect(() => { /* ... camera access ... */ }, [faceLandmarker]);


    const predictWebcam = useCallback(async () => {
        animationFrameRef.current = requestAnimationFrame(predictWebcam); // Schedule next frame first

        const checkTime = performance.now().toFixed(0);
        let ready = true;
        let reason = "";

        // Readiness checks (using videoStreamRef)
        if (!faceLandmarker) { ready = false; reason = "faceLandmarker missing"; }
        else if (!videoRef.current) { ready = false; reason = "videoRef missing"; }
        else if (videoRef.current.readyState < 2) { ready = false; reason = `videoRef not ready (${videoRef.current.readyState})`; }
        else if (!rendererRef.current) { ready = false; reason = "rendererRef missing"; }
        else if (!videoStreamRef.current) { ready = false; reason = "videoStream REF missing"; }

        if (!ready) {
            // console.log(`PredictWebcam [${checkTime}]: Skipping processing - ${reason}`); // Less noisy
            return; // Exit processing for this frame
        }

        // If ready, proceed
        const video = videoRef.current; // Capture video element reference
        const currentIntensity = effectIntensity; // Capture current intensity

        // Use setTimeout to potentially defer the detection and rendering slightly
        // Use try-finally to ensure rAF is scheduled even if detection fails
        setTimeout(async () => {
             const detectionTime = performance.now().toFixed(0);
             try {
                // console.log(`PredictWebcam [${detectionTime}]: Starting detection inside setTimeout`);
                 const results = faceLandmarker.detectForVideo(video, performance.now());

                 const currentRenderer = rendererRef.current;
                 // console.log(`PredictWebcam [${detectionTime}]: Checking Ref inside setTimeout. Ref exists? ${!!currentRenderer}`);

                 if (currentRenderer && typeof currentRenderer.renderResults === 'function') {
                    // console.log(`PredictWebcam [${detectionTime}]: Calling renderResults inside setTimeout`);
                     currentRenderer.renderResults(video, results, currentIntensity); // Use captured values
                 } else {
                     console.log(`PredictWebcam [${detectionTime}]: Error inside setTimeout - Skipping renderResults call (ref or method missing). Ref:`, currentRenderer);
                 }
             } catch (error) {
                 console.error(`PredictWebcam [${detectionTime}]: Error during detection/render call inside setTimeout:`, error);
             }
        }, 0); // setTimeout with 0 delay


    }, [faceLandmarker, effectIntensity]); // videoStream removed


    // --- Loop Stop Effect --- (Remains the same)
    useEffect(() => { /* ... */ }, [videoStream]);

    // --- JSX --- (Remains the same)
    return ( /* ... */ );
});

RealTimeMirror.displayName = 'RealTimeMirror';
export default RealTimeMirror;