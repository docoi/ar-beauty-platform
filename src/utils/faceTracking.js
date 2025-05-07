export async function loadFaceModel(videoElement, onResultsCallback) {
  const script = document.createElement('script');
  script.src = 'https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/face_mesh.js';
  script.async = true;

  await new Promise((resolve) => {
    script.onload = resolve;
    document.body.appendChild(script);
  });

  const faceMesh = new window.FaceMesh({
    locateFile: (file) =>
      `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/${file}`,
  });

  faceMesh.setOptions({
    maxNumFaces: 1,
    refineLandmarks: true,
    minDetectionConfidence: 0.5,
    minTrackingConfidence: 0.5,
  });

  faceMesh.onResults(onResultsCallback);

  return faceMesh;
}
