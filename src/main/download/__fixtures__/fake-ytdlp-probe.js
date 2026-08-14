#!/usr/bin/env node
// Test amaçlı sahte yt-dlp `-J --flat-playlist` çıktısı üretir (probe.ts entegrasyon testi için).
// PROBE_FIXTURE ortam değişkeni ile hangi JSON döneceği seçilir: video | playlist | fail | hang.

const mode = process.env.PROBE_FIXTURE || 'video';

// Şekiller gerçek yt-dlp 2026.07.04 çıktısından alındı: tekil videoda tek `thumbnail`
// alanı bulunur, `--flat-playlist` öğelerinde ise yalnızca `thumbnails` dizisi gelir.
const VIDEO = {
  _type: 'video',
  id: 'abc123',
  title: 'Test Video Başlığı',
  thumbnail: 'https://example.com/thumb.jpg',
  duration: 212,
};

const PLAYLIST = {
  _type: 'playlist',
  id: 'PL123',
  title: 'Test Oynatma Listesi',
  thumbnails: [{ url: 'https://example.com/playlist-168.jpg', width: 168, height: 94 }],
  entries: [
    {
      id: 'a',
      title: 'Parça 1',
      thumbnails: [
        { url: 'https://example.com/1-168.jpg', width: 168, height: 94 },
        { url: 'https://example.com/1-640.jpg', width: 640, height: 480 },
      ],
    },
    { id: 'b', title: 'Parça 2' },
    { id: 'c', title: 'Parça 3' },
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
