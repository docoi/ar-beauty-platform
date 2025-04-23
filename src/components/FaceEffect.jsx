import React, { useRef, useState, useEffect } from 'react';
import * as THREE from 'three'; // Keep THREE import even if unused for now

const FaceEffect = ({ effectType }) => {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isCameraReady, setIsCameraReady] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

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

  // --- Initialize function (KEEP AS IS - DO NOT MODIFY CAMERA SETTINGS) ---
  const initialize = async () => {
    let mounted = true; // Use a local mounted flag for this specific initialize call

    const cleanupLocal = () => {
      mounted = false;
      console.log("Cleanup called within initialize scope");
      // Stop camera stream tracks if they were started by *this* attempt
      if (videoRef.current && videoRef.current.srcObject) {
          const stream = videoRef.current.srcObject;
          // Check if tracks exist before trying to stop them
          if (stream && typeof stream.getTracks === 'function') {
              const tracks = stream.getTracks();
              tracks.forEach(track => {
                  if (track.readyState === 'live') { // Only stop live tracks
                      track.stop();
                  }
              });
              console.log("Local cleanup stopped tracks from this initialization attempt.");
          }
          // Only nullify srcObject if it belongs to this attempt,
          // difficult to guarantee, perhaps avoid nullifying here if retry is possible
          // videoRef.current.srcObject = null;
      }
      // Stop camera util if started by this attempt
      if (cameraUtilRef.current) {
          try {
              cameraUtilRef.current.stop();
              console.log("Local cleanup stopped Camera Utility from this initialization attempt.");
          } catch(e) { console.error("Error stopping camera util in local cleanup:", e); }
          cameraUtilRef.current = null; // Nullify ref if stopped
      }
      // We don't nullify faceMeshRef here, it's managed by useEffect cleanup
    };


    if (!mounted) return; // Check if component unmounted before async ops start

    setError(null);
    setIsLoading(true);
    setIsCameraReady(false);

    try {
      // --- Load MediaPipe Scripts ---
      console.log("Loading MediaPipe scripts...");
      // Ensure scripts aren't loaded multiple times if initialize is called again
      if (!window.FaceMesh) await loadScript('https://unpkg.com/@mediapipe/face_mesh');
      if (!window.Camera) await loadScript('https://unpkg.com/@mediapipe/camera_utils');
      console.log("MediaPipe scripts loaded.");

      if (!mounted) return cleanupLocal(); // Check after loading scripts

      if (!window.FaceMesh || !window.Camera) {
        throw new Error("MediaPipe scripts loaded but FaceMesh or Camera not found on window object.");
      }

      // --- 1. Initialize FaceMesh Instance (using window) ---
      console.log("Initializing FaceMesh...");
       // Only create a new instance if one doesn't exist or effectType changes require it
      if (!faceMeshRef.current) {
          faceMeshRef.current = new window.FaceMesh({
            locateFile: (file) => `https://unpkg.com/@mediapipe/face_mesh/${file}`,
          });

          faceMeshRef.current.setOptions({
            maxNumFaces: 1,
            refineLandmarks: true,
            minDetectionConfidence: 0.5,
            minTrackingConfidence: 0.5,
          });

          // Ensure onResults is only set once or is correctly updated if needed
          faceMeshRef.current.onResults(onFaceMeshResults);
          console.log("FaceMesh initialized.");
      } else {
         console.log("FaceMesh instance already exists.");
         // If options needed changing based on props, you'd do it here.
         // Re-attaching onResults might be needed if the component re-renders
         // causing the function reference to change, though useRef helps prevent this.
         faceMeshRef.current.onResults(onFaceMeshResults);
      }


      if (!mounted) return cleanupLocal(); // Check after FaceMesh init

      // --- 2. Access Camera ---
      console.log("Accessing camera...");
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error("Camera access is not supported by this browser.");
      }

      let stream = null;
      // Only get a new stream if the video element doesn't have one
      if (!videoRef.current || !videoRef.current.srcObject) {
          console.log("Requesting camera with simple constraints...");
          stream = await navigator.mediaDevices.getUserMedia({
            video: true, // KEEP width/height constraints OUT of here
            audio: false,
          });
          console.log("Successfully acquired camera stream");

          if (!mounted) {
              // Stop the newly acquired stream if component unmounted immediately
              if (stream) stream.getTracks().forEach(track => track.stop());
              return cleanupLocal();
          }

          if (!videoRef.current) {
              // If videoRef somehow became null after check, stop stream and exit
              if (stream) stream.getTracks().forEach(track => track.stop());
              console.error("Video element ref became null unexpectedly");
              return cleanupLocal();
          }

          videoRef.current.srcObject = stream;
          console.log("Stream assigned to video element");
      } else {
          console.log("Video element already has a stream.");
          stream = videoRef.current.srcObject; // Use existing stream
      }


      // --- 3. Set up event listeners for video element ---
      await new Promise((resolve, reject) => {
        if (!videoRef.current) {
            reject(new Error("Video ref missing before loadedmetadata listener"));
            return;
        }
        const videoElement = videoRef.current; // Capture ref value

        const onLoadedMetadata = () => {
          console.log("Video metadata loaded");
          videoElement.removeEventListener('loadedmetadata', onLoadedMetadata);
          videoElement.removeEventListener('error', onMetadataError); // Clean up error listener
          resolve();
        };
        const onMetadataError = (event) => {
            console.error("Error during video metadata loading:", event);
            videoElement.removeEventListener('loadedmetadata', onLoadedMetadata);
            videoElement.removeEventListener('error', onMetadataError);
            reject(new Error("Error loading video metadata."));
        };

        if (videoElement.readyState >= 2) { // HAVE_CURRENT_DATA or higher
          console.log("Video metadata already loaded");
          resolve();
        } else {
          console.log("Waiting for video metadata...");
          videoElement.addEventListener('loadedmetadata', onLoadedMetadata);
          videoElement.addEventListener('error', onMetadataError); // Add error listener
        }
      });

      if (!mounted) return cleanupLocal(); // Check after metadata wait

      // --- 4. Explicitly play video ---
      if (videoRef.current && videoRef.current.paused) { // Only play if paused
          try {
            console.log("Attempting to play video...");
            await videoRef.current.play();
            console.log("Video is playing successfully!");

             if (!mounted) return cleanupLocal(); // Check after play attempt
             setIsCameraReady(true); // Set ready state AFTER successful play

          } catch (playError) {
            console.error("Error playing video:", playError);
            throw new Error(`Could not play video: ${playError.message}`); // Rethrow to be caught below
          }
      } else if (videoRef.current && !videoRef.current.paused) {
          console.log("Video already playing.");
          if (!mounted) return cleanupLocal();
          setIsCameraReady(true); // Ensure ready state is true if already playing
      } else {
          // Handle case where videoRef is null here
          throw new Error("Video element not available to play.");
      }


      // --- 5. Initialize and start MediaPipe Camera Utility ---
      // Use setTimeout only if needed for timing, often better to proceed directly
      // setTimeout(() => {
        // Check prerequisites again right before initializing Camera
        if (!mounted || !videoRef.current || !faceMeshRef.current || !window.Camera || !videoRef.current.srcObject || videoRef.current.readyState < 2) {
          console.error("Prerequisites not met for Camera initialization just before starting.");
          // Consider throwing an error or specific handling
          if (!mounted) cleanupLocal(); // Clean up if unmounted during the short delay
          return; // Exit if prerequisites fail
        }

        console.log("Initializing MediaPipe Camera Utility...");
        try {
          // Stop existing camera util before creating a new one if necessary
          if (cameraUtilRef.current) {
            console.warn("Stopping existing Camera Utility instance before creating new one.");
            try {
                cameraUtilRef.current.stop();
            } catch(e){ console.error("Error stopping previous camera util:", e); }
          }

          // ** CRITICAL: DO NOT CHANGE width/height here **
          cameraUtilRef.current = new window.Camera(videoRef.current, {
            onFrame: async () => {
              // Add checks inside onFrame as well
              if (!videoRef.current || !faceMeshRef.current || !mounted) return;
              try {
                // Make sure video is ready before sending
                if (videoRef.current.readyState >= 2) { // HAVE_CURRENT_DATA or higher
                    await faceMeshRef.current.send({ image: videoRef.current });
                } else {
                    console.warn("Skipping frame send, video not ready.");
                }
              } catch (sendError) {
                console.error("Error sending frame to FaceMesh:", sendError);
                // Potentially stop camera or handle error further
              }
            },
            width: 640, // MUST NOT CHANGE
            height: 480, // MUST NOT CHANGE
          });

          await cameraUtilRef.current.start(); // Start is async, await it
          console.log("MediaPipe Camera Utility started");

          if (mounted) { // Final check before setting loading to false
            setIsLoading(false);
          } else {
              cleanupLocal(); // Clean up if unmounted just after start
          }

        } catch (cameraError) {
          console.error("Error initializing or starting Camera utility:", cameraError);
          throw cameraError; // Rethrow to be caught by outer try/catch
        }
      // }, 500); // Removed setTimeout unless proven necessary

    } catch (err) {
      console.error("Error during initialization:", err);
      cleanupLocal(); // Perform local cleanup on error

      if (!mounted) return; // Don't update state if unmounted

      let errorMessage = "Failed to initialize. Please check permissions and camera connection.";
       if (err.name === "NotFoundError" || err.name === "DevicesNotFoundError") {
          errorMessage = "No camera found. Please connect a camera.";
      } else if (err.name === "NotAllowedError" || err.name === "PermissionDeniedError") {
          errorMessage = "Camera permission denied. Please allow access in your browser settings.";
      } else if (err.name === "NotReadableError" || err.name === "TrackStartError") {
          errorMessage = "Camera is already in use or could not be started. Please ensure it's not used by another app/tab and try again.";
      } else if (err.message && err.message.includes("play")) {
          errorMessage = "Could not play video. Please ensure autoplay is allowed or interact with the page first.";
      } else if (err.message && err.message.includes("metadata")) {
          errorMessage = "Could not load video metadata. Please check camera connection.";
      } else if (err.message && err.message.includes("Camera not found on window")) {
          errorMessage = "Failed to load required libraries. Please check your internet connection.";
      } else if (err.message && err.message.includes("getUserMedia is not supported")) {
           errorMessage = "Camera access (getUserMedia) is not supported by this browser.";
      }


      // Append error details to the generic message for on-screen display
      const detailedErrorMessage = `${errorMessage} (Error: ${err.message})`;
      setError(detailedErrorMessage);
      setIsLoading(false);
      setIsCameraReady(false);
    }
    // Note: The main useEffect cleanup handles the rest when the component unmounts or effectType changes
  };


  useEffect(() => {
    let isComponentMounted = true; // Flag for the component lifecycle

    // Call initialize
    initialize();

    // Cleanup function for useEffect
    return () => {
      isComponentMounted = false; // Signal that the component is unmounting
      console.log("Cleaning up FaceEffect component (useEffect cleanup)...");

      // Stop MediaPipe Camera utility
      if (cameraUtilRef.current) {
        try {
          cameraUtilRef.current.stop(); // Ensure stop is called
          console.log("useEffect cleanup: MediaPipe Camera Utility stopped.");
        } catch (e) {
          console.error("useEffect cleanup: Error stopping camera:", e);
        }
        cameraUtilRef.current = null; // Clear the ref
      } else {
          console.log("useEffect cleanup: No Camera Utility ref to stop.");
      }

      // Close FaceMesh instance
      if (faceMeshRef.current) {
        try {
            // FaceMesh v0.4+ has a close() method
            if (typeof faceMeshRef.current.close === 'function') {
                faceMeshRef.current.close();
                console.log("useEffect cleanup: FaceMesh closed.");
            }
        } catch(e) {
            console.error("useEffect cleanup: Error closing FaceMesh:", e);
        }
        faceMeshRef.current = null; // Clear the ref
      } else {
          console.log("useEffect cleanup: No FaceMesh ref to close.");
      }

      // Stop camera stream tracks
      if (videoRef.current && videoRef.current.srcObject) {
        try {
          const stream = videoRef.current.srcObject;
          const tracks = stream.getTracks();
          tracks.forEach(track => track.stop());
          videoRef.current.srcObject = null; // Detach stream from video element
          console.log("useEffect cleanup: Camera stream stopped and detached.");
        } catch (e) {
          console.error("useEffect cleanup: Error stopping video tracks:", e);
        }
      } else {
           console.log("useEffect cleanup: No video stream srcObject to stop.");
      }

      // Optional: Remove dynamically added scripts if necessary, though often left
      // const scripts = document.querySelectorAll('script[src*="mediapipe"]');
      // scripts.forEach(s => document.body.removeChild(s));
      // console.log("useEffect cleanup: Removed MediaPipe scripts.");
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [effectType]); // Re-run effect if effectType changes

  const onFaceMeshResults = (results) => {
    // Ensure canvasRef and context are available
    if (!canvasRef.current) {
        console.warn("onFaceMeshResults: canvasRef is null.");
        return;
    }
    const canvasEl = canvasRef.current;
    const canvasCtx = canvasEl.getContext('2d');
    if (!canvasCtx) {
         console.warn("onFaceMeshResults: Failed to get 2D context.");
         return;
    }

    // Ensure results and image are valid
    if (!results || !results.image) {
       // console.warn("onFaceMeshResults: No results or image data received.");
       // Don't clear or draw if there's no new image, keep the last frame?
       // Or clear to show nothing? Let's clear for now.
       canvasCtx.clearRect(0, 0, canvasEl.width, canvasEl.height);
       return;
    }


    canvasCtx.save();
    canvasCtx.clearRect(0, 0, canvasEl.width, canvasEl.height);

    // Draw video frame to canvas (use the intrinsic size of the canvas)
    canvasCtx.drawImage(
      results.image,
      0, 0,
      canvasEl.width, // Draw onto the 640x480 drawing surface
      canvasEl.height
    );


    // Draw face landmarks if available
    if (results.multiFaceLandmarks && results.multiFaceLandmarks.length > 0) {
      const landmarks = results.multiFaceLandmarks[0]; // Assuming single face

      // Check if landmarks array exists and has elements
      if (landmarks && landmarks.length > 0) {
            switch (effectType) {
              case 'landmarks':
                drawLandmarks(canvasCtx, landmarks, canvasEl.width, canvasEl.height);
                break;
              // Add other effect types here
              // case 'someOtherEffect':
              //   drawOtherEffect(canvasCtx, landmarks, canvasEl.width, canvasEl.height);
              //   break;
              default:
                // Optionally draw landmarks by default or do nothing
                 drawLandmarks(canvasCtx, landmarks, canvasEl.width, canvasEl.height);
            }
       } else {
           // console.log("onFaceMeshResults: No landmarks found in results.multiFaceLandmarks[0]");
       }
    } else {
        // console.log("onFaceMeshResults: No multiFaceLandmarks data received.");
    }

    canvasCtx.restore();
  };

  // Pass canvas dimensions to drawing function
  const drawLandmarks = (ctx, landmarks, canvasWidth, canvasHeight) => {
    ctx.fillStyle = '#00FF00'; // Green dots

    // Example key points (adjust as needed)
    const keyPoints = [
        1,   // Nose tip
        152, // Chin
        226, // Left Outer Eye Corner
        446, // Right Outer Eye Corner
        58,  // Left Mouth Corner
        288, // Right Mouth Corner
        // Add more points if desired e.g., forehead, cheeks
        10, // Forehead approx center
        168, // Nose bridge center
    ];

    for (const id of keyPoints) {
        // Check if landmark index exists
        if (id < landmarks.length) {
            const point = landmarks[id];
            // Check if point coords exist
            if (point && typeof point.x === 'number' && typeof point.y === 'number') {
                ctx.beginPath();
                ctx.arc(
                  point.x * canvasWidth,  // Scale x to canvas width
                  point.y * canvasHeight, // Scale y to canvas height
                  5, // Make dots slightly larger
                  0, 2 * Math.PI
                );
                ctx.fill();
            } else {
                // console.warn(`Landmark ${id} has invalid coordinates.`);
            }
        } else {
           // console.warn(`Landmark index ${id} out of bounds (total: ${landmarks.length})`);
        }
    }
  };


  const handleRetry = () => {
    console.log("Retry button clicked");
    setError(null); // Clear error message
    setIsLoading(true); // Show loading indicator
    setIsCameraReady(false); // Reset camera ready state

    // Call initialize again.
    // initialize function should handle potential cleanup of previous failed attempts.
    initialize();
  };


  // --- JSX Structure ---
  return (
    <div className="relative w-full flex justify-center">
      {/* Outer container with responsive width */}
      <div
        className={`${isFullscreen ? 'fixed inset-0 z-50 bg-black flex items-center justify-center' : 'w-full max-w-md mx-auto'}`}
      >
        {/* Container defining the click area and aspect ratio box */}
        <div
          className="relative"
          style={{
            width: isFullscreen ? '100vw' : '100%',
            height: isFullscreen ? '100vh' : 'auto',
            // Use paddingBottom only when NOT fullscreen to maintain aspect ratio
            paddingBottom: isFullscreen ? '0' : '160%', // 10:16 aspect ratio (height is 160% of width)
            cursor: 'pointer',
            display: 'flex', // Needed for centering content when fullscreen
            alignItems: 'center', // Needed for centering content when fullscreen
            justifyContent: 'center' // Needed for centering content when fullscreen
          }}
          onClick={toggleFullscreen}
        >
          {/* This container holds the canvas and ensures it's centered and potentially overflows */}
          <div
            style={{
              position: isFullscreen ? 'relative' : 'absolute', // Allow relative positioning in fullscreen for flex centering
              top: isFullscreen ? 'auto' : 0,
              left: isFullscreen ? 'auto' : 0,
              right: isFullscreen ? 'auto' : 0,
              bottom: isFullscreen ? 'auto' : 0,
              width: '100%', // Take full width of parent
              height: '100%', // Take full height of parent
              overflow: 'hidden', // Hide parts of the canvas that extend beyond this box due to object-fit: cover
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: '#1a1a1a' // Darker background for letter/pillarboxing
            }}
          >
            {/* The canvas element: Maintains 640x480 drawing buffer. CSS controls display size & fit. */}
            {/* The canvas element: Maintains 640x480 drawing buffer. CSS controls display size & fit. */}
            <canvas
              ref={canvasRef}
              width="640" // Intrinsic width of the drawing buffer
              height="480" // Intrinsic height of the drawing buffer
              style={{
                display: 'block', // Prevent extra space below canvas
                // --- MODIFICATION START ---
                width: '100%',     // Make the canvas element try to fill the container width
                height: '100%',    // Make the canvas element try to fill the container height
                objectFit: 'contain', // Maintain 4:3 aspect ratio, FIT WITHIN container, add pillar/letterbox if needed
                // --- MODIFICATION END ---
              }}
            />
          </div>

          {/* Video element - hidden but needed for camera access and MediaPipe */}
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted // Muted is important for autoplay policies
            className="absolute -z-10" // Keep hidden
            style={{ // Explicitly hide fully
                width: '1px',
                height: '1px',
                top: '-10px',
                left: '-10px',
                opacity: 0,
                pointerEvents: 'none'
            }}
          />

          {/* Loading Overlay */}
          {isLoading && (
            <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-75 z-10 pointer-events-none">
              <p className="text-white text-lg px-4 py-2 rounded font-semibold">Loading Camera...</p>
              {/* Optional: Add a spinner here */}
            </div>
          )}

          {/* Error Overlay */}
          {error && !isLoading && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-red-900 bg-opacity-80 p-4 z-20 text-center">
              <p className="text-white font-semibold mb-4">{error}</p>
              <button
                onClick={(e) => {
                  e.stopPropagation(); // Prevent toggleFullscreen when clicking retry
                  handleRetry();
                }}
                className="bg-white text-red-700 font-bold py-2 px-6 rounded hover:bg-gray-200 transition duration-150 ease-in-out"
              >
                Try Again
              </button>
            </div>
          )}

          {/* Fullscreen toggle indicator (only show if not loading and no error) */}
          {!isLoading && !error && (
            <div
              className="absolute bottom-4 right-4 z-10 pointer-events-none" // pointer-events-none so it doesn't interfere with the main click area
            >
              <div className="bg-black bg-opacity-60 px-3 py-1 rounded-full shadow">
                <p className="text-sm text-white font-medium">
                  {isFullscreen ? "Tap to exit fullscreen" : "Tap for fullscreen"}
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );

};

export default FaceEffect;