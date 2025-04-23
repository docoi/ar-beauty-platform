import React, { useRef, useState, useEffect } from 'react';
import * as THREE from 'three';

const FaceEffect = ({ effectType }) => {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isCameraReady, setIsCameraReady] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [videoDimensions, setVideoDimensions] = useState({ width: 0, height: 0 });
  
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

  // Toggle fullscreen mode
  const toggleFullscreen = () => {
    setIsFullscreen(!isFullscreen);
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
        await new Promise((resolve) => {
          const onLoadedMetadata = () => {
            console.log("Video metadata loaded");
            
            // Get and store actual video dimensions
            if (videoRef.current) {
              const videoWidth = videoRef.current.videoWidth;
              const videoHeight = videoRef.current.videoHeight;
              console.log(`Actual video dimensions: ${videoWidth}x${videoHeight}`);
              
              // Set these dimensions for the canvas
              if (canvasRef.current) {
                canvasRef.current.width = videoWidth;
                canvasRef.current.height = videoHeight;
              }
              
              // Store for calculating aspect ratio
              setVideoDimensions({ width: videoWidth, height: videoHeight });
            }
            
            videoRef.current.removeEventListener('loadedmetadata', onLoadedMetadata);
            resolve();
          };
          
          if (videoRef.current.readyState >= 2) {
            console.log("Video metadata already loaded");
            onLoadedMetadata(); // Still call this to get dimensions
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
          setTimeout(() => {
            if (!mounted || !videoRef.current || !faceMeshRef.current || !window.Camera) {
              console.error("Prerequisites not available for Camera initialization");
              return;
            }
            
            console.log("Initializing MediaPipe Camera Utility...");
            try {
              // Use actual video dimensions from the camera
              const videoWidth = canvasRef.current ? canvasRef.current.width : 640;
              const videoHeight = canvasRef.current ? canvasRef.current.height : 480;
              
              cameraUtilRef.current = new window.Camera(videoRef.current, {
                onFrame: async () => {
                  if (!videoRef.current || !faceMeshRef.current) return;
                  try {
                    await faceMeshRef.current.send({ image: videoRef.current });
                  } catch (sendError) {
                    console.error("Error sending frame to FaceMesh:", sendError);
                  }
                },
                width: videoWidth,
                height: videoHeight,
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
          }, 500);
          
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
  }, [effectType]);

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
      
      switch (effectType) {
        case 'landmarks':
          drawLandmarks(canvasCtx, landmarks);
          break;
        default:
          drawLandmarks(canvasCtx, landmarks);
      }
    }

    canvasCtx.restore();
  };

  const drawLandmarks = (ctx, landmarks) => {
    ctx.fillStyle = '#00FF00';
    
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

  const handleRetry = () => {
    setError(null);
    setIsLoading(true);
    initialize();
  };

  // Calculate container aspect ratio based on actual video dimensions
  const getContainerStyles = () => {
    // Default to a sensible ratio if we don't have video dimensions yet
    let aspectRatio = 3/4; // Default to portrait orientation
    
    if (videoDimensions.width && videoDimensions.height) {
      // Use actual video dimensions to set aspect ratio
      aspectRatio = videoDimensions.height / videoDimensions.width;
    }
    
    return {
      position: isFullscreen ? 'fixed' : 'relative',
      top: isFullscreen ? 0 : 'auto',
      left: isFullscreen ? 0 : 'auto',
      right: isFullscreen ? 0 : 'auto',
      bottom: isFullscreen ? 0 : 'auto',
      width: isFullscreen ? '100%' : '100%',
      maxWidth: isFullscreen ? '100%' : '400px',
      height: isFullscreen ? '100%' : 'auto',
      margin: '0 auto',
      background: 'black',
      // Set aspect ratio based on actual camera dimensions
      aspectRatio: isFullscreen ? 'auto' : `${1}/${aspectRatio.toFixed(3)}`,
      zIndex: isFullscreen ? 9999 : 'auto',
      borderRadius: isFullscreen ? 0 : '8px',
      overflow: 'hidden',
      cursor: 'pointer'
    };
  };

  return (
    <div className="relative w-full flex justify-center">
      <div
        style={getContainerStyles()}
        onClick={toggleFullscreen}
      >
        {/* Canvas - dimensions now match the actual video stream */}
        <canvas
          ref={canvasRef}
          className="w-full h-full object-contain"
        />

        {/* Video element - hidden but needed for camera access */}
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className="absolute -z-10 w-0 h-0"
        />

        {/* Loading Overlay */}
        {isLoading && (
          <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-50 z-10">
            <p className="text-white px-4 py-2 rounded font-semibold">Loading camera...</p>
          </div>
        )}

        {/* Error Overlay */}
        {error && !isLoading && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-red-500 bg-opacity-75 p-4 z-10">
            <p className="text-white text-center font-semibold mb-4">{error}</p>
            
            <button
              onClick={(e) => {
                e.stopPropagation(); // Prevent toggleFullscreen from being called
                handleRetry();
              }}
              className="bg-white text-red-600 font-semibold py-2 px-4 rounded"
            >
              Try Again
            </button>
          </div>
        )}

        {/* Fullscreen indicator */}
        {!isLoading && !error && (
          <div className="absolute bottom-4 right-4 z-10">
            <div className="bg-black bg-opacity-50 px-3 py-1 rounded-full">
              <p className="text-sm text-white">
                {isFullscreen ? "Tap to exit fullscreen" : "Tap for fullscreen"}
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default FaceEffect;