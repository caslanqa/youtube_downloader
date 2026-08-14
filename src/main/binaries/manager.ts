// Binary hazırlığı: yt-dlp indirir + SHA-256 doğrular, ffmpeg-static'i doğrular,
// ikisinin sürümünü okur. bkz. docs/PLAN.md §6.
import { app } from 'electron';
import { spawn } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import { pipeline } from 'node:stream/promises';
import { Readable } from 'node:stream';
import type { BinaryState } from '../../shared/types';
import { getFfmpegPath } from './ffmpeg';
import { YTDLP_REPO, YTDLP_SUMS_ASSET, getYtDlpAssetName, getYtDlpLocalName } from './ytdlp';

const USER_AGENT = 'youtube-downloader-app';

interface ReleaseAsset {
  name: string;
  browser_download_url: string;
}

interface ReleaseInfo {
  tag_name: string;
  assets: ReleaseAsset[];
}

async function fetchLatestYtDlpRelease(): Promise<ReleaseInfo> {
  const res = await fetch(`https://api.github.com/repos/${YTDLP_REPO}/releases/latest`, {
    headers: { 'User-Agent': USER_AGENT },
  });
  if (!res.ok) {
    throw new Error(`yt-dlp sürüm bilgisi alınamadı (HTTP ${res.status})`);
  }
  return (await res.json()) as ReleaseInfo;
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
async function isUsableBinary(binPath: string): Promise<boolean> {
  try {
    await fsp.access(binPath, fs.constants.X_OK);
    await readVersion(binPath, ['--version']);
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
  const release = await fetchLatestYtDlpRelease();
  const assetName = getYtDlpAssetName();
  const asset = release.assets.find((a) => a.name === assetName);
  const sumsAsset = release.assets.find((a) => a.name === YTDLP_SUMS_ASSET);
  if (!asset) throw new Error(`yt-dlp release varlığı bulunamadı: ${assetName}`);
  if (!sumsAsset) throw new Error(`yt-dlp ${YTDLP_SUMS_ASSET} bulunamadı`);

  await fsp.mkdir(binDir, { recursive: true });
  await downloadWithProgress(asset.browser_download_url, localPath, (percent) =>
    onState({ kind: 'downloading', name: 'yt-dlp', percent }),
  );

  const sumsRes = await fetch(sumsAsset.browser_download_url, { headers: { 'User-Agent': USER_AGENT } });
  const sumsContent = await sumsRes.text();
  const isValid = await verifyChecksum(localPath, assetName, sumsContent);
  if (!isValid) {
    await fsp.rm(localPath, { force: true });
    throw new Error('yt-dlp checksum doğrulaması başarısız — dosya silindi');
  }

  if (process.platform !== 'win32') {
    await fsp.chmod(localPath, 0o755);
  }
  if (process.platform === 'darwin') {
    // Karantina niteliği temizlenmezse Gatekeeper indirilen ikiliyi çalıştırmaz.
    await new Promise<void>((resolve) => {
      const proc = spawn('xattr', ['-d', 'com.apple.quarantine', localPath]);
      proc.on('close', () => resolve());
      proc.on('error', () => resolve());
    });
  }

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
    const ffmpegPath = process.env.YTDL_FFMPEG_PATH || getFfmpegPath();
    const [ytdlpVersion, ffmpegVersionLine] = await Promise.all([
      readVersion(ytdlpPath, ['--version']),
      readVersion(ffmpegPath, ['-version']),
    ]);
    const ffmpegVersion = ffmpegVersionLine.split(' ')[2] ?? ffmpegVersionLine;
    const state: BinaryState = { kind: 'ready', ytdlpVersion, ffmpegVersion };
    onState(state);
    ready = { paths: { ytdlpPath, ffmpegPath }, state };
    return ready.paths;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    onState({ kind: 'failed', message });
    throw err;
  }
}
