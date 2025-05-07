// src/utils/faceTracking.js
import * as tf from '@tensorflow/tfjs'; // ✅ This was missing
import '@tensorflow/tfjs-backend-webgl';
import * as faceLandmarksDetection from '@tensorflow-models/face-landmarks-detection';

export async function loadFaceModel() {
  await tf.setBackend('webgl');
  await tf.ready();

  const model = await faceLandmarksDetection.load(
    faceLandmarksDetection.SupportedModels.MediaPipeFaceMesh,
    {
      maxFaces: 1,
      refineLandmarks: true,
    }
  );

  return model;
}

export async function detectFaceLandmarks(model, videoElement) {
  const predictions = await model.estimateFaces({
    input: videoElement,
    returnTensors: false,
    flipHorizontal: true,
    predictIrises: false,
  });

  return predictions;
}
