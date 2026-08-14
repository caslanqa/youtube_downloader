import { useEffect, useRef, useState } from 'react';
import type { Job, JobStatus } from '../../shared/types';
import { BUTTON_INLINE, PANEL } from '../ui';

function statusLabel(status: JobStatus): string {
  switch (status.kind) {
    case 'queued':
      return 'sıraya alındı';
    case 'running':
      return 'indiriliyor';
    case 'done':
      return `tamamlandı, ${status.fileCount} dosya`;
    case 'cancelled':
      return 'iptal edildi';
    case 'error':
      return `hata: ${status.message}`;
  }
}

function jobTitle(job: Job): string {
  return job.info?.title || job.request.albumName || job.request.url;
}

/**
 * Tek bir canlı bölge, yalnızca durum *geçişlerini* duyurur. Her kartı ayrı ayrı
 * `role="status"` yapmak veya yüzde değişimlerini duyurmak ekran okuyucuyu
 * saniyede birkaç kez konuşturur (WCAG 4.1.3'ün amacı bu değil).
 */
function useStatusAnnouncement(jobs: Job[]): string {
  const seen = useRef(new Map<string, JobStatus['kind']>());
  const [message, setMessage] = useState('');

  useEffect(() => {
    for (const job of jobs) {
      if (seen.current.get(job.id) === job.status.kind) continue;
      seen.current.set(job.id, job.status.kind);
      setMessage(`${jobTitle(job)}: ${statusLabel(job.status)}`);
    }
  }, [jobs]);

  return message;
}

export function QueueList({ jobs }: { jobs: Job[] }) {
  const announcement = useStatusAnnouncement(jobs);

  return (
    <section aria-labelledby="queue-heading" className="space-y-3">
      <h2 id="queue-heading" className="text-sm font-medium text-muted">
        İndirme kuyruğu
      </h2>

      <p aria-live="polite" className="sr-only">
        {announcement}
      </p>

      {jobs.length === 0 ? (
        <p className={`${PANEL} text-sm text-muted`}>
          Kuyruk boş. Yukarıya bir bağlantı ekleyerek başlayın.
        </p>
      ) : (
        <ul className="space-y-3">
          {jobs.map((job) => (
            <li key={job.id}>
              <JobCard job={job} />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function JobCard({ job }: { job: Job }) {
  const { status } = job;

  return (
    <article className={`${PANEL} p-4`}>
      <div className="mb-2 flex items-baseline justify-between gap-4">
        <h3 className="truncate text-sm font-medium text-ink">{jobTitle(job)}</h3>
        <span className="shrink-0 text-xs font-medium uppercase text-muted">{job.request.format}</span>
      </div>

      {status.kind === 'queued' && <p className="text-sm text-muted">Sırada bekliyor…</p>}

      {status.kind === 'running' && (
        <div className="space-y-2">
          <div
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={status.percent}
            aria-label={`${jobTitle(job)} indirme ilerlemesi`}
            className="h-2 w-full overflow-hidden rounded-full bg-track"
          >
            <div className="h-full bg-brand transition-[width]" style={{ width: `${status.percent}%` }} />
          </div>
          <div className="flex items-center justify-between text-sm text-muted">
            <span>
              %{status.percent}
              {status.speed ? ` · ${status.speed}` : ''}
              {status.eta ? ` · kalan ${status.eta}` : ''}
            </span>
            <button
              type="button"
              onClick={() => void window.api.cancel(job.id)}
              className={`${BUTTON_INLINE} text-danger`}
            >
              İptal et
            </button>
          </div>
        </div>
      )}

      {status.kind === 'done' && (
        <div className="flex items-center justify-between gap-4">
          <p className="text-sm text-ok">Tamamlandı — {status.fileCount} dosya</p>
          <button
            type="button"
            onClick={() => void window.api.openFolder(status.outputDir)}
            className={`${BUTTON_INLINE} text-ink`}
          >
            Klasörü aç
          </button>
        </div>
      )}

      {status.kind === 'cancelled' && <p className="text-sm text-muted">İptal edildi.</p>}

      {status.kind === 'error' && (
        <div className="space-y-2">
          <p className="text-sm text-danger">{status.message}</p>
          {status.logTail && (
            <details>
              <summary className="cursor-pointer rounded text-xs text-muted">Ayrıntı</summary>
              <pre className="mt-1 max-h-32 overflow-auto rounded bg-surface p-2 text-xs text-muted">
                {status.logTail}
              </pre>
            </details>
          )}
        </div>
      )}
    </article>
  );
}
