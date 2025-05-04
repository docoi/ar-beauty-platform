// src/effects/lipstickEffect.js

import lipstickShader from '../shaders/lipstickEffect.wgsl?raw';

export const lipstickEffect = {
  name: 'Lipstick',
  shaderCode: lipstickShader,
  blendMode: 'normal',
  colorOverlay: true,
  usesFaceMesh: true,
  faceLandmarks: ['lipsUpperOuter', 'lipsLowerOuter'],
};

export default lipstickEffect;
