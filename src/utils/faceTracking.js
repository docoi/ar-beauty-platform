// src/utils/faceTracking.js

import * as mpFaceMesh from '@mediapipe/face_mesh';
import { drawConnectors } from '@mediapipe/drawing_utils';
import { FACEMESH_LIPS } from '@mediapipe/face_mesh';

let faceMeshInstance = null;

export async function loadFaceModel() {
  if (faceMeshInstance) return;

  return new Promise((resolve) => {
    faceMeshInstance = new mpFaceMesh.FaceMesh({
      locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/${file}`,
    });

    faceMeshInstance.setOptions({
      maxNumFaces: 1,
      refineLandmarks: true,
      minDetectionConfidence: 0.5,
      minTrackingConfidence: 0.5,
    });

    faceMeshInstance.onResults(() => {
      resolve();
    });

    const img = new Image();
    img.src =
      'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wnmp3gAAAAASUVORK5CYII=';
    img.onload = () => {
      faceMeshInstance.send({ image: img });
    };
  });
}

export async function detectFacelandmarks(videoElement) {
  return new Promise((resolve, reject) => {
    if (!faceMeshInstance) {
      reject(new Error('FaceMesh not loaded. Call loadFaceModel() first.'));
      return;
    }

    faceMeshInstance.onResults((results) => {
      if (results.multiFaceLandmarks && results.multiFaceLandmarks.length > 0) {
        resolve(results.multiFaceLandmarks[0]);
      } else {
        resolve(null);
      }
    });

    faceMeshInstance.send({ image: videoElement }).catch((err) => {
      reject(err);
    });
  });
}

export { drawConnectors, FACEMESH_LIPS };
