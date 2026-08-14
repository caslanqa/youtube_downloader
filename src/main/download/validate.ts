// URL ve dosya sistemi güvenlik doğrulamaları — bkz. docs/PLAN.md §11.
// Bu doğrulamalar yalnızca main sürecinde çalışır; renderer'dan gelen hiçbir veri güvenilir kabul edilmez.

import path from 'node:path';

const ALLOWED_HOSTS = new Set([
  'youtube.com',
  'www.youtube.com',
  'm.youtube.com',
  'music.youtube.com',
  'youtu.be',
]);

/** https + YouTube host allowlist doğrulaması. Geçersizse fırlatır. */
export function validateUrl(rawUrl: string): URL {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    throw new Error('Geçersiz URL');
  }
  if (url.protocol !== 'https:') {
    throw new Error('Yalnızca https:// bağlantılarına izin verilir');
  }
  if (!ALLOWED_HOSTS.has(url.hostname)) {
    throw new Error(`Desteklenmeyen host: ${url.hostname}`);
  }
  return url;
}

/** Yol ayırıcıları ve tekil ".."/"." segmentlerini eler; boşsa varsayılan ad döner. */
export function sanitizeAlbumName(albumName: string): string {
  const trimmed = albumName.trim();
  const safe = trimmed.replace(/[\\/]+/g, '-');
  if (!safe || safe === '.' || safe === '..') {
    return 'Indirilenler';
  }
  return safe;
}

/**
 * `baseDir` altında albüm adına göre nihai hedef klasörü hesaplar.
 * Sonuç `baseDir` dışına çıkarsa (path traversal) hata fırlatır.
 */
export function resolveDestination(baseDir: string, albumName: string): string {
  const normalizedBase = path.resolve(baseDir);
  const resolved = path.resolve(normalizedBase, sanitizeAlbumName(albumName));
  if (resolved !== normalizedBase && !resolved.startsWith(normalizedBase + path.sep)) {
    throw new Error('Albüm klasörü hedef dizinin dışına çıkıyor');
  }
  return resolved;
}
