// Kuyruk + eşzamanlılık limiti entegrasyon testleri (Faz 3 çıktı kriteri: "Üç iş sıraya
// alınıp doğru sırayla tamamlanıyor", bkz. docs/PLAN.md §13). Gerçek yt-dlp yerine sahte,
// gecikmeli bir ikili kullanılır — bu ortamda gerçek ağ erişimi yok (bkz. Faz 2 notları).
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

/** Zaman damgalı start/end log satırlarından aynı anda çalışan iş sayısının maksimumunu hesaplar. */
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

describe('queue (sahte gecikmeli yt-dlp entegrasyonu)', () => {
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

  it('eşzamanlılık limiti (2) aşılmadan 3 iş sıraya alınıp tamamlanır', async () => {
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
    expect(logLines.length).toBe(6); // 3 iş × (start + end)
    expect(maxOverlap(logLines)).toBeLessThanOrEqual(2);
  }, 10000);

  it('henüz başlamamış (kuyrukta bekleyen) iş iptal edilince hiç çalıştırılmaz', async () => {
    process.env.FAKE_DELAY_MS = '300';
    const { configureQueue, enqueue, cancel, setConcurrency } = await import('./queue');

    const updatesById = new Map<string, Job>();
    configureQueue({ ytdlpPath: DELAY_FIXTURE, ffmpegPath: FAKE_FFMPEG }, (job) => updatesById.set(job.id, job));
    setConcurrency(1); // job-2 kesinlikle sırada bekleyecek

    enqueue('job-1', makeRequest(tmpDir, 'AlbumA'));
    enqueue('job-2', makeRequest(tmpDir, 'AlbumB'));
    cancel('job-2'); // henüz başlamadı, sıradan çıkarılmalı

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
    await expect(fs.access(albumBDir)).rejects.toThrow(); // hiç oluşturulmadı
  }, 10000);
});
