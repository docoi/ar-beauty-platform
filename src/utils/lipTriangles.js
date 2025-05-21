// src/utils/lipTriangles.js

const lipTriangles = [
  // Upper outer lip
  [61, 185, 40], [40, 39, 37], [37, 0, 267], [267, 269, 270], [270, 409, 415],
  [415, 310, 311], [311, 312, 13], [13, 82, 81], [81, 42, 183], [183, 78, 61],

  // Inner upper lip
  [78, 191, 80], [80, 81, 82], [82, 13, 312], [312, 311, 310], [310, 415, 308],

  // Outer lower lip
  [61, 146, 91], [91, 181, 84], [84, 17, 314], [314, 405, 321], [321, 375, 291],
  [291, 308, 324], [324, 318, 402], [402, 317, 14], [14, 87, 178], [178, 88, 95],
  [95, 185, 61], // closing outer loop

  // Inner lower lip (with the potentially degenerate triangle removed)
  [78, 95, 88], [95, 88, 178], [88, 178, 87], [178, 87, 14], [87, 14, 317],
  [14, 317, 402], [317, 402, 318], [402, 318, 324], [318, 324, 308],
  // [78, 308, 308], // Potentially degenerate - REMOVED/COMMENTED OUT

  // Fill between outer & inner lip contours (upper)
  [61, 78, 191], [191, 80, 81], [81, 82, 13], [13, 312, 311], [311, 310, 415],
  [415, 308, 78],

  // Fill between outer & inner lip contours (lower)
  [78, 95, 88], [88, 178, 87], [87, 14, 317], [317, 402, 318], [318, 324, 308],
  [308, 78, 95], // This was [308, 78, 95] from ChatGPT, let's check it.
                  // It connects 308 (inner lower left) to 78 (midline) and 95 (midline lower). This could be okay for closing.

  // Commissures (corners of the mouth) - from ChatGPT
  [61, 78, 95],   // This is identical to the last "fill lower" one, and part of "fill lower". Redundant?
  [84, 181, 91],  // This is part of "Outer lower lip"
  [314, 17, 84],  // Part of "Outer lower lip"
  [314, 405, 321], // Part of "Outer lower lip"
  [321, 375, 291], // Part of "Outer lower lip"
  [291, 308, 324], // Part of "Outer lower lip"
  [308, 415, 310], // Part of "Inner upper lip"
];
// It seems the "Commissures" section provided by ChatGPT mostly repeated existing triangles.
// The core "Outer" and "Inner" loops, plus the "Fill between" sections, are the most important.
// Let's try with the list as given by ChatGPT, MINUS the single [78, 308, 308] and relying on its "Fill" sections.

// Reconstructing clean list based on ChatGPT's sections, minus [78,308,308] and avoiding clear repeats from commissures:
const refinedLipTriangles = [
    // Upper outer lip
    [61, 185, 40],[40, 39, 37],[37, 0, 267],[267, 269, 270],[270, 409, 415],[415, 310, 311],[311, 312, 13],[13, 82, 81],[81, 42, 183],[183, 78, 61],
    // Inner upper lip
    [78, 191, 80],[80, 81, 82],[82, 13, 312],[312, 311, 310],[310, 415, 308], // Original end of ChatGPT's inner upper
    // Fill between outer & inner lip contours (upper) - from ChatGPT
    [61, 78, 191], // Connects outer 61 to inner 78, 191
    // [191, 80, 81], // This is already in Inner Upper. We need to connect outer points to these inner points.
    // [81, 82, 13],   // Already in Inner Upper
    // [13, 312, 311], // Already in Inner Upper
    // [311, 310, 415],// Already in Inner Upper
    [415, 308, 78], // Connects inner 415, 308 back to inner 78. This closes the inner loop nicely.
    // Now connect outer upper to inner upper
    [185,40,191],[40,39,191],[39,37,80],[37,0,80],[0,267,81],[267,269,81],[269,270,82],[270,409,82],[409,415,13],[415,310,13],[310,311,312],[311,13,312], // Rough fill upper

    // Outer lower lip
    [61, 146, 91],[91, 181, 84],[84, 17, 314],[314, 405, 321],[321, 375, 291],[291, 308, 324],[324, 318, 402],[402, 317, 14],[14, 87, 178],[178, 88, 95],[95, 185, 61],
    // Inner lower lip
    [78, 95, 88],[88, 178, 87],[87, 14, 317],[317, 402, 318],[318, 324, 308], // Original ChatGPT list, minus the bad triangle
    // Fill between outer & inner lip contours (lower) - from ChatGPT
    // [308, 78, 95], // This one seems good to connect inner lower back to midline
    // Let's add it if not already creating issues.
    [308, 78, 95], // Connects inner 308 back to 78 and 95 (midline)
    // Now connect outer lower to inner lower
    [146,91,95],[91,181,88],[181,84,88],[84,17,87],[17,314,87],[314,405,14],[405,321,14],[321,375,317],[375,291,317],[291,308,402],[308,324,402],[324,318,402], // Rough fill lower

];
// The list above tries to combine ChatGPT's outer/inner with some fill logic.
// It might be too complex and still have issues.

