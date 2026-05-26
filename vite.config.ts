import path from 'node:path';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  root: 'src/client',
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src/client')
    }
  },
  build: {
    outDir: '../../dist/client',
    emptyOutDir: true
  },
  server: {
    host: '127.0.0.1',
    port: 5173,
    proxy: {
      '/api/': 'http://127.0.0.1:8787',
      '/media/': 'http://127.0.0.1:8787'
    }
  }
});
