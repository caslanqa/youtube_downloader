import type { BinaryState, Job, JobRequest, MediaInfo, Settings } from '../shared/types';

declare global {
  interface Window {
    api: {
      ensureBinaries: () => Promise<{ ytdlpPath: string; ffmpegPath: string }>;
      probe: (url: string) => Promise<MediaInfo>;
      enqueue: (request: JobRequest) => Promise<string>;
      cancel: (jobId: string) => Promise<void>;
      getSettings: () => Promise<Settings>;
      setSettings: (partial: Partial<Settings>) => Promise<Settings>;
      pickFolder: () => Promise<string | null>;
      openFolder: (target: string) => Promise<void>;
      onBinaryState: (cb: (state: BinaryState) => void) => void;
      onJobUpdate: (cb: (job: Job) => void) => void;
    };
  }
}

export {};
