import React, { useRef, useState, useEffect } from 'react';
import * as THREE from 'three';

const FaceEffect = ({ effectType }) => {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isCameraReady, setIsCameraReady] = useState(false);
  const [retryCount, setRetryCount] = useState(0);
  const maxRetries = 3;
  const [deviceInfo, setDeviceInfo] = useState('');
  const [scriptLoadingStatus, setScriptLoadingStatus] = useState('');
  
  // Refs for MediaPipe objects
  const faceMeshRef = useRef(null);
  const cameraUtilRef = useRef(null);

  // Helper function to load scripts dynamically with fallbacks
  const loadScriptWithFallbacks = async (sources) => {
    let lastError = null;
    
    for (const src of sources) {
      try {
        setScriptLoadingStatus(`Trying to load: ${src}`);
        console.log(`Attempting to load script: ${src}`);
        
        await new Promise((resolve, reject) => {
          const script = document.createElement('script');
          script.src = src;
          script.async = true;
          
          script.onload = () => {
            console.log(`✓ Script loaded successfully: ${src}`);
            setScriptLoadingStatus(`Loaded: ${src}`);
            resolve();
          };
          
          script.onerror = (error) => {
            console.error(`✗ Error loading script: ${src}`, error);
            setScriptLoadingStatus(`Failed: ${src}`);
            reject(new Error(`Failed to load script: ${src}`));
          };
          
          document.body.appendChild(script);
        });
        
        // If we reach here, script loaded successfully
        return;
      } catch (error) {
        console.log(`Failed loading ${src}, trying next fallback if available`);
        lastError = error;
        // Continue to next fallback
      }
    }
    
    // If we get here, all fallbacks failed
    throw lastError || new Error("All script loading fallbacks failed");
  };

  // Get device information for better debugging
  useEffect(() => {
    try {
      const info = `User Agent: ${navigator.userAgent.substring(0, 50)}...`;
      setDeviceInfo(info);
      console.log("Full Device Info:", navigator.userAgent);
    } catch (e) {
      console.error("Error getting device info:", e);
      setDeviceInfo("Error getting device info");
    }
  }, []);

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
            // Unpkg fallbacks
            'https://unpkg.com/@mediapipe/face_mesh',
            // Original jsdelivr fallbacks without specific versions
            'https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/face_mesh.js',
            // Local fallback if available (you'd need to host these files)
            '/scripts/face_mesh.js'
          ]);
          
          await loadScriptWithFallbacks([
            // Unpkg fallbacks
            'https://unpkg.com/@mediapipe/camera_utils',
            // Original jsdelivr fallbacks without specific versions
            'https://cdn.jsdelivr.net/npm/@mediapipe/camera_utils/camera_utils.js',
            // Local fallback if available
            '/scripts/camera_utils.js'
          ]);
          
          console.log("All MediaPipe scripts loaded successfully.");
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

        // --- Initialize FaceMesh Instance ---
        console.log("Initializing FaceMesh...");
        faceMeshRef.current = new window.FaceMesh({
          locateFile: (file) => {
            // Try multiple fallback locations
            const locations = [
              `https://unpkg.com/@mediapipe/face_mesh/${file}`,
              `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/${file}`,
              `/scripts/${file}`
            ];
            console.log(`Requesting file: ${file}, using: ${locations[0]}`);
            return locations[0]; // Use the first one - the instance will try others if this fails
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

        // --- Access Camera ---
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

        // Try with simplest constraints
        console.log("Requesting camera stream with simplest constraints...");
        try {
          const stream = await navigator.mediaDevices.getUserMedia({
            video: true, // Just request any video
            audio: false,
          });
          
          console.log("Successfully acquired camera stream.");
          
          if (!videoRef.current || !mounted) return;
          
          videoRef.current.srcObject = stream;
          console.log("Camera stream set to video element.");
          
          // --- Set up event listeners for video element ---
          await new Promise((resolve) => {
            const onLoadedMetadata = () => {
              console.log("Video metadata loaded");
              videoRef.current.removeEventListener('loadedmetadata', onLoadedMetadata);
              resolve();
            };
            
            if (videoRef.current.readyState >= 2) {
              console.log("Video metadata already loaded");
              resolve();
            } else {
              console.log("Waiting for video metadata...");
              videoRef.current.addEventListener('loadedmetadata', onLoadedMetadata);
            }
          });
          
          // --- Play video ---
          try {
            console.log("Attempting to play video...");
            await videoRef.current.play();
            console.log("Video playing successfully!");
            
            if (!mounted) return;
            setIsCameraReady(true);
            
            // --- Set Canvas Dimensions ---
            if (videoRef.current && canvasRef.current) {
              const videoWidth = videoRef.current.videoWidth;
              const videoHeight = videoRef.current.videoHeight;

              console.log(`Video dimensions: ${videoWidth}x${videoHeight}`);
              
              if (videoWidth > 0 && videoHeight > 0) {
                canvasRef.current.width = videoWidth;
                canvasRef.current.height = videoHeight;
                console.log(`Canvas dimensions set to: ${canvasRef.current.width}x${canvasRef.current.height}`);
              } else {
                console.warn("Using default canvas size");
                canvasRef.current.width = 640;
                canvasRef.current.height = 480;
              }
            }
            
            // --- Start MediaPipe Camera Utility ---
            setTimeout(() => {
              if (!mounted || !videoRef.current || !faceMeshRef.current || !window.Camera) {
                console.error("Prerequisites not available for Camera initialization");
                return;
              }
              
              console.log("Initializing Camera Utility...");
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
                console.log("Camera Utility started!");
                
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
          console.error("ERROR accessing camera:", mediaError);
          
          // For retry logic
          if (mediaError.name === "NotReadableError" && retryCount < maxRetries) {
            const nextRetryCount = retryCount + 1;
            const delay = 1500 * nextRetryCount;
            
            console.log(`Scheduling retry ${nextRetryCount}/${maxRetries} in ${delay}ms...`);
            setError(`Camera busy. Retrying in ${Math.round(delay/1000)} seconds... (${nextRetryCount}/${maxRetries})`);
            
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
          if (mediaError.name === "NotReadableError") {
            throw new Error("Camera is already in use or has technical issues. Please close other apps that might be using your camera.");
          } else if (mediaError.name === "NotAllowedError") {
            throw new Error("Camera permission denied. Please grant camera access.");
          } else {
            throw mediaError;
          }
        }
        
      } catch (err) {
        console.error("ERROR during initialization:", err);
        
        if (!mounted) return;
        
        let errorMessage = "Failed to initialize. Please check permissions and camera connection.";
        if (err.name === "NotFoundError") {
          errorMessage = "No camera found. Please connect a camera.";
        } else if (err.name === "NotAllowedError") {
          errorMessage = "Camera permission denied. Please allow access in your browser settings.";
        } else if (err.name === "NotReadableError") {
          errorMessage = "Camera is already in use by another application.";
        } else if (err.message.includes("play")) {
          errorMessage = "Could not play video. Please ensure autoplay is allowed.";
        } else if (err.message.includes("script")) {
          errorMessage = "Failed to load required scripts. Please check your internet connection.";
        }
        
        setError(`${errorMessage} (Type: ${err.name}, Msg: ${err.message})`);
        setIsLoading(false);
        setIsCameraReady(false);
      }
    };

    initialize();

    // Cleanup function
    return () => {
      mounted = false;
      console.log("Cleaning up...");
      
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
      {deviceInfo && (
        <div className="text-xs text-gray-500 mb-2 w-full overflow-hidden whitespace-nowrap overflow-ellipsis">
          {deviceInfo}
        </div>
      )}
      
      {scriptLoadingStatus && (
        <div className="text-xs text-blue-500 mb-2">
          {scriptLoadingStatus}
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