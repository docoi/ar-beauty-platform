// src/utils/lipTriangles.js

const lipTriangles = [
  // Upper lip fill (outer → inner contour (vermillion fill))
  [61, 146, 91], // These first few look like they connect outer lower to inner upper. Let's test.
  [61, 91, 78],
  [78, 91, 80],
  [80, 81, 78],
  [78, 81, 61], // This triangle seems to use 61, 78, 81 which are all upper lip points.

  // The following seem to be a fan from 61 for the user's *left* upper lip (screen right)
  [61, 81, 82],  // Assuming this is the start of the fan after the initial connections
  [61, 82, 13],
  [61, 13, 312],
  [61, 312, 311],
  [61, 311, 310],
  [61, 310, 415], 
  [61, 415, 308], 

  // Lower lip fill (outer → inner contour (vermillion fill))
  // This looks like a fan from landmark 84 for the user's *right* lower lip (screen left)
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
  [78, 61, 84],   // Connects the two fans/sides at the inner points near commissures
  [84, 78, 95],   // Further fills near commissure, using 95 (lower midline)
];

export default lipTriangles;