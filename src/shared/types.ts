export interface EncodeJob {
  id: string;
  inputPath: string;
  outputPath: string;
}

export interface EncodeLog {
  jobId: string;
  message: string;
}

export interface MediaMetadata {
  path: string;
  fileName: string;
  durationSeconds: number;
}

export type ShortcutAction =
  | 'toggle-playback'
  | 'seek-backward'
  | 'seek-forward'
  | 'open-video'
  | 'queue-current'
  | 'start-encode'
  | 'zoom-in'
  | 'zoom-out';

export interface AppApi {
  openVideo(): Promise<MediaMetadata | null>;
  startBatch(jobs: EncodeJob[]): Promise<{ ok: boolean }>;
  onEncodeLog(callback: (log: EncodeLog) => void): () => void;
  onShortcut(callback: (action: ShortcutAction) => void): () => void;
  setZoom(delta: 1 | -1): Promise<number>;
}
