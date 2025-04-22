import React, { useRef, useState, useEffect } from 'react';
import * as THREE from 'three';
// Don't import FaceMesh or Camera directly

const FaceEffect = ({ effectType }) => {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isCameraReady, setIsCameraReady] = useState(false);
  const [retryCount, setRetryCount] = useState(0);
  const maxRetries = 3;
  const [deviceInfo, setDeviceInfo] = useState('');
  
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

  // Get device information for better debugging
  useEffect(() => {
    try {
      const info = [
        `User Agent: ${navigator.userAgent}`,
        `Platform: ${navigator.platform}`,
        `Vendor: ${navigator.vendor}`,
        `Memory: ${navigator.deviceMemory ? navigator.deviceMemory + 'GB' : 'unknown'}`,
        `Cores: ${navigator.hardwareConcurrency || 'unknown'}`,
        `Screen: ${window.screen.width}x${window.screen.height}`,
        `Pixel Ratio: ${window.devicePixelRatio}`
      ].join(' | ');
      setDeviceInfo(info);
      console.log("Device Info:", info);
    } catch (e) {
      console.error("Error getting device info:", e);
      setDeviceInfo("Error getting device info");
    }
  }, []);

  useEffect(() => {
    let mounted = true;
    let retryTimeout = null;
    
    const getSupportedConstraints = () => {
      try {
        const supportedConstraints = navigator.mediaDevices.getSupportedConstraints();
        console.log("Supported constraints:", supportedConstraints);
        return supportedConstraints;
      } catch (e) {
        console.error("Error getting supported constraints:", e);
        return {};
      }
    };
    
    const enumerateDevices = async () => {
      try {
        const devices = await navigator.mediaDevices.enumerateDevices();
        const cameras = devices.filter(device => device.kind === 'videoinput');
        console.log("Available cameras:", cameras);
        return cameras;
      } catch (e) {
        console.error("Error enumerating devices:", e);
        return [];
      }
    };
    
    const initialize = async () => {
      if (!mounted) return;
      
      setError(null);
      setIsLoading(true);
      setIsCameraReady(false);

      try {
        // --- Get supported constraints and devices ---
        const supportedConstraints = getSupportedConstraints();
        const cameras = await enumerateDevices();
        
        // --- Load MediaPipe Scripts ---
        console.log("Loading MediaPipe scripts...");
        try {
          await loadScript('https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh@0.4.1633559619/face_mesh.js');
          await loadScript('https://cdn.jsdelivr.net/npm/@mediapipe/camera_utils@0.3.1620248243/camera_utils.js');
          console.log("MediaPipe scripts loaded successfully.");
        } catch (scriptError) {
          console.error("Failed to load MediaPipe scripts:", scriptError);
          throw new Error(`Failed to load required scripts: ${scriptError.message}`);
        }

        // Check if scripts actually added FaceMesh and Camera to window
        console.log("Checking window for FaceMesh:", window.FaceMesh ? "Found" : "Not Found");
        console.log("Checking window for Camera:", window.Camera ? "Found" : "Not Found");
        
        if (!window.FaceMesh || !window.Camera) {
          throw new Error("MediaPipe scripts loaded but FaceMesh or Camera not found on window object.");
        }

        // --- 1. Initialize FaceMesh Instance (using window) ---
        console.log("Initializing FaceMesh...");
        faceMeshRef.current = new window.FaceMesh({
          locateFile: (file) => {
            const url = `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh@0.4.1633559619/${file}`;
            console.log(`Requesting file from: ${url}`);
            return url;
          },
        });

        faceMeshRef.current.setOptions({
          maxNumFaces: 1,
          refineLandmarks: true,
          minDetectionConfidence: 0.5,
          minTrackingConfidence: 0.5,
        });

        faceMeshRef.current.onResults(onFaceMeshResults);
        console.log("FaceMesh initialized successfully.");

        // --- 2. Access Camera ---
        console.log("Checking camera support...");
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
          throw new Error("Camera access is not supported by this browser.");
        }

        // Release any existing camera stream before requesting a new one
        if (videoRef.current && videoRef.current.srcObject) {
          const oldStream = videoRef.current.srcObject;
          oldStream.getTracks().forEach(track => {
            console.log(`Stopping existing track: ${track.kind}`);
            track.stop();
          });
          videoRef.current.srcObject = null;
          console.log("Released previous camera stream");
        }

        // Samsung Browser specific handling - try multiple approaches
        console.log("Requesting camera stream with default constraints...");
        try {
          // Try approach 1: Minimal constraints (preferred for Samsung devices)
          console.log("Approach 1: Using minimal constraints");
          const stream = await navigator.mediaDevices.getUserMedia({
            video: true, // Just request any video
            audio: false,
          });
          
          console.log("Successfully acquired camera stream with minimal constraints.");
          
          if (!videoRef.current || !mounted) return;
          
          videoRef.current.srcObject = stream;
          console.log("Camera stream set to video element.");
          
          // --- 3. Set up event listeners for video element ---
          await new Promise((resolve) => {
            const onLoadedMetadata = () => {
              console.log("Video metadata loaded");
              videoRef.current.removeEventListener('loadedmetadata', onLoadedMetadata);
              resolve();
            };
            
            if (videoRef.current.readyState >= 2) {
              console.log("Video metadata already loaded (readyState >= 2)");
              resolve();
            } else {
              console.log("Waiting for video metadata to load...");
              videoRef.current.addEventListener('loadedmetadata', onLoadedMetadata);
            }
          });
          
          // --- 4. Explicitly play video ---
          try {
            console.log("Attempting to play video...");
            await videoRef.current.play();
            console.log("Video playing successfully!");
            
            if (!mounted) return;
            setIsCameraReady(true);
            
            // --- Set Canvas Dimensions to Match Video ---
            if (videoRef.current && canvasRef.current) {
              const videoWidth = videoRef.current.videoWidth;
              const videoHeight = videoRef.current.videoHeight;

              console.log(`Video dimensions reported as: ${videoWidth}x${videoHeight}`);
              
              if (videoWidth > 0 && videoHeight > 0) {
                canvasRef.current.width = videoWidth;
                canvasRef.current.height = videoHeight;
                console.log(`Canvas dimensions set to: ${canvasRef.current.width}x${canvasRef.current.height}`);
              } else {
                console.warn("Could not get valid video dimensions, using defaults.");
                canvasRef.current.width = 640;
                canvasRef.current.height = 480;
              }
            }
            
            // --- Initialize and start MediaPipe Camera Utility ---
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
                  width: canvasRef.current ? canvasRef.current.width : 640,
                  height: canvasRef.current ? canvasRef.current.height : 480,
                });
                
                cameraUtilRef.current.start();
                console.log("MediaPipe Camera Utility started successfully!");
                
                if (mounted) {
                  setIsLoading(false);
                  setRetryCount(0);
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
          
        } catch (mediaError) {
          console.error("ERROR: Failed with minimal constraints:", mediaError);
          
          // If minimal constraints failed, no need to try more specific ones
          if (mediaError.name === "NotReadableError" && retryCount < maxRetries) {
            const nextRetryCount = retryCount + 1;
            const delay = 1500 * nextRetryCount; // Increasing delay with each retry
            
            console.log(`Camera NotReadableError. Scheduling retry ${nextRetryCount}/${maxRetries} in ${delay}ms...`);
            setError(`Camera busy or unavailable. Retrying in ${Math.round(delay/1000)} seconds... (${nextRetryCount}/${maxRetries})`);
            
            if (mounted) {
              setRetryCount(nextRetryCount);
              retryTimeout = setTimeout(() => {
                if (mounted) {
                  console.log(`Executing retry attempt ${nextRetryCount}...`);
                  initialize();
                }
              }, delay);
            }
            return; // Exit without setting error since we're retrying
          }
          
          // Handle specific mobile camera errors
          if (mediaError.name === "NotReadableError") {
            throw new Error("Camera is already in use or has technical issues. Please close other apps that might be using your camera, restart your browser, and try again.");
          } else if (mediaError.name === "NotAllowedError") {
            throw new Error("Camera access was denied. Please grant camera permission in your browser settings and refresh the page.");
          } else {
            throw mediaError; // Rethrow for the outer catch block
          }
        }
        
      } catch (err) {
        console.error("ERROR during initialization:", err);
        
        if (err.name === "NotReadableError") {
          console.error("Specific NotReadableError detected. Camera might be in use or hardware issue.");
        }
        
        if (!mounted) return;
        
        let errorMessage = "Failed to initialize. Please check permissions and camera connection.";
        if (err.name === "NotFoundError" || err.name === "DevicesNotFoundError") {
          errorMessage = "No camera found. Please connect a camera.";
        } else if (err.name === "NotAllowedError" || err.name === "PermissionDeniedError") {
          errorMessage = "Camera permission denied. Please allow access in your browser settings.";
        } else if (err.name === "NotReadableError" || err.name === "TrackStartError") {
          errorMessage = "Camera is already in use by another application or cannot be accessed.";
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
      console.log("Cleanup: Stopping FaceEffect...");
      
      // Clear any pending retry
      if (retryTimeout) {
        clearTimeout(retryTimeout);
        console.log("Cleanup: Cleared pending retry timeout.");
      }
      
      // Stop MediaPipe Camera utility
      if (cameraUtilRef.current) {
        try {
          console.log("Cleanup: Stopping MediaPipe Camera Utility.");
          cameraUtilRef.current.stop();
        } catch (e) {
          console.error("Error stopping camera:", e);
        }
        cameraUtilRef.current = null;
      }
      
      // Close FaceMesh
      if (faceMeshRef.current) {
        console.log("Cleanup: Releasing FaceMesh reference.");
        faceMeshRef.current = null;
      }
      
      // Stop camera stream tracks
      if (videoRef.current && videoRef.current.srcObject) {
        try {
          console.log("Cleanup: Stopping camera stream tracks.");
          const stream = videoRef.current.srcObject;
          const tracks = stream.getTracks();
          tracks.forEach(track => {
            console.log(`Stopping track: ${track.kind}`);
            track.stop();
          });
          videoRef.current.srcObject = null;
        } catch (e) {
          console.error("Error stopping video tracks:", e);
        }
      }
      
      console.log("Cleanup: FaceEffect stopped completely.");
    };
  }, [effectType, retryCount, maxRetries, deviceInfo]); // Added deviceInfo

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

  const handleRetry = () => {
    setRetryCount(0);
    setError(null);
    setIsLoading(true);
  };

  return (
    <div className="relative flex flex-col items-center p-4 w-full">
      {deviceInfo && (
        <div className="text-xs text-gray-500 mb-2 w-full overflow-hidden whitespace-nowrap overflow-ellipsis">
          {deviceInfo}
        </div>
      )}
      
      <div className="relative w-full max-w-2xl mx-auto aspect-video">
        {/* Canvas for output rendering - width/height set dynamically */}
        <canvas
          ref={canvasRef}
          className="absolute top-0 left-0 w-full h-full rounded-lg shadow-md border border-gray-300 object-contain"
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
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-red-400 bg-opacity-80 rounded-lg p-4 z-10">
            <p className="text-white text-center font-semibold mb-4">{error}</p>
            
            {/* Retry Button */}
            {error.includes('NotReadableError') && retryCount >= maxRetries && (
              <button 
                onClick={handleRetry} 
                className="bg-white text-red-600 font-semibold py-2 px-4 rounded hover:bg-gray-100"
              >
                Try Again
              </button>
            )}
          </div>
        )}
      </div>
      
      {error && (
        <div className="mt-4 text-xs bg-yellow-100 p-2 rounded border border-yellow-300">
          <p className="font-semibold">Troubleshooting tips:</p>
          <ul className="list-disc pl-5 mt-1">
            <li>Close other apps that might be using your camera</li>
            <li>Check camera permissions in your browser and device settings</li>
            <li>Try refreshing the page</li>
            <li>Restart your browser</li>
            <li>Try using a different browser if available</li>
          </ul>
        </div>
      )}
    </div>
  );
};

export default FaceEffect;