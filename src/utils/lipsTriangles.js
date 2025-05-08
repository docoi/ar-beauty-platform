// src/utils/lipsTriangles.js

// Lip landmark indexes from MediaPipe FaceMesh (76–95 inclusive)
export const LIP_INDICES = [
    61, 146, 91, 181, 84, 17, 314, 405, 321, 375, 291, 308,
    324, 318, 402, 317, 14, 87, 178, 88,
  ];
  
  // Triangles manually defined from the lip region above
  export const LIP_TRIANGLES = [
    [0, 1, 2],
    [2, 3, 4],
    [4, 5, 6],
    [6, 7, 8],
    [8, 9, 10],
    [10, 11, 0],
    [0, 2, 12],
    [2, 4, 13],
    [4, 6, 14],
    [6, 8, 15],
    [8, 10, 16],
    [10, 0, 17],
    [12, 13, 18],
    [13, 14, 18],
    [14, 15, 19],
    [15, 16, 19],
    [16, 17, 19],
  ];
  