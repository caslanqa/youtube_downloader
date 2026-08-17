import { useEffect, useState } from 'react';
import type { Format, JobRequest, MediaInfo, Settings, VideoQuality } from '../../shared/types';
import { useT } from '../i18n';
import { useProbe } from '../useProbe';
import { BUTTON_PRIMARY, BUTTON_QUIET, FIELD, LABEL, PANEL } from '../ui';
import { ProbePreview } from './ProbePreview';
import { SearchPanel } from './SearchPanel';

const ALBUM_NAME_MAX = 80;

/**
 * Suggests a folder name from the probed title: path separators and characters that upset
 * filesystems are replaced, and long titles are truncated. The main process validates the
 * value again (validate.ts); this is only a suggestion.
 */
function suggestAlbumName(title: string): string {
  return title
    .replace(/[\\/:*?"<>|]/g, '-')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, ALBUM_NAME_MAX)
    .trim();
}

/**
 * Absolute destination paths are long enough to make the row unreadable, and the leading
 * segments carry no information for the user. Only the last two segments are shown; the full
 * path stays available as a tooltip.
 */
function shortenPath(fullPath: string): string {
  const segments = fullPath.split(/[\\/]+/).filter(Boolean);
  return segments.length <= 2 ? fullPath : `…/${segments.slice(-2).join('/')}`;
}

type Mode = 'link' | 'search';

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
  const [mode, setMode] = useState<Mode>('link');
  const [url, setUrl] = useState('');
  const [albumName, setAlbumName] = useState('');
  // Once the user has touched the field, auto-fill must not overwrite their input.
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
      quality: settings.defaultQuality,
      albumName: albumName.trim(),
      destination: settings.destination,
      numberPlaylistItems: settings.numberPlaylistItems,
    };
    try {
      await onEnqueue(request, info);
      // Clear the form so a second link can be entered right away (docs/PLAN.md §8).
      setUrl('');
      setAlbumName('');
      setAlbumEdited(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  return (
    <div className={PANEL}>
      {/*
        A plain toggle-button pair (WAI-ARIA "button" pattern with aria-pressed), not
        role="tab"/tablist: that pattern requires roving-tabindex arrow-key navigation, which
        isn't implemented here for a plain two-way switch. Tab still moves between the buttons.
      */}
      <div role="group" aria-label={t('sourceModeLabel')} className="mb-4 inline-flex rounded-lg border border-line-soft p-0.5">
        {(['link', 'search'] as const).map((candidate) => (
          <button
            key={candidate}
            type="button"
            aria-pressed={mode === candidate}
            onClick={() => setMode(candidate)}
            className={`rounded-md px-3 py-1.5 text-sm transition-colors ${
              mode === candidate ? 'bg-brand text-white' : 'text-muted hover:text-ink'
            }`}
          >
            {candidate === 'link' ? t('modeLink') : t('modeSearch')}
          </button>
        ))}
      </div>

      {mode === 'search' ? (
        <SearchPanel
          onPick={(videoId) => {
            setUrl(`https://www.youtube.com/watch?v=${videoId}`);
            setMode('link');
          }}
        />
      ) : (
        <form onSubmit={handleSubmit}>
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
            {settings.defaultFormat !== 'mp3' && (
              <div className="flex-1">
                <label className={LABEL} htmlFor="quality">
                  {t('qualityLabel')}
                </label>
                <select
                  id="quality"
                  value={settings.defaultQuality}
                  onChange={(event) => onPatch({ defaultQuality: event.target.value as VideoQuality })}
                  className={FIELD}
                >
                  <option value="best">{t('qualityBest')}</option>
                  <option value="2160">2160p (4K)</option>
                  <option value="1440">1440p (2K)</option>
                  <option value="1080">1080p</option>
                  <option value="720">720p</option>
                  <option value="480">480p</option>
                  <option value="360">360p</option>
                </select>
              </div>
            )}
          </div>

          <div className="mt-4">
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
          <p id="album-hint" className="mt-1.5 text-xs text-muted">
            {t('albumHint')}
          </p>

          <div className="mt-4">
            <label className={LABEL} htmlFor="destination">
              {t('destinationLabel')}
            </label>
            <div className="flex gap-2">
              <input
                id="destination"
                type="text"
                readOnly
                value={shortenPath(settings.destination)}
                title={settings.destination}
                className={`${FIELD} text-muted`}
              />
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
      )}
    </div>
  );
}
