// src/hooks/useFaceLandmarker.js - Set runningMode to IMAGE for testing detect()

import { useState, useEffect } from 'react';
import { FaceLandmarker, FilesetResolver } from "@mediapipe/tasks-vision";

const useFaceLandmarker = () => {
  const [faceLandmarker, setFaceLandmarker] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let isMounted = true;

    const createFaceLandmarker = async () => {
      try {
        console.log("Loading Vision Task Fileset...");
        const vision = await FilesetResolver.forVisionTasks(
          "/wasm" // Path relative to the public directory
        );
        console.log("Fileset loaded. Creating FaceLandmarker with IMAGE mode...");

        const landmarker = await FaceLandmarker.createFromOptions(vision, {
          baseOptions: {
            modelAssetPath: `https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task`,
            delegate: "CPU"
          },
          // ***** CHANGED runningMode *****
          runningMode: 'IMAGE', // Use IMAGE mode for detect() method
          // ******************************
          outputSegmentationMasks: true, // Still request masks
          numFaces: 1
          // Keep blendshapes/matrices removed for simplicity
        });

        console.log("FaceLandmarker created successfully (Using CPU Delegate, IMAGE Mode).");
        if (isMounted) {
          setFaceLandmarker(landmarker);
          setIsLoading(false);
        }

      } catch (err) {
        console.error("Error initializing FaceLandmarker:", err);
        if (isMounted) {
          setError(err);
          setIsLoading(false);
        }
      }
    };

    createFaceLandmarker();

    // Cleanup function
    return () => {
      isMounted = false;
      console.log("Cleaning up FaceLandmarker hook...");
      faceLandmarker?.close(); // Close method recommended for IMAGE/VIDEO modes
      setFaceLandmarker(null);
      console.log("FaceLandmarker instance closed and nullified.");
    };
  }, []);

  return { faceLandmarker, isLoading, error };
};

export default useFaceLandmarker;