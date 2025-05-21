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
  [291, 308, 308], // Maintains loop continuity

  // Connecting upper lip strip
  [61, 78, 191],
  [185, 191, 78],
  [40, 191, 80],
  [39, 80, 81],
  [37, 81, 82],
  [0, 82, 13],
  [267, 13, 312],
  [269, 312, 311],
  [270, 311, 310],
  [409, 310, 415],
  [291, 415, 308],

  // Lower lip: outer to inner (left → right)
  [61, 146, 95],
  [146, 91, 88],
  [91, 181, 178],
  [181, 84, 87],
  [84, 17, 14],
  [17, 314, 317],
  [314, 405, 402],
  [405, 321, 318],
  [321, 375, 324],
  [375, 291, 308], // 308 shared at corner

  // Connecting lower lip strip
  [61, 95, 88],
  [146, 88, 178],
  [91, 178, 87],
  [181, 87, 14],
  [84, 14, 317],
  [17, 317, 402],
  [314, 402, 318],
  [405, 318, 324],
  [321, 324, 308],

  // Commissure edge smoothing (mouth corners)
  [308, 291, 375],
  [61, 291, 308],
  [61, 308, 78], // Closes upper to inner lip loop

  // No triangles bridging the mouth cavity
];

export default lipTriangles;
