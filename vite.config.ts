import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  root: 'src/render',
  base: './',
  build: {
    outDir: '../../dist/render',
    emptyOutDir: true
  },
  server: {
    port: 5173,
    strictPort: true
  }
});
