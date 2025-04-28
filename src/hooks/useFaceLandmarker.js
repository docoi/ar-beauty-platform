// src/hooks/useFaceLandmarker.js - VIDEO mode, CPU Delegate, Simplified Options

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
        console.log("Fileset loaded. Creating FaceLandmarker with VIDEO mode, CPU delegate...");

        const landmarker = await FaceLandmarker.createFromOptions(vision, {
          baseOptions: {
            modelAssetPath: `https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task`,
            delegate: "CPU" // Keep CPU for stability check
          },
          // ***** Back to VIDEO mode *****
          runningMode: 'VIDEO',
          // ******************************
          outputSegmentationMasks: true, // Essential
          numFaces: 1
          // Keep blendshapes/matrices removed
        });

        console.log("FaceLandmarker created successfully (Using CPU Delegate, VIDEO Mode).");
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
      faceLandmarker?.close(); // Close needed for VIDEO mode
      setFaceLandmarker(null);
      console.log("FaceLandmarker instance closed and nullified.");
    };
  }, []); // Empty dependency array

  return { faceLandmarker, isLoading, error };
};

export default useFaceLandmarker;