import type { DownloadJob, IngestionRecord } from "@personal-music/shared";

export interface AppStateRepository {
  loadJobs(maxJobs: number): Promise<DownloadJob[]>;
  saveJobs(jobs: DownloadJob[], maxJobs: number): Promise<void>;
  loadIngestions(): Promise<IngestionRecord[]>;
  saveIngestions(ingestions: IngestionRecord[]): Promise<void>;
}
