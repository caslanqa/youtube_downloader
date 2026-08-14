// Binary hazırlığı: yt-dlp, ffmpeg ve deno'yu indirir + SHA-256 doğrular,
// sürümlerini okur. Üçü de uygulamayla paketlenmez. bkz. docs/PLAN.md §6.
import { app } from 'electron';
import { spawn } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import { pipeline } from 'node:stream/promises';
import { Readable } from 'node:stream';
import type { BinaryState } from '../../shared/types';
import { DENO_REPO, getDenoAssetName, getDenoLocalName, getDenoSumsAssetName } from './deno';
import { FFMPEG_REPO, getFfmpegAssetName, getFfmpegLocalName } from './ffmpeg';
import { setDenoDirectory } from './runtimeEnv';
import { YTDLP_REPO, YTDLP_SUMS_ASSET, getYtDlpAssetName, getYtDlpLocalName } from './ytdlp';

const USER_AGENT = 'youtube-downloader-app';

interface ReleaseAsset {
  name: string;
  browser_download_url: string;
  /** GitHub'ın varlık başına verdiği özet, "sha256:<hex>" biçiminde (her repoda bulunmayabilir). */
  digest?: string | null;
}

interface ReleaseInfo {
  tag_name: string;
  assets: ReleaseAsset[];
}

async function fetchLatestRelease(repo: string): Promise<ReleaseInfo> {
  const res = await fetch(`https://api.github.com/repos/${repo}/releases/latest`, {
    headers: { 'User-Agent': USER_AGENT },
  });
  if (!res.ok) {
    throw new Error(`${repo} sürüm bilgisi alınamadı (HTTP ${res.status})`);
  }
  return (await res.json()) as ReleaseInfo;
}

async function fetchText(url: string): Promise<string> {
  const res = await fetch(url, { headers: { 'User-Agent': USER_AGENT } });
  if (!res.ok) throw new Error(`İndirme başarısız: ${url} (HTTP ${res.status})`);
  return res.text();
}

async function downloadWithProgress(
  url: string,
  destPath: string,
  onPercent: (percent: number) => void,
): Promise<void> {
  const res = await fetch(url, { headers: { 'User-Agent': USER_AGENT } });
  if (!res.ok || !res.body) {
    throw new Error(`İndirme başarısız: ${url} (HTTP ${res.status})`);
  }
  const total = Number(res.headers.get('content-length')) || 0;
  let downloaded = 0;
  // Süreç kimliği eklenir: iki uygulama örneği aynı anda indirse bile aynı .part dosyasına yazmazlar.
  const partPath = `${destPath}.${process.pid}.part`;

  try {
    await pipeline(
      Readable.fromWeb(res.body as Parameters<typeof Readable.fromWeb>[0]),
      async function* track(source: AsyncIterable<Buffer>) {
        for await (const chunk of source) {
          downloaded += chunk.length;
          if (total > 0) onPercent(Math.round((downloaded / total) * 100));
          yield chunk;
        }
      },
      fs.createWriteStream(partPath),
    );
    // Yarım dosya asla çalıştırılmaz: doğrulamadan önce .part olarak kalır.
    await fsp.rename(partPath, destPath);
  } catch (err) {
    await fsp.rm(partPath, { force: true }); // yarım kalan dosya bir sonraki denemeyi kirletmesin
    throw err;
  }
}

/** Verilen dosyanın SHA-256 özeti. Test edilebilir olması için export edildi. */
export async function sha256File(filePath: string): Promise<string> {
  const hash = crypto.createHash('sha256');
  for await (const chunk of fs.createReadStream(filePath)) {
    hash.update(chunk as Buffer);
  }
  return hash.digest('hex');
}

/** GitHub varlık digest'ine ("sha256:<hex>") karşı doğrulama. */
export async function verifyDigest(filePath: string, digest: string | null | undefined): Promise<boolean> {
  const expected = digest?.replace(/^sha256:/, '').toLowerCase();
  if (!expected) throw new Error('Varlık için sha256 digest bulunamadı');
  return expected === (await sha256File(filePath)).toLowerCase();
}

/** `sha256sum` formatlı bir SUMS dosyası içinden `fileName` doğrulamasını yapar. */
export async function verifyChecksum(filePath: string, fileName: string, sumsContent: string): Promise<boolean> {
  const line = sumsContent.split('\n').find((entry) => entry.trim().endsWith(fileName));
  if (!line) {
    throw new Error(`${fileName} için checksum bulunamadı`);
  }
  const expected = line.trim().split(/\s+/)[0]?.toLowerCase();
  const actual = (await sha256File(filePath)).toLowerCase();
  return expected === actual;
}

/**
 * Diskteki ikilinin gerçekten kullanılabilir olduğunu doğrular: yalnızca "dosya var mı"
 * bakmak yetmez — yarım inmiş veya chmod'u yapılamamış bir dosya EACCES ile patlar ve
 * varlık kontrolü onu sonsuza dek onarılmaz bırakır.
 */
