// src/utils/faceTracking.js
import * as faceLandmarksDetection from '@tensorflow-models/face-landmarks-detection';
import '@tensorflow/tfjs-backend-webgl';

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
