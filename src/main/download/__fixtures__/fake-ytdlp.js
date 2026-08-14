#!/usr/bin/env node
// Fake yt-dlp used to exercise the job.ts flow end to end without network access.
// FAKE_YTDLP_MODE selects the behaviour: success | fail | hang (default: success).
const fs = require('node:fs');
const path = require('node:path');

const args = process.argv.slice(2);
const oIndex = args.indexOf('-o');
const outputTemplate = args[oIndex + 1];
const outputDir = path.dirname(outputTemplate);
fs.mkdirSync(outputDir, { recursive: true });

const mode = process.env.FAKE_YTDLP_MODE || 'success';

// With `--progress-template "download:%(progress)j"` real yt-dlp writes bare JSON lines: the
// `download:` part is a type selector and never reaches the output. The fake must match that.
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
  setInterval(() => {}, 1000); // wait until SIGTERM arrives
}
