import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig } from 'vite';

const apiProxy = {
  '/api': {
    target: 'http://localhost:8000',
    changeOrigin: true,
  },
  '/avatars': {
    target: 'http://localhost:8000',
    changeOrigin: true,
  },
} as const;

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@components': path.resolve(__dirname, 'src/components'),
      '@types': path.resolve(__dirname, 'src/types'),
      '@utils': path.resolve(__dirname, 'src/utils'),
    },
  },
  server: {
    port: 3000,
    host: '0.0.0.0',
    proxy: apiProxy,
  },
  preview: {
    proxy: apiProxy,
  },
});
