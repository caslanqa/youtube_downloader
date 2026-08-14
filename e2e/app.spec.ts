// Uçtan uca duman testi (docs/PLAN.md §10). Kapsam bilinçli olarak dar: paketlenmiş
// ana süreç + gerçek IPC + gerçek renderer, sahte yt-dlp/ffmpeg ile ağsız çalışır.
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
  destination = path.join(userDataDir, 'indirilenler');
  // Ayarlar uygulamanın kendi deposundan okunur; hedef klasörü önceden yazarak
  // testin kullanıcının gerçek İndirilenler klasörüne dokunmasını engelliyoruz.
  fs.writeFileSync(
    path.join(userDataDir, 'config.json'),
    JSON.stringify({
      destination,
      defaultFormat: 'mp3',
      concurrency: 2,
      numberPlaylistItems: false,
      embedMetadata: true,
      theme: 'dark',
      language: 'tr', // testteki metin beklentileri sistem dilinden etkilenmesin
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
      YTDL_DENO_PATH: FAKE_DENO, // gerçek deno indirmesi testte tetiklenmesin
    },
  });
  page = await app.firstWindow();
});

test.afterAll(async () => {
  await app?.close();
  fs.rmSync(userDataDir, { recursive: true, force: true });
});

test('hazırlık tamamlanınca ana arayüz yüklenir', async () => {
  // Arayüzün görünmesi aynı zamanda üretim CSP başlığının renderer'ı bozmadığını kanıtlar.
  await expect(page.getByRole('heading', { name: 'YouTube Downloader', level: 1 })).toBeVisible();
  await expect(page.getByText('yt-dlp 2026.07.04')).toBeVisible();
  await expect(page.getByLabel('YouTube bağlantısı')).toBeVisible();
});

test('bağlantı incelenir, iş kuyruğa alınır ve tamamlanır', async () => {
  await page.getByLabel('YouTube bağlantısı').fill('https://www.youtube.com/watch?v=abc123');
  await expect(page.getByText('Sahte Test Videosu')).toBeVisible();

  // Albüm adı probe başlığından otomatik dolar; kullanıcı yazınca üzerine yazılmaz.
  await expect(page.getByLabel('Albüm adı')).toHaveValue('Sahte Test Videosu');
  await page.getByLabel('Albüm adı').fill('E2E Albüm');
  await page.getByRole('button', { name: 'Kuyruğa ekle' }).click();

  await expect(page.getByText(/Tamamlandı/)).toBeVisible({ timeout: 15_000 });
  expect(fs.existsSync(path.join(destination, 'E2E Albüm', 'Sahte Test Videosu.mp3'))).toBe(true);
});

test('ayarlar dişli düğmesinin altında açılır ve dil değişimi arayüze yansır', async () => {
  const gear = page.getByRole('button', { name: 'Ayarları aç' });
  await gear.click();
  await expect(page.getByRole('heading', { name: 'Ayarlar' })).toBeVisible();

  // Açılır kutu düğmenin ALTINDA ve sağa hizalı olmalı (ekranın ortasında değil).
  const gearBox = (await gear.boundingBox())!;
  const popoverBox = (await page.locator('#settings-popover').boundingBox())!;
  expect(popoverBox.y).toBeGreaterThanOrEqual(gearBox.y + gearBox.height);
  expect(Math.abs(popoverBox.x + popoverBox.width - (gearBox.x + gearBox.width))).toBeLessThan(2);

  await page.getByLabel('Dil').selectOption('en');
  await expect(page.getByRole('heading', { name: 'Settings' })).toBeVisible();

  await page.getByRole('button', { name: 'Close' }).click();
  await expect(page.getByLabel('YouTube link')).toBeVisible();
});
