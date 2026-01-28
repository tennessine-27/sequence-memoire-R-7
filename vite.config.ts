import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  base: './', // Crucial: makes asset paths relative (e.g., "assets/script.js" instead of "/assets/script.js")
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
  }
});