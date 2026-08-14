// deno is yt-dlp's default JavaScript runtime. Without it YouTube extraction is considered
// deprecated and some formats are not listed at all (measurements in docs/PLAN.md §6).
// It is downloaded and managed at runtime, exactly like yt-dlp.

export const DENO_REPO = 'denoland/deno';

// deno releases ship zip archives named after the target triple.
const TARGETS: Record<string, string> = {
  'darwin-arm64': 'aarch64-apple-darwin',
  'darwin-x64': 'x86_64-apple-darwin',
  'win32-x64': 'x86_64-pc-windows-msvc',
  'win32-arm64': 'aarch64-pc-windows-msvc',
  'linux-x64': 'x86_64-unknown-linux-gnu',
  'linux-arm64': 'aarch64-unknown-linux-gnu',
};

/** GitHub release asset name (zip). Throws when the platform is not published. */
export function getDenoAssetName(): string {
  const key = `${process.platform}-${process.arch}`;
  const target = TARGETS[key];
  if (!target) throw new Error(`deno is not published for this platform: ${key}`);
  return `deno-${target}.zip`;
}

/** Every asset has its own checksum file, unlike yt-dlp's single SUMS file. */
export function getDenoSumsAssetName(): string {
  return `${getDenoAssetName()}.sha256sum`;
}

/** File name extracted from the archive into userData/bin/. */
export function getDenoLocalName(): string {
  return process.platform === 'win32' ? 'deno.exe' : 'deno';
}
