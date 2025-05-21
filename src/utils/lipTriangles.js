// src/utils/lipTriangles.js (MANUALLY CURATED by AI for better shape and open mouth)

const lipTriangles = [
  // --- UPPER LIP ---
  // Outer Contour Points (approximate, from left commissure, over top, to right commissure)
  // L-R: 61, 185, 40, 39, 37, 0, 267, 269, 270, 409, 291
  // Inner Contour Points (approximate, from left inner commissure, along mouth line, to right inner commissure)
  // L-R: 78, 191, 80, 81, 82, 13, 312, 311, 310, 415, 308

  // Upper Lip Surface (strip triangulation between outer and inner contours)
  // Left side moving towards center
  [61, 185, 78],   [185, 191, 78],   // From outer corner (61) and next outer (185) to inner corner (78) and next inner (191)
  [185, 40, 191],  [40, 80, 191],    // This forms quads: 61-185-191-78, then 185-40-80-191
  [40, 39, 80],    [39, 81, 80],
  [39, 37, 81],    [37, 82, 81],
  [37, 0, 82],     [0, 13, 82],     // Midpoint top

  // Right side moving from center
  [0, 267, 13],    [267, 312, 13],
  [267, 269, 312], [269, 311, 312],
  [269, 270, 311], [270, 310, 311],
  [270, 409, 310], [409, 415, 310],
  [409, 291, 415], [291, 308, 415],   // To outer corner (291) and inner corner (308)

  // --- LOWER LIP ---
  // Outer Contour Points (approximate, from left commissure, along bottom, to right commissure)
  // L-R: 61, 146, 91, 181, 84, 17 (bottom mid), 314, 405, 321, 375, 291
  // Inner Contour Points (approximate, from left inner commissure, along mouth line, to right inner commissure)
  // L-R: 78, 95, 88, 178, 87, 14 (top mid), 317, 402, 318, 324, 308

  // Lower Lip Surface (strip triangulation)
  // Left side moving towards center
  [61, 78, 146],   [78, 95, 146],    // From outer corner (61) and inner (78) to next outer (146) and next inner (95)
  [146, 95, 91],   [95, 88, 91],
  [91, 88, 181],   [88, 178, 181],
  [181, 178, 84],  [178, 87, 84],
  [84, 87, 17],    [87, 14, 17],     // Midpoint bottom

  // Right side moving from center
  [17, 14, 314],    [14, 317, 314],
  [314, 317, 405],  [317, 402, 405],
  [405, 402, 321],  [402, 318, 321],
  [321, 318, 375],  [318, 324, 375],
  [375, 324, 291],  [324, 308, 291],   // To outer corner (291) and inner corner (308)

  // Connect commissures if needed (the strips should mostly meet)
  // The points 61 (outer left), 78 (inner left for upper), 
  // and 291 (outer right), 308 (inner right for upper) are key.
  // And 95 (inner left for lower), 324 (inner right for lower)
  // The strips above should connect 61 to 78 and 291 to 308 for upper,
  // and 61 to 78/95 and 291 to 308/324 for lower.
];
// Total: 20 (upper) + 20 (lower) = 40 triangles = 120 vertices.

console.log(`[lipTriangles.js] Using Manually Curated list. Triangle count: ${lipTriangles.length}, Vertex count: ${lipTriangles.length * 3}`);
export default lipTriangles;