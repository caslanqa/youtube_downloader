#!/usr/bin/env node
// Delayed fake yt-dlp for the queue concurrency tests: it waits FAKE_DELAY_MS and exits,
// writing start/end timestamps to FAKE_LOG_FILE when set so overlap can be measured.
const fs = require('node:fs');
const path = require('node:path');

const args = process.argv.slice(2);
const oIndex = args.indexOf('-o');
const outputDir = path.dirname(args[oIndex + 1]);
fs.mkdirSync(outputDir, { recursive: true });

const delayMs = Number(process.env.FAKE_DELAY_MS || 100);
const logFile = process.env.FAKE_LOG_FILE;

function log(event) {
  if (logFile) fs.appendFileSync(logFile, `${Date.now()} ${event}\n`);
}

log('start');
process.stdout.write(
  `${JSON.stringify({ status: 'downloading', downloaded_bytes: 0, total_bytes: 100 })}\n`,
);

setTimeout(() => {
  process.stdout.write(
    `${JSON.stringify({ status: 'downloading', downloaded_bytes: 100, total_bytes: 100 })}\n`,
  );
  fs.writeFileSync(path.join(outputDir, 'file.mp3'), 'x');
  log('end');
  process.exit(0);
}, delayMs);
