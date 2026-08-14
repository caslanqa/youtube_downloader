import { useEffect, useRef, useState } from 'react';
import type { BinaryState, Job, JobRequest, MediaInfo, Settings } from '../shared/types';
import { DownloadForm } from './components/DownloadForm';
import { PrepScreen } from './components/PrepScreen';
import { QueueList } from './components/QueueList';
import { SettingsPanel } from './components/SettingsPanel';
import { useAppliedTheme } from './theme';

export function App() {
  const [binaries, setBinaries] = useState<BinaryState>({ kind: 'checking' });
  const [settings, setSettings] = useState<Settings | null>(null);
  const [jobs, setJobs] = useState<Job[]>([]);
  // Kuyruk bilgisi main tarafında tutulmuyor; probe sonucunu iş kimliğiyle burada eşliyoruz.
  const infoById = useRef(new Map<string, MediaInfo>());

  useAppliedTheme(settings?.theme ?? 'system');

  useEffect(() => {
    window.api.onBinaryState(setBinaries);
    // 'failed' durumu manager tarafından onBinaryState ile zaten yayınlanır;
    // burada sadece unhandled rejection oluşmasını önlüyoruz.
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
    setSettings((previous) => (previous ? { ...previous, ...partial } : previous)); // iyimser güncelleme
    const saved = await window.api.setSettings(partial).catch(() => null);
    if (saved) setSettings(saved);
  }

  async function enqueue(request: JobRequest, info: MediaInfo | null) {
    const jobId = await window.api.enqueue(request);
    if (info) infoById.current.set(jobId, info);
  }

  if (binaries.kind !== 'ready' || !settings) {
    return <PrepScreen state={binaries.kind === 'ready' ? { kind: 'checking' } : binaries} />;
  }

  return (
    <main className="min-h-screen px-6 py-10">
      <div className="mx-auto flex max-w-2xl flex-col gap-6">
        <header>
          <h1 className="text-2xl font-semibold tracking-tight">YouTube Downloader</h1>
          <p className="mt-1 text-sm text-muted">
            yt-dlp {binaries.ytdlpVersion} · ffmpeg {binaries.ffmpegVersion}
          </p>
        </header>

        <DownloadForm
          settings={settings}
          onFormatChange={(format) => void patchSettings({ defaultFormat: format })}
          onEnqueue={enqueue}
        />
        <SettingsPanel settings={settings} onChange={patchSettings} />
        <QueueList jobs={jobs} />
      </div>
    </main>
  );
}
