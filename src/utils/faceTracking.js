import * as faceLandmarksDetection from '@tensorflow-models/face-landmarks-detection';
import '@tensorflow/tfjs-backend-webgl'; // or webgpu if supported
import '@tensorflow/tfjs-core';

let model;

export async function loadFaceModel() {
  if (!model) {
    model = await faceLandmarksDetection.load(
      faceLandmarksDetection.SupportedPackages.mediapipeFacemesh
    );
  }
  return model;
}

export async function detectFaceLandmarks(model, video) {
  if (!model || !video) return null;
  const predictions = await model.estimateFaces({ input: video });
  return predictions;
}
