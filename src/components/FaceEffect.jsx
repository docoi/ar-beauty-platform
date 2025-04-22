import React, { useRef, useState, useEffect } from 'react';
import * as THREE from 'three';

const FaceEffect = ({ effectType }) => {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isCameraReady, setIsCameraReady] = useState(false);
  const [retryCount, setRetryCount] = useState(0);
  const [scriptStatus, setScriptStatus] = useState('');
  const maxRetries = 3;
  
  // Refs for MediaPipe objects
  const faceMeshRef = useRef(null);
  const cameraUtilRef = useRef(null);

  // Helper function to load scripts dynamically with fallbacks
  const loadScriptWithFallbacks = async (sources) => {
    let lastError = null;
    
    for (const src of sources) {
      try {
        setScriptStatus(`Loading: ${src.split('/').pop()}`);
        
        await new Promise((resolve, reject) => {
          const script = document.createElement('script');
          script.src = src;
          script.async = true;
          
          script.onload = () => {
            setScriptStatus(`Loaded: ${src.split('/').pop()}`);
            resolve();
          };
          
          script.onerror = (error) => {
            setScriptStatus(`Failed: ${src.split('/').pop()}`);
            reject(new Error(`Failed to load: ${src.split('/').pop()}`));
          };
          
          document.body.appendChild(script);
        });
        
        // If we reach here, script loaded successfully
        return;
      } catch (error) {
        lastError = error;
        // Continue to next fallback
      }
    }
    
    // If we get here, all fallbacks failed
    throw lastError || new Error("All script loading fallbacks failed");
  };

  // This function tries different approaches to get the camera working
  const tryGetUserMedia = async () => {
    const approaches = [
      // Approach 1: Basic, no constraints
      {
        name: "Basic",
        constraints: { video: true, audio: false }
      },
      // Approach 2: Explicitly set low resolution for Samsung
      {
        name: "Low resolution",
        constraints: { 
          video: { 
            width: { ideal: 320 }, 
            height: { ideal: 240 }
          }, 
          audio: false 
        }
      },
      // Approach 3: Try with Samsung-specific facingMode approach
      {
        name: "Explicit facing mode",
        constraints: { 
          video: { 
            facingMode: { exact: "user" }
          }, 
          audio: false 
        }
      },
      // Approach 4: Last resort - weird sizes that sometimes work on Samsung
      {
        name: "Unusual dimensions",
        constraints: { 
          video: { 
            width: { ideal: 352 }, 
            height: { ideal: 288 }
          }, 
          audio: false 
        }
      }
    ];
    
    let lastError = null;
    
    for (const approach of approaches) {
      try {
        console.log(`Trying camera approach: ${approach.name}`);
        setScriptStatus(`Camera attempt: ${approach.name}`);
        
        const stream = await navigator.mediaDevices.getUserMedia(approach.constraints);
        console.log(`Camera approach succeeded: ${approach.name}`);
        setScriptStatus(`Camera working: ${approach.name}`);
        
        return stream;
      } catch (error) {
        console.log(`Camera approach failed: ${approach.name}`, error);
        lastError = error;
        // Continue to next approach
      }
    }
    
    // All approaches failed
    throw lastError || new Error("All camera approaches failed");
  };

  useEffect(() => {
    let mounted = true;
    let retryTimeout = null;
    
    const initialize = async () => {
      if (!mounted) return;
      
      setError(null);
      setIsLoading(true);
      setIsCameraReady(false);

      try {
        // --- Load MediaPipe Scripts with Fallbacks ---
        console.log("Loading MediaPipe scripts...");
        
        try {
          await loadScriptWithFallbacks([
            'https://unpkg.com/@mediapipe/face_mesh',
            'https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/face_mesh.js'
          ]);
          
          await loadScriptWithFallbacks([
            'https://unpkg.com/@mediapipe/camera_utils',
            'https://cdn.jsdelivr.net/npm/@mediapipe/camera_utils/camera_utils.js'
          ]);
        } catch (scriptError) {
          throw new Error(`Failed to load required scripts: ${scriptError.message}`);
        }

        // Check if scripts added to window
        if (!window.FaceMesh || !window.Camera) {
          throw new Error("Scripts loaded but FaceMesh or Camera not found on window object.");
        }

        // --- Initialize FaceMesh Instance ---
        console.log("Initializing FaceMesh...");
        faceMeshRef.current = new window.FaceMesh({
          locateFile: (file) => `https://unpkg.com/@mediapipe/face_mesh/${file}`
        });

        faceMeshRef.current.setOptions({
          maxNumFaces: 1,
          refineLandmarks: true,
          minDetectionConfidence: 0.5,
          minTrackingConfidence: 0.5,
        });

        faceMeshRef.current.onResults(onFaceMeshResults);
        console.log("FaceMesh initialized.");

        // --- Try different camera approaches ---
        console.log("Checking camera support...");
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
          throw new Error("Camera API not supported in this browser.");
        }

        // Release any existing camera stream
        if (videoRef.current && videoRef.current.srcObject) {
          const oldStream = videoRef.current.srcObject;
          oldStream.getTracks().forEach(track => track.stop());
          videoRef.current.srcObject = null;
          console.log("Released previous camera stream");
        }

        // Try getting camera with fallbacks
        const stream = await tryGetUserMedia();
          
        if (!videoRef.current || !mounted) return;
        
        console.log("Setting stream to video element");
        videoRef.current.srcObject = stream;
        
        // Clear srcObject, remove all event listeners, then set it again (fixes some Samsung issues)
        const tempStream = stream;
        videoRef.current.srcObject = null;
        videoRef.current.srcObject = tempStream;
        
        // --- Wait for video metadata ---
        try {
          await new Promise((resolve, reject) => {
            const timeoutId = setTimeout(() => {
              reject(new Error("Video metadata loading timed out"));
            }, 5000);
            
            const onLoadedMetadata = () => {
              clearTimeout(timeoutId);
              videoRef.current.removeEventListener('loadedmetadata', onLoadedMetadata);
              resolve();
            };
            
            if (videoRef.current.readyState >= 2) {
              clearTimeout(timeoutId);
              resolve();
            } else {
              videoRef.current.addEventListener('loadedmetadata', onLoadedMetadata);
            }
          });
          
          // --- Play video --- use a user interaction simulation in Samsung browsers
          console.log("Attempting to play video...");
          
          // Create and dispatch a touch event to help with Samsung autoplay restrictions
          try {
            const touchEvent = new TouchEvent('touchstart', {
              bubbles: true,
              cancelable: true,
              view: window
            });
            document.body.dispatchEvent(touchEvent);
          } catch (e) {
            console.log("Touch event simulation failed, continuing anyway");
          }
          
          await videoRef.current.play();
          console.log("Video playing successfully!");
          
          if (!mounted) return;
          setIsCameraReady(true);
          
          // --- Set Canvas Dimensions ---
          if (videoRef.current && canvasRef.current) {
            const videoWidth = videoRef.current.videoWidth || 640;
            const videoHeight = videoRef.current.videoHeight || 480;
            
            canvasRef.current.width = videoWidth;
            canvasRef.current.height = videoHeight;
          }
          
          // --- Start MediaPipe Camera Utility ---
          setTimeout(() => {
            if (!mounted || !videoRef.current || !faceMeshRef.current || !window.Camera) {
              return;
            }
            
            console.log("Initializing Camera Utility...");
            try {
              // For Samsung, explicitly setting video dimensions again can help
              const vw = videoRef.current.videoWidth || 640;
              const vh = videoRef.current.videoHeight || 480;
              
              cameraUtilRef.current = new window.Camera(videoRef.current, {
                onFrame: async () => {
                  if (!videoRef.current || !faceMeshRef.current) return;
                  try {
                    await faceMeshRef.current.send({ image: videoRef.current });
                  } catch (sendError) {
                    // Just log, don't throw
                    console.error("Frame processing error:", sendError);
                  }
                },
                width: vw,
                height: vh,
              });
              
              cameraUtilRef.current.start();
              setScriptStatus("All systems operational");
              
              if (mounted) {
                setIsLoading(false);
                setRetryCount(0);
              }
            } catch (cameraError) {
              console.error("Error initializing Camera utility:", cameraError);
              throw cameraError;
            }
          }, 500);
          
        } catch (metadataError) {
          console.error("Error with video metadata or playback:", metadataError);
          throw metadataError;
        }
          
      } catch (err) {
        console.error("Initialization error:", err);
        
        if (!mounted) return;
        
        // For retry logic with NotReadableError
        if ((err.name === "NotReadableError" || 
             err.message.includes("Could not start video source")) && 
             retryCount < maxRetries) {
          const nextRetryCount = retryCount + 1;
          const delay = 2000 * nextRetryCount;
          
          console.log(`Scheduling retry ${nextRetryCount}/${maxRetries} in ${delay}ms...`);
          setError(`Camera busy. Retrying in ${Math.round(delay/1000)} sec (${nextRetryCount}/${maxRetries})`);
          
          if (mounted) {
            setRetryCount(nextRetryCount);
            retryTimeout = setTimeout(() => {
              if (mounted) {
                console.log(`Executing retry attempt ${nextRetryCount}...`);
                initialize();
              }
            }, delay);
          }
          return;
        }
        
        // Handle specific errors
        let errorMessage = "Camera initialization failed.";
        if (err.name === "NotFoundError") {
          errorMessage = "No camera found. Please check your device.";
        } else if (err.name === "NotAllowedError") {
          errorMessage = "Camera access denied. Please grant camera permission.";
        } else if (err.name === "NotReadableError") {
          errorMessage = "Camera is already in use by another app or tab.";
        } else if (err.message.includes("play")) {
          errorMessage = "Video autoplay blocked. Please adjust browser settings.";
        } else if (err.message.includes("script")) {
          errorMessage = "Failed to load resources. Please check your connection.";
        }
        
        setError(`${errorMessage} (${err.name})`);
        setScriptStatus("Error occurred");
        setIsLoading(false);
        setIsCameraReady(false);
      }
    };

    initialize();

    // Cleanup function
    return () => {
      mounted = false;
      
      if (retryTimeout) {
        clearTimeout(retryTimeout);
      }
      
      if (cameraUtilRef.current) {
        try {
          cameraUtilRef.current.stop();
        } catch (e) {
          console.error("Error stopping camera:", e);
        }
        cameraUtilRef.current = null;
      }
      
      if (faceMeshRef.current) {
        faceMeshRef.current = null;
      }
      
      if (videoRef.current && videoRef.current.srcObject) {
        try {
          const stream = videoRef.current.srcObject;
          const tracks = stream.getTracks();
          tracks.forEach(track => track.stop());
          videoRef.current.srcObject = null;
        } catch (e) {
          console.error("Error stopping video tracks:", e);
        }
      }
    };
  }, [effectType, retryCount, maxRetries]);

  // onResults Callback
  const onFaceMeshResults = (results) => {
    if (!canvasRef.current) return;
    
    const canvasCtx = canvasRef.current.getContext('2d');
    canvasCtx.save();
    canvasCtx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);

    if (results.image) {
      canvasCtx.drawImage(
        results.image, 
        0, 0, 
        canvasRef.current.width, 
        canvasRef.current.height
      );
    }

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

  // Helper function to draw face landmarks
  const drawLandmarks = (ctx, landmarks) => {
    ctx.fillStyle = '#00FF00';
    
    const keyPoints = [1, 33, 61, 199, 263, 291];
    
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
      {scriptStatus && (
        <div className="text-xs text-blue-600 mb-2">
          Status: {scriptStatus}
        </div>
      )}
      
      <div className="relative w-full max-w-2xl mx-auto aspect-video">
        <canvas
          ref={canvasRef}
          className="absolute top-0 left-0 w-full h-full rounded-lg shadow-md border border-gray-300 object-contain"
        />

        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className="absolute -z-10 w-px h-px top-0 left-0"
        />

        {isLoading && (
          <div className="absolute inset-0 flex items-center justify-center bg-gray-400 bg-opacity-60 rounded-lg z-10">
            <p className="text-white bg-black bg-opacity-70 px-4 py-2 rounded">Loading resources...</p>
          </div>
        )}

        {error && !isLoading && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-red-400 bg-opacity-80 rounded-lg p-4 z-10">
            <p className="text-white text-center font-semibold mb-4">{error}</p>
            
            <button 
              onClick={handleRetry} 
              className="bg-white text-red-600 font-semibold py-2 px-4 rounded hover:bg-gray-100"
            >
              Try Again
            </button>
          </div>
        )}
      </div>
      
      {error && (
        <div className="mt-4 text-xs bg-yellow-100 p-2 rounded border border-yellow-300">
          <p className="font-semibold">Troubleshooting tips:</p>
          <ul className="list-disc pl-5 mt-1">
            <li>Close other apps using the camera (like gallery, camera app, etc.)</li>
            <li>Check that camera permissions are granted (check both browser and system settings)</li>
            <li>Restart your browser</li>
            <li>Try using Chrome instead of Samsung Internet</li>
            <li>Try using desktop mode in your browser settings</li>
          </ul>
        </div>
      )}
    </div>
  );
};

export default FaceEffect;