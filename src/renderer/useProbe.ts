import { useEffect, useState } from 'react';
import type { MediaInfo } from '../shared/types';

const PROBE_DEBOUNCE_MS = 600;

/**
 * Fetches title, thumbnail and item count while the URL is typed, before anything is
 * downloaded (docs/PLAN.md §8). Debounced so no yt-dlp process starts on every keystroke.
 */
export function useProbe(url: string) {
  const [info, setInfo] = useState<MediaInfo | null>(null);
  const [probing, setProbing] = useState(false);
  const [probeError, setProbeError] = useState<string | null>(null);

  useEffect(() => {
    const trimmed = url.trim();
    if (!trimmed.startsWith('https://')) {
      setInfo(null);
      setProbeError(null);
      setProbing(false);
      return;
    }
    let stale = false;
    setProbing(true);
    setProbeError(null);
    const timer = setTimeout(() => {
      window.api
        .probe(trimmed)
        .then((result) => {
          if (!stale) setInfo(result);
        })
        .catch((err: unknown) => {
          if (stale) return;
          setInfo(null);
          setProbeError(err instanceof Error ? err.message : String(err));
        })
        .finally(() => {
          if (!stale) setProbing(false);
        });
    }, PROBE_DEBOUNCE_MS);

    return () => {
      stale = true;
      clearTimeout(timer);
    };
  }, [url]);

  return { info, probing, probeError };
}
