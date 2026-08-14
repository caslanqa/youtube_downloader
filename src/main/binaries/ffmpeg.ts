// ffmpeg de yt-dlp ve deno gibi çalışma zamanında indirilir (bkz. docs/PLAN.md §6).
// Uygulamayla birlikte paketlenmemesinin iki nedeni var: yükleyiciyi ~45 MB küçültüyor
// ve GPL lisanslı bir ikiliyi dağıtma yükümlülüğü doğmuyor — kullanıcı kendi makinesine indiriyor.
//
// Kaynak: ffmpeg-static'in yayınladığı tek dosyalık statik derlemeler. Bunlar daha önce
// npm paketiyle gelen ikililerin aynısı; bütünlük GitHub'ın varlık başına verdiği
// sha256 digest'i ile doğrulanır.

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

/** GitHub release asset adı, ör. `ffmpeg-darwin-arm64`. */
export function getFfmpegAssetName(): string {
  const target = `${process.platform}-${process.arch}`;
  if (!TARGETS.has(target)) throw new Error(`ffmpeg bu platform için yayınlanmıyor: ${target}`);
  return `ffmpeg-${target}`;
}

/** userData/bin/ altında kaydedileceği dosya adı. */
export function getFfmpegLocalName(): string {
  return process.platform === 'win32' ? 'ffmpeg.exe' : 'ffmpeg';
}
