// Format profiles; see docs/PLAN.md §7. Defined once here and read by job.ts.

import type { Format, VideoQuality } from '../../shared/types';

export const OUTPUT_TEMPLATE = (numbered: boolean): string =>
  numbered ? '%(playlist_index)s - %(title)s.%(ext)s' : '%(title)s.%(ext)s';

/** yt-dlp's `[height<=N]` filter; empty for 'best' so the selector stays unrestricted. */
function heightCap(quality: VideoQuality): string {
  return quality === 'best' ? '' : `[height<=${quality}]`;
}

/**
 * Builds the `-f`/`-x` arguments for a format + quality pair. Quality only affects video
 * formats: MP3 always takes the best available audio regardless of the selected quality.
 */
export function buildFormatArgs(format: Format, quality: VideoQuality): string[] {
  const cap = heightCap(quality);
  switch (format) {
    case 'mp3':
      return ['-x', '-f', 'bestaudio', '--audio-format', 'mp3'];
    case 'mp4':
      return [
        '-f',
        `bestvideo[ext=mp4]${cap}+bestaudio[ext=m4a]/best[ext=mp4]${cap}`,
        '--merge-output-format',
        'mp4',
      ];
    case 'webm':
      return ['-f', `bestvideo[ext=webm]${cap}+bestaudio[ext=webm]/best[ext=webm]${cap}`];
  }
}
