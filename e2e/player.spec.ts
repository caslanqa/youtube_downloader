// Regression coverage for two real bugs found by watching a real video, not just a fake one:
// (1) the app-wide CSP header was being force-applied to every request in the session, which
// silently broke the embedded player by overwriting YouTube's own CSP and blocking its inline
// scripts/fonts; (2) loading the renderer as a file:// page made YouTube's embedded player
// reject it outright ("Error 153: Video player configuration error"), fixed by serving the
// packaged renderer over a local http:// server instead (see src/main.ts). Neither bug was
// visible with the fake-video fixture the rest of the e2e suite uses, since that never produces
// real player content -- this test deliberately uses real binaries and a real, stable video.
import { _electron as electron, expect, test, type ElectronApplication, type Page } from '@playwright/test';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const REPO_ROOT = path.join(__dirname, '..');
const MAIN = path.join(REPO_ROOT, '.vite', 'build', 'main.js');
// "Me at the zoo" -- the first video ever uploaded to YouTube; stable, always available, and
// embedding-enabled, so it won't flake the way a random/removable video could.
const VIDEO_ID = 'jNQXAC9IVRw';

let app: ElectronApplication;
let page: Page;
let userDataDir: string;

test.beforeAll(async () => {
  // The inner expect() timeout below only bounds that one assertion; it does NOT extend the
  // hook's own timeout, which otherwise stays at playwright.config.ts's 30s default and kills
  // a fresh, nothing-cached-yet real binary download (~120 MB) well before it can finish.
  test.setTimeout(180_000);

  userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ytdl-player-e2e-'));
  fs.writeFileSync(
    path.join(userDataDir, 'config.json'),
    JSON.stringify({
      destination: path.join(userDataDir, 'downloads'),
      defaultFormat: 'mp3',
      concurrency: 2,
      numberPlaylistItems: false,
      embedMetadata: true,
      theme: 'dark',
      language: 'en',
      ytdlpAutoUpdate: false,
    }),
  );

  // Deliberately no YTDL_*_PATH overrides: this needs the real yt-dlp/ffmpeg/deno, which the
  // app downloads itself on first launch if they aren't already cached from a previous run.
  app = await electron.launch({ args: [MAIN, `--user-data-dir=${userDataDir}`] });
  page = await app.firstWindow();
  // Generous timeout: a machine with nothing cached yet downloads ~120 MB of tools first.
  await expect(page.getByLabel('YouTube link')).toBeVisible({ timeout: 120_000 });
});

test.afterAll(async () => {
  await app?.close();
  fs.rmSync(userDataDir, { recursive: true, force: true });
});

test('a real video actually plays in the embedded player, not just loads', async () => {
  await page.getByLabel('YouTube link').fill(`https://www.youtube.com/watch?v=${VIDEO_ID}`);

  const frame = await page.waitForEvent('framenavigated', {
    predicate: (candidate) => candidate.url() === `https://www.youtube-nocookie.com/embed/${VIDEO_ID}`,
    timeout: 20_000,
  });

  // YouTube's player shell renders #movie_player once it has actually initialized; a CSP or
  // origin problem leaves the frame stuck on a bare error screen with no player element at all.
  const player = frame.locator('#movie_player');
  await expect(player).toBeAttached({ timeout: 15_000 });

  const frameText = await frame.locator('body').innerText();
  expect(frameText).not.toContain('Error 153');
  expect(frameText).not.toContain('configuration error');
});
