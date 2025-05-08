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

// Full triangulation for accurate lipstick shape
export const LIP_TRIANGLES = [
  [61, 185, 40], [40, 39, 37], [37, 0, 267], [267, 269, 270], [270, 409, 291],
  [375, 321, 405], [405, 314, 17], [17, 84, 181], [181, 91, 146], [146, 61, 185],
  [78, 95, 88], [178, 87, 14], [317, 402, 318], [324, 318, 308], [291, 308, 375]
];
