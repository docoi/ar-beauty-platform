import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@utils': path.resolve(__dirname, 'src/utils'),
      '@shaders': path.resolve(__dirname, 'src/shaders'),
    },
  },
  assetsInclude: ['**/*.wgsl'], // ✅ ensure shaders are included
  build: {
    target: 'esnext',
  },
});
