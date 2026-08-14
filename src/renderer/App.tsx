import { useEffect, useRef, useState } from 'react';
import type { BinaryState, Format, Job, JobRequest, MediaInfo, Settings } from '../shared/types';

export function App() {
  const [state, setState] = useState<BinaryState>({ kind: 'checking' });
  const [settings, setSettings] = useState<Settings | null>(null);

  useEffect(() => {
    window.api.onBinaryState(setState);
    // 'failed' durumu manager tarafından onBinaryState ile zaten yayınlanır;
    // burada sadece unhandled rejection oluşmasını önlüyoruz.
    window.api.ensureBinaries().catch(() => undefined);
    window.api.getSettings().then(setSettings).catch(() => undefined);
  }, []);

  if (state.kind !== 'ready' || !settings) {
    return <PrepScreen state={state.kind === 'ready' ? { kind: 'checking' } : state} />;
  }

  return (
    <div className="min-h-screen min-w-[720px] bg-neutral-950 px-8 py-10 text-neutral-100">
      <header className="mb-8 text-center">
        <h1 className="text-2xl font-semibold">YouTube Downloader</h1>
        <p className="mt-1 text-sm text-neutral-400">
          yt-dlp {state.ytdlpVersion} · ffmpeg {state.ffmpegVersion} hazır
        </p>
      </header>
      <DownloadPanel initialSettings={settings} />
    </div>
  );
}

/** URL yapıştırıldığında indirmeden önce başlık/süre/öğe sayısı bilgisini çeker (bkz. docs/PLAN.md §8). */
function useProbe(url: string) {
  const [info, setInfo] = useState<MediaInfo | null>(null);
  const [probing, setProbing] = useState(false);
  const [probeError, setProbeError] = useState<string | null>(null);

  useEffect(() => {
    const trimmed = url.trim();
    if (!trimmed.startsWith('https://')) {
      setInfo(null);
      setProbeError(null);
      setProbing(false);
      return;
    }
    let stale = false;
    setProbing(true);
    setProbeError(null);
    // Her tuş vuruşunda yt-dlp süreci başlatmamak için gecikme.
    const timer = setTimeout(() => {
      window.api
        .probe(trimmed)
        .then((result) => {
          if (stale) return;
          setInfo(result);
        })
        .catch((err: unknown) => {
          if (stale) return;
          setInfo(null);
          setProbeError(err instanceof Error ? err.message : String(err));
        })
        .finally(() => {
          if (!stale) setProbing(false);
        });
    }, 600);

    return () => {
      stale = true;
      clearTimeout(timer);
    };
  }, [url]);

  return { info, probing, probeError };
}

function DownloadPanel({ initialSettings }: { initialSettings: Settings }) {
  const [settings, setSettings] = useState<Settings>(initialSettings);
  const [url, setUrl] = useState('');
  const [format, setFormat] = useState<Format>(initialSettings.defaultFormat);
  const [albumName, setAlbumName] = useState('');
  const [jobs, setJobs] = useState<Job[]>([]);
  const [error, setError] = useState<string | null>(null);
  // Kuyruk bilgisi main tarafında tutulmuyor; probe sonucunu iş kimliğiyle burada eşliyoruz.
  const infoById = useRef(new Map<string, MediaInfo>());

  const { info, probing, probeError } = useProbe(url);

  useEffect(() => {
    window.api.onJobUpdate((job) => {
      setJobs((prev) => {
        const idx = prev.findIndex((j) => j.id === job.id);
        const merged = { ...job, info: infoById.current.get(job.id) };
        if (idx === -1) return [...prev, merged];
        const next = [...prev];
        next[idx] = merged;
        return next;
      });
    });
  }, []);

  async function patchSettings(partial: Partial<Settings>) {
    setSettings((prev) => ({ ...prev, ...partial })); // iyimser güncelleme
    const saved = await window.api.setSettings(partial).catch(() => null);
    if (saved) setSettings(saved);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const request: JobRequest = {
      url: url.trim(),
      format,
      albumName: albumName.trim(),
      destination: settings.destination,
      numberPlaylistItems: settings.numberPlaylistItems,
    };
    try {
      const jobId = await window.api.enqueue(request);
      if (info) infoById.current.set(jobId, info);
      // Form temizlenir: kullanıcı beklemeden ikinci bağlantıyı girebilir (docs/PLAN.md §8).
      setUrl('');
      setAlbumName('');
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <form onSubmit={handleSubmit} className="space-y-4 rounded-lg bg-neutral-900 p-6">
        <div>
          <label className="mb-1 block text-sm text-neutral-400" htmlFor="url">
            YouTube bağlantısı
          </label>
          <input
            id="url"
            type="url"
            required
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://www.youtube.com/watch?v=..."
            aria-invalid={probeError ? true : undefined}
            aria-describedby={probeError ? 'url-error' : 'url-preview'}
            className="w-full rounded border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm outline-none focus:border-neutral-500"
          />
          <ProbePreview info={info} probing={probing} probeError={probeError} />
        </div>
        <div className="flex gap-4">
          <div className="flex-1">
            <label className="mb-1 block text-sm text-neutral-400" htmlFor="format">
              Format
            </label>
            <select
              id="format"
              value={format}
              onChange={(e) => {
                const next = e.target.value as Format;
                setFormat(next);
                void patchSettings({ defaultFormat: next }); // seçim bir sonraki açılışta hatırlanır
              }}
              className="w-full rounded border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm outline-none focus:border-neutral-500"
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
              value={albumName}
              onChange={(e) => setAlbumName(e.target.value)}
              placeholder="Indirilenler"
              className="w-full rounded border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm outline-none focus:border-neutral-500"
            />
          </div>
        </div>
        <button
          type="submit"
          className="w-full rounded bg-red-600 py-2 text-sm font-medium hover:bg-red-500 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Kuyruğa ekle
        </button>
        {error && (
          <p id="url-error" role="alert" className="text-sm text-red-400">
            {error}
          </p>
        )}
      </form>

      <SettingsPanel settings={settings} onChange={patchSettings} />
      <QueueList jobs={jobs} />
    </div>
  );
}

function ProbePreview({
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
      <p id="url-error" role="alert" className="mt-2 text-sm text-red-400">
        {probeError}
      </p>
    );
  }
  if (probing) {
    return (
      <p id="url-preview" className="mt-2 text-sm text-neutral-500" aria-live="polite">
        Bağlantı inceleniyor…
      </p>
    );
  }
  if (!info) return null;

  return (
    <div id="url-preview" aria-live="polite" className="mt-2 flex items-center gap-3">
      {info.thumbnail && <img src={info.thumbnail} alt="" className="h-12 w-20 rounded object-cover" />}
      <div className="min-w-0">
        <p className="truncate text-sm text-neutral-200">{info.title}</p>
        <p className="text-xs text-neutral-500">
          {info.isPlaylist ? `Oynatma listesi · ${info.entryCount} öğe` : formatDuration(info.duration)}
        </p>
      </div>
    </div>
  );
}

