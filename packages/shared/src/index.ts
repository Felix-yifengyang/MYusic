export type DownloadStatus = "running" | "done" | "failed" | "canceled";

export interface DownloadJob {
  id: string;
  url: string;
  status: DownloadStatus;
  output: string;
  createdAt: string;
  updatedAt?: string;
  finishedAt?: string;
  exitCode?: number | null;
  error?: string;
  retryOf?: string;
}

export interface Track {
  title: string;
  artist: string;
  fileName: string;
  relativePath: string;
  size: number;
  modifiedAt: string;
}

export interface RuntimeStatus {
  ok: boolean;
  collectorUrl: string;
  navidromeUrl: string;
  musicDir: string;
  audioFormat: string;
  cookies: {
    bilibili: {
      path: string;
      exists: boolean;
    };
  };
  tools: {
    ytdlpPath: string;
    ffmpegPath: string;
    ytdlpExists: boolean;
    ffmpegExists: boolean;
  };
  lan: Array<{
    address: string;
    collectorUrl: string;
    navidromeUrl: string;
  }>;
  requestHost: string;
}
