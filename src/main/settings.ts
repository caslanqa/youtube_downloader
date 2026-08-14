// Kalıcı ayarlar — electron-store ile userData altında JSON. bkz. docs/PLAN.md §9.
import { app } from 'electron';
import path from 'node:path';
import Store from 'electron-store';
import type { Settings } from '../shared/types';

const DEFAULTS: Settings = {
  destination: '', // boşsa runtime'da ~/Downloads/YTDownloader kullanılır (bkz. ipc.ts)
  defaultFormat: 'mp3',
  concurrency: 2,
  numberPlaylistItems: true,
  embedMetadata: true,
  theme: 'system',
  ytdlpAutoUpdate: true,
};

let store: Store<Settings> | null = null;

function getStore(): Store<Settings> {
  if (!store) {
    store = new Store<Settings>({
      defaults: DEFAULTS,
      cwd: path.join(app.getPath('userData')),
    });
  }
  return store;
}

export function getSettings(): Settings {
  return { ...DEFAULTS, ...getStore().store };
}

export function setSettings(partial: Partial<Settings>): Settings {
  const merged = { ...getSettings(), ...partial };
  getStore().set(merged);
  return merged;
}
