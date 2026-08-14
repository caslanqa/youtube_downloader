import type { BinaryState } from '../shared/types';

declare global {
  interface Window {
    api: {
      ensureBinaries: () => Promise<{ ytdlpPath: string; ffmpegPath: string }>;
      onBinaryState: (cb: (state: BinaryState) => void) => void;
    };
  }
}

export {};
