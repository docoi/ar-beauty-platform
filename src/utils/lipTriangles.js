// src/utils/lipTriangles.js (New Curated Set - Aiming for ~30-40 triangles)

const lipTriangles = [
  // --- UPPER LIP VERMILION ---
  // Outer Upper Contour (approximate, using key points)
  // 61 (L corner), 185, 40, 39, 37, 0 (top mid), 267, 269, 270, 409, 291 (R corner)
  // Inner Upper Contour (approximate)
  // 78 (L inner corner), 191, 80, 81, 82, 13 (bottom mid), 312, 311, 310, 415, 308 (R inner corner)

  // Upper Lip Left Side (Screen Right for unmirrored video)
  [61, 185, 78], [185, 191, 78], // Commisure to inner
  [185, 40, 191], [40, 39, 191], // Outer edge to inner
  [39, 37, 80], [191, 80, 39],   // Outer edge to inner
  [37, 0, 80], [80, 81, 37],     // Top outer to inner

  // Upper Lip Right Side (Screen Left for unmirrored video)
  [291, 308, 78], [308, 415, 78], // Commisure to inner (using 78 as a central inner anchor)
  [291, 409, 308], [409, 270, 308], // Outer edge to inner
  [270, 269, 310], [308, 310, 270], // Outer edge to inner
  [269, 267, 311], [311, 310, 269], // Top outer to inner
  [0, 267, 311], [311, 312, 0],     // Top outer to inner using 0 and 13 (midline)
  [81, 82, 0], [82, 13, 0], // Connecting inner points to top midline (0)

  // --- LOWER LIP VERMILION ---
  // Outer Lower Contour
  // 61 (L corner), 146, 91, 181, 84, 17 (bottom mid), 314, 405, 321, 375, 291 (R corner)
  // Inner Lower Contour
  // 78 (L inner), 95, 88, 178, 87, 14 (top mid), 317, 402, 318, 324, 308 (R inner)

  // Lower Lip Left Side (Screen Right)
  [61, 146, 78], [146, 95, 78], // Commisure to inner/midline
  [146, 91, 95],
  [91, 181, 88], [95, 88, 91],
  [181, 84, 88], [88, 178, 181],
  [84, 17, 87], [178, 87, 84],

  // Lower Lip Right Side (Screen Left)
  [291, 308, 78], // Connects to inner midline (78)
  [291, 375, 308], [375, 321, 308],
  [321, 405, 324], [308, 324, 321],
  [405, 314, 318], [318, 324, 405],
  [314, 17, 318], [318, 402, 314],
  [17, 87, 317], [317, 402, 17], // Connecting to inner point 14 via 87,317
  [87, 14, 317], // part of inner contour

  // Ensure commissures are covered by connecting the fans if gaps appear
  // Example connecting outer points with inner points at corners
  [61, 78, 146], // Left Commissure area (top outer, top inner, bottom outer)
  [291, 78, 308], // Right Commissure area (using 78 as a shared inner point temporarily)
                 // A better commissure would use 308 and 415 for right upper inner,
                 // and 95, 88 for left lower inner, then bridge.
                 // For now, the fans should mostly meet.

  // Let's try ChatGPT's latest provided list again, as it was curated and intended to be complete,
  // but remove the one degenerate triangle: [78, 308, 308]
  // Also, remove triangles from "Commissures" section if they are duplicates of "Fill between" or "Outer"
  // This list comes from your input where ChatGPT said "✅ Triangulated Lip Mesh: lipTriangles.js"
  // This is the 25-triangle list (75 vertices).
  // We will use this list, as it was the one that produced the "solid yellow bar" before,
  // indicating it *does* fill. The goal now is to ensure no bar.
  // The prompt given to ChatGPT for *that* list specifically asked to avoid the bar.
];

// Using the list from ChatGPT's response you just gave me,
// which was in response to my prompt about fixing the bar.
const chatGptRefinedList = [
    // Upper lip fill (outer → inner contour (vermillion fill))
    [61, 146, 91], // This seems to connect upper-left-outer to lower-left-outer to lower-left-inner.
    [61, 91, 78],  // Connects to upper-left-inner.
    [78, 91, 80],  // From upper-left-inner, to lower-left-inner, to upper-mid-inner.
    [80, 81, 78],  // Upper-mid-inner triangle.
    [78, 81, 61],  // Closes a section on user's right side of upper lip (screen left).

    [61, 81, 82],  // Continuing user's right upper lip.
    [61, 82, 13],
    [61, 13, 312],
    [61, 312, 311],
    [61, 311, 310],
    [61, 310, 415],
    [61, 415, 308], // This completes a fan from 61 (user's right outer corner) around the upper lip.

    // Lower lip fill (outer → inner contour (vermillion fill))
    // This section looks like a fan from 84 (user's left outer mid-lower lip) around the lower lip.
    [84, 181, 91],
    [84, 91, 95],
    [95, 88, 84],
    [88, 178, 84],
    [178, 87, 84],
    [87, 14, 84],
    [14, 317, 84],
    [317, 402, 84],
    [402, 318, 84],
    [318, 324, 84],
    [324, 308, 84], 

    // Commissures — blend corners of mouth
    [78, 61, 84],   // Connects the 'anchor' of upper fan (61) with 'anchor' of lower fan (84) via an inner point (78)
    [84, 78, 95],   // Uses lower fan anchor (84), inner upper (78), and inner lower midline (95)
];
// This list has 12 (upper) + 11 (lower) + 2 (commissures) = 25 triangles.
// 25 triangles * 3 vertices/triangle = 75 vertices.

console.log(`[lipTriangles.js] Using ChatGPT's refined list. Triangle count: ${chatGptRefinedList.length}, Vertex count: ${chatGptRefinedList.length * 3}`);

export default chatGptRefinedList;