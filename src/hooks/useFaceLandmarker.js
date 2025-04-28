// src/hooks/useFaceLandmarker.js - SWITCHED TO CPU DELEGATE FOR DEBUGGING

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
        console.log("Fileset loaded. Creating FaceLandmarker...");

        const landmarker = await FaceLandmarker.createFromOptions(vision, {
          baseOptions: {
            modelAssetPath: `https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task`,
            // ***** CHANGED DELEGATE TO CPU *****
            delegate: "CPU"
            // ***********************************
          },
          outputFaceBlendshapes: true,
          outputFacialTransformationMatrixes: true,
          outputSegmentationMasks: true, // Still request masks
          runningMode: 'VIDEO',
          numFaces: 1
        });

        console.log("FaceLandmarker created successfully (Using CPU Delegate)."); // Updated log
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
      // Simple cleanup for now
      setFaceLandmarker(null);
      console.log("FaceLandmarker instance nullified.");
    };
  }, []); // Empty dependency array ensures this runs only once

  return { faceLandmarker, isLoading, error };
};

export default useFaceLandmarker;