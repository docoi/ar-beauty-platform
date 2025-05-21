// src/utils/lipTriangles.js

const lipTriangles = [
  // Upper lip: outer to inner (left → right)
  [61, 185, 78],
  [185, 40, 191],
  [40, 39, 80],
  [39, 37, 81],
  [37, 0, 82],
  [0, 267, 13],
  [267, 269, 312],
  [269, 270, 311],
  [270, 409, 310],
  [409, 291, 415],
  [291, 308, 308], // intentionally degenerate to keep loop - let's test this as is

  // Connecting upper lip strip
  [61, 78, 191],    // Corrected based on typical strip: OuterL, InnerL, InnerR
  [61, 191, 185],   // OuterL, InnerR, OuterR
  [185, 191, 80],   // etc.
  [185, 80, 40],
  [40, 80, 81],
  [40, 81, 39],
  [39, 81, 82],
  [39, 82, 37],
  [37, 82, 13],
  [37, 13, 0],
  [0, 13, 312],
  [0, 312, 267],
  [267, 312, 311],
  [267, 311, 269],
  [269, 311, 310],
  [269, 310, 270],
  [270, 310, 415],
  [270, 415, 409],
  [409, 415, 308], // This closes the upper strip from outer right to inner right.
  // [291, 415, 308], // The original connecting strip from ChatGPT might have been simpler.
                     // The above is a more standard way to "skin" two polylines.

  // Lower lip: outer to inner (left → right)
  [61, 146, 95],   // OuterL, OuterMid, InnerMid
  [146, 91, 88],   // OuterMid, OuterR, InnerR
  [91, 181, 178],
  [181, 84, 87],
  [84, 17, 14],
  [17, 314, 317],
  [314, 405, 402],
  [405, 321, 318],
  [321, 375, 324],
  [375, 291, 308], 

  // Connecting lower lip strip
  [61, 95, 146],    // OuterL, InnerMid, OuterMid
  [146, 88, 91],    // OuterMid, InnerR, OuterR
  [91, 88, 178],    // etc.
  [181, 178, 87],
  [84, 87, 14],
  [17, 14, 317],
  [314, 317, 402],
  [405, 402, 318],
  [321, 318, 324],
  [375, 324, 308], // This closes the lower strip.

  // Commissure edge smoothing (just outside of mouth corner)
  // ChatGPT's original commissure suggestions:
  // [308, 291, 375], // This is part of lower outer
  // [61, 291, 308],   // This connects upper left outer, to lower right outer, to inner right. Complex.
  // [61, 308, 78],    // Connects upper left outer, to inner right, to inner left.
  // Let's try a simpler connection at the corners if needed, or rely on the strips meeting.
  // For now, let's use the "Upper lip fill" and "Lower lip fill" and their "Connecting strip" logic from ChatGPT directly.
  // The "Commissure" triangles ChatGPT listed might be redundant or specific tweaks.

  // Re-pasting EXACTLY what ChatGPT provided in its latest response for "Triangulated Lip Mesh: lipTriangles.js"
  // To avoid my interpretation errors.
];

