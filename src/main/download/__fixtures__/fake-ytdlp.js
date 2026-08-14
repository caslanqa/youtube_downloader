#!/usr/bin/env node
// Gerçek ağ erişimi olmadan job.ts akışını uçtan uca test etmek için sahte yt-dlp.
// FAKE_YTDLP_MODE ortam değişkeniyle davranış seçilir: success | fail | hang (varsayılan: success).
const fs = require('node:fs');
const path = require('node:path');

const args = process.argv.slice(2);
const oIndex = args.indexOf('-o');
const outputTemplate = args[oIndex + 1];
const outputDir = path.dirname(outputTemplate);
fs.mkdirSync(outputDir, { recursive: true });

const mode = process.env.FAKE_YTDLP_MODE || 'success';

// Gerçek yt-dlp `--progress-template "download:%(progress)j"` ile çıplak JSON satırı yazar;
// `download:` tip seçicidir ve çıktıya girmez. Sahte ikili de aynısını yapmalı.
function emit(downloadedBytes, totalBytes) {
  process.stdout.write(
    `${JSON.stringify({
      status: 'downloading',
      downloaded_bytes: downloadedBytes,
      total_bytes: totalBytes,
      speed: 1048576,
      eta: 2,
    })}\n`,
  );
}

if (mode === 'success') {
  emit(250000, 1000000);
  emit(750000, 1000000);
  emit(1000000, 1000000);
  fs.writeFileSync(path.join(outputDir, 'Test Video.mp3'), 'fake audio content');
  process.exit(0);
} else if (mode === 'fail') {
  process.stderr.write('ERROR: something went wrong\n');
  process.exit(1);
} else if (mode === 'hang') {
  emit(100000, 1000000);
  fs.writeFileSync(path.join(outputDir, 'Test Video.part'), 'partial content');
  setInterval(() => {}, 1000); // SIGTERM ile öldürülene kadar bekler
}
