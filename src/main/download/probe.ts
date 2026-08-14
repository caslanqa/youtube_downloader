// Reads video/playlist metadata without downloading (`-J --flat-playlist`). See docs/PLAN.md §5, §8.
import { spawn } from 'node:child_process';
import { spawnEnv } from '../binaries/runtimeEnv';
import type { MediaInfo } from '../../shared/types';
import { validateUrl } from './validate';

interface RawThumbnail {
  url: string;
  width?: number;
}

interface RawEntry {
  id?: string;
  title?: string;
  thumbnail?: string;
  thumbnails?: RawThumbnail[];
  duration?: number;
}

interface RawInfo extends RawEntry {
  _type?: string;
  entries?: RawEntry[];
}

/**
 * A single video carries one `thumbnail` field, while `--flat-playlist` entries only carry a
 * `thumbnails` array (verified against yt-dlp 2026.07.04). Candidates are tried in order and
 * the widest image in an array wins.
 */
function bestThumbnail(...candidates: (RawEntry | undefined)[]): string | undefined {
  for (const candidate of candidates) {
    if (candidate?.thumbnail) return candidate.thumbnail;
    const list = candidate?.thumbnails;
    if (list?.length) {
      return list.reduce((widest, current) => ((current.width ?? 0) > (widest.width ?? 0) ? current : widest)).url;
    }
  }
  return undefined;
}

function runYtDlp(ytdlpPath: string, args: string[], timeoutMs: number): Promise<string> {
  return new Promise((resolve, reject) => {
    const proc = spawn(ytdlpPath, args, { env: spawnEnv() });
    let stdout = '';
    let stderr = '';
    const timer = setTimeout(() => {
      proc.kill('SIGKILL');
      reject(new Error('Timed out while reading video information'));
    }, timeoutMs);

    proc.stdout.on('data', (chunk: Buffer) => (stdout += chunk.toString()));
    proc.stderr.on('data', (chunk: Buffer) => (stderr += chunk.toString()));
    proc.on('error', (err) => {
      clearTimeout(timer);
      reject(err);
    });
    proc.on('close', (code) => {
      clearTimeout(timer);
      if (code === 0) resolve(stdout);
      else reject(new Error(stderr.trim().split('\n').slice(-1)[0] || `yt-dlp exited with code ${code}`));
    });
  });
}

/** Returns title, thumbnail, duration and playlist information without downloading. */
export async function probeUrl(url: string, ytdlpPath: string, timeoutMs = 20_000): Promise<MediaInfo> {
  validateUrl(url);
  const output = await runYtDlp(
    ytdlpPath,
    ['-J', '--flat-playlist', '--skip-download', '--no-warnings', url],
    timeoutMs,
  );
  const data = JSON.parse(output) as RawInfo;

  const isPlaylist = data._type === 'playlist';
  const first = isPlaylist ? data.entries?.[0] : data;
  return {
    id: data.id ?? url,
    title: (isPlaylist ? data.title : first?.title) ?? 'Unknown title',
    thumbnail: bestThumbnail(first, data),
    duration: isPlaylist ? undefined : first?.duration,
    isPlaylist,
    entryCount: isPlaylist ? (data.entries?.length ?? 0) : 1,
  };
}
