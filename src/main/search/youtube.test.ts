import { afterEach, describe, expect, it, vi } from 'vitest';
import { parseIso8601Duration, searchVideos } from './youtube';

describe('parseIso8601Duration', () => {
  it('parses hours, minutes and seconds', () => {
    expect(parseIso8601Duration('PT1H2M3S')).toBe(3723);
  });

  it('parses minutes and seconds only', () => {
    expect(parseIso8601Duration('PT4M13S')).toBe(253);
  });

  it('parses seconds only', () => {
    expect(parseIso8601Duration('PT45S')).toBe(45);
  });

  it('returns undefined for a shape it does not recognise (e.g. a live stream reports "P0D")', () => {
    expect(parseIso8601Duration('P0D')).toBeUndefined();
  });
});

describe('searchVideos', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('rejects immediately, without a network call, when no API key is configured', async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);
    await expect(searchVideos('', 'lofi hip hop')).rejects.toThrow(/Add a YouTube Data API key/);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('returns an empty list, without a network call, for a blank query', async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);
    await expect(searchVideos('fake-key', '   ')).resolves.toEqual([]);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('combines search.list and videos.list into title/channel/thumbnail/duration', async () => {
    const fetchSpy = vi.fn(async (url: URL) => {
      const isSearch = url.pathname.endsWith('/search');
      const body = isSearch
        ? {
            items: [
              {
                id: { videoId: 'abc123' },
                snippet: {
                  title: 'A test video',
                  channelTitle: 'A Test Channel',
                  thumbnails: { default: { url: 'https://example.com/default.jpg' }, medium: { url: 'https://example.com/medium.jpg' } },
                },
              },
            ],
          }
        : { items: [{ id: 'abc123', contentDetails: { duration: 'PT4M13S' } }] };
      return new Response(JSON.stringify(body), { status: 200 });
    });
    vi.stubGlobal('fetch', fetchSpy);

    const results = await searchVideos('fake-key', 'test');
    expect(results).toEqual([
      {
        videoId: 'abc123',
        title: 'A test video',
        channelTitle: 'A Test Channel',
        thumbnail: 'https://example.com/medium.jpg',
        duration: 253,
      },
    ]);
    expect(fetchSpy).toHaveBeenCalledTimes(2);
  });

  it('translates a quota-exceeded error into a plain-language message', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(
        async () =>
          new Response(JSON.stringify({ error: { errors: [{ reason: 'quotaExceeded' }] } }), { status: 403 }),
      ),
    );
    await expect(searchVideos('fake-key', 'test')).rejects.toThrow(/free YouTube search quota/i);
  });

  it('translates an invalid-key error into a plain-language message', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(
        async () => new Response(JSON.stringify({ error: { errors: [{ reason: 'keyInvalid' }] } }), { status: 400 }),
      ),
    );
    await expect(searchVideos('fake-key', 'test')).rejects.toThrow(/rejected this API key/i);
  });
});
