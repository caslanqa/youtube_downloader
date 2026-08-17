// Types shared by the main and renderer processes: the single source of truth for the
// IPC contract. See docs/PLAN.md §5.

export type BinaryState =
  | { kind: 'checking' }
  | { kind: 'downloading'; name: 'yt-dlp' | 'ffmpeg' | 'deno'; percent: number }
  | { kind: 'ready'; ytdlpVersion: string; ffmpegVersion: string }
  | { kind: 'failed'; message: string };

export type Format = 'mp3' | 'mp4' | 'webm';

// Height caps for yt-dlp's `[height<=N]` filter; 'best' leaves the resolution unrestricted.
// Ignored for the 'mp3' format, which is always audio-only regardless of the selected value.
export type VideoQuality = 'best' | '2160' | '1440' | '1080' | '720' | '480' | '360';

export interface SearchResultItem {
  videoId: string;
  title: string;
  channelTitle: string;
  thumbnail?: string;
  /** Seconds; undefined for content the API reports with a non-standard duration (e.g. a live stream). */
  duration?: number;
}

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
  /** Ignored when format is 'mp3'. */
  quality: VideoQuality;
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
  defaultQuality: VideoQuality;
  concurrency: number;
  numberPlaylistItems: boolean;
  embedMetadata: boolean;
  theme: 'system' | 'light' | 'dark';
  language: Language;
  ytdlpAutoUpdate: boolean;
  /** Empty disables search entirely; get one from console.cloud.google.com (see README). */
  youtubeApiKey: string;
}
