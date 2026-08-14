#!/usr/bin/env node
// Fake yt-dlp for the end-to-end tests: mimics the version, probe (-J) and download flows.
// The output shapes match those verified against real yt-dlp 2026.07.04.
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
      title: 'Fake Test Video',
      duration: 125,
      thumbnail: 'https://i.ytimg.com/vi/abc123/hqdefault.jpg',
    }),
  );
  process.exit(0);
}

const outputTemplate = args[args.indexOf('-o') + 1];
const outputDir = path.dirname(outputTemplate);
fs.mkdirSync(outputDir, { recursive: true });

// With `--progress-template "download:%(progress)j"` real yt-dlp writes bare JSON lines.
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

fs.writeFileSync(path.join(outputDir, 'Fake Test Video.mp3'), 'fake audio');
process.exit(0);
