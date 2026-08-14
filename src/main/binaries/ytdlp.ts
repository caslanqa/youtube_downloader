// Names the platform-specific yt-dlp binary published on GitHub releases.
// See docs/PLAN.md §6.

export const YTDLP_REPO = 'yt-dlp/yt-dlp';
export const YTDLP_SUMS_ASSET = 'SHA2-256SUMS';

/** GitHub release asset name for the current process.platform/arch. See plan §6. */
export function getYtDlpAssetName(): string {
  const { platform, arch } = process;
  if (platform === 'darwin') return 'yt-dlp_macos';
  if (platform === 'win32') return 'yt-dlp.exe';
  if (platform === 'linux') return arch === 'arm64' ? 'yt-dlp_linux_aarch64' : 'yt-dlp_linux';
  throw new Error(`Unsupported platform: ${platform}`);
}

/** File name yt-dlp is stored under in userData/bin/. */
export function getYtDlpLocalName(): string {
  return process.platform === 'win32' ? 'yt-dlp.exe' : 'yt-dlp';
}
