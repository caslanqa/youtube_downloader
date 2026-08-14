#!/usr/bin/env node
// Produces fake yt-dlp `-J --flat-playlist` output for the probe.ts integration test.
// PROBE_FIXTURE selects which JSON is returned: video | playlist | fail | hang.

const mode = process.env.PROBE_FIXTURE || 'video';

// Shapes taken from real yt-dlp 2026.07.04 output: a single video carries one `thumbnail`
// field, while `--flat-playlist` entries only carry a `thumbnails` array.
const VIDEO = {
  _type: 'video',
  id: 'abc123',
  title: 'Test Video Title',
  thumbnail: 'https://example.com/thumb.jpg',
  duration: 212,
};

const PLAYLIST = {
  _type: 'playlist',
  id: 'PL123',
  title: 'Test Playlist',
  thumbnails: [{ url: 'https://example.com/playlist-168.jpg', width: 168, height: 94 }],
  entries: [
    {
      id: 'a',
      title: 'Track 1',
      thumbnails: [
        { url: 'https://example.com/1-168.jpg', width: 168, height: 94 },
        { url: 'https://example.com/1-640.jpg', width: 640, height: 480 },
      ],
    },
    { id: 'b', title: 'Track 2' },
    { id: 'c', title: 'Track 3' },
  ],
};

if (mode === 'video') {
  process.stdout.write(JSON.stringify(VIDEO));
  process.exit(0);
} else if (mode === 'playlist') {
  process.stdout.write(JSON.stringify(PLAYLIST));
  process.exit(0);
} else if (mode === 'fail') {
  process.stderr.write('ERROR: Video unavailable\n');
  process.exit(1);
} else if (mode === 'hang') {
  setInterval(() => {}, 1000);
}
