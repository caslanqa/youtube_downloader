// End-to-end coverage for the search feature (docs/PLAN.md §10): a local HTTP server stands in
// for the real googleapis.com endpoints, so this needs no network access and no real API key.
import { _electron as electron, expect, test, type ElectronApplication, type Page } from '@playwright/test';
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';

const REPO_ROOT = path.join(__dirname, '..');
const MAIN = path.join(REPO_ROOT, '.vite', 'build', 'main.js');
const fake = (name: string) => path.join(REPO_ROOT, 'e2e', 'fixtures', name);

let server: http.Server;
let app: ElectronApplication;
let page: Page;
let userDataDir: string;

test.beforeAll(async () => {
  server = http.createServer((req, res) => {
    const url = new URL(req.url ?? '', 'http://localhost');
    res.setHeader('Content-Type', 'application/json');
    if (url.pathname === '/search') {
      res.end(
        JSON.stringify({
          items: [
            {
              id: { videoId: 'abc123' },
              snippet: {
                title: 'Fake Search Result',
                channelTitle: 'Fake Channel',
                thumbnails: { default: { url: 'https://i.ytimg.com/vi/abc123/default.jpg' } },
              },
            },
          ],
        }),
      );
    } else if (url.pathname === '/videos') {
      res.end(JSON.stringify({ items: [{ id: 'abc123', contentDetails: { duration: 'PT2M5S' } }] }));
    } else {
      res.statusCode = 404;
      res.end('{}');
    }
  });
  await new Promise<void>((resolve) => server.listen(0, resolve));
  const { port } = server.address() as { port: number };

  userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ytdl-search-e2e-'));
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
      youtubeApiKey: 'fake-key',
    }),
  );

  app = await electron.launch({
    args: [MAIN, `--user-data-dir=${userDataDir}`],
    env: {
      ...process.env,
      YTDL_YTDLP_PATH: fake('fake-ytdlp.js'),
      YTDL_FFMPEG_PATH: fake('fake-ffmpeg.js'),
      YTDL_DENO_PATH: fake('fake-deno.js'),
      YOUTUBE_API_BASE: `http://127.0.0.1:${port}`,
    },
  });
  page = await app.firstWindow();
  await expect(page.getByLabel('YouTube link')).toBeVisible();
});

test.afterAll(async () => {
  await app?.close();
  await new Promise<void>((resolve) => server.close(() => resolve()));
  fs.rmSync(userDataDir, { recursive: true, force: true });
});

test('searches YouTube, shows a result, and picking it hands off to the link flow', async () => {
  await page.getByRole('button', { name: 'Search YouTube' }).click();
  await page.getByLabel('Search YouTube', { exact: true }).fill('fake query');
  await page.getByRole('button', { name: 'Search', exact: true }).click();

  await expect(page.getByText('Fake Search Result')).toBeVisible();
  await expect(page.getByText('Fake Channel')).toBeVisible();
  await expect(page.getByText('2:05')).toBeVisible();

  await page.getByText('Fake Search Result').click();

  // Picking a result switches back to Link mode and probes the URL through the fake yt-dlp,
  // exactly like pasting the link by hand would (no separate download path to keep in sync).
  await expect(page.getByLabel('YouTube link')).toHaveValue('https://www.youtube.com/watch?v=abc123');
  await expect(page.getByText('Fake Test Video')).toBeVisible();
});
