// src/hooks/useImageSegmenter.js - Hook for Selfie Segmentation

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
            // Model specifically trained for selfie segmentation
            modelAssetPath: 'https://storage.googleapis.com/mediapipe-models/image_segmenter/selfie_segmentation/float16/latest/selfie_segmentation.tflite',
            delegate: "CPU" // Start with CPU, can try GPU later if needed
          },
          runningMode: 'VIDEO', // Use VIDEO mode for frame-by-frame processing
          // *** Specify MASK output type ***
          outputCategoryMask: false, // We don't need category mask (hair, body, etc.)
          outputConfidenceMasks: true // <<< Request CONFIDENCE mask (more flexible)
          // Note: Output is usually Float32Array for CPU delegate
        });

        console.log("useImageSegmenter: ImageSegmenter created successfully (CPU, Selfie Model).");
        if (isMounted) {
          setImageSegmenter(segmenter);
          setIsLoading(false);
        }

      } catch (err) {
        console.error("useImageSegmenter: Error initializing ImageSegmenter:", err);
        if (isMounted) {
          setError(err);
          setIsLoading(false);
        }
      }
    };

    createImageSegmenter();

    // Cleanup function
    return () => {
      isMounted = false;
      console.log("useImageSegmenter: Cleaning up ImageSegmenter...");
      imageSegmenter?.close(); // Close the segmenter instance
      setImageSegmenter(null);
    };
  }, []); // Run once

  // Return the segmenter instance and its state
  return { imageSegmenter, isLoadingSegmenter: isLoading, segmenterError: error };
};

export default useImageSegmenter;