// FOR SIMPLICITY AND TO TEST CHATGPT's EXACT LIST (minus the one degenerate triangle):
const chatGPTsListMinusOne = [
    // Upper outer lip
    [61, 185, 40],[40, 39, 37],[37, 0, 267],[267, 269, 270],[270, 409, 415],[415, 310, 311],[311, 312, 13],[13, 82, 81],[81, 42, 183],[183, 78, 61],
    // Inner upper lip
    [78, 191, 80],[80, 81, 82],[82, 13, 312],[312, 311, 310],[310, 415, 308],
    // Outer lower lip
    [61, 146, 91],[91, 181, 84],[84, 17, 314],[314, 405, 321],[321, 375, 291],[291, 308, 324],[324, 318, 402],[402, 317, 14],[14, 87, 178],[178, 88, 95],[95, 185, 61],
    // Inner lower lip (original from ChatGPT, minus the bad one)
    [78, 95, 88],[95, 88, 178],[88, 178, 87],[178, 87, 14],[87, 14, 317],[14, 317, 402],[317, 402, 318],[402, 318, 324],[318, 324, 308],
    // Fill between outer & inner lip contours (upper) - from ChatGPT
    [61, 78, 191],[191, 80, 81],[81, 82, 13],[13, 312, 311],[311, 310, 415],[415, 308, 78],
    // Fill between outer & inner lip contours (lower) - from ChatGPT
    [78, 95, 88],[88, 178, 87],[87, 14, 317],[317, 402, 318],[318, 324, 308],[308, 78, 95],
    // Commissures (mouth corners) - from ChatGPT (these are likely redundant or part of above)
    // [61, 78, 95], // Already in "Fill between lower"
    // [84, 181, 91], // Already in "Outer lower"
    // [314, 17, 84], // Already in "Outer lower"
    // [314, 405, 321], // Already in "Outer lower"
    // [321, 375, 291], // Already in "Outer lower"
    // [291, 308, 324], // Already in "Outer lower"
    // [308, 415, 310], // Already in "Inner upper"
];
// Let's count unique triangles from ChatGPT's list sections more carefully.
// Upper Outer: 10
// Inner Upper: 5
// Outer Lower: 11
// Inner Lower (minus bad one): 9
// Fill Upper: 6
// Fill Lower: 6
// Total = 10 + 5 + 11 + 9 + 6 + 6 = 47 distinct triangles (if "Fill" sections don't overlap too much with "Inner")
// 47 triangles * 3 = 141 vertices. This is different from the 192 previously.

// For maximum fidelity to what ChatGPT intended to provide as a "complete" list in its response:
const lipTrianglesFromChatGPTFormatted = [
  // Upper outer lip
  [61, 185, 40], [40, 39, 37], [37, 0, 267], [267, 269, 270], [270, 409, 415],
  [415, 310, 311], [311, 312, 13], [13, 82, 81], [81, 42, 183], [183, 78, 61],
  // Inner upper lip
  [78, 191, 80], [80, 81, 82], [82, 13, 312], [312, 311, 310], [310, 415, 308],
  // Outer lower lip
  [61, 146, 91], [91, 181, 84], [84, 17, 314], [314, 405, 321], [321, 375, 291],
  [291, 308, 324], [324, 318, 402], [402, 317, 14], [14, 87, 178], [178, 88, 95],
  [95, 185, 61],
  // Inner lower lip (MODIFIED: Removed [78, 308, 308])
  [78, 95, 88], [95, 88, 178], [88, 178, 87], [178, 87, 14], [87, 14, 317],
  [14, 317, 402], [317, 402, 318], [402, 318, 324], [318, 324, 308],
  // Fill between outer & inner lip contours (upper)
  [61, 78, 191], [191, 80, 81], [81, 82, 13], [13, 312, 311], [311, 310, 415],
  [415, 308, 78],
  // Fill between outer & inner lip contours (lower)
  [78, 95, 88], // Note: This is a repeat of the first triangle in "Inner lower lip"
  [88, 178, 87], // Repeat
  [87, 14, 317],   // Repeat
  [317, 402, 318], // Repeat
  [318, 324, 308], // Repeat
  [308, 78, 95],   // Connects inner lower points with midline points
  // Commissures (mouth corners) - these were exact repeats from outer lips.
];

// Let's create a unique set to avoid issues with repeated triangles in the list
const uniqueTriangles = [];
const seenTriangles = new Set();
for (const tri of lipTrianglesFromChatGPTFormatted) {
    const sortedTri = [...tri].sort((a,b) => a-b).toString(); // Canonical representation
    if (!seenTriangles.has(sortedTri)) {
        uniqueTriangles.push(tri);
        seenTriangles.add(sortedTri);
    }
}
console.log(`[lipTriangles.js] Using ChatGPT's curated list. Original count: ${lipTrianglesFromChatGPTFormatted.length}, Unique count: ${uniqueTriangles.length}`);
export default uniqueTriangles; // Export the list with duplicates removed