import { useState } from 'react';
import type { Format, JobRequest, MediaInfo, Settings } from '../../shared/types';
import { useT } from '../i18n';
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
  const t = useT();
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
            onChange={(event) => onFormatChange(event.target.value as Format)}
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
            onChange={(event) => setAlbumName(event.target.value)}
            placeholder={t('albumPlaceholder')}
            aria-describedby="album-hint"
            className={FIELD}
          />
        </div>
      </div>
      <p id="album-hint" className="mt-1.5 text-xs text-muted">
        {t('albumHint')}
      </p>

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
