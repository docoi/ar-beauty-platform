// src/utils/faceTracking.js
import * as tf from '@tensorflow/tfjs'; // ✅ Fixed: frontend-safe full tfjs bundle
import { load, SupportedModels } from '@tensorflow-models/face-landmarks-detection';

// Load face landmark model
export async function loadFaceModel() {
  await tf.setBackend('webgl');
  await tf.ready();
  return await load(SupportedModels.MediaPipeFaceMesh, {
    maxFaces: 1,
    refineLandmarks: true,
  });
}

// Detect landmarks from video input
export async function detectFaceLandmarks(model, video) {
  const predictions = await model.estimateFaces({
    input: video,
    returnTensors: false,
    flipHorizontal: true,
    predictIrises: true,
  });

  if (predictions.length > 0) {
    return predictions[0].annotations;
  }

  return null;
}
