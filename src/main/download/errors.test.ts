import { describe, expect, it } from 'vitest';
import { summarizeDownloadError } from './errors';

describe('summarizeDownloadError', () => {
  it('recognises a 403 Forbidden and explains it in plain language', () => {
    const stderr = ['ERROR: unable to download video data: HTTP Error 403: Forbidden'];
    expect(summarizeDownloadError(stderr, 1)).toMatch(/refused this download \(403/i);
  });

  it('recognises a 429 rate limit', () => {
    expect(summarizeDownloadError(['ERROR: HTTP Error 429: Too Many Requests'], 1)).toMatch(/rate-limiting/i);
  });

  it('recognises a private video', () => {
    expect(summarizeDownloadError(['ERROR: Private video. Sign in if you\'ve been granted access.'], 1)).toMatch(
      /private video/i,
    );
  });

  it('recognises a region block', () => {
    expect(
      summarizeDownloadError(['ERROR: The uploader has not made this video available in your country'], 1),
    ).toMatch(/not available in your region/i);
  });

  it('falls back to a generic exit-code message when nothing matches', () => {
    expect(summarizeDownloadError(['ERROR: something completely different'], 2)).toBe('yt-dlp exited with code 2');
  });

  it('falls back cleanly on an empty stderr tail', () => {
    expect(summarizeDownloadError([], 1)).toBe('yt-dlp exited with code 1');
  });
});
