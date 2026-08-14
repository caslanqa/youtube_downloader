import { useEffect, useState } from 'react';
import type { BinaryState, Format, Job, JobRequest } from '../shared/types';

export function App() {
  const [state, setState] = useState<BinaryState>({ kind: 'checking' });

  useEffect(() => {
    window.api.onBinaryState(setState);
    // 'failed' durumu manager tarafından onBinaryState ile zaten yayınlanır;
    // burada sadece unhandled rejection oluşmasını önlüyoruz.
    window.api.ensureBinaries().catch(() => undefined);
  }, []);

  if (state.kind !== 'ready') {
    return <PrepScreen state={state} />;
  }

  return (
    <div className="min-h-screen min-w-[720px] bg-neutral-950 px-8 py-10 text-neutral-100">
      <header className="mb-8 text-center">
        <h1 className="text-2xl font-semibold">YouTube Downloader</h1>
        <p className="mt-1 text-sm text-neutral-400">
          yt-dlp {state.ytdlpVersion} · ffmpeg {state.ffmpegVersion} hazır
        </p>
      </header>
      <DownloadPanel />
    </div>
  );
}

function DownloadPanel() {
  const [url, setUrl] = useState('');
  const [format, setFormat] = useState<Format>('mp3');
  const [albumName, setAlbumName] = useState('');
  const [job, setJob] = useState<Job | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    window.api.onJobUpdate(setJob);
  }, []);

  const busy = job !== null && (job.status.kind === 'queued' || job.status.kind === 'running');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const request: JobRequest = {
      url: url.trim(),
      format,
      albumName: albumName.trim(),
      destination: '',
      numberPlaylistItems: false,
    };
    try {
      await window.api.enqueue(request);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  function handleCancel() {
    if (job) void window.api.cancel(job.id);
  }

  return (
    <div className="mx-auto max-w-xl space-y-6">
      <form onSubmit={handleSubmit} className="space-y-4 rounded-lg bg-neutral-900 p-6">
        <div>
          <label className="mb-1 block text-sm text-neutral-400" htmlFor="url">
            YouTube bağlantısı
          </label>
          <input
            id="url"
            type="url"
            required
            disabled={busy}
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://www.youtube.com/watch?v=..."
            className="w-full rounded border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm outline-none focus:border-neutral-500 disabled:opacity-50"
          />
        </div>
        <div className="flex gap-4">
          <div className="flex-1">
            <label className="mb-1 block text-sm text-neutral-400" htmlFor="format">
              Format
            </label>
            <select
              id="format"
              disabled={busy}
              value={format}
              onChange={(e) => setFormat(e.target.value as Format)}
              className="w-full rounded border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm outline-none focus:border-neutral-500 disabled:opacity-50"
            >
              <option value="mp3">MP3 (ses)</option>
              <option value="mp4">MP4 (video)</option>
              <option value="webm">WebM (video)</option>
            </select>
          </div>
          <div className="flex-1">
            <label className="mb-1 block text-sm text-neutral-400" htmlFor="album">
              Albüm adı
            </label>
            <input
              id="album"
              type="text"
              disabled={busy}
              value={albumName}
              onChange={(e) => setAlbumName(e.target.value)}
              placeholder="Indirilenler"
              className="w-full rounded border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm outline-none focus:border-neutral-500 disabled:opacity-50"
            />
          </div>
        </div>
        <button
          type="submit"
          disabled={busy}
          className="w-full rounded bg-red-600 py-2 text-sm font-medium hover:bg-red-500 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {busy ? 'İndiriliyor…' : 'İndir'}
        </button>
      </form>
      {error && <p className="text-sm text-red-400">{error}</p>}
      {job && <JobCard job={job} onCancel={handleCancel} />}
    </div>
  );
}

function JobCard({ job, onCancel }: { job: Job; onCancel: () => void }) {
  const { status } = job;
  return (
    <div className="rounded-lg bg-neutral-900 p-6" role="status" aria-live="polite">
      {status.kind === 'queued' && <p className="text-sm text-neutral-400">Sırada bekliyor…</p>}
      {status.kind === 'running' && (
        <div className="space-y-2">
          <div className="h-2 w-full overflow-hidden rounded bg-neutral-800">
            <div className="h-full bg-red-600 transition-all" style={{ width: `${status.percent}%` }} />
          </div>
          <div className="flex items-center justify-between text-sm text-neutral-400">
            <span>
              %{status.percent}
              {status.speed ? ` · ${status.speed}` : ''}
              {status.eta ? ` · ETA ${status.eta}` : ''}
            </span>
            <button onClick={onCancel} className="text-red-400 hover:underline">
              İptal
            </button>
          </div>
        </div>
      )}
      {status.kind === 'done' && (
        <p className="text-sm text-emerald-400">
          Tamamlandı — {status.fileCount} dosya · {status.outputDir}
        </p>
      )}
      {status.kind === 'cancelled' && <p className="text-sm text-neutral-400">İptal edildi.</p>}
      {status.kind === 'error' && (
        <div className="space-y-1">
          <p className="text-sm text-red-400">{status.message}</p>
          {status.logTail && (
            <pre className="max-h-32 overflow-auto rounded bg-neutral-950 p-2 text-xs text-neutral-500">
              {status.logTail}
            </pre>
          )}
        </div>
      )}
    </div>
  );
}


function PrepScreen({ state }: { state: Exclude<BinaryState, { kind: 'ready' }> }) {
  const label =
    state.kind === 'checking'
      ? 'Bağımlılıklar kontrol ediliyor…'
      : state.kind === 'downloading'
        ? `${state.name} indiriliyor… %${state.percent}`
        : `Hata: ${state.message}`;

  return (
    <div
      role="status"
      aria-live="polite"
      className="flex min-h-screen min-w-[720px] flex-col items-center justify-center gap-3 bg-neutral-950 text-neutral-100"
    >
      <h1 className="text-xl font-semibold">YouTube Downloader</h1>
      <p className={state.kind === 'failed' ? 'text-red-400' : 'text-neutral-400'}>{label}</p>
    </div>
  );
}
