#!/usr/bin/env node
// Uçtan uca testler için sahte yt-dlp: sürüm, probe (-J) ve indirme akışını taklit eder.
// Çıktı biçimleri gerçek yt-dlp 2026.07.04 ile doğrulanmış olanlarla aynıdır.
const fs = require('node:fs');
const path = require('node:path');

const args = process.argv.slice(2);

if (args.includes('--version')) {
  process.stdout.write('2026.07.04\n');
  process.exit(0);
}

if (args.includes('-J')) {
  process.stdout.write(
    JSON.stringify({
      _type: 'video',
      id: 'abc123',
      title: 'Sahte Test Videosu',
      duration: 125,
      thumbnail: 'https://i.ytimg.com/vi/abc123/hqdefault.jpg',
    }),
  );
  process.exit(0);
}

const outputTemplate = args[args.indexOf('-o') + 1];
const outputDir = path.dirname(outputTemplate);
fs.mkdirSync(outputDir, { recursive: true });

// Gerçek yt-dlp `--progress-template "download:%(progress)j"` ile çıplak JSON yazar.
for (const downloaded of [250000, 750000, 1000000]) {
  process.stdout.write(
    `${JSON.stringify({
      status: 'downloading',
      downloaded_bytes: downloaded,
      total_bytes: 1000000,
      speed: 1048576,
      eta: 1,
    })}\n`,
  );
}

fs.writeFileSync(path.join(outputDir, 'Sahte Test Videosu.mp3'), 'sahte ses');
process.exit(0);
