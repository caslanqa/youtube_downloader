// yt-dlp process handling: spawn, progress parsing, cancellation. See docs/PLAN.md §5-7, §11.

import { spawn, type ChildProcess } from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';
import { spawnEnv } from '../binaries/runtimeEnv';
import type { JobRequest, JobStatus } from '../../shared/types';
import { summarizeDownloadError } from './errors';
import { OUTPUT_TEMPLATE, buildFormatArgs } from './formats';
import { resolveDestination, validateUrl } from './validate';

const STDERR_TAIL_LINES = 50;
const CANCEL_GRACE_MS = 3000;

// YouTube's per-request signed URLs are rejected intermittently, not because of the chosen
// format: verified by hand that the identical yt-dlp command, unchanged, failed with 403 and
// then succeeded moments later on a plain retry (a fresh process re-extracts the video and
// gets a new signed URL). A few automatic retries resolve this far more reliably than picking
// a "safer" format ever could, since there isn't a format that is safe on a consistent basis.
const MAX_ATTEMPTS = 3;
const RETRY_DELAY_MS = 2000;

interface RunningJob {
  process: ChildProcess | null; // null in the gap between a failed attempt and its retry
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

/** 403/429 have been observed to be transient (see MAX_ATTEMPTS above); anything else — a
 * private/unavailable/region-blocked/members-only video — is permanent, so retrying would only
 * delay a message the user could otherwise act on immediately. */
export function isRetryableFailure(stderrTail: string[]): boolean {
  return /HTTP Error (403|429)/i.test(stderrTail.join('\n'));
}

function buildArgs(request: JobRequest, outputDir: string, ffmpegPath: string): string[] {
  return [
    ...buildFormatArgs(request.format, request.quality),
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

interface AttemptResult {
  code: number | null;
  stderrTail: string[];
}

/** Runs a single yt-dlp invocation to completion and reports progress as it goes. */
function runAttempt(
  jobId: string,
  ytdlpPath: string,
  args: string[],
  onUpdate: (status: JobStatus) => void,
): Promise<AttemptResult> {
  return new Promise((resolve) => {
    // shell: true is NEVER used; arguments are passed as an array (docs/PLAN.md §11).
    // spawnEnv makes yt-dlp's JS runtime (deno) discoverable through PATH.
    const proc = spawn(ytdlpPath, args, { env: spawnEnv() });
    const job = running.get(jobId);
    if (job) job.process = proc;

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
      stderrTail.push(err.message);
      resolve({ code: null, stderrTail });
    });
    proc.on('close', (code) => resolve({ code, stderrTail }));
  });
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
    running.set(jobId, { process: null, cancelled: false });

    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
      if (running.get(jobId)?.cancelled) break; // cancelled while waiting between attempts

      // eslint-disable-next-line no-await-in-loop -- attempts are inherently sequential
      const { code, stderrTail } = await runAttempt(jobId, ytdlpPath, args, onUpdate);
      const wasCancelled = running.get(jobId)?.cancelled ?? false;

      if (wasCancelled) break;
      if (code === 0) {
        running.delete(jobId);
        const files = await fs.readdir(outputDir).catch(() => [] as string[]);
        onUpdate({ kind: 'done', outputDir, fileCount: files.length });
        return;
      }

      const willRetry = attempt < MAX_ATTEMPTS && isRetryableFailure(stderrTail);
      // eslint-disable-next-line no-await-in-loop -- cleanup must finish before either retrying or exiting
      await cleanupPartialFiles(outputDir);
      if (willRetry) {
        const job = running.get(jobId);
        if (job) job.process = null;
        // eslint-disable-next-line no-await-in-loop -- deliberate pause before re-extracting
        await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS));
        continue;
      }

      running.delete(jobId);
      onUpdate({ kind: 'error', message: summarizeDownloadError(stderrTail, code), logTail: stderrTail.join('\n') });
      return;
    }

    // Only the cancellation path falls out of the loop normally; retries return or continue.
    running.delete(jobId);
    await cleanupPartialFiles(outputDir);
    onUpdate({ kind: 'cancelled' });
  })();
}

export function cancelJob(jobId: string): void {
  const job = running.get(jobId);
  if (!job) return;
  job.cancelled = true;
  if (!job.process) return; // between attempts: the loop checks the flag before the next one
  job.process.kill('SIGTERM');
  const proc = job.process;
  setTimeout(() => {
    if (running.get(jobId)?.process === proc) proc.kill('SIGKILL');
  }, CANCEL_GRACE_MS);
}
