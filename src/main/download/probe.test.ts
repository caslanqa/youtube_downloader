// Verifies the real spawn/parse flow of probe.ts against a fake yt-dlp, without network access.
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { probeUrl } from './probe';

const FIXTURE = path.join(__dirname, '__fixtures__', 'fake-ytdlp-probe.js');

describe('probeUrl (fake yt-dlp)', () => {
  it('returns MediaInfo for a single video', async () => {
    process.env.PROBE_FIXTURE = 'video';
    const info = await probeUrl('https://www.youtube.com/watch?v=abc123', FIXTURE);
    expect(info).toEqual({
      id: 'abc123',
      title: 'Test Video Title',
      thumbnail: 'https://example.com/thumb.jpg',
      duration: 212,
      isPlaylist: false,
      entryCount: 1,
    });
    delete process.env.PROBE_FIXTURE;
  });

  it('returns isPlaylist and entryCount for a playlist', async () => {
    process.env.PROBE_FIXTURE = 'playlist';
    const info = await probeUrl('https://www.youtube.com/playlist?list=PL123', FIXTURE);
    expect(info.isPlaylist).toBe(true);
    expect(info.entryCount).toBe(3);
    expect(info.title).toBe('Test Playlist');
    // Playlist entries carry no `thumbnail` field; the widest image from `thumbnails` wins.
    expect(info.thumbnail).toBe('https://example.com/1-640.jpg');
    delete process.env.PROBE_FIXTURE;
  });

  it('rejects when yt-dlp exits with an error code', async () => {
    process.env.PROBE_FIXTURE = 'fail';
    await expect(probeUrl('https://www.youtube.com/watch?v=abc123', FIXTURE)).rejects.toThrow(/unavailable/i);
    delete process.env.PROBE_FIXTURE;
  });

  it('rejects on timeout', async () => {
    process.env.PROBE_FIXTURE = 'hang';
    await expect(probeUrl('https://www.youtube.com/watch?v=abc123', FIXTURE, 200)).rejects.toThrow(/timed out/i);
    delete process.env.PROBE_FIXTURE;
  });

  it('rejects a disallowed host without running yt-dlp', async () => {
    await expect(probeUrl('https://evil.example.com/video', FIXTURE)).rejects.toThrow(/host/i);
  });
});
