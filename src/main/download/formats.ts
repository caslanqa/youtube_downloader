// Format profilleri — bkz. docs/PLAN.md §7. Tek yerde tanımlanır, job.ts burada okur.

import type { Format } from '../../shared/types';

export const OUTPUT_TEMPLATE = (numbered: boolean): string =>
  numbered ? '%(playlist_index)s - %(title)s.%(ext)s' : '%(title)s.%(ext)s';

export const PROFILES: Record<Format, string[]> = {
  mp3: ['-x', '-f', 'bestaudio', '--audio-format', 'mp3'],
  mp4: ['-f', 'bestvideo[ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]', '--merge-output-format', 'mp4'],
  webm: ['-f', 'bestvideo[ext=webm]+bestaudio[ext=webm]/best[ext=webm]'],
};
