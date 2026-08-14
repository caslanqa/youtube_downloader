// Types shared by the main and renderer processes: the single source of truth for the
// IPC contract. See docs/PLAN.md §5.

export type BinaryState =
  | { kind: 'checking' }
  | { kind: 'downloading'; name: 'yt-dlp' | 'ffmpeg' | 'deno'; percent: number }
  | { kind: 'ready'; ytdlpVersion: string; ffmpegVersion: string }
  | { kind: 'failed'; message: string };

export type Format = 'mp3' | 'mp4' | 'webm';

export interface MediaInfo {
  id: string;
  title: string;
  thumbnail?: string;
  duration?: number;
  isPlaylist: boolean;
  entryCount: number; // 1 for a single video
}

export interface JobRequest {
  url: string;
  format: Format;
  albumName: string;
  /** Base folder chosen by the user; the final path is `destination/albumName`. */
  destination: string;
  numberPlaylistItems: boolean;
}

export type JobStatus =
  | { kind: 'queued' }
  | { kind: 'running'; percent: number; speed?: string; eta?: string; currentItem?: number; totalItems?: number }
  | { kind: 'done'; outputDir: string; fileCount: number }
  | { kind: 'error'; message: string; logTail: string }
  | { kind: 'cancelled' };

export interface Job {
  id: string;
  request: JobRequest;
  info?: MediaInfo;
  status: JobStatus;
}

export type Language = 'tr' | 'en';

export interface Settings {
  destination: string;
  defaultFormat: Format;
  concurrency: number;
  numberPlaylistItems: boolean;
  embedMetadata: boolean;
  theme: 'system' | 'light' | 'dark';
  language: Language;
  ytdlpAutoUpdate: boolean;
}
