// YouTube Data API v3 search: lets a user browse and pick a video instead of pasting a link.
// Runs entirely in the main process so the API key never reaches the renderer, matching how
// binary downloads (binaries/manager.ts) keep every external call on this side of the IPC
// boundary. Uses the raw REST endpoints via fetch, not the `googleapis` SDK — that package
// covers every Google API and would be a heavy dependency for two read-only GET requests.

import type { SearchResultItem } from '../../shared/types';

// Overridable so end-to-end tests can point this at a local mock server instead of the real
// Google API; there is no real end-user reason to change it (unlike the binary path overrides
// in binaries/manager.ts, which are also a genuine escape hatch for a blocked download source).
const API_BASE = process.env.YOUTUBE_API_BASE || 'https://www.googleapis.com/youtube/v3';
const USER_AGENT = 'youtube-downloader-app';
// search.list costs 100 of the default 10,000-unit daily quota — effectively 100 searches per
// day per key — so results are capped modestly rather than paginated (docs/PLAN.md §16).
const MAX_RESULTS = 15;

interface GoogleApiErrorBody {
  error?: { message?: string; errors?: { reason?: string }[] };
}

interface SearchListResponse {
  items: {
    id: { videoId?: string };
    snippet: { title: string; channelTitle: string; thumbnails: Record<string, { url: string }> };
  }[];
}

interface VideosListResponse {
  items: { id: string; contentDetails: { duration: string } }[];
}

/** Converts an ISO 8601 duration ("PT4M13S") to whole seconds; undefined for shapes it can't parse (e.g. "P0D" for a live stream). */
export function parseIso8601Duration(duration: string): number | undefined {
  const match = /^PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/.exec(duration);
  if (!match) return undefined;
  const [, hours, minutes, seconds] = match;
  return Number(hours ?? 0) * 3600 + Number(minutes ?? 0) * 60 + Number(seconds ?? 0);
}

async function callApi<T>(path: string, params: Record<string, string>, apiKey: string): Promise<T> {
  const url = new URL(`${API_BASE}/${path}`);
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);
  url.searchParams.set('key', apiKey);

  const res = await fetch(url, { headers: { 'User-Agent': USER_AGENT } });
  const body = (await res.json()) as T & GoogleApiErrorBody;
  if (!res.ok) {
    const reason = body.error?.errors?.[0]?.reason;
    if (reason === 'quotaExceeded') {
      throw new Error(
        "You've used today's free YouTube search quota. Try again tomorrow, or paste the video link directly instead.",
      );
    }
    if (reason === 'keyInvalid' || res.status === 400 || res.status === 403) {
      throw new Error('YouTube rejected this API key. Check it under Settings.');
    }
    throw new Error(body.error?.message ?? `YouTube search failed (HTTP ${res.status})`);
  }
  return body;
}

/** Best-effort thumbnail pick: prefers a middling size over the tiny default one. */
function bestThumbnail(thumbnails: Record<string, { url: string }>): string | undefined {
  return thumbnails.medium?.url ?? thumbnails.high?.url ?? thumbnails.default?.url;
}

export async function searchVideos(apiKey: string, query: string): Promise<SearchResultItem[]> {
  if (!apiKey.trim()) throw new Error('Add a YouTube Data API key in Settings to search.');
  const trimmed = query.trim();
  if (!trimmed) return [];

  const search = await callApi<SearchListResponse>(
    'search',
    { part: 'snippet', type: 'video', maxResults: String(MAX_RESULTS), q: trimmed },
    apiKey,
  );
  const videoIds = search.items.map((item) => item.id.videoId).filter((id): id is string => Boolean(id));
  if (videoIds.length === 0) return [];

  // One extra request, batched for all results (videos.list accepts up to 50 comma-separated
  // ids): this is the only way to get duration, and it costs just 1 more quota unit.
  const videos = await callApi<VideosListResponse>(
    'videos',
    { part: 'contentDetails', id: videoIds.join(',') },
    apiKey,
  );
  const durationById = new Map(videos.items.map((item) => [item.id, parseIso8601Duration(item.contentDetails.duration)]));

  return search.items
    .filter((item): item is typeof item & { id: { videoId: string } } => Boolean(item.id.videoId))
    .map((item) => ({
      videoId: item.id.videoId,
      title: item.snippet.title,
      channelTitle: item.snippet.channelTitle,
      thumbnail: bestThumbnail(item.snippet.thumbnails),
      duration: durationById.get(item.id.videoId),
    }));
}
