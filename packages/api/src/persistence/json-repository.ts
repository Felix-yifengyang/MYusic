import type { DownloadJob, IngestionRecord, Playlist } from "@myusic/shared";
import type { ApiConfig } from "../config";
import { loadIngestions, saveIngestions } from "../ingestion-store";
import { loadJobs, saveJobs } from "../job-store";
import { loadPlaylists, savePlaylists } from "../playlist-store";
import type { AppStateRepository } from "./repository";

export function createJsonRepository(config: ApiConfig): AppStateRepository {
  return {
    async loadJobs(maxJobs: number): Promise<DownloadJob[]> {
      return loadJobs(config.jobStorePath, maxJobs);
    },

    async saveJobs(jobs: DownloadJob[], maxJobs: number) {
      saveJobs(config.jobStorePath, jobs, maxJobs);
    },

    async loadIngestions(): Promise<IngestionRecord[]> {
      return loadIngestions(config.ingestionStorePath);
    },

    async saveIngestions(ingestions: IngestionRecord[]) {
      saveIngestions(config.ingestionStorePath, ingestions);
    },

    async loadPlaylists(): Promise<Playlist[]> {
      return loadPlaylists(config.playlistStorePath);
    },

    async savePlaylists(playlists: Playlist[]) {
      savePlaylists(config.playlistStorePath, playlists);
    }
  };
}
