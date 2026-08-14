import { defineConfig } from 'vitest/config';

// Birim/entegrasyon testleri yalnızca src altında; e2e/ Playwright'a ait.
export default defineConfig({
  test: {
    include: ['src/**/*.test.ts'],
  },
});
