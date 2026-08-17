import { useState } from 'react';
import type { JobRequest, MediaInfo, Settings } from '../../shared/types';
import { formatDuration } from '../format';
import { useT } from '../i18n';
import { useProbe } from '../useProbe';
import { BUTTON_PRIMARY, FIELD, LABEL, PANEL } from '../ui';
import { DOWNLOAD_POPOVER_ID, DownloadPopover } from './DownloadPopover';
import { SearchPanel } from './SearchPanel';
import { VideoPlayer } from './VideoPlayer';

type Mode = 'link' | 'search';

/**
 * The primary workspace: paste a link or search, watch it inline, and download it from a
 * popover anchored to the player rather than an always-visible form (docs/PLAN.md §17).
 */
export function PlayerPanel({
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
  const { info, probing, probeError } = useProbe(url);

  return (
    <div className={PANEL}>
      {/*
        A plain toggle-button pair (WAI-ARIA "button" pattern with aria-pressed), not
        role="tab"/tablist: that pattern requires roving-tabindex arrow-key navigation, which
        isn't implemented here for a plain two-way switch. Tab still moves between the buttons.
      */}
      <div
        role="group"
        aria-label={t('sourceModeLabel')}
        className="mb-4 inline-flex rounded-lg border border-line-soft p-0.5"
      >
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
        <div>
          <label className={LABEL} htmlFor="url">
            {t('urlLabel')}
          </label>
          <input
            id="url"
            type="url"
            value={url}
            onChange={(event) => setUrl(event.target.value)}
            placeholder={t('urlPlaceholder')}
            aria-invalid={probeError ? true : undefined}
            aria-describedby="url-status"
            className={FIELD}
          />

          <div id="url-status" aria-live="polite">
            {probing && <p className="mt-2 text-sm text-muted">{t('probing')}</p>}
            {probeError && (
              <p role="alert" className="mt-2 text-sm text-danger">
                {probeError}
              </p>
            )}
            {!probing && !probeError && !info && <p className="mt-2 text-sm text-muted">{t('urlHint')}</p>}
          </div>

          {info && !probing && !probeError && (
            <div className="mt-3">
              <p className="truncate text-sm text-ink">{info.title}</p>
              <p className="mb-2 text-xs text-muted">
                {info.isPlaylist
                  ? t('playlistSummary', { count: info.entryCount })
                  : (formatDuration(info.duration) ?? t('singleVideo'))}
              </p>
              <VideoPlayer info={info} />
              <button
                type="button"
                popoverTarget={DOWNLOAD_POPOVER_ID}
                className={`download-anchor ${BUTTON_PRIMARY} mt-3`}
              >
                {t('downloadButton')}
              </button>
            </div>
          )}
        </div>
      )}

      <DownloadPopover url={url} info={info} settings={settings} onPatch={onPatch} onEnqueue={onEnqueue} />
    </div>
  );
}
