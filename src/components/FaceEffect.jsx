import React, { useRef, useState, useEffect } from 'react';
import * as THREE from 'three';
import { FaceMesh } from '@mediapipe/face_mesh';
import { Camera } from '@mediapipe/camera_utils';

const FaceEffect = ({ effectType }) => {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const threeRef = useRef({
    renderer: null,
    scene: null,
    camera: null
  });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  
  // Placeholder for FaceMesh instance
  const faceMeshRef = useRef(null);
  // Track if face mesh is initialized
  const [faceMeshInitialized, setFaceMeshInitialized] = useState(false);
  // Track if a face is currently detected
  const [faceDetected, setFaceDetected] = useState(false);

  // Initialize Three.js
  useEffect(() => {
    if (!canvasRef.current) return;

    const initializeThreeJS = () => {
      // Get canvas dimensions
      const width = canvasRef.current.width;
      const height = canvasRef.current.height;

      // Create scene
      const scene = new THREE.Scene();
      
      // Create camera
      const camera = new THREE.PerspectiveCamera(75, width / height, 0.1, 1000);
      camera.position.z = 2;
      
      // Create renderer
      const renderer = new THREE.WebGLRenderer({
        canvas: canvasRef.current,
        alpha: true // Allow transparency
      });
      renderer.setSize(width, height);
      
      // Add some lighting
      const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
      scene.add(ambientLight);
      
      const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
      directionalLight.position.set(0, 1, 1);
      scene.add(directionalLight);
      
      // Store Three.js objects in ref
      threeRef.current = {
        renderer,
        scene,
        camera
      };
      
      // Initial render
      renderer.render(scene, camera);
      
      console.log("Three.js initialized");
    };
    
    initializeThreeJS();
    
    // Cleanup Three.js resources
    return () => {
      if (threeRef.current.renderer) {
        threeRef.current.renderer.dispose();
        const scene = threeRef.current.scene;
        if (scene) {
          // Dispose of all objects in the scene
          scene.traverse((object) => {
            if (object.geometry) object.geometry.dispose();
            if (object.material) {
              if (Array.isArray(object.material)) {
                object.material.forEach(material => material.dispose());
              } else {
                object.material.dispose();
              }
            }
          });
        }
      }
    };
  }, []);

  // Initialize camera and MediaPipe
  useEffect(() => {
    // --- START MODIFICATION AREA ---
    const initializeCamera = async () => {
      setError(null); // Clear previous errors
      setIsLoading(true); // Set loading state

      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
          setError("Camera access is not supported by this browser.");
          setIsLoading(false);
          return;
      }

      try {
          // Request camera stream
          const stream = await navigator.mediaDevices.getUserMedia({
              video: {
                  width: { ideal: 640 }, // Request a specific size
                  height: { ideal: 480 },
                  facingMode: 'user' // Prefer front camera
              },
              audio: false // We don't need audio
          });

          // Attach stream to video element
          if (videoRef.current) {
              videoRef.current.srcObject = stream;

              // Wait for the video metadata to load to get correct dimensions
              videoRef.current.onloadedmetadata = () => {
                  // Optional: Adjust canvas size based on video dimensions if needed
                  if (canvasRef.current && videoRef.current) {
                     canvasRef.current.width = videoRef.current.videoWidth;
                     canvasRef.current.height = videoRef.current.videoHeight;
                     
                     // Update Three.js renderer size
                     if (threeRef.current.renderer) {
                       threeRef.current.renderer.setSize(
                         videoRef.current.videoWidth,
                         videoRef.current.videoHeight
                       );
                     }
                     
                     // Update camera aspect ratio
                     if (threeRef.current.camera) {
                       threeRef.current.camera.aspect = 
                         videoRef.current.videoWidth / videoRef.current.videoHeight;
                       threeRef.current.camera.updateProjectionMatrix();
                     }
                  }
                  console.log("Camera stream started");
                  
                  // Initialize MediaPipe once video is ready
                  initializeMediaPipe();
              };
          } else {
             throw new Error("Video element ref not available.");
          }

      } catch (err) {
          console.error("Error accessing camera:", err);
          let errorMessage = "Failed to access camera. Please ensure permissions are granted.";
          if (err.name === "NotFoundError" || err.name === "DevicesNotFoundError") {
              errorMessage = "No camera found. Please connect a camera.";
          } else if (err.name === "NotAllowedError" || err.name === "PermissionDeniedError") {
              errorMessage = "Camera permission denied. Please allow access in your browser settings.";
          } else if (err.name === "NotReadableError" || err.name === "TrackStartError") {
               errorMessage = "Camera is already in use by another application.";
          }
          setError(errorMessage);
          setIsLoading(false);
      }
    };

    // Initialize MediaPipe FaceMesh
    const initializeMediaPipe = () => {
      // Create FaceMesh instance if not already created
      if (!faceMeshRef.current) {
        faceMeshRef.current = new FaceMesh({
          locateFile: (file) => {
            return `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/${file}`;
          }
        });
        
        // Configure FaceMesh
        faceMeshRef.current.setOptions({
          maxNumFaces: 1,
          refineLandmarks: true,
          minDetectionConfidence: 0.5,
          minTrackingConfidence: 0.5
        });
        
        // Set up the FaceMesh results callback
        faceMeshRef.current.onResults(onFaceMeshResults);
      }
      
      // Create Camera instance to feed frames to FaceMesh
      if (videoRef.current) {
        const camera = new Camera(videoRef.current, {
          onFrame: async () => {
            if (faceMeshRef.current && videoRef.current) {
              await faceMeshRef.current.send({ image: videoRef.current });
            }
          },
          width: videoRef.current.videoWidth,
          height: videoRef.current.videoHeight
        });
        
        // Start camera feed processing
        camera.start()
          .then(() => {
            console.log("MediaPipe Camera started");
            setFaceMeshInitialized(true);
            setIsLoading(false); // Everything is ready
          })
          .catch((err) => {
            console.error("Error starting MediaPipe Camera:", err);
            setError("Failed to initialize face tracking. Please refresh and try again.");
            setIsLoading(false);
          });
      }
    };

    // Process results from FaceMesh
    const onFaceMeshResults = (results) => {
      // Check if we have valid face landmarks
      if (results.multiFaceLandmarks && results.multiFaceLandmarks.length > 0) {
        setFaceDetected(true);
        
        // Get the first face detected
        const faceLandmarks = results.multiFaceLandmarks[0];
        
        // Here we'd use the landmarks to update the Three.js scene
        // For now we'll just log that we received landmarks
        console.log("Face detected with landmarks:", faceLandmarks.length);
        
        // Depending on the effectType, we would apply different effects
        // This will be implemented next
        
        // For hydration effect specifically
        if (effectType === "hydration") {
          applyHydrationEffect(faceLandmarks);
        }
        
        // Render the Three.js scene
        if (threeRef.current.renderer && threeRef.current.scene && threeRef.current.camera) {
          threeRef.current.renderer.render(
            threeRef.current.scene,
            threeRef.current.camera
          );
        }
      } else {
        // No face detected
        setFaceDetected(false);
      }
    };
    
    // Apply hydration effect based on face landmarks
    const applyHydrationEffect = (faceLandmarks) => {
      // This is a placeholder for the actual effect implementation
      // For now, we'll just add a simple mesh to represent where the effect would be
      
      // Example: Visualize the face mesh area
      // In a real implementation, this would be replaced with the actual effect visual
      
      // For simplicity, we're just ensuring the effect placeholder is visible
      if (threeRef.current.scene) {
        // Check if we already have a placeholder object
        let placeholderMesh = threeRef.current.scene.getObjectByName("hydration-effect-placeholder");
        
        if (!placeholderMesh) {
          // Create a simple sphere to represent the effect area
          const geometry = new THREE.SphereGeometry(0.5, 32, 32);
          const material = new THREE.MeshBasicMaterial({ 
            color: 0x00ffff, 
            opacity: 0.3,
            transparent: true
          });
          placeholderMesh = new THREE.Mesh(geometry, material);
          placeholderMesh.name = "hydration-effect-placeholder";
          threeRef.current.scene.add(placeholderMesh);
        }
        
        // In a real implementation, we would update the effect's position
        // based on the face landmarks
      }
    };

    initializeCamera();
    // --- END MODIFICATION AREA ---

    // Cleanup function
    return () => {
      console.log("Cleaning up FaceEffect: stopping camera stream.");
      if (videoRef.current && videoRef.current.srcObject) {
        const stream = videoRef.current.srcObject;
        const tracks = stream.getTracks();
        tracks.forEach(track => track.stop()); // Stop each track
        videoRef.current.srcObject = null; // Release the reference
      }
      
      // Cleanup MediaPipe if initialized
      if (faceMeshRef.current) {
        faceMeshRef.current.close();
        faceMeshRef.current = null;
      }
    };
  }, []); // Run only once on mount

  // Handle window resize
  useEffect(() => {
    const handleResize = () => {
      if (!canvasRef.current || !threeRef.current.renderer || !threeRef.current.camera) return;
      
      const width = canvasRef.current.clientWidth;
      const height = canvasRef.current.clientHeight;
      
      // Update canvas dimensions
      canvasRef.current.width = width;
      canvasRef.current.height = height;
      
      // Update camera aspect ratio
      threeRef.current.camera.aspect = width / height;
      threeRef.current.camera.updateProjectionMatrix();
      
      // Update renderer size
      threeRef.current.renderer.setSize(width, height);
    };
    
    window.addEventListener('resize', handleResize);
    
    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  return (
    <div className="relative flex flex-col items-center p-4">
      {/* Canvas should overlay the video or be the main view */}
      <canvas
        ref={canvasRef}
        width="640"
        height="480"
        className="w-full max-w-2xl mx-auto rounded-lg shadow-md border border-gray-300" // Added border for visibility
      />
      {/* Video element remains hidden or small */}
      <video
        ref={videoRef}
        autoPlay
        playsInline
        className="absolute -z-10 w-px h-px top-0 left-0" // Keep hidden
        // Or for debugging: className="absolute top-0 left-0 w-32 h-24 border border-red-500"
      />

      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-400 bg-opacity-50 rounded-lg">
          <p className="text-white bg-black bg-opacity-70 px-4 py-2 rounded">Loading camera...</p>
        </div>
      )}
      {error && (
        <div className="absolute inset-0 flex items-center justify-center bg-red-400 bg-opacity-75 rounded-lg p-4">
          <p className="text-white text-center font-semibold">{error}</p>
        </div>
      )}
      {faceMeshInitialized && !isLoading && !faceDetected && (
        <div className="absolute bottom-4 left-0 right-0 text-center">
          <p className="bg-yellow-500 bg-opacity-80 text-white inline-block px-4 py-2 rounded-full">
            No face detected. Please position your face in view of the camera.
          </p>
        </div>
      )}
    </div>
  );
};

export default FaceEffect;