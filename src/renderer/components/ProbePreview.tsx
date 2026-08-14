import type { MediaInfo } from '../../shared/types';

function formatDuration(seconds?: number): string {
  if (seconds === undefined) return 'Tek video';
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
        Bağlantı inceleniyor…
      </p>
    );
  }

  if (!info) {
    return (
      <p id="url-status" className="mt-2 text-sm text-muted">
        Bağlantıyı yapıştırın; indirmeden önce içeriği burada görürsünüz.
      </p>
    );
  }

  return (
    <div id="url-status" aria-live="polite" className="mt-2 flex items-center gap-3">
      {info.thumbnail && (
        <img src={info.thumbnail} alt="" className="h-12 w-20 shrink-0 rounded object-cover" />
      )}
      <div className="min-w-0">
        <p className="truncate text-sm text-ink">{info.title}</p>
        <p className="text-xs text-muted">
          {info.isPlaylist ? `Oynatma listesi · ${info.entryCount} öğe` : formatDuration(info.duration)}
        </p>
      </div>
    </div>
  );
}
