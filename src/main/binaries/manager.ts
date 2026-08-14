// Binary preparation: downloads yt-dlp, ffmpeg and deno, verifies their SHA-256 and reads
// their versions. None of them ship inside the installer. See docs/PLAN.md §6.
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
  /** Per-asset digest reported by GitHub as "sha256:<hex>" (not present in every repository). */
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
    throw new Error(`Could not read ${repo} release info (HTTP ${res.status})`);
  }
  return (await res.json()) as ReleaseInfo;
}

async function fetchText(url: string): Promise<string> {
  const res = await fetch(url, { headers: { 'User-Agent': USER_AGENT } });
  if (!res.ok) throw new Error(`Download failed: ${url} (HTTP ${res.status})`);
  return res.text();
}

async function downloadWithProgress(
  url: string,
  destPath: string,
  onPercent: (percent: number) => void,
): Promise<void> {
  const res = await fetch(url, { headers: { 'User-Agent': USER_AGENT } });
  if (!res.ok || !res.body) {
    throw new Error(`Download failed: ${url} (HTTP ${res.status})`);
  }
  const total = Number(res.headers.get('content-length')) || 0;
  let downloaded = 0;
  // The pid suffix keeps two app instances from writing the same .part file concurrently.
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
    // A half-written file is never executed: it stays as .part until the download completes.
    await fsp.rename(partPath, destPath);
  } catch (err) {
    await fsp.rm(partPath, { force: true }); // leftovers must not poison the next attempt
    throw err;
  }
}

/** SHA-256 digest of a file. Exported so it can be tested directly. */
export async function sha256File(filePath: string): Promise<string> {
  const hash = crypto.createHash('sha256');
  for await (const chunk of fs.createReadStream(filePath)) {
    hash.update(chunk as Buffer);
  }
  return hash.digest('hex');
}

/** Verifies a file against a GitHub asset digest ("sha256:<hex>"). */
export async function verifyDigest(filePath: string, digest: string | null | undefined): Promise<boolean> {
  const expected = digest?.replace(/^sha256:/, '').toLowerCase();
  if (!expected) throw new Error('No sha256 digest published for this asset');
  return expected === (await sha256File(filePath)).toLowerCase();
}

/** Verifies `fileName` against a `sha256sum`-formatted SUMS file. */
export async function verifyChecksum(filePath: string, fileName: string, sumsContent: string): Promise<boolean> {
  const line = sumsContent.split('\n').find((entry) => entry.trim().endsWith(fileName));
  if (!line) {
    throw new Error(`No checksum entry found for ${fileName}`);
  }
  const expected = line.trim().split(/\s+/)[0]?.toLowerCase();
  const actual = (await sha256File(filePath)).toLowerCase();
  return expected === actual;
}

/**
 * Checks that a binary on disk is actually usable. An existence check is not enough: a
 * half-downloaded or non-executable file fails with EACCES, and an existence check alone
 * would keep returning that broken copy forever.
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
    await fsp.rm(localPath, { force: true }); // broken copy: download it again
  }

  onState({ kind: 'downloading', name: 'yt-dlp', percent: 0 });
  const release = await fetchLatestRelease(YTDLP_REPO);
  const assetName = getYtDlpAssetName();
  const asset = release.assets.find((a) => a.name === assetName);
  const sumsAsset = release.assets.find((a) => a.name === YTDLP_SUMS_ASSET);
  if (!asset) throw new Error(`yt-dlp release asset not found: ${assetName}`);
  if (!sumsAsset) throw new Error(`yt-dlp ${YTDLP_SUMS_ASSET} not found`);

  await fsp.mkdir(binDir, { recursive: true });
  await downloadWithProgress(asset.browser_download_url, localPath, (percent) =>
    onState({ kind: 'downloading', name: 'yt-dlp', percent }),
  );

  const sumsContent = await fetchText(sumsAsset.browser_download_url);
  const isValid = await verifyChecksum(localPath, assetName, sumsContent);
  if (!isValid) {
    await fsp.rm(localPath, { force: true });
    throw new Error('yt-dlp checksum verification failed; the file was deleted');
  }

  await makeExecutable(localPath);
  return localPath;
}

async function makeExecutable(binPath: string): Promise<void> {
  if (process.platform === 'win32') return;
  await fsp.chmod(binPath, 0o755);
  if (process.platform === 'darwin') {
    // Without clearing the quarantine attribute, Gatekeeper refuses to run the download.
    await new Promise<void>((resolve) => {
      const proc = spawn('xattr', ['-d', 'com.apple.quarantine', binPath]);
      proc.on('close', () => resolve());
      proc.on('error', () => resolve());
    });
  }
}

/**
 * ffmpeg is mandatory: MP3 extraction and video+audio merging do not work without it.
 * Unlike deno this is not best-effort; if it cannot be fetched, preparation fails.
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
  if (!asset) throw new Error(`ffmpeg release asset not found: ${assetName}`);

  await fsp.mkdir(binDir, { recursive: true });
  await downloadWithProgress(asset.browser_download_url, localPath, (percent) =>
    onState({ kind: 'downloading', name: 'ffmpeg', percent }),
  );

  if (!(await verifyDigest(localPath, asset.digest))) {
    await fsp.rm(localPath, { force: true });
    throw new Error('ffmpeg checksum verification failed; the file was deleted');
  }

  await makeExecutable(localPath);
  return localPath;
}

/** Archive extraction through the operating system's own tool, so no extra dependency. */
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
      code === 0 ? resolve() : reject(new Error(`Could not extract archive: ${command} exited with code ${code}`)),
    );
  });
}

