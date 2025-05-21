// src/utils/lipTriangles.js (Using a SIMPLE HARDCODED set for testing)

// These are landmark indices for a basic outline of outer lips
// (example, actual known good indices would be better)
// Using a subset of MediaPipe landmarks generally known to be on the lips
// Outer Upper Lip
const UL = [61, 185, 40, 39, 37, 0, 267, 269, 270, 409, 291];
// Outer Lower Lip
const LL = [291, 375, 321, 405, 314, 17, 84, 181, 91, 146, 61];

const simpleLipTriangles = [
  // Simple fan triangulation for upper lip (from point 61)
  [UL[0], UL[1], UL[2]], [UL[0], UL[2], UL[3]], [UL[0], UL[3], UL[4]],
  [UL[0], UL[4], UL[5]], [UL[0], UL[5], UL[6]], [UL[0], UL[6], UL[7]],
  [UL[0], UL[7], UL[8]], [UL[0], UL[8], UL[9]], [UL[0], UL[9], UL[10]],
  
  // Simple fan triangulation for lower lip (from point 291)
  [LL[0], LL[1], LL[2]], [LL[0], LL[2], LL[3]], [LL[0], LL[3], LL[4]],
  [LL[0], LL[4], LL[5]], [LL[0], LL[5], LL[6]], [LL[0], LL[6], LL[7]],
  [LL[0], LL[7], LL[8]], [LL[0], LL[8], LL[9]], [LL[0], LL[9], LL[10]],
];

// To make it a bit more filled, connect the two fans (very crudely)
// This is highly simplistic and just for testing visibility
simpleLipTriangles.push([UL[0], LL[10], LL[0]]); // Connect 61 to 61 (itself via LL) and 291
simpleLipTriangles.push([UL[10], LL[0], UL[0]]); // Connect 291 to 61 

// A slightly more robust small set for testing (12 triangles, 36 vertices)
// This attempts to create a filled mouth shape, but may not be perfect.
const testLipTriangles = [
  // Upper Lip
  [61, 185, 40], [61, 40, 39], [61, 39, 37], [61, 37, 0], [61, 0, 267],
  [61, 267, 269], [61, 269, 270], [61, 270, 409], [61, 409, 291],
  // Lower Lip
  [291, 375, 321], [291, 321, 405], [291, 405, 314], [291, 314, 17], [291, 17, 84],
  [291, 84, 181], [291, 181, 91], [291, 91, 146], [291, 146, 61] 
  // This is just an outer loop, not filled. We need to fill it.
];

// Let's use the very first simple set you had that produced *some* yellow shape,
// even if misaligned, just to confirm drawing.
// The set that produced "Drawing 39 lip vertices" in a previous successful tracking test
// had 13 triangles.
const previouslyWorkingShapeTriangles = [
    // Upper outer lip (example part)
    [61, 185, 40], [40, 39, 37], [37, 0, 267], [267, 269, 270],
    // Lower outer lip (example part)
    [61, 146, 91], [91, 181, 84], [84, 17, 314],
    // Connecting some points crudely
    [40, 78, 191], [191, 80, 40], // Some triangles involving inner points
    [78, 95, 88], [88, 178, 95],
    [13, 82, 81], [0, 13, 82] // Some more upper points
]; // This is 13 triangles = 39 vertices. This matches your old log.

console.log(`[lipTriangles.js] Using HARDCODED simple test triangles. Count: ${previouslyWorkingShapeTriangles.length}`);

export default previouslyWorkingShapeTriangles;