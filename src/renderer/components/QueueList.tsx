import { useEffect, useRef, useState } from 'react';
import type { Job, JobStatus } from '../../shared/types';
import { useT, type Translate } from '../i18n';
import { BUTTON_INLINE, PANEL } from '../ui';

function statusLabel(status: JobStatus, t: Translate): string {
  switch (status.kind) {
    case 'queued':
      return t('statusQueuedShort');
    case 'running':
      return t('statusRunningShort');
    case 'done':
      return t('statusDoneShort', { count: status.fileCount });
    case 'cancelled':
      return t('statusCancelledShort');
    case 'error':
      return t('statusErrorShort', { message: status.message });
  }
}

function jobTitle(job: Job): string {
  return job.info?.title || job.request.albumName || job.request.url;
}

/**
 * A single live region announces status *transitions* only. Marking every card as
 * `role="status"`, or announcing percentage updates, would make a screen reader talk several
 * times per second, which is not what WCAG 4.1.3 asks for.
 */
function useStatusAnnouncement(jobs: Job[], t: Translate): string {
  const seen = useRef(new Map<string, JobStatus['kind']>());
  const [message, setMessage] = useState('');

  useEffect(() => {
    for (const job of jobs) {
      if (seen.current.get(job.id) === job.status.kind) continue;
      seen.current.set(job.id, job.status.kind);
      setMessage(`${jobTitle(job)}: ${statusLabel(job.status, t)}`);
    }
    // `jobs` is the only dependency: `t` is a new function on every render, so including it
    // would repeat announcements even when the language has not changed.
  }, [jobs]);

  return message;
}

export function QueueList({ jobs }: { jobs: Job[] }) {
  const t = useT();
  const announcement = useStatusAnnouncement(jobs, t);

  return (
    <section aria-labelledby="queue-heading" className="space-y-3">
      <h2 id="queue-heading" className="text-sm font-medium text-muted">
        {t('queueHeading')}
      </h2>

      <p aria-live="polite" className="sr-only">
        {announcement}
      </p>

      {jobs.length === 0 ? (
        <p className={`${PANEL} text-sm text-muted`}>{t('queueEmpty')}</p>
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
  const t = useT();
  const { status } = job;

  return (
    <article className={`${PANEL} p-4`}>
      <div className="mb-2 flex items-baseline justify-between gap-4">
        <h3 className="truncate text-sm font-medium text-ink">{jobTitle(job)}</h3>
        <span className="shrink-0 text-xs font-medium uppercase text-muted">{job.request.format}</span>
      </div>

      {status.kind === 'queued' && <p className="text-sm text-muted">{t('statusQueued')}</p>}

      {status.kind === 'running' && (
        <div className="space-y-2">
          <div
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={status.percent}
            aria-label={t('progressLabel', { title: jobTitle(job) })}
            className="h-2 w-full overflow-hidden rounded-full bg-track"
          >
            <div className="h-full bg-brand transition-[width]" style={{ width: `${status.percent}%` }} />
          </div>
          <div className="flex items-center justify-between text-sm text-muted">
            <span>
              %{status.percent}
              {status.speed ? ` · ${status.speed}` : ''}
              {status.eta ? ` · ${t('remaining', { eta: status.eta })}` : ''}
            </span>
            <button
              type="button"
              onClick={() => void window.api.cancel(job.id)}
              className={`${BUTTON_INLINE} text-danger`}
            >
              {t('cancel')}
            </button>
          </div>
        </div>
      )}

      {status.kind === 'done' && (
        <div className="flex items-center justify-between gap-4">
          <p className="text-sm text-ok">{t('statusDone', { count: status.fileCount })}</p>
          <button
            type="button"
            onClick={() => void window.api.openFolder(status.outputDir)}
            className={`${BUTTON_INLINE} text-ink`}
          >
            {t('openFolder')}
          </button>
        </div>
      )}

      {status.kind === 'cancelled' && <p className="text-sm text-muted">{t('statusCancelled')}</p>}

      {status.kind === 'error' && (
        <div className="space-y-2">
          <p className="text-sm text-danger">{status.message}</p>
          {status.logTail && (
            <details>
              <summary className="cursor-pointer rounded text-xs text-muted">{t('errorDetails')}</summary>
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
