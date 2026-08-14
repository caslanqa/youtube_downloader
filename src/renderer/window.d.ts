import type { BinaryState, Job, JobRequest } from '../shared/types';

declare global {
  interface Window {
    api: {
      ensureBinaries: () => Promise<{ ytdlpPath: string; ffmpegPath: string }>;
      enqueue: (request: JobRequest) => Promise<string>;
      cancel: (jobId: string) => Promise<void>;
      onBinaryState: (cb: (state: BinaryState) => void) => void;
      onJobUpdate: (cb: (job: Job) => void) => void;
    };
  }
}

export {};
