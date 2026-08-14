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
  language: 'tr', // ilk açılışta sistem diliyle değiştirilir (bkz. defaults())
  ytdlpAutoUpdate: true,
};

/** İlk açılışta arayüz dili sistem diline uyar; kullanıcı sonradan değiştirebilir. */
function defaults(): Settings {
  return { ...DEFAULTS, language: app.getLocale().toLowerCase().startsWith('tr') ? 'tr' : 'en' };
}

let store: Store<Settings> | null = null;

function getStore(): Store<Settings> {
  if (!store) {
    store = new Store<Settings>({
      defaults: defaults(),
      cwd: path.join(app.getPath('userData')),
    });
  }
  return store;
}

export function getSettings(): Settings {
  return { ...defaults(), ...getStore().store };
}

export function setSettings(partial: Partial<Settings>): Settings {
  const merged = { ...getSettings(), ...partial };
  getStore().set(merged);
  return merged;
}
