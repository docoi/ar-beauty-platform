import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@utils': path.resolve(__dirname, 'src/utils'),
      '@shaders': path.resolve(__dirname, 'src/shaders'),
      '@effects': path.resolve(__dirname, 'src/effects'),
    },
  },
  build: {
    target: 'esnext', // Required for WebGPU
  },
  assetsInclude: ['**/*.wgsl'], // Tell Vite to include .wgsl files
});
