// Tüm ipcMain.handle kayıtları — tek dosyada. bkz. docs/PLAN.md §4
import { app, ipcMain, type BrowserWindow } from 'electron';
import { randomUUID } from 'node:crypto';
import path from 'node:path';
import { ensureBinaries } from './binaries/manager';
import { cancelJob, startJob } from './download/job';
import type { BinaryState, Job, JobRequest, JobStatus } from '../shared/types';

let currentWindow: BrowserWindow | null = null;
let registered = false;
let binaryPaths: { ytdlpPath: string; ffmpegPath: string } | null = null;
let activeJobId: string | null = null;

export function registerIpc(mainWindow: BrowserWindow): void {
  currentWindow = mainWindow;
  if (registered) return; // activate() ile pencere yeniden açılsa da tek kayıt
  registered = true;

  ipcMain.handle('binaries:ensure', async () => {
    const result = await ensureBinaries((state: BinaryState) => {
      currentWindow?.webContents.send('binaries:state', state);
    });
    binaryPaths = result;
    return result;
  });

  ipcMain.handle('job:enqueue', (_e, request: JobRequest) => {
    if (!binaryPaths) throw new Error('Binary\'ler henüz hazır değil');
    if (activeJobId) throw new Error('Zaten devam eden bir indirme var');

    const jobId = randomUUID();
    activeJobId = jobId;
    // Renderer boş bırakırsa varsayılan hedef: ~/Downloads/YTDownloader (bkz. docs/PLAN.md §6).
    const effectiveRequest: JobRequest = {
      ...request,
      destination: request.destination.trim() || path.join(app.getPath('downloads'), 'YTDownloader'),
    };
    const sendUpdate = (status: JobStatus) => {
      if (status.kind !== 'queued' && status.kind !== 'running') activeJobId = null;
      const job: Job = { id: jobId, request: effectiveRequest, status };
      currentWindow?.webContents.send('job:update', job);
    };
    sendUpdate({ kind: 'queued' });
    startJob(jobId, effectiveRequest, binaryPaths.ytdlpPath, binaryPaths.ffmpegPath, sendUpdate);
    return jobId;
  });

  ipcMain.handle('job:cancel', (_e, jobId: string) => {
    cancelJob(jobId);
  });
}
