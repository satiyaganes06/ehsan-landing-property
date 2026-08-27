import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      // The API and the panel run on different ports in dev; the backend
      // already sets credentials: 'include' + CORS, but proxying avoids
      // third-party-cookie issues some browsers apply to cross-port fetches.
      '/api': { target: 'http://localhost:4000', changeOrigin: true },
      '/media': { target: 'http://localhost:4000', changeOrigin: true },
      '/live-site': { target: 'http://localhost:4000', changeOrigin: true },
    },
  },
});
