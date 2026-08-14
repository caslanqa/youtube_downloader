import { useState } from 'react';
import type { Format, JobRequest, MediaInfo, Settings } from '../../shared/types';
import { useProbe } from '../useProbe';
import { BUTTON_PRIMARY, FIELD, LABEL, PANEL } from '../ui';
import { ProbePreview } from './ProbePreview';

export function DownloadForm({
  settings,
  onFormatChange,
  onEnqueue,
}: {
  settings: Settings;
  onFormatChange: (format: Format) => void;
  onEnqueue: (request: JobRequest, info: MediaInfo | null) => Promise<void>;
}) {
  const [url, setUrl] = useState('');
  const [albumName, setAlbumName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const { info, probing, probeError } = useProbe(url);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    const request: JobRequest = {
      url: url.trim(),
      format: settings.defaultFormat,
      albumName: albumName.trim(),
      destination: settings.destination,
      numberPlaylistItems: settings.numberPlaylistItems,
    };
    try {
      await onEnqueue(request, info);
      // Form temizlenir: kullanıcı beklemeden ikinci bağlantıyı girebilir (docs/PLAN.md §8).
      setUrl('');
      setAlbumName('');
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  return (
    <form onSubmit={handleSubmit} className={PANEL}>
      <div>
        <label className={LABEL} htmlFor="url">
          YouTube bağlantısı
        </label>
        <input
          id="url"
          type="url"
          required
          value={url}
          onChange={(event) => setUrl(event.target.value)}
          placeholder="https://www.youtube.com/watch?v=..."
          aria-invalid={probeError ? true : undefined}
          aria-describedby="url-status"
          className={FIELD}
        />
        <ProbePreview info={info} probing={probing} probeError={probeError} />
      </div>

      <div className="mt-4 flex gap-4">
        <div className="flex-1">
          <label className={LABEL} htmlFor="format">
            Format
          </label>
          <select
            id="format"
            value={settings.defaultFormat}
            onChange={(event) => onFormatChange(event.target.value as Format)}
            className={FIELD}
          >
            <option value="mp3">MP3 (ses)</option>
            <option value="mp4">MP4 (video)</option>
            <option value="webm">WebM (video)</option>
          </select>
        </div>
        <div className="flex-1">
          <label className={LABEL} htmlFor="album">
            Albüm adı
          </label>
          <input
            id="album"
            type="text"
            value={albumName}
            onChange={(event) => setAlbumName(event.target.value)}
            placeholder="Indirilenler"
            aria-describedby="album-hint"
            className={FIELD}
          />
        </div>
      </div>
      <p id="album-hint" className="mt-1.5 text-xs text-muted">
        Dosyalar hedef klasörün altında bu adla bir alt klasöre iner.
      </p>

      <button type="submit" className={`${BUTTON_PRIMARY} mt-5 w-full`}>
        Kuyruğa ekle
      </button>

      {error && (
        <p role="alert" className="mt-3 text-sm text-danger">
          {error}
        </p>
      )}
    </form>
  );
}
