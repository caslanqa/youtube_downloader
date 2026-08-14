import { useEffect, useState } from 'react';
import type { MediaInfo } from '../shared/types';

const PROBE_DEBOUNCE_MS = 600;

/**
 * URL yazıldıkça indirmeden önce başlık/kapak/öğe sayısı bilgisini çeker
 * (bkz. docs/PLAN.md §8). Her tuş vuruşunda yt-dlp süreci başlatmamak için gecikmeli.
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
