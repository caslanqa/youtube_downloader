// Integration tests for the queue and its concurrency limit (docs/PLAN.md §13). A fake,
// deliberately slow binary stands in for yt-dlp so the tests need no network access.
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Job, JobRequest } from '../../shared/types';

const DELAY_FIXTURE = path.join(__dirname, '__fixtures__', 'fake-ytdlp-delay.js');
const FAKE_FFMPEG = '/usr/bin/true';

function makeRequest(destination: string, albumName: string): JobRequest {
  return {
    url: 'https://www.youtube.com/watch?v=abc',
    format: 'mp3',
    albumName,
    destination,
    numberPlaylistItems: false,
  };
}

/** Computes the maximum number of overlapping jobs from timestamped start/end log lines. */
function maxOverlap(lines: string[]): number {
  const events = lines
    .filter(Boolean)
    .map((line) => {
      const [ts, kind] = line.split(' ');
      return { ts: Number(ts), delta: kind === 'start' ? 1 : -1 };
    })
    .sort((a, b) => a.ts - b.ts);
  let current = 0;
  let max = 0;
  for (const e of events) {
    current += e.delta;
    max = Math.max(max, current);
  }
  return max;
}

describe('queue (fake delayed yt-dlp integration)', () => {
  let tmpDir: string;

  beforeEach(async () => {
    vi.resetModules();
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'ytdl-queue-test-'));
  });

  afterEach(async () => {
    delete process.env.FAKE_DELAY_MS;
    delete process.env.FAKE_LOG_FILE;
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  it('runs three jobs to completion without exceeding the concurrency limit of two', async () => {
    process.env.FAKE_DELAY_MS = '150';
    const logFile = path.join(tmpDir, 'log.txt');
    process.env.FAKE_LOG_FILE = logFile;
    await fs.writeFile(logFile, '');

    const { configureQueue, enqueue, setConcurrency } = await import('./queue');

    const updatesById = new Map<string, Job>();
    configureQueue({ ytdlpPath: DELAY_FIXTURE, ffmpegPath: FAKE_FFMPEG }, (job) => updatesById.set(job.id, job));
    setConcurrency(2);

    const allDone = new Promise<void>((resolve, reject) => {
      let doneCount = 0;
      configureQueue({ ytdlpPath: DELAY_FIXTURE, ffmpegPath: FAKE_FFMPEG }, (job) => {
        updatesById.set(job.id, job);
        if (job.status.kind === 'done') {
          doneCount += 1;
          if (doneCount === 3) resolve();
        } else if (job.status.kind === 'error') {
          reject(new Error(job.status.message));
        }
      });
    });

    enqueue('job-1', makeRequest(tmpDir, 'AlbumA'));
    enqueue('job-2', makeRequest(tmpDir, 'AlbumB'));
    enqueue('job-3', makeRequest(tmpDir, 'AlbumC'));

    await allDone;

    for (const id of ['job-1', 'job-2', 'job-3']) {
      expect(updatesById.get(id)?.status.kind).toBe('done');
    }

    const logLines = (await fs.readFile(logFile, 'utf8')).trim().split('\n');
    expect(logLines.length).toBe(6); // 3 jobs x (start + end)
    expect(maxOverlap(logLines)).toBeLessThanOrEqual(2);
  }, 10000);

  it('never starts a queued job that is cancelled before it runs', async () => {
    process.env.FAKE_DELAY_MS = '300';
    const { configureQueue, enqueue, cancel, setConcurrency } = await import('./queue');

    const updatesById = new Map<string, Job>();
    configureQueue({ ytdlpPath: DELAY_FIXTURE, ffmpegPath: FAKE_FFMPEG }, (job) => updatesById.set(job.id, job));
    setConcurrency(1); // job-2 is guaranteed to wait

    enqueue('job-1', makeRequest(tmpDir, 'AlbumA'));
    enqueue('job-2', makeRequest(tmpDir, 'AlbumB'));
    cancel('job-2'); // not started yet, must be removed from the queue

    await new Promise<void>((resolve) => {
      const check = setInterval(() => {
        if (updatesById.get('job-1')?.status.kind === 'done') {
          clearInterval(check);
          resolve();
        }
      }, 20);
    });

    expect(updatesById.get('job-2')?.status.kind).toBe('cancelled');
    const albumBDir = path.join(tmpDir, 'AlbumB');
    await expect(fs.access(albumBDir)).rejects.toThrow(); // never created
  }, 10000);
});
