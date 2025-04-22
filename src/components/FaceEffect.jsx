import React, { useRef, useState, useEffect } from 'react';
import * as THREE from 'three';
// REMOVED:
// import { FaceMesh } from '@mediapipe/face_mesh';
// import { Camera } from '@mediapipe/camera_utils';

const FaceEffect = ({ effectType }) => {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isCameraReady, setIsCameraReady] = useState(false);
  
  // Refs for MediaPipe objects
  const faceMeshRef = useRef(null);
  const cameraUtilRef = useRef(null);

  // Helper function to load scripts dynamically
  const loadScript = (src) => {
    return new Promise((resolve, reject) => {
      console.log(`Loading script: ${src}`);
      const script = document.createElement('script');
      script.src = src;
      script.async = true;
      script.onload = () => {
        console.log(`Script loaded successfully: ${src}`);
        resolve();
      };
      script.onerror = (error) => {
        console.error(`Error loading script: ${src}`, error);
        reject(new Error(`Failed to load script: ${src}`));
      };
      document.body.appendChild(script);
    });
  };

  useEffect(() => {
    let mounted = true;
    
    const initialize = async () => {
      if (!mounted) return;
      
      setError(null);
      setIsLoading(true);
      setIsCameraReady(false);

      try {
        // --- Load MediaPipe Scripts ---
        console.log("Loading MediaPipe scripts...");
        await loadScript('https://unpkg.com/@mediapipe/face_mesh');
        await loadScript('https://unpkg.com/@mediapipe/camera_utils');
        console.log("MediaPipe scripts loaded.");

        // Check if scripts actually added FaceMesh and Camera to window
        if (!window.FaceMesh || !window.Camera) {
          throw new Error("MediaPipe scripts loaded but FaceMesh or Camera not found on window object.");
        }

        // --- 1. Initialize FaceMesh Instance (using window) ---
        console.log("Initializing FaceMesh...");
        faceMeshRef.current = new window.FaceMesh({
          locateFile: (file) => `https://unpkg.com/@mediapipe/face_mesh/${file}`,
        });

        faceMeshRef.current.setOptions({
          maxNumFaces: 1,
          refineLandmarks: true,
          minDetectionConfidence: 0.5,
          minTrackingConfidence: 0.5,
        });

        faceMeshRef.current.onResults(onFaceMeshResults);
        console.log("FaceMesh initialized.");

        // --- 2. Access Camera ---
        console.log("Accessing camera...");
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
          throw new Error("Camera access is not supported by this browser.");
        }

        console.log("Requesting camera with simple constraints...");
        const stream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: false,
        });
        console.log("Successfully acquired camera stream");

        if (!videoRef.current || !mounted) return;
        
        videoRef.current.srcObject = stream;
        console.log("Stream assigned to video element");
        
        // --- 3. Set up event listeners for video element ---
        // Wait for video metadata to load before attempting to play
        await new Promise((resolve) => {
          const onLoadedMetadata = () => {
            console.log("Video metadata loaded");
            videoRef.current.removeEventListener('loadedmetadata', onLoadedMetadata);
            resolve();
          };
          
          if (videoRef.current.readyState >= 2) {
            // Metadata already loaded
            console.log("Video metadata already loaded");
            resolve();
          } else {
            console.log("Waiting for video metadata...");
            videoRef.current.addEventListener('loadedmetadata', onLoadedMetadata);
          }
        });
        
        // --- 4. Explicitly play video ---
        try {
          console.log("Attempting to play video...");
          await videoRef.current.play();
          console.log("Video is playing successfully!");
          
          if (!mounted) return;
          setIsCameraReady(true);
          
          // --- 5. Initialize and start MediaPipe Camera Utility ---
          // Need to use setTimeout to ensure DOM is updated with isCameraReady state
          setTimeout(() => {
            if (!mounted || !videoRef.current || !faceMeshRef.current || !window.Camera) {
              console.error("Prerequisites not available for Camera initialization");
              return;
            }
            
            console.log("Initializing MediaPipe Camera Utility...");
            try {
              cameraUtilRef.current = new window.Camera(videoRef.current, {
                onFrame: async () => {
                  if (!videoRef.current || !faceMeshRef.current) return;
                  try {
                    await faceMeshRef.current.send({ image: videoRef.current });
                  } catch (sendError) {
                    console.error("Error sending frame to FaceMesh:", sendError);
                  }
                },
                width: 640,
                height: 480,
              });
              
              cameraUtilRef.current.start();
              console.log("MediaPipe Camera Utility started");
              
              if (mounted) {
                setIsLoading(false);
              }
            } catch (cameraError) {
              console.error("Error initializing Camera utility:", cameraError);
              throw cameraError;
            }
          }, 500); // Increased timeout to ensure everything is ready
          
        } catch (playError) {
          console.error("Error playing video:", playError);
          throw new Error(`Could not play video: ${playError.message}`);
        }
      } catch (err) {
        console.error("Error during initialization:", err);
        
        if (!mounted) return;
        
        let errorMessage = "Failed to initialize. Please check permissions and camera connection.";
        if (err.name === "NotFoundError" || err.name === "DevicesNotFoundError") {
          errorMessage = "No camera found. Please connect a camera.";
        } else if (err.name === "NotAllowedError" || err.name === "PermissionDeniedError") {
          errorMessage = "Camera permission denied. Please allow access in your browser settings.";
        } else if (err.name === "NotReadableError" || err.name === "TrackStartError") {
          errorMessage = "Camera is already in use by another application.";
        } else if (err.message.includes("play")) {
          errorMessage = "Could not play video. Please ensure autoplay is allowed or interact with the page first.";
        }
        
        // Append error details to the generic message for on-screen display
        const detailedErrorMessage = `${errorMessage} (Type: ${err.name}, Msg: ${err.message})`;
        setError(detailedErrorMessage);
        setIsLoading(false);
        setIsCameraReady(false);
      }
    };

    initialize();

    // Cleanup function
    return () => {
      mounted = false;
      console.log("Cleaning up FaceEffect...");
      
      // Stop MediaPipe Camera utility
      if (cameraUtilRef.current) {
        try {
          cameraUtilRef.current.stop();
        } catch (e) {
          console.error("Error stopping camera:", e);
        }
        cameraUtilRef.current = null;
        console.log("MediaPipe Camera Utility stopped.");
      }
      
      // Close FaceMesh
      if (faceMeshRef.current) {
        faceMeshRef.current = null;
      }
      
      // Stop camera stream tracks
      if (videoRef.current && videoRef.current.srcObject) {
        try {
          const stream = videoRef.current.srcObject;
          const tracks = stream.getTracks();
          tracks.forEach(track => track.stop());
          videoRef.current.srcObject = null;
          console.log("Camera stream stopped.");
        } catch (e) {
          console.error("Error stopping video tracks:", e);
        }
      }
    };
  }, [effectType]); // Re-initialize when effectType changes

  // --- Define the onResults Callback ---
  const onFaceMeshResults = (results) => {
    if (!canvasRef.current) return;
    
    const canvasCtx = canvasRef.current.getContext('2d');
    canvasCtx.save();
    canvasCtx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);

    // Draw video frame to canvas
    if (results.image) {
      canvasCtx.drawImage(
        results.image, 
        0, 0, 
        canvasRef.current.width, 
        canvasRef.current.height
      );
    }

    // Draw face landmarks if available
    if (results.multiFaceLandmarks && results.multiFaceLandmarks.length > 0) {
      const landmarks = results.multiFaceLandmarks[0];
      
      // Apply different effects based on effectType prop
      switch (effectType) {
        case 'landmarks':
          drawLandmarks(canvasCtx, landmarks);
          break;
        // Add more effect types here
        default:
          drawLandmarks(canvasCtx, landmarks);
      }
    }

    canvasCtx.restore();
  };

  // Helper function to draw face landmarks
  const drawLandmarks = (ctx, landmarks) => {
    // Simple drawing of key points
    ctx.fillStyle = '#00FF00';
    
    // Draw key facial landmarks (simplified)
    const keyPoints = [1, 33, 61, 199, 263, 291]; // Nose, chin, left eye, right eye, etc.
    
    for (const id of keyPoints) {
      const point = landmarks[id];
      ctx.beginPath();
      ctx.arc(
        point.x * canvasRef.current.width,
        point.y * canvasRef.current.height,
        3, 0, 2 * Math.PI
      );
      ctx.fill();
    }
  };

  return (
    <div className="relative flex flex-col items-center p-4 w-full">
      <div className="relative w-full max-w-2xl mx-auto aspect-video">
        {/* Canvas for output rendering - keep fixed dimensions */}
        <canvas
          ref={canvasRef}
          width="640"
          height="480"
          className="absolute top-0 left-0 w-full h-full rounded-lg shadow-md border border-gray-300"
        />

        {/* Video element - hidden, Camera utility uses it */}
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className="absolute -z-10 w-px h-px top-0 left-0"
        />

        {/* Loading Overlay */}
        {isLoading && (
          <div className="absolute inset-0 flex items-center justify-center bg-gray-400 bg-opacity-60 rounded-lg z-10">
            <p className="text-white bg-black bg-opacity-70 px-4 py-2 rounded">Loading resources...</p>
          </div>
        )}

        {/* Error Overlay */}
        {error && !isLoading && (
          <div className="absolute inset-0 flex items-center justify-center bg-red-400 bg-opacity-80 rounded-lg p-4 z-10">
            <p className="text-white text-center font-semibold">{error}</p>
          </div>
        )}
      </div>

      {error && (
        <button
          onClick={() => {
            setError(null);
            setIsLoading(true);
            initialize();
          }}
          className="mt-4 bg-blue-500 text-white font-semibold py-2 px-4 rounded"
        >
          Try Again
        </button>
      )}
    </div>
  );
};

export default FaceEffect;