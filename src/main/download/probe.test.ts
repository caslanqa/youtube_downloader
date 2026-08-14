// Sahte yt-dlp ile probe.ts'in gerçek spawn/parse akışını doğrular (ağ erişimi olmadan).
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { probeUrl } from './probe';

const FIXTURE = path.join(__dirname, '__fixtures__', 'fake-ytdlp-probe.js');

describe('probeUrl (sahte yt-dlp)', () => {
  it('tekil video için MediaInfo döner', async () => {
    process.env.PROBE_FIXTURE = 'video';
    const info = await probeUrl('https://www.youtube.com/watch?v=abc123', FIXTURE);
    expect(info).toEqual({
      id: 'abc123',
      title: 'Test Video Başlığı',
      thumbnail: 'https://example.com/thumb.jpg',
      duration: 212,
      isPlaylist: false,
      entryCount: 1,
    });
    delete process.env.PROBE_FIXTURE;
  });

  it('oynatma listesi için isPlaylist + entryCount döner', async () => {
    process.env.PROBE_FIXTURE = 'playlist';
    const info = await probeUrl('https://www.youtube.com/playlist?list=PL123', FIXTURE);
    expect(info.isPlaylist).toBe(true);
    expect(info.entryCount).toBe(3);
    expect(info.title).toBe('Test Oynatma Listesi');
    // Playlist öğelerinde `thumbnail` alanı yoktur; `thumbnails` dizisinden en geniş görsel seçilir.
    expect(info.thumbnail).toBe('https://example.com/1-640.jpg');
    delete process.env.PROBE_FIXTURE;
  });

  it('yt-dlp hata koduyla çıkarsa reddedilir', async () => {
    process.env.PROBE_FIXTURE = 'fail';
    await expect(probeUrl('https://www.youtube.com/watch?v=abc123', FIXTURE)).rejects.toThrow(/unavailable/i);
    delete process.env.PROBE_FIXTURE;
  });

  it('zaman aşımında reddedilir', async () => {
    process.env.PROBE_FIXTURE = 'hang';
    await expect(probeUrl('https://www.youtube.com/watch?v=abc123', FIXTURE, 200)).rejects.toThrow(/zaman aşımı/i);
    delete process.env.PROBE_FIXTURE;
  });

  it('izinsiz host için yt-dlp hiç çalıştırılmadan reddedilir', async () => {
    await expect(probeUrl('https://evil.example.com/video', FIXTURE)).rejects.toThrow(/host/i);
  });
});
