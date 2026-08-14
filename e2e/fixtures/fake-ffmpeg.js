#!/usr/bin/env node
// Fake ffmpeg for the end-to-end tests: only the version line is ever read (manager.readVersion).
process.stdout.write('ffmpeg version 7.1 Copyright (c) 2000-2026 the FFmpeg developers\n');
process.exit(0);
