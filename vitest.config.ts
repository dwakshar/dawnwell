import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  define: {
    __DEV__: 'true',
  },
  test: {
    environment: 'node',
    globals: true,
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
    },
  },
});
