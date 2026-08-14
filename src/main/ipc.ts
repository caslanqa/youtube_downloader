// Tüm ipcMain.handle kayıtları — tek dosyada. bkz. docs/PLAN.md §4
import { ipcMain, type BrowserWindow } from 'electron';
import { ensureBinaries } from './binaries/manager';
import type { BinaryState } from '../shared/types';

let currentWindow: BrowserWindow | null = null;
let registered = false;

export function registerIpc(mainWindow: BrowserWindow): void {
  currentWindow = mainWindow;
  if (registered) return; // activate() ile pencere yeniden açılsa da tek kayıt
  registered = true;

  ipcMain.handle('binaries:ensure', () =>
    ensureBinaries((state: BinaryState) => {
      currentWindow?.webContents.send('binaries:state', state);
    }),
  );
}
