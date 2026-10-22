import { defineConfig } from 'vitest/config';

export default defineConfig({
  // GitHub Pages serves the app from /<repo>/.
  base: '/pdd-swipe/',
  test: {
    include: ['src/**/*.test.ts'],
  },
});
