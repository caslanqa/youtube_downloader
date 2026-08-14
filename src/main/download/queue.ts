// İş kuyruğu: eşzamanlılık limiti kadar iş aynı anda çalışır, kalanı sırada bekler. bkz. docs/PLAN.md §8, §13 (Faz 3).
import type { Job, JobRequest, JobStatus } from '../../shared/types';
import { cancelJob as cancelRunningJob, startJob } from './job';

interface QueueEntry {
  job: Job;
}

const pending: QueueEntry[] = [];
const runningIds = new Set<string>();

let concurrency = 2;
let ytdlpPath = '';
let ffmpegPath = '';
let notify: (job: Job) => void = () => {};

/** Binary yolları hazır olduğunda ve pencere kurulurken bir kez çağrılır. */
export function configureQueue(paths: { ytdlpPath: string; ffmpegPath: string }, onUpdate: (job: Job) => void): void {
  ytdlpPath = paths.ytdlpPath;
  ffmpegPath = paths.ffmpegPath;
  notify = onUpdate;
}

export function setConcurrency(n: number): void {
  concurrency = Math.max(1, Math.floor(n));
  pump();
}

export function enqueue(jobId: string, request: JobRequest): Job {
  const job: Job = { id: jobId, request, status: { kind: 'queued' } };
  pending.push({ job });
  notify(job);
  pump();
  return job;
}

/** Çalışıyorsa süreci durdurur; henüz başlamadıysa sıradan çıkarır. */
export function cancel(jobId: string): void {
  cancelRunningJob(jobId);
  const idx = pending.findIndex((entry) => entry.job.id === jobId);
  if (idx !== -1) {
    const [entry] = pending.splice(idx, 1);
    notify({ ...entry.job, status: { kind: 'cancelled' } });
  }
}

function pump(): void {
  while (runningIds.size < concurrency && pending.length > 0) {
    const entry = pending.shift();
    if (!entry) break;
    const { job } = entry;
    runningIds.add(job.id);
    startJob(job.id, job.request, ytdlpPath, ffmpegPath, (status: JobStatus) => {
      notify({ ...job, status });
      if (status.kind !== 'queued' && status.kind !== 'running') {
        runningIds.delete(job.id);
        pump();
      }
    });
  }
}
