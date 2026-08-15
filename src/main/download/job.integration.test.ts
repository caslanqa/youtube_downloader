// Real YouTube network access is not dependable here (JS challenges, bot protection), so the
// spawn/progress/cancel flow of job.ts is verified end to end against a fake yt-dlp binary.
// See docs/PLAN.md §10 on why network tests do not belong in CI.
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { JobRequest, JobStatus } from '../../shared/types';
import { cancelJob, startJob } from './job';

const FIXTURE = path.join(__dirname, '__fixtures__', 'fake-ytdlp.js');
const FAKE_FFMPEG = '/usr/bin/true';

function makeRequest(destination: string): JobRequest {
  return {
    url: 'https://www.youtube.com/watch?v=abc',
    format: 'mp3',
    quality: 'best',
    albumName: 'TestAlbum',
    destination,
    numberPlaylistItems: false,
  };
}

describe('startJob (fake yt-dlp integration)', () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'ytdl-job-test-'));
  });

  afterEach(async () => {
    delete process.env.FAKE_YTDLP_MODE;
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  it('reports running then done and writes the file on a successful download', async () => {
    process.env.FAKE_YTDLP_MODE = 'success';
    const updates: JobStatus[] = [];
    await new Promise<void>((resolve, reject) => {
      startJob('job-success', makeRequest(tmpDir), FIXTURE, FAKE_FFMPEG, (status) => {
        updates.push(status);
        if (status.kind === 'done') resolve();
        if (status.kind === 'error') reject(new Error(status.message));
      });
    });

    const runningUpdates = updates.filter((u) => u.kind === 'running');
    expect(runningUpdates.length).toBeGreaterThan(0);
    expect(runningUpdates.at(-1)).toMatchObject({ percent: 100 });

    const done = updates.find((u) => u.kind === 'done');
    expect(done).toMatchObject({ kind: 'done', fileCount: 1, outputDir: path.join(tmpDir, 'TestAlbum') });
  });

  it('reports an error with the stderr tail when yt-dlp exits non-zero', async () => {
    process.env.FAKE_YTDLP_MODE = 'fail';
    const status = await new Promise<JobStatus>((resolve) => {
      startJob('job-fail', makeRequest(tmpDir), FIXTURE, FAKE_FFMPEG, (s) => {
        if (s.kind === 'done' || s.kind === 'error') resolve(s);
      });
    });
    expect(status).toMatchObject({ kind: 'error' });
    if (status.kind === 'error') {
      expect(status.logTail).toContain('ERROR: something went wrong');
    }
  });

  it('stops the process, reports cancelled and cleans up partial files', async () => {
    process.env.FAKE_YTDLP_MODE = 'hang';
    const albumDir = path.join(tmpDir, 'TestAlbum');
    const finalStatus = await new Promise<JobStatus>((resolve) => {
      let cancelled = false;
      startJob('job-hang', makeRequest(tmpDir), FIXTURE, FAKE_FFMPEG, (status) => {
        if (status.kind === 'running' && !cancelled) {
          cancelled = true;
          cancelJob('job-hang');
        }
        if (status.kind === 'cancelled' || status.kind === 'error') resolve(status);
      });
    });
    expect(finalStatus.kind).toBe('cancelled');
    const remaining = await fs.readdir(albumDir).catch(() => []);
    expect(remaining.some((f) => f.endsWith('.part'))).toBe(false);
  }, 10000);

  it('reports an error for a rejected URL without spawning yt-dlp', async () => {
    const request = { ...makeRequest(tmpDir), url: 'https://evil.example.com/video' };
    const status = await new Promise<JobStatus>((resolve) => {
      startJob('job-badurl', request, FIXTURE, FAKE_FFMPEG, resolve);
    });
    expect(status).toMatchObject({ kind: 'error' });
    if (status.kind === 'error') {
      expect(status.message).toMatch(/host/i);
    }
  });
});
