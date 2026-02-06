import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';

export default defineConfig({
  plugins: [vue()],
  build: {
    outDir: 'dist',
    manifest: true,
    emptyOutDir: true,
    rollupOptions: {
      input: 'src/main.js'
    }
  },
  test: {
    environment: 'jsdom',
    globals: true
  }
});