/**
 * deno is yt-dlp's JavaScript runtime. It differs from yt-dlp in two ways: releases ship as
 * zip archives rather than single files, and every asset has its own .sha256sum file.
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
  if (!asset) throw new Error(`deno release asset not found: ${assetName}`);
  if (!sumsAsset) throw new Error(`deno checksum file not found: ${getDenoSumsAssetName()}`);

  await fsp.mkdir(binDir, { recursive: true });
  const zipPath = path.join(binDir, assetName);
  await downloadWithProgress(asset.browser_download_url, zipPath, (percent) =>
    onState({ kind: 'downloading', name: 'deno', percent }),
  );

  const sumsContent = await fetchText(sumsAsset.browser_download_url);
  const isValid = await verifyChecksum(zipPath, assetName, sumsContent);
  if (!isValid) {
    await fsp.rm(zipPath, { force: true });
    throw new Error('deno checksum verification failed; the file was deleted');
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
      else reject(new Error(`${binPath} ${args.join(' ')} exited with code ${code}`));
    });
  });
}

interface BinaryPaths {
  ytdlpPath: string;
  ffmpegPath: string;
  /** Without the JS runtime the app still works; only some formats stop being listed. */
  denoPath?: string;
}

// Single-flight guard: the renderer calls ensureBinaries again whenever the window reloads.
// Without it two downloads race over the same files (checksum failures, rename ENOENT). The
// result is cached as well, so a late caller still receives the 'ready' state.
let inFlight: Promise<BinaryPaths> | null = null;
let ready: { paths: BinaryPaths; state: BinaryState } | null = null;

export function ensureBinaries(onState: (state: BinaryState) => void): Promise<BinaryPaths> {
  if (ready) {
    onState(ready.state);
    return Promise.resolve(ready.paths);
  }
  if (!inFlight) {
    inFlight = doEnsureBinaries(onState).catch((err) => {
      inFlight = null; // failure is not permanent: the user can retry
      throw err;
    });
  }
  return inFlight;
}

async function doEnsureBinaries(onState: (state: BinaryState) => void): Promise<BinaryPaths> {
  onState({ kind: 'checking' });
  const binDir = path.join(app.getPath('userData'), 'bin');

  try {
    // Externally provided paths replace the download: an escape hatch when a download source
    // breaks (docs/PLAN.md §14) and the injection point for end-to-end tests.
    const ytdlpPath = process.env.YTDL_YTDLP_PATH || (await ensureYtDlp(binDir, onState));
    const ffmpegPath = process.env.YTDL_FFMPEG_PATH || (await ensureFfmpeg(binDir, onState));
    const [ytdlpVersion, ffmpegVersionLine] = await Promise.all([
      readVersion(ytdlpPath, ['--version']),
      readVersion(ffmpegPath, ['-version']),
    ]);
    const ffmpegVersion = ffmpegVersionLine.split(' ')[2] ?? ffmpegVersionLine;

    // deno is best-effort: downloads still work without it (some formats are missing), so a
    // failure must not bring the whole preparation down; it is only logged.
    let denoPath: string | undefined;
    try {
      denoPath = process.env.YTDL_DENO_PATH || (await ensureDeno(binDir, onState));
    } catch (err) {
      console.warn('Could not prepare deno, continuing without a JS runtime:', err);
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
