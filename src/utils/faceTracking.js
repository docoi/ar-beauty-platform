// src/utils/faceTracking.js

import {
  FilesetResolver,
  FaceLandmarker,
} from '@mediapipe/tasks-vision';

let faceLandmarker = null;
let canvas = null;

export async function loadFaceModel() {
  if (faceLandmarker) return;

  const vision = await FilesetResolver.forVisionTasks(
    'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision/wasm'
  );

  faceLandmarker = await FaceLandmarker.createFromOptions(vision, {
    baseOptions: {
      modelAssetPath: '/face_landmarker.task', // ✅ Served via /public
      delegate: 'GPU',
    },
    runningMode: 'VIDEO',
    numFaces: 1,
  });
}

export async function detectFacelandmarks(video) {
  if (!faceLandmarker) {
    throw new Error('FaceLandmarker not loaded. Call loadFaceModel() first.');
  }

  if (!canvas || canvas.width !== video.videoWidth || canvas.height !== video.videoHeight) {
    canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
  }

  const ctx = canvas.getContext('2d');
  ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

  const result = faceLandmarker.detectForVideo(canvas, performance.now());

  if (result && result.faceLandmarks && result.faceLandmarks.length > 0) {
    return result.faceLandmarks[0];
  }

  return null;
}
