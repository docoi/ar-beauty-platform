// src/utils/faceTracking.js

export async function setupFaceLandmarker() {
  const { FaceLandmarker, FilesetResolver } = await import('@mediapipe/tasks-vision');
  const fileset = await FilesetResolver.forVisionTasks('/models');
  const landmarker = await FaceLandmarker.createFromOptions(fileset, {
    baseOptions: {
      modelAssetPath: '/models/face_landmarker.task',
      delegate: 'GPU',
    },
    outputFaceBlendshapes: false,
    outputFacialTransformationMatrixes: false,
    runningMode: 'VIDEO',
    numFaces: 1,
  });
  return landmarker;
}

// Accurate lip landmark indices based on MediaPipe's documentation
export const LIP_INDICES = [
  61, 146, 91, 181, 84, 17, 314, 405, 321, 375,
  291, 308, 324, 318, 402, 317, 14, 87, 178, 88,
  95, 78, 191, 80, 81, 82, 13, 312, 311, 310,
  415, 308
];

// Triangulation indices for the lips
export const LIP_TRIANGLES = [
  [0, 1, 2], [2, 3, 4], [4, 5, 6], [6, 7, 8],
  [8, 9, 10], [10, 11, 12], [12, 13, 14], [14, 15, 16],
  [16, 17, 18], [18, 19, 20], [20, 21, 22], [22, 23, 24],
  [24, 25, 26], [26, 27, 28], [28, 29, 30], [30, 31, 0]
];
