import { describe, expect, it } from 'vitest';
import { buildFormatArgs } from './formats';

describe('buildFormatArgs', () => {
  it('mp3 always takes the best audio, ignoring quality', () => {
    expect(buildFormatArgs('mp3', 'best')).toEqual(['-x', '-f', 'bestaudio', '--audio-format', 'mp3']);
    expect(buildFormatArgs('mp3', '720')).toEqual(['-x', '-f', 'bestaudio', '--audio-format', 'mp3']);
  });

  it('mp4 with "best" leaves the resolution unrestricted', () => {
    expect(buildFormatArgs('mp4', 'best')).toEqual([
      '-f',
      'bestvideo[ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]',
      '--merge-output-format',
      'mp4',
    ]);
  });

  it('mp4 with a resolution caps both the primary and fallback selector', () => {
    expect(buildFormatArgs('mp4', '1080')).toEqual([
      '-f',
      'bestvideo[ext=mp4][height<=1080]+bestaudio[ext=m4a]/best[ext=mp4][height<=1080]',
      '--merge-output-format',
      'mp4',
    ]);
  });

  it('webm applies the same height cap', () => {
    expect(buildFormatArgs('webm', '720')).toEqual([
      '-f',
      'bestvideo[ext=webm][height<=720]+bestaudio[ext=webm]/best[ext=webm][height<=720]',
    ]);
  });
});
