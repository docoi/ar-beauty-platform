// src/utils/lipsTriangles.js

// Accurate upper + lower lip indices from MediaPipe FaceMesh
export const LIP_INDICES = [
    61, 146, 91, 181, 84, 17, 314, 405, 321, 375,
    291, 308, 324, 318, 402, 317, 14, 87, 178, 88,
  ];
  
  // Manual triangulation between these lip indices
  export const LIP_TRIANGLES = [
    [0, 1, 2],
    [2, 3, 4],
    [4, 5, 6],
    [6, 7, 8],
    [8, 9, 10],
    [10, 11, 12],
    [12, 13, 14],
    [14, 15, 16],
    [16, 17, 18],
    [18, 19, 0],
    [0, 2, 18],
    [2, 4, 18],
    [4, 6, 18],
    [6, 8, 18],
    [8, 10, 18],
    [10, 12, 18],
    [12, 14, 18],
    [14, 16, 18],
    [16, 0, 18],
  ];
  