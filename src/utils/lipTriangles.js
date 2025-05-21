// src/utils/lipTriangles.js (ChatGPT's new simplified list)

const lipTriangles = [
  // Upper lip: outer → inner contour (vermillion fill)
  [61, 146, 91], // These look like they might be for lower lip based on 146, 91
  [61, 91, 78],  // Using 61 as an anchor
  [78, 91, 80],  // This is not a fan from 61. It's connecting existing points.
  [80, 81, 78],
  [78, 81, 61],  // Closing back to 61

  [61, 81, 82],
  [61, 82, 13],
  [61, 13, 312],
  [61, 312, 311],
  [61, 311, 310],
  [61, 310, 415],
  [61, 415, 308], // final triangle toward top right lip (from ChatGPT comment)
                   // This is indeed a fan from 61 for the user's left upper lip.

  // Lower lip: outer → inner contour (vermillion fill)
  // This looks like a fan from landmark 84 for the user's right lower lip
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
  [324, 308, 84], // closing right side of lower lip (from ChatGPT comment)

  // Commissures — blend corners of mouth
  [78, 61, 84],   // left corner (user’s right) - connects the two fans
  [84, 78, 95],   // fill commissure arc - uses points from the fans
];

export default lipTriangles;