async function isUsableBinary(binPath: string, versionArgs: string[] = ['--version']): Promise<boolean> {
  try {
    await fsp.access(binPath, fs.constants.X_OK);
    await readVersion(binPath, versionArgs);
    return true;
  } catch {
    return false;
  }
}

async function ensureYtDlp(binDir: string, onState: (state: BinaryState) => void): Promise<string> {
  const localPath = path.join(binDir, getYtDlpLocalName());
  if (fs.existsSync(localPath)) {
    if (await isUsableBinary(localPath)) {
      return localPath;
    }
    await fsp.rm(localPath, { force: true }); // bozuk kopya: yeniden indirilecek
  }

  onState({ kind: 'downloading', name: 'yt-dlp', percent: 0 });
  const release = await fetchLatestRelease(YTDLP_REPO);
  const assetName = getYtDlpAssetName();
  const asset = release.assets.find((a) => a.name === assetName);
  const sumsAsset = release.assets.find((a) => a.name === YTDLP_SUMS_ASSET);
  if (!asset) throw new Error(`yt-dlp release varlığı bulunamadı: ${assetName}`);
  if (!sumsAsset) throw new Error(`yt-dlp ${YTDLP_SUMS_ASSET} bulunamadı`);

  await fsp.mkdir(binDir, { recursive: true });
  await downloadWithProgress(asset.browser_download_url, localPath, (percent) =>
    onState({ kind: 'downloading', name: 'yt-dlp', percent }),
  );

  const sumsContent = await fetchText(sumsAsset.browser_download_url);
  const isValid = await verifyChecksum(localPath, assetName, sumsContent);
  if (!isValid) {
    await fsp.rm(localPath, { force: true });
    throw new Error('yt-dlp checksum doğrulaması başarısız — dosya silindi');
  }

  await makeExecutable(localPath);
  return localPath;
}

async function makeExecutable(binPath: string): Promise<void> {
  if (process.platform === 'win32') return;
  await fsp.chmod(binPath, 0o755);
  if (process.platform === 'darwin') {
    // Karantina niteliği temizlenmezse Gatekeeper indirilen ikiliyi çalıştırmaz.
    await new Promise<void>((resolve) => {
      const proc = spawn('xattr', ['-d', 'com.apple.quarantine', binPath]);
      proc.on('close', () => resolve());
      proc.on('error', () => resolve());
    });
  }
}

/**
 * ffmpeg zorunlu: MP3'e dönüştürme ve video+ses birleştirme onsuz çalışmaz,
 * bu yüzden deno'nun aksine "en iyi çaba" değil — indirilemezse hazırlık düşer.
 */
async function ensureFfmpeg(binDir: string, onState: (state: BinaryState) => void): Promise<string> {
  const localPath = path.join(binDir, getFfmpegLocalName());
  if (fs.existsSync(localPath)) {
    if (await isUsableBinary(localPath, ['-version'])) return localPath;
    await fsp.rm(localPath, { force: true });
  }

  onState({ kind: 'downloading', name: 'ffmpeg', percent: 0 });
  const release = await fetchLatestRelease(FFMPEG_REPO);
  const assetName = getFfmpegAssetName();
  const asset = release.assets.find((a) => a.name === assetName);
  if (!asset) throw new Error(`ffmpeg release varlığı bulunamadı: ${assetName}`);

  await fsp.mkdir(binDir, { recursive: true });
  await downloadWithProgress(asset.browser_download_url, localPath, (percent) =>
    onState({ kind: 'downloading', name: 'ffmpeg', percent }),
  );

  if (!(await verifyDigest(localPath, asset.digest))) {
    await fsp.rm(localPath, { force: true });
    throw new Error('ffmpeg checksum doğrulaması başarısız — dosya silindi');
  }

  await makeExecutable(localPath);
  return localPath;
}

/** Arşiv açma: işletim sisteminin kendi aracı kullanılır, ek bağımlılık yok. */
async function extractZip(zipPath: string, destDir: string): Promise<void> {
  const [command, args] =
    process.platform === 'win32'
      ? ([
          'powershell',
          ['-NoProfile', '-Command', `Expand-Archive -LiteralPath "${zipPath}" -DestinationPath "${destDir}" -Force`],
        ] as const)
      : (['unzip', ['-o', '-q', zipPath, '-d', destDir]] as const);

  await new Promise<void>((resolve, reject) => {
    const proc = spawn(command, [...args]);
    proc.on('error', reject);
    proc.on('close', (code) =>
      code === 0 ? resolve() : reject(new Error(`Arşiv açılamadı: ${command} kod ${code} ile bitti`)),
    );
  });
}

/**
 * deno, yt-dlp'nin JS runtime'ı. yt-dlp'den farkı: tek dosya değil zip yayınlanıyor
 * ve her asset'in kendi .sha256sum dosyası var.
 */