function SettingsPanel({
  settings,
  onChange,
}: {
  settings: Settings;
  onChange: (partial: Partial<Settings>) => void;
}) {
  return (
    <details className="rounded-lg bg-neutral-900 p-6">
      <summary className="cursor-pointer text-sm text-neutral-300">Ayarlar</summary>
      <div className="mt-4 space-y-4">
        <div>
          <label className="mb-1 block text-sm text-neutral-400" htmlFor="destination">
            Hedef klasör
          </label>
          <div className="flex gap-2">
            <input
              id="destination"
              type="text"
              readOnly
              value={settings.destination}
              className="w-full rounded border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm text-neutral-300 outline-none"
            />
            <button
              type="button"
              onClick={async () => {
                const picked = await window.api.pickFolder();
                if (picked) onChange({ destination: picked });
              }}
              className="shrink-0 rounded border border-neutral-700 px-3 py-2 text-sm hover:bg-neutral-800"
            >
              Seç
            </button>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <label className="text-sm text-neutral-400" htmlFor="concurrency">
            Eşzamanlı indirme
          </label>
          <input
            id="concurrency"
            type="number"
            min={1}
            max={5}
            value={settings.concurrency}
            onChange={(e) => {
              const value = Number(e.target.value);
              if (Number.isFinite(value) && value >= 1 && value <= 5) onChange({ concurrency: value });
            }}
            className="w-20 rounded border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm outline-none focus:border-neutral-500"
          />
        </div>
        <div className="flex items-center gap-2">
          <input
            id="numbering"
            type="checkbox"
            checked={settings.numberPlaylistItems}
            onChange={(e) => onChange({ numberPlaylistItems: e.target.checked })}
            className="size-4"
          />
          <label className="text-sm text-neutral-400" htmlFor="numbering">
            Oynatma listesi dosyalarını numaralandır
          </label>
        </div>
      </div>
    </details>
  );
}

function QueueList({ jobs }: { jobs: Job[] }) {
  if (jobs.length === 0) return null;
  return (
    <section aria-label="İndirme kuyruğu" className="space-y-3">
      {jobs.map((job) => (
        <JobCard key={job.id} job={job} />
      ))}
    </section>
  );
}

function JobCard({ job }: { job: Job }) {
  const { status } = job;
  const title = job.info?.title || job.request.albumName || job.request.url;

  return (
    <div className="rounded-lg bg-neutral-900 p-4" role="status" aria-live="polite">
      <div className="mb-2 flex items-baseline justify-between gap-4">
        <p className="truncate text-sm text-neutral-200">{title}</p>
        <span className="shrink-0 text-xs uppercase text-neutral-500">{job.request.format}</span>
      </div>

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
            <button onClick={() => void window.api.cancel(job.id)} className="text-red-400 hover:underline">
              İptal
            </button>
          </div>
        </div>
      )}

      {status.kind === 'done' && (
        <div className="flex items-center justify-between gap-4">
          <p className="text-sm text-emerald-400">Tamamlandı — {status.fileCount} dosya</p>
          <button
            onClick={() => void window.api.openFolder(status.outputDir)}
            className="shrink-0 text-sm text-neutral-300 hover:underline"
          >
            Klasörü aç
          </button>
        </div>
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

function formatDuration(seconds?: number): string {
  if (seconds === undefined) return 'Tek video';
  const mins = Math.floor(seconds / 60);
  const secs = Math.round(seconds % 60);
  return `${mins}:${String(secs).padStart(2, '0')}`;
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
