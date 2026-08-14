// deno, yt-dlp'nin varsayılan JavaScript runtime'ı. Onsuz YouTube çıkarımı
// "deprecated" sayılıyor ve formatların bir kısmı listelenmiyor (ölçüm için
// bkz. docs/PLAN.md §6). yt-dlp gibi runtime'da indirilip yönetilir.

export const DENO_REPO = 'denoland/deno';

// deno release'leri hedef üçlüsüyle adlandırılmış zip arşivleri yayınlar.
const TARGETS: Record<string, string> = {
  'darwin-arm64': 'aarch64-apple-darwin',
  'darwin-x64': 'x86_64-apple-darwin',
  'win32-x64': 'x86_64-pc-windows-msvc',
  'win32-arm64': 'aarch64-pc-windows-msvc',
  'linux-x64': 'x86_64-unknown-linux-gnu',
  'linux-arm64': 'aarch64-unknown-linux-gnu',
};

/** GitHub release asset adı (zip). Platform desteklenmiyorsa fırlatır. */
export function getDenoAssetName(): string {
  const key = `${process.platform}-${process.arch}`;
  const target = TARGETS[key];
  if (!target) throw new Error(`deno bu platform için yayınlanmıyor: ${key}`);
  return `deno-${target}.zip`;
}

/** Her asset'in kendi checksum dosyası var (yt-dlp'deki tek SUMS dosyasından farklı). */
export function getDenoSumsAssetName(): string {
  return `${getDenoAssetName()}.sha256sum`;
}

/** userData/bin/ altında arşivden çıkacak dosya adı. */
export function getDenoLocalName(): string {
  return process.platform === 'win32' ? 'deno.exe' : 'deno';
}