async function ensureDeno(binDir: string, onState: (state: BinaryState) => void): Promise<string> {
  const localPath = path.join(binDir, getDenoLocalName());
  if (fs.existsSync(localPath)) {
    if (await isUsableBinary(localPath)) return localPath;
    await fsp.rm(localPath, { force: true });
  }

  onState({ kind: 'downloading', name: 'deno', percent: 0 });
  const release = await fetchLatestRelease(DENO_REPO);
  const assetName = getDenoAssetName();
  const asset = release.assets.find((a) => a.name === assetName);
  const sumsAsset = release.assets.find((a) => a.name === getDenoSumsAssetName());
  if (!asset) throw new Error(`deno release varlığı bulunamadı: ${assetName}`);
  if (!sumsAsset) throw new Error(`deno checksum dosyası bulunamadı: ${getDenoSumsAssetName()}`);

  await fsp.mkdir(binDir, { recursive: true });
  const zipPath = path.join(binDir, assetName);
  await downloadWithProgress(asset.browser_download_url, zipPath, (percent) =>
    onState({ kind: 'downloading', name: 'deno', percent }),
  );

  const sumsContent = await fetchText(sumsAsset.browser_download_url);
  const isValid = await verifyChecksum(zipPath, assetName, sumsContent);
  if (!isValid) {
    await fsp.rm(zipPath, { force: true });
    throw new Error('deno checksum doğrulaması başarısız — dosya silindi');
  }

  await extractZip(zipPath, binDir);
  await fsp.rm(zipPath, { force: true });
  await makeExecutable(localPath);
  return localPath;
}

function readVersion(binPath: string, args: string[]): Promise<string> {
  return new Promise((resolve, reject) => {
    const proc = spawn(binPath, args);
    let output = '';
    proc.stdout.on('data', (chunk: Buffer) => (output += chunk.toString()));
    proc.on('error', reject);
    proc.on('close', (code) => {
      if (code === 0) resolve(output.trim().split('\n')[0] ?? '');
      else reject(new Error(`${binPath} ${args.join(' ')} kod ${code} ile bitti`));
    });
  });
}

interface BinaryPaths {
  ytdlpPath: string;
  ffmpegPath: string;
  /** JS runtime bulunamazsa uygulama çalışmaya devam eder; yalnızca bazı formatlar eksilir. */
  denoPath?: string;
}

// Tek uçuş (single-flight): pencere yeniden yüklendiğinde renderer ensureBinaries'i tekrar
// çağırır. Koruma olmadan iki indirme aynı dosyalar üzerinde yarışır (checksum hatası,
// rename ENOENT). Sonuç ayrıca önbelleğe alınır; geç gelen çağrı 'ready' durumunu tekrar alır.
let inFlight: Promise<BinaryPaths> | null = null;
let ready: { paths: BinaryPaths; state: BinaryState } | null = null;

export function ensureBinaries(onState: (state: BinaryState) => void): Promise<BinaryPaths> {
  if (ready) {
    onState(ready.state);
    return Promise.resolve(ready.paths);
  }
  if (!inFlight) {
    inFlight = doEnsureBinaries(onState).catch((err) => {
      inFlight = null; // başarısızlık kalıcı değil: kullanıcı yeniden deneyebilir
      throw err;
    });
  }
  return inFlight;
}

async function doEnsureBinaries(onState: (state: BinaryState) => void): Promise<BinaryPaths> {
  onState({ kind: 'checking' });
  const binDir = path.join(app.getPath('userData'), 'bin');

  try {
    // Dışarıdan verilen yollar indirmenin yerine geçer: indirme kaynağı bozulduğunda
    // kullanıcıya kaçış yolu (bkz. docs/PLAN.md §14) ve uçtan uca testler için giriş noktası.
    const ytdlpPath = process.env.YTDL_YTDLP_PATH || (await ensureYtDlp(binDir, onState));
    const ffmpegPath = process.env.YTDL_FFMPEG_PATH || (await ensureFfmpeg(binDir, onState));
    const [ytdlpVersion, ffmpegVersionLine] = await Promise.all([
      readVersion(ytdlpPath, ['--version']),
      readVersion(ffmpegPath, ['-version']),
    ]);
    const ffmpegVersion = ffmpegVersionLine.split(' ')[2] ?? ffmpegVersionLine;

    // deno en iyi çaba: indirilemezse indirme yine çalışır (bazı formatlar listelenmez),
    // bu yüzden hata tüm hazırlığı düşürmez — yalnızca loglanır.
    let denoPath: string | undefined;
    try {
      denoPath = process.env.YTDL_DENO_PATH || (await ensureDeno(binDir, onState));
    } catch (err) {
      console.warn('deno hazırlanamadı, JS runtime olmadan devam ediliyor:', err);
    }
    setDenoDirectory(denoPath ?? null);

    const state: BinaryState = { kind: 'ready', ytdlpVersion, ffmpegVersion };
    onState(state);
    ready = { paths: { ytdlpPath, ffmpegPath, denoPath }, state };
    return ready.paths;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    onState({ kind: 'failed', message });
    throw err;
  }
}
