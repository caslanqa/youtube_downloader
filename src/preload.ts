// See the Electron documentation for details on how to use preload scripts:
// https://www.electronjs.org/docs/latest/tutorial/process-model#preload-scripts
import { contextBridge, ipcRenderer } from 'electron';
import type { BinaryState } from './shared/types';

contextBridge.exposeInMainWorld('api', {
  ensureBinaries: () => ipcRenderer.invoke('binaries:ensure') as Promise<{ ytdlpPath: string; ffmpegPath: string }>,
  // (_e, value) => cb(value) sarmalaması bilinçli: callback'e IpcRendererEvent
  // geçirmek event.sender üzerinden ipcRenderer'ı renderer'a sızdırır.
  onBinaryState: (cb: (state: BinaryState) => void) =>
    ipcRenderer.on('binaries:state', (_e, state: BinaryState) => cb(state)),
});

