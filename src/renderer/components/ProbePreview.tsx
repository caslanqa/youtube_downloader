import type { MediaInfo } from '../../shared/types';
import { useT } from '../i18n';

function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.round(seconds % 60);
  return `${mins}:${String(secs).padStart(2, '0')}`;
}

export function ProbePreview({
  info,
  probing,
  probeError,
}: {
  info: MediaInfo | null;
  probing: boolean;
  probeError: string | null;
}) {
  const t = useT();

  if (probeError) {
    return (
      <p id="url-status" role="alert" className="mt-2 text-sm text-danger">
        {probeError}
      </p>
    );
  }

  if (probing) {
    return (
      <p id="url-status" aria-live="polite" className="mt-2 text-sm text-muted">
        {t('probing')}
      </p>
    );
  }

  if (!info) {
    return (
      <p id="url-status" className="mt-2 text-sm text-muted">
        {t('urlHint')}
      </p>
    );
  }

  return (
    <div id="url-status" aria-live="polite" className="mt-2 flex items-center gap-3">
      {info.thumbnail && <img src={info.thumbnail} alt="" className="h-12 w-20 shrink-0 rounded object-cover" />}
      <div className="min-w-0">
        <p className="truncate text-sm text-ink">{info.title}</p>
        <p className="text-xs text-muted">
          {info.isPlaylist
            ? t('playlistSummary', { count: info.entryCount })
            : info.duration !== undefined
              ? formatDuration(info.duration)
              : t('singleVideo')}
        </p>
      </div>
    </div>
  );
}
