import { defineConfig } from '@playwright/test';

// The Electron app runs as a single instance, so no parallel workers.
export default defineConfig({
  testDir: './e2e',
  workers: 1,
  fullyParallel: false,
  timeout: 30_000,
  reporter: [['list']],
});
