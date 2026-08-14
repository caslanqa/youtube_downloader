// yt-dlp GitHub release'inden platforma uygun binary'yi indirir ve doğrular.
// bkz. docs/PLAN.md §6

export const YTDLP_REPO = 'yt-dlp/yt-dlp';
export const YTDLP_SUMS_ASSET = 'SHA2-256SUMS';

/** GitHub release asset adı — process.platform/arch'e göre. bkz. plan §6 tablosu. */
export function getYtDlpAssetName(): string {
  const { platform, arch } = process;
  if (platform === 'darwin') return 'yt-dlp_macos';
  if (platform === 'win32') return 'yt-dlp.exe';
  if (platform === 'linux') return arch === 'arm64' ? 'yt-dlp_linux_aarch64' : 'yt-dlp_linux';
  throw new Error(`Desteklenmeyen platform: ${platform}`);
}

/** userData/bin/ altında yt-dlp'nin kaydedileceği dosya adı. */
export function getYtDlpLocalName(): string {
  return process.platform === 'win32' ? 'yt-dlp.exe' : 'yt-dlp';
}
