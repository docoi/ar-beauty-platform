import { FaceMesh } from '@mediapipe/face_mesh';
import { Camera } from '@mediapipe/camera_utils';

export async function loadFaceModel() {
  return new FaceMesh({
    locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/${file}`,
  });
}

export async function detectFaceLandmarks(model, video) {
  return new Promise((resolve) => {
    model.setOptions({
      maxNumFaces: 1,
      refineLandmarks: true,
      minDetectionConfidence: 0.5,
      minTrackingConfidence: 0.5,
    });

    model.onResults((results) => {
      resolve(results.multiFaceLandmarks?.[0] || []);
    });

    const camera = new Camera(video, {
      onFrame: async () => {
        await model.send({ image: video });
      },
      width: 640,
      height: 480,
    });

    camera.start();
  });
}
