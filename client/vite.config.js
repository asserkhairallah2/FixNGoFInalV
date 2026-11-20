import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const rootDir = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': { target: 'http://localhost:5080', changeOrigin: true },
      '/hubs': { target: 'http://localhost:5080', changeOrigin: true, ws: true },
      '/health': { target: 'http://localhost:5080', changeOrigin: true }
    }
  },
  build: {
    outDir: '../src/FixNGo.Web/wwwroot',
    emptyOutDir: true,
    rollupOptions: {
      input: path.resolve(rootDir, 'src/main.jsx'),
      output: {
        entryFileNames: 'assets/fixngo-app.js',
        chunkFileNames: 'assets/fixngo-[name].js',
        assetFileNames: (assetInfo) =>
          assetInfo.name && assetInfo.name.endsWith('.css')
            ? 'assets/fixngo-app.css'
            : 'assets/[name][extname]'
      }
    }
  }
});
