// src/utils/faceTracking.js
import * as tf from '@tensorflow/tfjs'; // TensorFlow.js core
import '@tensorflow/tfjs-backend-webgl'; // WebGL backend
import * as faceLandmarksDetection from '@tensorflow-models/face-landmarks-detection';

export async function loadFaceModel() {
  await tf.setBackend('webgl');   // set backend before ready
  await tf.ready();               // ensure TensorFlow is ready

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
  if (!model || !videoElement) return [];

  const predictions = await model.estimateFaces({
    input: videoElement,
    returnTensors: false,
    flipHorizontal: true,
    predictIrises: false,
  });

  return predictions;
}
