import { useEffect, useState } from 'react';
import type { Format, JobRequest, MediaInfo, Settings } from '../../shared/types';
import { useT } from '../i18n';
import { useProbe } from '../useProbe';
import { BUTTON_PRIMARY, BUTTON_QUIET, FIELD, LABEL, PANEL } from '../ui';
import { ProbePreview } from './ProbePreview';

const ALBUM_NAME_MAX = 80;

/**
 * Probe'dan gelen başlığı klasör adı olarak önerir: yol ayırıcıları ve dosya
 * sistemlerinde sorun çıkaran karakterler elenir, uzun başlıklar kısaltılır.
 * Main süreci ayrıca kendi doğrulamasını yapıyor (validate.ts) — bu yalnızca öneri.
 */
function suggestAlbumName(title: string): string {
  return title
    .replace(/[\\/:*?"<>|]/g, '-')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, ALBUM_NAME_MAX)
    .trim();
}

export function DownloadForm({
  settings,
  onPatch,
  onEnqueue,
}: {
  settings: Settings;
  onPatch: (partial: Partial<Settings>) => void;
  onEnqueue: (request: JobRequest, info: MediaInfo | null) => Promise<void>;
}) {
  const t = useT();
  const [url, setUrl] = useState('');
  const [albumName, setAlbumName] = useState('');
  // Kullanıcı alana bir kez dokunduysa otomatik doldurma onu ezmez.
  const [albumEdited, setAlbumEdited] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { info, probing, probeError } = useProbe(url);

  useEffect(() => {
    if (albumEdited || !info) return;
    setAlbumName(suggestAlbumName(info.title));
  }, [info, albumEdited]);

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
      setAlbumEdited(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  return (
    <form onSubmit={handleSubmit} className={PANEL}>
      <div>
        <label className={LABEL} htmlFor="url">
          {t('urlLabel')}
        </label>
        <input
          id="url"
          type="url"
          required
          value={url}
          onChange={(event) => setUrl(event.target.value)}
          placeholder={t('urlPlaceholder')}
          aria-invalid={probeError ? true : undefined}
          aria-describedby="url-status"
          className={FIELD}
        />
        <ProbePreview info={info} probing={probing} probeError={probeError} />
      </div>

      <div className="mt-4 flex gap-4">
        <div className="flex-1">
          <label className={LABEL} htmlFor="format">
            {t('formatLabel')}
          </label>
          <select
            id="format"
            value={settings.defaultFormat}
            onChange={(event) => onPatch({ defaultFormat: event.target.value as Format })}
            className={FIELD}
          >
            <option value="mp3">{t('formatMp3')}</option>
            <option value="mp4">{t('formatMp4')}</option>
            <option value="webm">{t('formatWebm')}</option>
          </select>
        </div>
        <div className="flex-1">
          <label className={LABEL} htmlFor="album">
            {t('albumLabel')}
          </label>
          <input
            id="album"
            type="text"
            value={albumName}
            onChange={(event) => {
              setAlbumEdited(true);
              setAlbumName(event.target.value);
            }}
            placeholder={t('albumPlaceholder')}
            aria-describedby="album-hint"
            className={FIELD}
          />
        </div>
      </div>
      <p id="album-hint" className="mt-1.5 text-xs text-muted">
        {t('albumHint')}
      </p>

      <div className="mt-4">
        <label className={LABEL} htmlFor="destination">
          {t('destinationLabel')}
        </label>
        <div className="flex gap-2">
          <input id="destination" type="text" readOnly value={settings.destination} className={`${FIELD} text-muted`} />
          <button
            type="button"
            onClick={async () => {
              const picked = await window.api.pickFolder();
              if (picked) onPatch({ destination: picked });
            }}
            className={`${BUTTON_QUIET} shrink-0`}
          >
            {t('destinationPick')}
          </button>
        </div>
      </div>

      <button type="submit" className={`${BUTTON_PRIMARY} mt-5 w-full`}>
        {t('submit')}
      </button>

      {error && (
        <p role="alert" className="mt-3 text-sm text-danger">
          {error}
        </p>
      )}
    </form>
  );
}
