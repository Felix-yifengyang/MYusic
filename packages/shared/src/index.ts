export type DownloadStatus = "running" | "done" | "failed" | "canceled";
export type LibrarySyncStatus = "pending" | "scanning" | "synced" | "failed";

export interface LibrarySyncState {
  status: LibrarySyncStatus;
  message?: string;
  requestedAt?: string;
  finishedAt?: string;
}

export interface IngestionRecord {
  sourceUrl: string;
  sourceSite?: string;
  sourceId?: string;
  title?: string;
  uploader?: string;
  duration?: number;
  webpageUrl?: string;
  outputPath?: string;
  relativeOutputPath?: string;
  infoJsonPath?: string;
  capturedAt?: string;
}

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
  ingestion?: IngestionRecord;
  librarySync?: LibrarySyncState;
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

export interface AppSettings {
  musicDir: string;
  ytdlpPath: string;
  ffmpegPath: string;
  audioFormat: string;
  audioQuality: string;
  bilibiliCookiesPath: string;
  navidromeBaseUrl: string;
  navidromeUsername: string;
  navidromePassword: string;
  maxJobs: number;
}

export interface SettingsSaveResult {
  settings: AppSettings;
  restartRequired: boolean;
  restartReasons: string[];
}

export type DiagnosticLevel = "ok" | "warning" | "error";

export interface DiagnosticCheck {
  id: string;
  label: string;
  level: DiagnosticLevel;
  message: string;
  suggestion?: string;
}

export interface DiagnosticsReport {
  ok: boolean;
  checks: DiagnosticCheck[];
}

export interface NavidromeSong {
  id: string;
  title: string;
  artist?: string;
  album?: string;
  duration?: number;
  coverArt?: string;
  suffix?: string;
  size?: number;
  contentType?: string;
}

export interface NavidromeSongsResult {
  songs: NavidromeSong[];
}

export interface NavidromeScanStatus {
  scanning: boolean;
  count?: number;
}
