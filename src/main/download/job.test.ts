import { describe, expect, it } from 'vitest';
import { isRetryableFailure, parseProgressLine } from './job';

// The line format comes from real yt-dlp 2026.07.04 output: the `download:` part of
// `--progress-template "download:%(progress)j"` is a type selector and is never printed.
describe('parseProgressLine', () => {
  it('derives percent, speed and eta from the known fields', () => {
    const line = JSON.stringify({
      status: 'downloading',
      downloaded_bytes: 512000,
      total_bytes: 1024000,
      speed: 2 * 1024 * 1024,
      eta: 12.4,
    });
    expect(parseProgressLine(line)).toEqual({ percent: 50, speed: '2.00 MB/s', eta: '12s' });
  });

  it('falls back to total_bytes_estimate when total_bytes is missing', () => {
    const line = JSON.stringify({ downloaded_bytes: 250000, total_bytes_estimate: 1000000 });
    expect(parseProgressLine(line)?.percent).toBe(25);
  });

  it('leaves percent undefined when the total size is unknown', () => {
    const line = JSON.stringify({ downloaded_bytes: 1000 });
    expect(parseProgressLine(line)?.percent).toBeUndefined();
  });

  it('ignores yt-dlp status lines', () => {
    expect(parseProgressLine('[youtube] Extracting URL')).toBeNull();
    expect(parseProgressLine('[download] Destination: /tmp/x.webm')).toBeNull();
  });

  it('ignores JSON lines that carry no progress', () => {
    expect(parseProgressLine(JSON.stringify({ status: 'finished' }))).toBeNull();
  });

  it('returns null for malformed JSON', () => {
    expect(parseProgressLine('{not json')).toBeNull();
  });
});

describe('isRetryableFailure', () => {
  it('treats a 403 as transient', () => {
    expect(isRetryableFailure(['ERROR: unable to download video data: HTTP Error 403: Forbidden'])).toBe(true);
  });

  it('treats a 429 as transient', () => {
    expect(isRetryableFailure(['ERROR: HTTP Error 429: Too Many Requests'])).toBe(true);
  });

  it('does not retry a permanent failure like a private video', () => {
    expect(isRetryableFailure(["ERROR: Private video. Sign in if you've been granted access."])).toBe(false);
  });
});
