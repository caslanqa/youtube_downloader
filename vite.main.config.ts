import { defineConfig } from 'vite';

// https://vitejs.dev/config
export default defineConfig({
  build: {
    rollupOptions: {
      // ffmpeg-static hesapladığı binary yolu için gerçek __dirname'e ihtiyaç duyar;
      // vite'ın bundle'a gömmesi bu yolu bozar (bkz. asarUnpack, forge.config.ts).
      external: ['ffmpeg-static'],
    },
  },
});
