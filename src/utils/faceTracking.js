// src/utils/faceTracking.js

import { FaceMesh } from '@mediapipe/face_mesh';
import { Camera } from '@mediapipe/camera_utils';

export async function loadFaceModel(videoElement) {
  const faceMesh = new FaceMesh({
    locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/${file}`,
  });

  faceMesh.setOptions({
    maxNumFaces: 1,
    refineLandmarks: true,
    minDetectionConfidence: 0.5,
    minTrackingConfidence: 0.5,
  });

  return { faceMesh, videoElement };
}

export async function detectFaceLandmarks({ faceMesh, videoElement }) {
  return new Promise((resolve) => {
    faceMesh.onResults((results) => {
      const landmarks = results.multiFaceLandmarks?.[0] || [];
      resolve(landmarks);
    });

    const camera = new Camera(videoElement, {
      onFrame: async () => {
        await faceMesh.send({ image: videoElement });
      },
      width: 640,
      height: 480,
    });

    camera.start();
  });
}
