// See the Electron documentation for details on how to use preload scripts:
// https://www.electronjs.org/docs/latest/tutorial/process-model#preload-scripts
import { contextBridge, ipcRenderer } from 'electron';
import type { BinaryState, Job, JobRequest } from './shared/types';

contextBridge.exposeInMainWorld('api', {
  ensureBinaries: () => ipcRenderer.invoke('binaries:ensure') as Promise<{ ytdlpPath: string; ffmpegPath: string }>,
  enqueue: (request: JobRequest) => ipcRenderer.invoke('job:enqueue', request) as Promise<string>,
  cancel: (jobId: string) => ipcRenderer.invoke('job:cancel', jobId) as Promise<void>,
  // (_e, value) => cb(value) sarmalaması bilinçli: callback'e IpcRendererEvent
  // geçirmek event.sender üzerinden ipcRenderer'ı renderer'a sızdırır.
  onBinaryState: (cb: (state: BinaryState) => void) =>
    ipcRenderer.on('binaries:state', (_e, state: BinaryState) => cb(state)),
  onJobUpdate: (cb: (job: Job) => void) => ipcRenderer.on('job:update', (_e, job: Job) => cb(job)),
});