const lipTrianglesFromChatGptResponse = [
  // Upper lip: outer → inner contour (vermillion fill)
  [61, 185, 78],
  [185, 40, 191],
  [40, 39, 80],
  [39, 37, 81],
  [37, 0, 82],
  [0, 267, 13],
  [267, 269, 312],
  [269, 270, 311],
  [270, 409, 310],
  [409, 291, 415],
  // [291, 308, 308], // Intentionally removing the degenerate one for now. If it was crucial, ChatGPT can clarify.
  // Let's check if the next line implies the previous one's third point was meant to be different or if it starts a new sequence.
  // The list seems to be pairs of triangles forming quads between outer and inner.
  // For example, [61, 185, 78] and then [61, 78, 191] (from connecting strip) would form a quad 61-185-191-78.

  // Connecting upper lip strip (This should ideally be integrated with the above to form the fill)
  [61, 78, 191], // This makes sense with [61, 185, 78] to form quad 61,185,191,78
  [185, 191, 80], // With [185, 40, 191] -> quad 185,40,80,191
  [40, 191, 80], // This is a duplicate if the above logic is right. Let's use ChatGPT's raw list.
  // The two sections "Upper lip: outer to inner" and "Connecting upper lip strip" seem to be two halves of the quads.

  // From ChatGPT's "✅ Triangulated Lip Mesh: lipTriangles.js" section:
  // Upper lip: outer → inner contour (vermillion fill)
  [61, 185, 78], [185, 40, 191], [40, 39, 80], [39, 37, 81], [37, 0, 82],
  [0, 267, 13], [267, 269, 312], [269, 270, 311], [270, 409, 310], [409, 291, 415],
  // [291, 308, 308], // Degenerate, omitting for now.
  // ChatGPT then had "Connecting upper lip strip". These are likely the other halves of the quads.
  [61, 78, 191], [185, 191, 40], // Note: ChatGPT had [185, 191, 80], using 40 seems more logical for outer.
                                 // Let's stick to its list: [185, 191, 80] - this makes [185,40,191] and [185,191,80] share edge 185-191
                                 // Actually, it should be: [Outer1, Inner1, Inner2] and [Outer1, Inner2, Outer2]
                                 // So for quad Outer1-Outer2-Inner2-Inner1:
                                 // Triangle1: Outer1, Outer2, Inner1
                                 // Triangle2: Outer2, Inner2, Inner1
                                 // ChatGPT list is:
                                 // [61(O1), 185(O2), 78(I1)]
                                 // [185(O2), 40(O3), 191(I2)] -> This seems to be advancing along the outer and inner loops.
                                 // Let's use its list verbatim, minus the degenerate one.

  // Lower lip: outer to inner (left → right)
  [61, 146, 95], [146, 91, 88], [91, 181, 178], [181, 84, 87], [84, 17, 14],
  [17, 314, 317], [314, 405, 402], [405, 321, 318], [321, 375, 324], [375, 291, 308],

  // Connecting lower lip strip (These are the second triangles for the quads forming the lower lip surface)
  [61, 95, 146], // These should be: [OuterOld, InnerNew, OuterNew]
                 // e.g. for quad 61-146-88-95: Tri1=[61,146,95], Tri2=[146,88,95]
                 // Let's use ChatGPT's list verbatim.
  [146, 88, 91], // This with [146,91,88] from above is a duplicate flipped.
                 // The "Connecting" list from ChatGPT seems problematic or needs careful pairing.

  // Using THE EXACT LIST from ChatGPT's "✅ Triangulated Lip Mesh: lipTriangles.js" block:
];
const lipTrianglesFromChatGPT = [
    // Upper lip: outer → inner contour (vermillion fill)
    [61, 185, 78], [185, 40, 191], [40, 39, 80], [39, 37, 81], [37, 0, 82],
    [0, 267, 13], [267, 269, 312], [269, 270, 311], [270, 409, 310], [409, 291, 415],
    // [291, 308, 308], // SKIPPING DEGENERATE TRIANGLE

    // Connecting upper lip strip
    [61, 78, 191], [185, 191, 80], [40, 191, 80], //This [40,191,80] seems to make a quad with [185,40,191] and [185,191,80] - complex
                   // Let's use the raw list and see. It might be correct.
    [39, 80, 81], [37, 81, 82], [0, 82, 13], [267, 13, 312], [269, 312, 311],
    [270, 311, 310], [409, 310, 415], [291, 415, 308],

    // Lower lip: outer to inner (left → right)
    [61, 146, 95], [146, 91, 88], [91, 181, 178], [181, 84, 87], [84, 17, 14],
    [17, 314, 317], [314, 405, 402], [405, 321, 318], [321, 375, 324], [375, 291, 308],

    // Connecting lower lip strip
    [61, 95, 88], [146, 88, 178], [91, 178, 87], [181, 87, 14], [84, 14, 317],
    [17, 317, 402], [314, 402, 318], [405, 318, 324], [321, 324, 308],

    // Commissure edge smoothing (just outside of mouth corner)
    [308, 291, 375], // This is a repeat of last triangle in lower lip outer list
    [61, 291, 308],  // Connects upper left corner, lower right corner, inner right corner
    [61, 308, 78],   // Connects upper left corner, inner right corner, inner left corner
];
// Removing the clearly degenerate triangle from ChatGPT's first block:
const chatGPTsFinalList = lipTrianglesFromChatGPT.filter(tri => !(tri[1] === tri[2] && tri[0] === 291)); // Remove [291,308,308]

// To be absolutely sure about duplicates for the final list before exporting:
const uniqueTriangles = [];
const seenTriangles = new Set();
for (const tri of chatGPTsFinalList) {
    // Create a canonical representation (e.g., sorted indices as string) to detect duplicates/flips
    const sortedTriString = [...tri].sort((a,b) => a-b).toString();
    if (!seenTriangles.has(sortedTriString)) {
        uniqueTriangles.push(tri); // Add the original winding order
        seenTriangles.add(sortedTriString);
    }
}
console.log(`[lipTriangles.js] Using ChatGPT's refined list. Original count: ${chatGPTsFinalList.length}, Unique count: ${uniqueTriangles.length}`);

export default uniqueTriangles;