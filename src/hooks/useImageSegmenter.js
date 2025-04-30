// src/hooks/useImageSegmenter.js - CORRECTED Model URL

import { useState, useEffect } from 'react';
import { ImageSegmenter, FilesetResolver } from "@mediapipe/tasks-vision";

const useImageSegmenter = () => {
  const [imageSegmenter, setImageSegmenter] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let isMounted = true;

    const createImageSegmenter = async () => {
      try {
        console.log("useImageSegmenter: Loading Vision Task Fileset...");
        const vision = await FilesetResolver.forVisionTasks("/wasm");
        console.log("useImageSegmenter: Fileset loaded. Creating ImageSegmenter...");

        // Configure ImageSegmenter for Selfie Segmentation
        const segmenter = await ImageSegmenter.createFromOptions(vision, {
          baseOptions: {
            // ***** CORRECTED Model URL *****
            modelAssetPath: 'https://storage.googleapis.com/mediapipe-models/image_segmenter/selfie_segmenter/float16/1/selfie_segmenter.tflite',
            delegate: "CPU" // Start with CPU
          },
          runningMode: 'VIDEO',
          outputConfidenceMasks: true // Request CONFIDENCE mask
        });

        console.log("useImageSegmenter: ImageSegmenter created successfully (CPU, Selfie Model).");
        if (isMounted) {
          setImageSegmenter(segmenter);
          setIsLoading(false);
        }

      } catch (err) {
        console.error("useImageSegmenter: Error initializing ImageSegmenter:", err);
        const errorMessage = err.message || String(err);
        if (isMounted) {
          setError(new Error(`Failed to initialize ImageSegmenter: ${errorMessage}`));
          setIsLoading(false);
        }
      }
    };

    createImageSegmenter();

    // Cleanup function
    return () => {
      isMounted = false;
      console.log("useImageSegmenter: Cleaning up ImageSegmenter...");
      imageSegmenter?.close();
      setImageSegmenter(null);
    };
  }, []); // Run once

  // Return the segmenter instance and its state
  return { imageSegmenter, isLoadingSegmenter: isLoading, segmenterError: error };
};

export default useImageSegmenter;