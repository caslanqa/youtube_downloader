// URL and filesystem security checks; see docs/PLAN.md §11. These run in the main process
// only: nothing coming from the renderer is trusted.

import path from 'node:path';

const ALLOWED_HOSTS = new Set([
  'youtube.com',
  'www.youtube.com',
  'm.youtube.com',
  'music.youtube.com',
  'youtu.be',
]);

/** Enforces https plus the YouTube host allowlist. Throws when the URL is not acceptable. */
export function validateUrl(rawUrl: string): URL {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    throw new Error('Invalid URL');
  }
  if (url.protocol !== 'https:') {
    throw new Error('Only https:// links are allowed');
  }
  if (!ALLOWED_HOSTS.has(url.hostname)) {
    throw new Error(`Unsupported host: ${url.hostname}`);
  }
  return url;
}

/** Strips path separators and bare ".."/"." segments; falls back to a default name. */
export function sanitizeAlbumName(albumName: string): string {
  const trimmed = albumName.trim();
  const safe = trimmed.replace(/[\\/]+/g, '-');
  if (!safe || safe === '.' || safe === '..') {
    return 'Downloads';
  }
  return safe;
}

/**
 * Resolves the final destination folder for an album name under `baseDir`.
 * Throws when the result would escape `baseDir` (path traversal).
 */
export function resolveDestination(baseDir: string, albumName: string): string {
  const normalizedBase = path.resolve(baseDir);
  const resolved = path.resolve(normalizedBase, sanitizeAlbumName(albumName));
  if (resolved !== normalizedBase && !resolved.startsWith(normalizedBase + path.sep)) {
    throw new Error('The album folder would fall outside the destination directory');
  }
  return resolved;
}
