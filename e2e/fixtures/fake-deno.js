#!/usr/bin/env node
// Fake deno for the end-to-end tests: only its presence matters (it is yt-dlp's JS runtime).
// Passed through YTDL_DENO_PATH so no real download is triggered.
process.stdout.write('deno 2.9.5 (stable, release, fake)\n');
process.exit(0);
