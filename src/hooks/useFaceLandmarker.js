import { useState, useEffect } from 'react';
import { FaceLandmarker, FilesetResolver } from "@mediapipe/tasks-vision";

const useFaceLandmarker = () => {
  const [faceLandmarker, setFaceLandmarker] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let isMounted = true; // Flag to prevent state updates on unmounted component

    const createFaceLandmarker = async () => {
      try {
        console.log("Loading Vision Task Fileset...");
        // Point FilesetResolver to the WASM files in your public/wasm directory
        const vision = await FilesetResolver.forVisionTasks(
          "/wasm" // Path relative to the public directory
        );
        console.log("Fileset loaded. Creating FaceLandmarker...");

        // Create the FaceLandmarker instance
        const landmarker = await FaceLandmarker.createFromOptions(vision, {
          baseOptions: {
            // Use the official model path (or download and host it yourself)
            modelAssetPath: `https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task`,
            delegate: "GPU" // Use GPU delegate for performance boost
          },
          outputFaceBlendshapes: true, // Needed for expression analysis (optional for now)
          outputFacialTransformationMatrixes: true, // Needed for mesh positioning (optional)
          outputSegmentationMasks: true, // CRUCIAL for applying effects to skin/lips
          runningMode: 'VIDEO', // Use VIDEO mode for both real-time and processing video/images frame-by-frame
          numFaces: 1 // Detect only one face
        });

        console.log("FaceLandmarker created successfully.");
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
      if (faceLandmarker) {
        // faceLandmarker.close(); // v0.10.0+ might have issues with close() in strict mode double-invokes
        // For now, just nullify the state, actual cleanup might depend on MediaPipe version nuances
        setFaceLandmarker(null);
        console.log("FaceLandmarker instance nullified.");
      }
    };
    // Intentionally leave dependency array empty to run only once on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { faceLandmarker, isLoading, error };
};

export default useFaceLandmarker;