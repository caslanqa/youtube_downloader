// Main ve renderer sürecinin paylaştığı tipler — IPC sözleşmesinin tek doğruluk kaynağı.
// bkz. docs/PLAN.md §5

export type BinaryState =
  | { kind: 'checking' }
  | { kind: 'downloading'; name: 'yt-dlp' | 'ffmpeg'; percent: number }
  | { kind: 'ready'; ytdlpVersion: string; ffmpegVersion: string }
  | { kind: 'failed'; message: string };
