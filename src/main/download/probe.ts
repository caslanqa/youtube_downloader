// Video/oynatma listesi bilgisini indirmeden alır (`-J --flat-playlist`). bkz. docs/PLAN.md §5, §8.
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
 * Tekil videoda tek bir `thumbnail` alanı gelir; `--flat-playlist` öğelerinde ise
 * yalnızca `thumbnails` dizisi bulunur (yt-dlp 2026.07.04 ile doğrulandı).
 * Adaylar sırayla denenir, dizide en geniş görsel seçilir.
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
      reject(new Error('Video bilgisi alma zaman aşımına uğradı'));
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
      else reject(new Error(stderr.trim().split('\n').slice(-1)[0] || `yt-dlp kod ${code} ile sonlandı`));
    });
  });
}

/** URL'yi indirmeden başlık/kapak/süre/playlist bilgisini döner. */
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
    title: (isPlaylist ? data.title : first?.title) ?? 'Bilinmeyen başlık',
    thumbnail: bestThumbnail(first, data),
    duration: isPlaylist ? undefined : first?.duration,
    isPlaylist,
    entryCount: isPlaylist ? (data.entries?.length ?? 0) : 1,
  };
}
