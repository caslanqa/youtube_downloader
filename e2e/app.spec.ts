// End-to-end smoke test (docs/PLAN.md §10). The scope is deliberately narrow: the built main
// process, real IPC and the real renderer, driven by fake binaries so no network is needed.
import { _electron as electron, expect, test, type ElectronApplication, type Page } from '@playwright/test';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const REPO_ROOT = path.join(__dirname, '..');
const MAIN = path.join(REPO_ROOT, '.vite', 'build', 'main.js');
const FAKE_YTDLP = path.join(__dirname, 'fixtures', 'fake-ytdlp.js');
const FAKE_FFMPEG = path.join(__dirname, 'fixtures', 'fake-ffmpeg.js');
const FAKE_DENO = path.join(__dirname, 'fixtures', 'fake-deno.js');

let app: ElectronApplication;
let page: Page;
let userDataDir: string;
let destination: string;

test.beforeAll(async () => {
  userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ytdl-e2e-'));
  destination = path.join(userDataDir, 'downloads');
  // Settings are read from the app's own store, so writing the destination up front keeps the
  // test away from the user's real Downloads folder.
  fs.writeFileSync(
    path.join(userDataDir, 'config.json'),
    JSON.stringify({
      destination,
      defaultFormat: 'mp3',
      concurrency: 2,
      numberPlaylistItems: false,
      embedMetadata: true,
      theme: 'dark',
      language: 'en', // keep the expected strings independent of the system locale
      ytdlpAutoUpdate: false,
    }),
  );

  for (const fixture of [FAKE_YTDLP, FAKE_FFMPEG, FAKE_DENO]) fs.chmodSync(fixture, 0o755);

  app = await electron.launch({
    args: [MAIN, `--user-data-dir=${userDataDir}`],
    env: {
      ...process.env,
      YTDL_YTDLP_PATH: FAKE_YTDLP,
      YTDL_FFMPEG_PATH: FAKE_FFMPEG,
      YTDL_DENO_PATH: FAKE_DENO, // never trigger a real deno download from a test
    },
  });
  page = await app.firstWindow();
});

test.afterAll(async () => {
  await app?.close();
  fs.rmSync(userDataDir, { recursive: true, force: true });
});

test('loads the main UI once preparation finishes', async () => {
  // A rendered UI also proves the production CSP header did not break the renderer.
  await expect(page.getByRole('heading', { name: 'YouTube Downloader', level: 1 })).toBeVisible();
  await expect(page.getByText('yt-dlp 2026.07.04')).toBeVisible();
  await expect(page.getByLabel('YouTube link')).toBeVisible();
});

test('probes a link, plays it, queues the job and completes it', async () => {
  await page.getByLabel('YouTube link').fill('https://www.youtube.com/watch?v=abc123');
  await expect(page.getByText('Fake Test Video')).toBeVisible();

  // Confirms the CSP frame-src change actually allows the embed to load, not just that the
  // <iframe> element exists in the DOM (which CSP would still permit even while blocking it).
  // This needs real network access, unlike the rest of the e2e suite.
  const frame = await page.waitForEvent('framenavigated', {
    predicate: (candidate) => candidate.url().startsWith('https://www.youtube-nocookie.com/embed/abc123'),
    timeout: 15_000,
  });
  expect(frame.url()).toContain('abc123');

  await page.getByRole('button', { name: 'Download', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Download this video' })).toBeVisible();

  // The Download button sits below the player, close to the bottom of the window, so opening
  // downward (like the settings popover does) would clip most of this taller popover off
  // screen — this is exactly what `position-try-fallbacks: flip-block` in index.css exists to
  // avoid by flipping it above the button instead. Assert it actually fits.
  // page.viewportSize() is null for Electron windows (they use the native window size, not a
  // configured Playwright viewport), so read the real dimension from the document instead.
  const windowHeight = await page.evaluate(() => window.innerHeight);
  const popoverBox = await page.locator('#download-popover').boundingBox();
  expect(popoverBox).not.toBeNull();
  expect(popoverBox!.y).toBeGreaterThanOrEqual(0);
  expect(popoverBox!.y + popoverBox!.height).toBeLessThanOrEqual(windowHeight);

  // The album name is auto-filled from the probed title and is not overwritten once typed.
  await expect(page.getByLabel('Album name')).toHaveValue('Fake Test Video');
  await page.getByLabel('Album name').fill('E2E Album');
  await page.getByRole('button', { name: 'Add to queue' }).click();

  await expect(page.getByText(/Completed/)).toBeVisible({ timeout: 15_000 });
  expect(fs.existsSync(path.join(destination, 'E2E Album', 'Fake Test Video.mp3'))).toBe(true);
});

test('opens settings under the gear button and applies a language change', async () => {
  const gear = page.getByRole('button', { name: 'Open settings' });
  await gear.click();
  await expect(page.getByRole('heading', { name: 'Settings' })).toBeVisible();

  // The popover must sit BELOW the button and align to its right edge, not centred on screen.
  const gearBox = (await gear.boundingBox())!;
  const popoverBox = (await page.locator('#settings-popover').boundingBox())!;
  expect(popoverBox.y).toBeGreaterThanOrEqual(gearBox.y + gearBox.height);
  expect(Math.abs(popoverBox.x + popoverBox.width - (gearBox.x + gearBox.width))).toBeLessThan(2);

  await page.getByLabel('Language').selectOption('tr');
  await expect(page.getByRole('heading', { name: 'Ayarlar' })).toBeVisible();

  await page.getByRole('button', { name: 'Kapat' }).click();
  await expect(page.getByLabel('YouTube bağlantısı')).toBeVisible();
});
