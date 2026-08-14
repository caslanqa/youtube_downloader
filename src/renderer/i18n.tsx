import { createContext, useContext, type ReactNode } from 'react';
import type { Language } from '../shared/types';

// Arayüz metinleri tek dosyada. ~40 dize için i18next gibi bir kütüphane taşımaya
// gerek yok; sözlük + {placeholder} değişimi yetiyor. Türkçe referans dil:
// yeni bir anahtar eklendiğinde TypeScript diğer dilleri de zorunlu kılar.
const TR = {
  appTitle: 'YouTube Downloader',
  binariesVersions: 'yt-dlp {ytdlp} · ffmpeg {ffmpeg}',

  prepChecking: 'Bağımlılıklar kontrol ediliyor…',
  prepDownloading: '{name} indiriliyor',
  prepProgressLabel: '{name} indirme ilerlemesi',
  prepFailedHint: 'İnternet bağlantısını kontrol edip uygulamayı yeniden başlatın.',

  urlLabel: 'YouTube bağlantısı',
  urlPlaceholder: 'https://www.youtube.com/watch?v=...',
  urlHint: 'Bağlantıyı yapıştırın; indirmeden önce içeriği burada görürsünüz.',
  probing: 'Bağlantı inceleniyor…',
  playlistSummary: 'Oynatma listesi · {count} öğe',
  singleVideo: 'Tek video',

  formatLabel: 'Format',
  formatMp3: 'MP3 (ses)',
  formatMp4: 'MP4 (video)',
  formatWebm: 'WebM (video)',
  albumLabel: 'Albüm adı',
  albumPlaceholder: 'Indirilenler',
  albumHint: 'Dosyalar hedef klasörün altında bu adla bir alt klasöre iner.',
  submit: 'Kuyruğa ekle',

  settings: 'Ayarlar',
  settingsOpen: 'Ayarları aç',
  settingsClose: 'Kapat',
  destinationLabel: 'Hedef klasör',
  destinationPick: 'Seç',
  concurrencyLabel: 'Eşzamanlı indirme',
  themeLabel: 'Tema',
  themeSystem: 'Sistemle aynı',
  themeLight: 'Açık',
  themeDark: 'Koyu',
  languageLabel: 'Dil',
  languageTr: 'Türkçe',
  languageEn: 'İngilizce',
  numberingLabel: 'Oynatma listesi dosyalarını numaralandır',

  queueHeading: 'İndirme kuyruğu',
  queueEmpty: 'Kuyruk boş. Yukarıya bir bağlantı ekleyerek başlayın.',
  statusQueued: 'Sırada bekliyor…',
  statusQueuedShort: 'sıraya alındı',
  statusRunningShort: 'indiriliyor',
  statusDone: 'Tamamlandı — {count} dosya',
  statusDoneShort: 'tamamlandı, {count} dosya',
  statusCancelled: 'İptal edildi.',
  statusCancelledShort: 'iptal edildi',
  statusErrorShort: 'hata: {message}',
  progressLabel: '{title} indirme ilerlemesi',
  remaining: 'kalan {eta}',
  cancel: 'İptal et',
  openFolder: 'Klasörü aç',
  errorDetails: 'Ayrıntı',
};

const EN: Record<keyof typeof TR, string> = {
  appTitle: 'YouTube Downloader',
  binariesVersions: 'yt-dlp {ytdlp} · ffmpeg {ffmpeg}',

  prepChecking: 'Checking dependencies…',
  prepDownloading: 'Downloading {name}',
  prepProgressLabel: '{name} download progress',
  prepFailedHint: 'Check your internet connection and restart the app.',

  urlLabel: 'YouTube link',
  urlPlaceholder: 'https://www.youtube.com/watch?v=...',
  urlHint: 'Paste a link; you will see what it contains before downloading.',
  probing: 'Inspecting link…',
  playlistSummary: 'Playlist · {count} items',
  singleVideo: 'Single video',

  formatLabel: 'Format',
  formatMp3: 'MP3 (audio)',
  formatMp4: 'MP4 (video)',
  formatWebm: 'WebM (video)',
  albumLabel: 'Album name',
  albumPlaceholder: 'Downloads',
  albumHint: 'Files go into a subfolder with this name under the destination folder.',
  submit: 'Add to queue',

  settings: 'Settings',
  settingsOpen: 'Open settings',
  settingsClose: 'Close',
  destinationLabel: 'Destination folder',
  destinationPick: 'Choose',
  concurrencyLabel: 'Concurrent downloads',
  themeLabel: 'Theme',
  themeSystem: 'Match system',
  themeLight: 'Light',
  themeDark: 'Dark',
  languageLabel: 'Language',
  languageTr: 'Turkish',
  languageEn: 'English',
  numberingLabel: 'Number playlist files',

  queueHeading: 'Download queue',
  queueEmpty: 'The queue is empty. Add a link above to start.',
  statusQueued: 'Waiting in queue…',
  statusQueuedShort: 'queued',
  statusRunningShort: 'downloading',
  statusDone: 'Completed — {count} files',
  statusDoneShort: 'completed, {count} files',
  statusCancelled: 'Cancelled.',
  statusCancelledShort: 'cancelled',
  statusErrorShort: 'error: {message}',
  progressLabel: '{title} download progress',
  remaining: '{eta} left',
  cancel: 'Cancel',
  openFolder: 'Open folder',
  errorDetails: 'Details',
};

const STRINGS: Record<Language, Record<keyof typeof TR, string>> = { tr: TR, en: EN };

export type StringKey = keyof typeof TR;
export type Translate = (key: StringKey, vars?: Record<string, string | number>) => string;

export function translate(language: Language, key: StringKey, vars?: Record<string, string | number>): string {
  const template = STRINGS[language][key];
  if (!vars) return template;
  return template.replace(/\{(\w+)\}/g, (match, name: string) => String(vars[name] ?? match));
}

const LanguageContext = createContext<Language>('tr');

export function LanguageProvider({ language, children }: { language: Language; children: ReactNode }) {
  return <LanguageContext.Provider value={language}>{children}</LanguageContext.Provider>;
}

/** Bileşenlerin metin erişimi: `const t = useT(); t('submit')`. */
export function useT(): Translate {
  const language = useContext(LanguageContext);
  return (key, vars) => translate(language, key, vars);
}
