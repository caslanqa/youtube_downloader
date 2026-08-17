import { useEffect, useRef, useState } from 'react';
import type { Format, JobRequest, MediaInfo, Settings, VideoQuality } from '../../shared/types';
import { useT } from '../i18n';
import { BUTTON_PRIMARY, BUTTON_QUIET, FIELD, LABEL } from '../ui';

export const DOWNLOAD_POPOVER_ID = 'download-popover';

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

/**
 * Opens as a native Popover anchored to the player's Download button (same pattern as
 * SettingsPopover): light dismiss, Escape and focus return to the trigger are handled by the
 * browser, so no open/close state is kept here.
 */
export function DownloadPopover({
  url,
  info,
  settings,
  onPatch,
  onEnqueue,
}: {
  url: string;
  info: MediaInfo | null;
  settings: Settings;
  onPatch: (partial: Partial<Settings>) => void;
  onEnqueue: (request: JobRequest, info: MediaInfo | null) => Promise<void>;
}) {
  const t = useT();
  const popoverRef = useRef<HTMLDivElement>(null);
  const [albumName, setAlbumName] = useState('');
  // Once the user has touched the field, auto-fill must not overwrite their input.
  const [albumEdited, setAlbumEdited] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // A newly picked or pasted video gets a fresh suggestion; an edit made for the previous one
  // must not linger onto this one.
  useEffect(() => {
    setAlbumEdited(false);
  }, [url]);

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
      // The job is now visible in the queue below; the player keeps playing the same video.
      popoverRef.current?.hidePopover();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  return (
    <div
      ref={popoverRef}
      id={DOWNLOAD_POPOVER_ID}
      popover="auto"
      aria-labelledby="download-popover-title"
      className="download-popover w-96 rounded-xl border border-line-soft bg-panel p-5 text-ink shadow-lg"
    >
      <div className="mb-4 flex items-center justify-between gap-4">
        <h2 id="download-popover-title" className="text-sm font-semibold">
          {t('downloadPopoverTitle')}
        </h2>
        <button type="button" popoverTarget={DOWNLOAD_POPOVER_ID} popoverTargetAction="hide" className={BUTTON_QUIET}>
          {t('settingsClose')}
        </button>
      </div>

      <form onSubmit={handleSubmit}>
        <div className="flex gap-4">
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
    </div>
  );
}
