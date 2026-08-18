import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['src/**/*.test.ts', 'scripts/**/*.test.mjs'],
    globals: false,
    environment: 'node',
    testTimeout: 10000,
    coverage: {
      reporter: ['text', 'json', 'html'],
    },
  },
});
