import type { DownloadJob, IngestionRecord, Playlist } from "@myusic/shared";

export interface AppStateRepository {
  loadJobs(maxJobs: number): Promise<DownloadJob[]>;
  saveJobs(jobs: DownloadJob[], maxJobs: number): Promise<void>;
  loadIngestions(): Promise<IngestionRecord[]>;
  saveIngestions(ingestions: IngestionRecord[]): Promise<void>;
  loadPlaylists(): Promise<Playlist[]>;
  savePlaylists(playlists: Playlist[]): Promise<void>;
}
