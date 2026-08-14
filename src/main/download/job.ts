// yt-dlp process handling: spawn, progress parsing, cancellation. See docs/PLAN.md §5-7, §11.

import { spawn, type ChildProcess } from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';
import { spawnEnv } from '../binaries/runtimeEnv';
import type { JobRequest, JobStatus } from '../../shared/types';
import { summarizeDownloadError } from './errors';
import { OUTPUT_TEMPLATE, PROFILES } from './formats';
import { resolveDestination, validateUrl } from './validate';

const STDERR_TAIL_LINES = 50;
const CANCEL_GRACE_MS = 3000;

interface RunningJob {
  process: ChildProcess;
  cancelled: boolean;
}

const running = new Map<string, RunningJob>();

interface ParsedProgress {
  percent?: number;
  speed?: string;
  eta?: string;
}

function formatSpeed(bytesPerSec: number | null | undefined): string | undefined {
  if (bytesPerSec === null || bytesPerSec === undefined) return undefined;
  return `${(bytesPerSec / (1024 * 1024)).toFixed(2)} MB/s`;
}

function formatEta(seconds: number | null | undefined): string | undefined {
  if (seconds === null || seconds === undefined) return undefined;
  return `${Math.round(seconds)}s`;
}

/**
 * Parses a yt-dlp progress line. In `--progress-template "download:%(progress)j"` the
 * `download:` prefix is a TYPE selector and is never printed, so lines arrive as bare JSON
 * (verified against yt-dlp 2026.07.04). Returns null for lines it does not recognise.
 */
export function parseProgressLine(line: string): ParsedProgress | null {
  if (!line.startsWith('{')) return null;
  try {
    const data = JSON.parse(line) as {
      downloaded_bytes?: number;
      total_bytes?: number;
      total_bytes_estimate?: number;
      speed?: number;
      eta?: number;
    };
    if (data.downloaded_bytes === undefined) return null; // a JSON line that is not progress
    const total = data.total_bytes ?? data.total_bytes_estimate;
    const percent =
      total && data.downloaded_bytes !== undefined
        ? Math.min(100, Math.round((data.downloaded_bytes / total) * 100))
        : undefined;
    return { percent, speed: formatSpeed(data.speed), eta: formatEta(data.eta) };
  } catch {
    return null;
  }
}

function buildArgs(request: JobRequest, outputDir: string, ffmpegPath: string): string[] {
  return [
    ...PROFILES[request.format],
    '--ffmpeg-location',
    ffmpegPath,
    '--no-color',
    '--newline',
    '--progress-template',
    'download:%(progress)j',
    '-o',
    path.join(outputDir, OUTPUT_TEMPLATE(request.numberPlaylistItems)),
    request.url,
  ];
}

async function cleanupPartialFiles(dir: string): Promise<void> {
  const entries = await fs.readdir(dir).catch(() => [] as string[]);
  await Promise.all(
    entries
      .filter((name) => name.endsWith('.part') || name.endsWith('.ytdl'))
      .map((name) => fs.rm(path.join(dir, name), { force: true })),
  );
}

export function startJob(
  jobId: string,
  request: JobRequest,
  ytdlpPath: string,
  ffmpegPath: string,
  onUpdate: (status: JobStatus) => void,
): void {
  let outputDir: string;
  try {
    validateUrl(request.url);
    outputDir = resolveDestination(request.destination, request.albumName);
  } catch (err) {
    onUpdate({ kind: 'error', message: err instanceof Error ? err.message : String(err), logTail: '' });
    return;
  }

  void (async () => {
    await fs.mkdir(outputDir, { recursive: true });

    const args = buildArgs(request, outputDir, ffmpegPath);
    // shell: true is NEVER used; arguments are passed as an array (docs/PLAN.md §11).
    // spawnEnv makes yt-dlp's JS runtime (deno) discoverable through PATH.
    const proc = spawn(ytdlpPath, args, { env: spawnEnv() });
    running.set(jobId, { process: proc, cancelled: false });

    let lastPercent = 0;
    const stderrTail: string[] = [];
    let stdoutRemainder = '';

    proc.stdout.on('data', (chunk: Buffer) => {
      stdoutRemainder += chunk.toString();
      const lines = stdoutRemainder.split('\n');
      stdoutRemainder = lines.pop() ?? '';
      for (const line of lines) {
        const progress = parseProgressLine(line.trim());
        if (!progress) continue;
        if (progress.percent !== undefined) lastPercent = progress.percent;
        onUpdate({ kind: 'running', percent: lastPercent, speed: progress.speed, eta: progress.eta });
      }
    });

    proc.stderr.on('data', (chunk: Buffer) => {
      for (const line of chunk.toString().split('\n')) {
        if (!line.trim()) continue;
        stderrTail.push(line);
        if (stderrTail.length > STDERR_TAIL_LINES) stderrTail.shift();
      }
    });

    proc.on('error', (err) => {
      running.delete(jobId);
      onUpdate({ kind: 'error', message: err.message, logTail: stderrTail.join('\n') });
    });

    proc.on('close', (code) => {
      void (async () => {
        const wasCancelled = running.get(jobId)?.cancelled ?? false;
        running.delete(jobId);
        if (wasCancelled) {
          await cleanupPartialFiles(outputDir);
          onUpdate({ kind: 'cancelled' });
        } else if (code === 0) {
          const files = await fs.readdir(outputDir).catch(() => [] as string[]);
          onUpdate({ kind: 'done', outputDir, fileCount: files.length });
        } else {
          onUpdate({
            kind: 'error',
            message: summarizeDownloadError(stderrTail, code),
            logTail: stderrTail.join('\n'),
          });
        }
      })();
    });
  })();
}

export function cancelJob(jobId: string): void {
  const job = running.get(jobId);
  if (!job) return;
  job.cancelled = true;
  job.process.kill('SIGTERM');
  setTimeout(() => {
    if (running.has(jobId)) job.process.kill('SIGKILL');
  }, CANCEL_GRACE_MS);
}
