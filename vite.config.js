import { defineConfig } from 'vite';

export default defineConfig({
  root: 'src',
  // root 在 src/ 下时 publicDir 默认也是 src/public；根目录 public/ 需显式指向
  publicDir: '../public',
  build: {
    outDir: '../dist',
    emptyOutDir: true,
  },
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:8888',
        changeOrigin: true,
      },
      '^/images': {
        target: 'http://localhost:8888',
        changeOrigin: true,
      },
    },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    include: ['**/*.test.js'],
  },
});
