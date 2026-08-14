import { useEffect, useRef, useState } from 'react';
import type { BinaryState, Job, JobRequest, MediaInfo, Settings } from '../shared/types';
import { DownloadForm } from './components/DownloadForm';
import { PrepScreen } from './components/PrepScreen';
import { QueueList } from './components/QueueList';
import { SETTINGS_POPOVER_ID, SettingsPopover } from './components/SettingsPopover';
import { LanguageProvider, useT } from './i18n';
import { useAppliedTheme } from './theme';

export function App() {
  const [binaries, setBinaries] = useState<BinaryState>({ kind: 'checking' });
  const [settings, setSettings] = useState<Settings | null>(null);
  const [jobs, setJobs] = useState<Job[]>([]);
  // The main process does not keep probe results, so they are matched to job ids here.
  const infoById = useRef(new Map<string, MediaInfo>());

  const language = settings?.language ?? 'en';
  useAppliedTheme(settings?.theme ?? 'system');

  useEffect(() => {
    // Keep the document language in sync so screen readers pronounce it correctly (WCAG 3.1.1).
    document.documentElement.lang = language;
  }, [language]);

  useEffect(() => {
    window.api.onBinaryState(setBinaries);
    // The manager already broadcasts the 'failed' state through onBinaryState; this catch only
    // prevents an unhandled rejection.
    window.api.ensureBinaries().catch(() => undefined);
    window.api.getSettings().then(setSettings).catch(() => undefined);

    window.api.onJobUpdate((job) => {
      setJobs((previous) => {
        const merged = { ...job, info: infoById.current.get(job.id) };
        const index = previous.findIndex((candidate) => candidate.id === job.id);
        if (index === -1) return [...previous, merged];
        const next = [...previous];
        next[index] = merged;
        return next;
      });
    });
  }, []);

  async function patchSettings(partial: Partial<Settings>) {
    setSettings((previous) => (previous ? { ...previous, ...partial } : previous)); // optimistic update
    const saved = await window.api.setSettings(partial).catch(() => null);
    if (saved) setSettings(saved);
  }

  async function enqueue(request: JobRequest, info: MediaInfo | null) {
    const jobId = await window.api.enqueue(request);
    if (info) infoById.current.set(jobId, info);
  }

  return (
    <LanguageProvider language={language}>
      {binaries.kind !== 'ready' || !settings ? (
        <PrepScreen state={binaries.kind === 'ready' ? { kind: 'checking' } : binaries} />
      ) : (
        <Workspace binaries={binaries} settings={settings} jobs={jobs} onPatch={patchSettings} onEnqueue={enqueue} />
      )}
    </LanguageProvider>
  );
}

function Workspace({
  binaries,
  settings,
  jobs,
  onPatch,
  onEnqueue,
}: {
  binaries: Extract<BinaryState, { kind: 'ready' }>;
  settings: Settings;
  jobs: Job[];
  onPatch: (partial: Partial<Settings>) => void;
  onEnqueue: (request: JobRequest, info: MediaInfo | null) => Promise<void>;
}) {
  const t = useT();

  return (
    <main className="min-h-screen px-6 py-10">
      <div className="mx-auto flex max-w-2xl flex-col gap-6">
        <header className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">{t('appTitle')}</h1>
            <p className="mt-1 text-sm text-muted">
              {t('binariesVersions', { ytdlp: binaries.ytdlpVersion, ffmpeg: binaries.ffmpegVersion })}
            </p>
          </div>
          <button
            type="button"
            popoverTarget={SETTINGS_POPOVER_ID}
            aria-label={t('settingsOpen')}
            className="settings-anchor rounded-lg border border-line-soft p-2.5 text-muted transition-colors hover:bg-panel hover:text-ink"
          >
            <GearIcon />
          </button>
          <SettingsPopover settings={settings} onChange={onPatch} />
        </header>

        <DownloadForm settings={settings} onPatch={onPatch} onEnqueue={onEnqueue} />
        <QueueList jobs={jobs} />
      </div>
    </main>
  );
}

function GearIcon() {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
      <circle cx="12" cy="12" r="3.2" />
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M19.4 13.5a7.7 7.7 0 0 0 0-3l1.7-1.3-1.9-3.3-2 .8a7.7 7.7 0 0 0-2.6-1.5L14.3 3H10l-.3 2.2a7.7 7.7 0 0 0-2.6 1.5l-2-.8-1.9 3.3 1.7 1.3a7.7 7.7 0 0 0 0 3l-1.7 1.3 1.9 3.3 2-.8a7.7 7.7 0 0 0 2.6 1.5L10 21h4.3l.3-2.2a7.7 7.7 0 0 0 2.6-1.5l2 .8 1.9-3.3-1.7-1.3Z"
      />
    </svg>
  );
}
