// ffmpeg is downloaded at runtime like yt-dlp and deno (see docs/PLAN.md §6). Keeping it out
// of the installer has two benefits: the installer is ~45 MB smaller, and no GPL-licensed
// binary is redistributed, because the user's machine fetches it directly.
//
// Source: the single-file static builds published by ffmpeg-static. These are the same
// binaries the npm package used to install; integrity is checked against the per-asset
// sha256 digest reported by GitHub.

export const FFMPEG_REPO = 'eugeneware/ffmpeg-static';

const TARGETS = new Set([
  'darwin-arm64',
  'darwin-x64',
  'linux-arm',
  'linux-arm64',
  'linux-ia32',
  'linux-x64',
  'win32-x64',
]);

/** GitHub release asset name, e.g. `ffmpeg-darwin-arm64`. */
export function getFfmpegAssetName(): string {
  const target = `${process.platform}-${process.arch}`;
  if (!TARGETS.has(target)) throw new Error(`ffmpeg is not published for this platform: ${target}`);
  return `ffmpeg-${target}`;
}

/** File name it is stored under in userData/bin/. */
export function getFfmpegLocalName(): string {
  return process.platform === 'win32' ? 'ffmpeg.exe' : 'ffmpeg';
}
