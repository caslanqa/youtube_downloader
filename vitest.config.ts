import { defineConfig } from 'vitest/config';

// Unit and integration tests live under src; e2e/ belongs to Playwright.
export default defineConfig({
  test: {
    include: ['src/**/*.test.ts'],
  },
});
