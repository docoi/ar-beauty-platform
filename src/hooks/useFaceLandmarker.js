// src/hooks/useFaceLandmarker.js - Landmarks AND Segmentation Masks Enabled

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
        console.log("useFaceLandmarker: Loading Vision Task Fileset...");
        const vision = await FilesetResolver.forVisionTasks("/wasm");
        console.log("useFaceLandmarker: Fileset loaded. Creating FaceLandmarker (Landmarks + Segmentation)...");

        const landmarker = await FaceLandmarker.createFromOptions(vision, {
          baseOptions: {
            modelAssetPath: `https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task`,
            delegate: "CPU" // Keep CPU for stability check
          },
          runningMode: 'VIDEO',
          outputFaceBlendshapes: false, // Keep false for now
          outputFacialTransformationMatrixes: false, // Keep false for now
          outputSegmentationMasks: true, // <<< ENABLED segmentation masks
          numFaces: 1
        });

        console.log("useFaceLandmarker: FaceLandmarker created successfully (CPU, Landmarks + Segmentation).");
        if (isMounted) {
          setFaceLandmarker(landmarker);
          setIsLoading(false);
        }

      } catch (err) {
        console.error("useFaceLandmarker: Error initializing FaceLandmarker:", err);
        if (isMounted) { setError(err); setIsLoading(false); }
      }
    };

    createFaceLandmarker();

    return () => {
      isMounted = false;
      console.log("useFaceLandmarker: Cleaning up FaceLandmarker...");
      faceLandmarker?.close();
      setFaceLandmarker(null);
    };
  }, []); // Run once

  return { faceLandmarker, isLoading, error }; // Return structure remains the same
};

export default useFaceLandmarker;