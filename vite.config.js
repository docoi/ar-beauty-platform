import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  resolve: {
    alias: {
      '@utils': path.resolve(__dirname, './src/utils'),
      '@shaders': path.resolve(__dirname, './src/shaders'),
    },
  },
  assetsInclude: ['**/*.wgsl'],
  plugins: [react()],
  build: {
    outDir: 'dist',
  },
});
