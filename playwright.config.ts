import { defineConfig } from '@playwright/test';

// Electron uygulaması tek örnek olarak başlatılır: paralel worker yok.
export default defineConfig({
  testDir: './e2e',
  workers: 1,
  fullyParallel: false,
  timeout: 30_000,
  reporter: [['list']],
});
