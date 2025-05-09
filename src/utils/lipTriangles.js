// lipTriangles.js

// Based on MediaPipe FaceMesh keypoints
// Outer Lip: lipsUpperOuter + lipsLowerOuter
// Inner Lip: lipsUpperInner + lipsLowerInner

const lipTriangles = [
  // Outer lip triangles (lipsUpperOuter + lipsLowerOuter)
  [61, 185, 40], [40, 185, 39], [39, 185, 95], [95, 185, 88],
  [88, 178, 87], [87, 178, 14], [14, 178, 317], [317, 402, 87],
  [317, 324, 318], [318, 324, 308], [308, 324, 78], [78, 191, 80],
  [80, 191, 81], [81, 191, 82], [82, 191, 13], [13, 312, 82],
  [13, 82, 312], [312, 311, 268], [268, 311, 270], [270, 311, 269],

  // Inner lip triangles (lipsUpperInner + lipsLowerInner)
  [78, 95, 88], [88, 95, 61], [61, 40, 39], [39, 40, 37],
  [37, 40, 0], [0, 267, 269], [269, 267, 270], [270, 267, 409],
  [409, 267, 291], [291, 409, 270], [270, 409, 78]
];

export default lipTriangles;
