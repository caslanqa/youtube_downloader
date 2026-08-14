// ffmpeg: npm paketiyle gömülü (Karar A, bkz. docs/PLAN.md §6) — runtime indirme yok.
import { app } from 'electron';
import path from 'node:path';

export function getFfmpegPath(): string {
  if (app.isPackaged) {
    // electron-forge/plugin-vite paketlenmiş build'e node_modules'i dahil etmiyor;
    // gerçek binary forge.config.ts'teki extraResource ile Resources/ altına kopyalanır.
    return path.join(process.resourcesPath, process.platform === 'win32' ? 'ffmpeg.exe' : 'ffmpeg');
  }
  // Geliştirmede node_modules diskte var — yalnızca bu dalda require ediliyor,
  // çünkü üst seviye bir import paketlenmiş build'de "Cannot find module" ile patlar.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const ffmpegBinaryPath = require('ffmpeg-static') as string | null;
  if (!ffmpegBinaryPath) {
    throw new Error('ffmpeg-static bu platform için bir binary sağlamadı');
  }
  return ffmpegBinaryPath;
}
