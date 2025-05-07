import * as faceLandmarksDetection from '@tensorflow-models/face-landmarks-detection';
import '@tensorflow/tfjs-backend-webgl';

let model;

export async function loadFaceModel() {
  await tf.setBackend('webgl');
  await tf.ready();
  model = await faceLandmarksDetection.load(
    faceLandmarksDetection.SupportedPackages.mediapipeFacemesh
  );
  return model;
}

export async function detectFaceLandmarks(video) {
  if (!model) {
    console.warn('Model not loaded yet.');
    return [];
  }
  const predictions = await model.estimateFaces({
    input: video,
    returnTensors: false,
    flipHorizontal: true,
    predictIrises: false,
  });

  return predictions;
}
