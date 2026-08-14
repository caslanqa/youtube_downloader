// Tüm ipcMain.handle kayıtları — tek dosyada. bkz. docs/PLAN.md §4, §5
import { app, dialog, ipcMain, shell, type BrowserWindow } from 'electron';
import { randomUUID } from 'node:crypto';
import path from 'node:path';
import { ensureBinaries } from './binaries/manager';
import { probeUrl } from './download/probe';
import { cancel as cancelJob, configureQueue, enqueue as enqueueJob, setConcurrency } from './download/queue';
import { getSettings, setSettings } from './settings';
import type { BinaryState, Job, JobRequest, Settings } from '../shared/types';

let currentWindow: BrowserWindow | null = null;
let registered = false;
let binaryPaths: { ytdlpPath: string; ffmpegPath: string } | null = null;

/** Ayarlardaki `destination` boşsa kullanılan varsayılan (bkz. docs/PLAN.md §9). */
function defaultDestination(): string {
  return path.join(app.getPath('downloads'), 'YTDownloader');
}

/** Renderer'a her zaman gerçek bir hedef yol gider — boş string sızmaz. */
function effectiveSettings(): Settings {
  const settings = getSettings();
  return { ...settings, destination: settings.destination.trim() || defaultDestination() };
}

function requireBinaries(): { ytdlpPath: string; ffmpegPath: string } {
  if (!binaryPaths) throw new Error('Bağımlılıklar henüz hazır değil');
  return binaryPaths;
}

export function registerIpc(mainWindow: BrowserWindow): void {
  currentWindow = mainWindow;
  if (registered) return; // activate() ile pencere yeniden açılsa da tek kayıt
  registered = true;

  ipcMain.handle('binaries:ensure', async () => {
    const result = await ensureBinaries((state: BinaryState) => {
      currentWindow?.webContents.send('binaries:state', state);
    });
    binaryPaths = result;
    // Kuyruk yalnızca binary yolları bilindikten sonra iş çalıştırabilir.
    configureQueue(result, (job: Job) => currentWindow?.webContents.send('job:update', job));
    setConcurrency(effectiveSettings().concurrency);
    return result;
  });

  ipcMain.handle('media:probe', (_e, url: string) => probeUrl(url, requireBinaries().ytdlpPath));

  ipcMain.handle('job:enqueue', (_e, request: JobRequest) => {
    requireBinaries();
    const jobId = randomUUID();
    enqueueJob(jobId, {
      ...request,
      destination: request.destination.trim() || defaultDestination(),
    });
    return jobId;
  });

  ipcMain.handle('job:cancel', (_e, jobId: string) => {
    cancelJob(jobId);
  });

  ipcMain.handle('settings:get', () => effectiveSettings());

  ipcMain.handle('settings:set', (_e, partial: Partial<Settings>) => {
    setSettings(partial);
    const settings = effectiveSettings();
    if (partial.concurrency !== undefined) setConcurrency(settings.concurrency);
    return settings;
  });

  ipcMain.handle('dialog:pickFolder', async () => {
    const result = currentWindow
      ? await dialog.showOpenDialog(currentWindow, { properties: ['openDirectory', 'createDirectory'] })
      : await dialog.showOpenDialog({ properties: ['openDirectory', 'createDirectory'] });
    return result.canceled ? null : (result.filePaths[0] ?? null);
  });

  ipcMain.handle('shell:openFolder', async (_e, target: string) => {
    // openPath hata durumunda boş olmayan bir mesaj döner (fırlatmaz).
    const error = await shell.openPath(target);
    if (error) throw new Error(error);
  });
}
