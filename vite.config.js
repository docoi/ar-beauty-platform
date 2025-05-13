import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path' // Make sure to import the 'path' module

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  // assetsInclude is useful if you import WGSL without '?raw',
  // but using '?raw' is generally more explicit and recommended with Vite.
  // Keep it if you have other raw asset types, or remove if only using '?raw' for WGSL.
  assetsInclude: ['**/*.wgsl'],
  resolve: {
    // Define aliases for easier imports (e.g., '@/utils/...' instead of '../../utils/...')
    alias: {
      '@': path.resolve(__dirname, './src') // Maps '@' to the 'src' directory
    }
  },
  server: {
    // Optional: configure server settings if needed
    // host: true, // Expose on network for mobile testing (if needed)
    // https: true // If using features requiring https locally
  },
  build: {
    // Optional: configure build settings
    // target: 'esnext' // Ensure modern JS features are supported
  }
})