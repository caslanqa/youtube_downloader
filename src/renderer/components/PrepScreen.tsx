import type { BinaryState } from '../../shared/types';

/** Binary'ler hazır olana kadar gösterilen hazırlık ekranı (bkz. docs/PLAN.md §8). */
export function PrepScreen({ state }: { state: Exclude<BinaryState, { kind: 'ready' }> }) {
  const label =
    state.kind === 'checking'
      ? 'Bağımlılıklar kontrol ediliyor…'
      : state.kind === 'downloading'
        ? `${state.name} indiriliyor`
        : state.message;

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 px-8">
      <h1 className="text-xl font-semibold">YouTube Downloader</h1>

      <div role={state.kind === 'failed' ? 'alert' : 'status'} aria-live="polite" className="w-full max-w-sm text-center">
        <p className={state.kind === 'failed' ? 'text-danger' : 'text-muted'}>{label}</p>

        {state.kind === 'downloading' && (
          <div
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={state.percent}
            aria-label={`${state.name} indirme ilerlemesi`}
            className="mt-3 h-2 w-full overflow-hidden rounded-full bg-track"
          >
            <div className="h-full bg-brand transition-[width]" style={{ width: `${state.percent}%` }} />
          </div>
        )}
      </div>

      {state.kind === 'failed' && (
        <p className="max-w-sm text-center text-sm text-muted">
          İnternet bağlantısını kontrol edip uygulamayı yeniden başlatın.
        </p>
      )}
    </main>
  );
}
