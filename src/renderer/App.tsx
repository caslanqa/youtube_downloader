import { useEffect, useState } from 'react';
import type { BinaryState } from '../shared/types';

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
    <div className="flex min-h-screen min-w-[720px] items-center justify-center bg-neutral-950 text-neutral-100">
      <div className="text-center">
        <h1 className="text-2xl font-semibold">YouTube Downloader</h1>
        <p className="mt-2 text-sm text-neutral-400">
          yt-dlp {state.ytdlpVersion} · ffmpeg {state.ffmpegVersion} hazır
        </p>
      </div>
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
