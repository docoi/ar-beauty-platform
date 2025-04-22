// src/components/FaceEffect.jsx
import React, { useRef, useState, useEffect } from 'react';
import * as THREE from 'three';
import { FaceMesh } from '@mediapipe/face_mesh';
import { Camera } from '@mediapipe/camera_utils';

const FaceEffect = ({ effectType }) => {
  // Refs for DOM elements and Three.js objects
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const threeRef = useRef({
    renderer: null,
    scene: null,
    camera: null,
  });

  // State management
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  // Initialize face mesh, camera, and Three.js setup
  useEffect(() => {
    if (!videoRef.current || !canvasRef.current) return;

    const initializeEffect = async () => {
      try {
        // ----- MediaPipe FaceMesh Setup -----
        const faceMesh = new FaceMesh({
          locateFile: (file) => {
            return `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/${file}`;
          }
        });

        faceMesh.setOptions({
          maxNumFaces: 1,
          refineLandmarks: true,
          minDetectionConfidence: 0.5,
          minTrackingConfidence: 0.5
        });

        faceMesh.onResults(onFaceMeshResults);

        // ----- Camera Setup -----
        const camera = new Camera(videoRef.current, {
          onFrame: async () => {
            await faceMesh.send({ image: videoRef.current });
          },
          width: 640,
          height: 480
        });

        // ----- Three.js Setup -----
        // Canvas dimensions
        const width = canvasRef.current.width;
        const height = canvasRef.current.height;

        // Create scene
        const scene = new THREE.Scene();
        
        // Create camera
        const camera3D = new THREE.PerspectiveCamera(75, width / height, 0.1, 1000);
        camera3D.position.z = 2;
        
        // Create renderer
        const renderer = new THREE.WebGLRenderer({
          canvas: canvasRef.current,
          alpha: true
        });
        renderer.setSize(width, height);
        
        // Store Three.js objects in ref
        threeRef.current = {
          renderer,
          scene,
          camera: camera3D
        };

        // Add some ambient light
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
        scene.add(ambientLight);
        
        // Add directional light
        const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
        directionalLight.position.set(0, 1, 1);
        scene.add(directionalLight);

        // Start camera
        camera.start();
        
        // Set loading to false
        setIsLoading(false);
      } catch (err) {
        console.error("Error initializing face effect:", err);
        setError("Failed to initialize face effect. Please check your camera permissions.");
        setIsLoading(false);
      }
    };

    initializeEffect();

    // Cleanup function
    return () => {
      // Stop camera if it exists
      if (videoRef.current && videoRef.current.srcObject) {
        const tracks = videoRef.current.srcObject.getTracks();
        tracks.forEach(track => track.stop());
      }

      // Dispose Three.js resources
      if (threeRef.current.renderer) {
        threeRef.current.renderer.dispose();
      }
      
      // Clear any animation frames or timers here if needed
    };
  }, []);

  // Handle results from FaceMesh
  const onFaceMeshResults = (results) => {
    if (!results.multiFaceLandmarks || !threeRef.current.renderer) return;

    // Here you would:
    // 1. Process the face landmarks data from results.multiFaceLandmarks
    // 2. Update the Three.js scene based on landmarks
    // 3. Render the Three.js scene

    // For now, we'll just render the current scene
    const { renderer, scene, camera } = threeRef.current;
    renderer.render(scene, camera);
  };

  // Handle window resize
  useEffect(() => {
    const handleResize = () => {
      if (!canvasRef.current || !threeRef.current.renderer || !threeRef.current.camera) return;
      
      const width = canvasRef.current.clientWidth;
      const height = canvasRef.current.clientHeight;
      
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
    <div className="relative w-full max-w-2xl mx-auto">
      {/* Video element (hidden) */}
      <video 
        ref={videoRef}
        autoPlay
        playsInline
        className="absolute -z-10 w-px h-px opacity-0"
      />
      
      {/* Canvas for rendering */}
      <canvas
        ref={canvasRef}
        width={640}
        height={480}
        className="w-full max-w-2xl mx-auto rounded-lg shadow-md"
      />
      
      {/* Loading indicator */}
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-50 rounded-lg">
          <div className="text-white text-lg">
            Loading camera...
          </div>
        </div>
      )}
      
      {/* Error message */}
      {error && (
        <div className="absolute inset-0 flex items-center justify-center bg-red-500 bg-opacity-75 rounded-lg">
          <div className="text-white text-lg p-4 text-center">
            {error}
          </div>
        </div>
      )}
    </div>
  );
};

export default FaceEffect;