import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  plugins: [react()],
  root: path.resolve(__dirname, 'renderer'),
  resolve: {
    alias: {
      '@shared': path.resolve(__dirname, 'shared')
    }
  },
  optimizeDeps: {
    include: ['../shared/noteMarkdown.cjs']
  },
  base: './',
  build: {
    outDir: path.resolve(__dirname, 'renderer/dist'),
    emptyOutDir: true
  },
  server: {
    port: 5174,
    strictPort: true
  }
});
