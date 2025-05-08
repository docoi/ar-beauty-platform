// src/utils/faceTracking.js

import { FilesetResolver, FaceLandmarker, DrawingUtils } from '@mediapipe/tasks-vision';

let faceLandmarker = null;

export async function loadFaceModel() {
  if (faceLandmarker) return;

  const vision = await FilesetResolver.forVisionTasks(
    'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision/wasm'
  );

  faceLandmarker = await FaceLandmarker.createFromOptions(vision, {
    baseOptions: {
      modelAssetPath:
        'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision/face_landmarker.task',
    },
    outputFaceBlendshapes: false,
    runningMode: 'IMAGE',
    numFaces: 1,
  });
}

export async function detectFacelandmarks(videoElement) {
  if (!faceLandmarker) {
    throw new Error('Face model not loaded. Call loadFaceModel() first.');
  }

  const canvas = document.createElement('canvas');
  canvas.width = videoElement.videoWidth;
  canvas.height = videoElement.videoHeight;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(videoElement, 0, 0, canvas.width, canvas.height);

  const imageBitmap = await createImageBitmap(canvas);
  const result = faceLandmarker.detect(imageBitmap);

  if (result.faceLandmarks && result.faceLandmarks.length > 0) {
    return result.faceLandmarks[0];
  }

  return null;
}

export { DrawingUtils };
