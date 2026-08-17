import { useRef, useState } from 'react';
import type { SearchResultItem } from '../../shared/types';
import { useT } from '../i18n';
import { BUTTON_PRIMARY, FIELD } from '../ui';

function formatDuration(seconds?: number): string | null {
  if (seconds === undefined) return null;
  const mins = Math.floor(seconds / 60);
  const secs = Math.round(seconds % 60);
  return `${mins}:${String(secs).padStart(2, '0')}`;
}

/**
 * YouTube Data API search has a small daily quota (100 free search calls/day per key), so this
 * only searches on explicit submit — never as-you-type — and caches results per query for the
 * component's lifetime so an accidental repeat search doesn't spend quota twice.
 */
export function SearchPanel({ onPick }: { onPick: (videoId: string) => void }) {
  const t = useT();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResultItem[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const cache = useRef(new Map<string, SearchResultItem[]>());

  async function handleSearch(event: React.FormEvent) {
    event.preventDefault();
    const trimmed = query.trim();
    if (!trimmed) return;
    setError(null);

    const cacheKey = trimmed.toLowerCase();
    const cached = cache.current.get(cacheKey);
    if (cached) {
      setResults(cached);
      return;
    }

    setLoading(true);
    try {
      const found = await window.api.searchVideos(trimmed);
      cache.current.set(cacheKey, found);
      setResults(found);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setResults(null);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <form onSubmit={handleSearch} className="flex gap-2">
        <label className="sr-only" htmlFor="youtube-search">
          {t('searchLabel')}
        </label>
        <input
          id="youtube-search"
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={t('searchPlaceholder')}
          aria-describedby="search-status"
          className={FIELD}
        />
        <button type="submit" disabled={loading} className={`${BUTTON_PRIMARY} shrink-0 px-4`}>
          {loading ? t('searching') : t('searchButton')}
        </button>
      </form>

      <div id="search-status" aria-live="polite">
        {error && (
          <p role="alert" className="mt-3 text-sm text-danger">
            {error}
          </p>
        )}
        {!error && results && results.length === 0 && <p className="mt-3 text-sm text-muted">{t('searchNoResults')}</p>}
      </div>

      {results && results.length > 0 && (
        <ul className="mt-3 max-h-96 space-y-2 overflow-y-auto">
          {results.map((item) => (
            <li key={item.videoId}>
              <button
                type="button"
                onClick={() => onPick(item.videoId)}
                className="flex w-full items-center gap-3 rounded-lg border border-line-soft p-2 text-left transition-colors hover:bg-surface"
              >
                {item.thumbnail && (
                  <img src={item.thumbnail} alt="" className="h-12 w-20 shrink-0 rounded object-cover" />
                )}
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm text-ink">{item.title}</p>
                  <p className="truncate text-xs text-muted">{item.channelTitle}</p>
                </div>
                {formatDuration(item.duration) && (
                  <span className="shrink-0 text-xs text-muted">{formatDuration(item.duration)}</span>
                )}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
