// Main ve renderer sürecinin paylaştığı tipler — IPC sözleşmesinin tek doğruluk kaynağı.
// bkz. docs/PLAN.md §5

export type BinaryState =
  | { kind: 'checking' }
  | { kind: 'downloading'; name: 'yt-dlp' | 'ffmpeg'; percent: number }
  | { kind: 'ready'; ytdlpVersion: string; ffmpegVersion: string }
  | { kind: 'failed'; message: string };

export type Format = 'mp3' | 'mp4' | 'webm';

export interface JobRequest {
  url: string;
  format: Format;
  albumName: string;
  /** Kullanıcının seçtiği taban klasör — nihai yol `destination/albumName`'dir. */
  destination: string;
  numberPlaylistItems: boolean;
}

export type JobStatus =
  | { kind: 'queued' }
  | { kind: 'running'; percent: number; speed?: string; eta?: string }
  | { kind: 'done'; outputDir: string; fileCount: number }
  | { kind: 'error'; message: string; logTail: string }
  | { kind: 'cancelled' };

export interface Job {
  id: string;
  request: JobRequest;
  status: JobStatus;
}
