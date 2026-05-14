import fs from "node:fs";
import type { ChildProcessWithoutNullStreams } from "node:child_process";
import Fastify from "fastify";
import type { DownloadJob, IngestionRecord, RuntimeStatus } from "@personal-music/shared";
import type { ApiConfig } from "./config";
import { seedIngestionsFromJobs } from "./ingestion-store";
import { getLanAddresses } from "./network";
import { createRepository } from "./persistence";
import type { AppStateRepository } from "./persistence/repository";
import { registerIngestionRoutes } from "./routes/ingestions";
import { registerJobRoutes } from "./routes/jobs";
import { registerNavidromeRoutes } from "./routes/navidrome";
import { registerSettingsRoutes } from "./routes/settings";
import { registerStaticRoutes } from "./static";
import { findDuplicateIngestion, startDownload, stopRunningJob } from "./services/download-service";
import { rematchIngestion, syncDownloadedJobToNavidrome } from "./services/ingestion-service";

export interface CreateApiServerOptions {
  config: ApiConfig;
  repository?: AppStateRepository;
}

export async function createApiServer(options: CreateApiServerOptions) {
  const { config } = options;
  const repository = options.repository || createRepository(config);
  const jobs: DownloadJob[] = await repository.loadJobs(config.maxJobs);
  const ingestions: IngestionRecord[] = await repository.loadIngestions();
  const runningProcesses = new Map<string, ChildProcessWithoutNullStreams>();
  const jobClients = new Set<(jobs: DownloadJob[]) => void>();
  const app = Fastify({ logger: false });
  const persist = () => persistAndBroadcastState(repository, jobs, ingestions, jobClients, config.maxJobs);
  seedIngestionsFromJobs(ingestions, jobs);
  await persist();

  app.get("/api/health", async (request): Promise<RuntimeStatus> => {
    const navidromeUrl = config.navidrome.baseUrl || "http://127.0.0.1:4533";
    const collectorUrl = `http://127.0.0.1:${config.port}`;
    const bilibiliCookies = config.cookies.bilibili || "";

    return {
      ok: true,
      collectorUrl,
      navidromeUrl,
      musicDir: config.musicDir,
      audioFormat: config.audioFormat,
      cookies: {
        bilibili: {
          path: bilibiliCookies,
          exists: Boolean(bilibiliCookies && fs.existsSync(bilibiliCookies))
        }
      },
      tools: {
        ytdlpPath: config.ytdlpPath,
        ffmpegPath: config.ffmpegPath,
        ytdlpExists: fs.existsSync(config.ytdlpPath),
        ffmpegExists: Boolean(config.ffmpegPath && fs.existsSync(config.ffmpegPath))
      },
      lan: getLanAddresses().map((address) => ({
        address,
        collectorUrl: `http://${address}:${config.port}`,
        navidromeUrl: `http://${address}:4533`
      })),
      requestHost: request.headers.host || ""
    };
  });

  registerSettingsRoutes(app, config);
  registerNavidromeRoutes(app, config);
  registerIngestionRoutes(app, {
    config,
    jobs,
    ingestions,
    persist,
    rematchIngestion
  });
  registerJobRoutes(app, {
    config,
    jobs,
    ingestions,
    runningProcesses,
    jobClients,
    persist,
    onDownloadDone: (job) => {
      void syncDownloadedJobToNavidrome(job, config, ingestions, () => {
        void persist();
      });
    },
    startDownload,
    findDuplicateIngestion,
    stopRunningJob
  });
  registerStaticRoutes(app, config.webDir);

  return app;
}

function persistAndBroadcastState(
  repository: AppStateRepository,
  jobs: DownloadJob[],
  ingestions: IngestionRecord[],
  clients: Set<(jobs: DownloadJob[]) => void>,
  maxJobs: number
) {
  return Promise.all([
    repository.saveJobs(jobs, maxJobs),
    repository.saveIngestions(ingestions)
  ]).then(() => {
    broadcastJobs(jobs, clients);
  });
}

function broadcastJobs(jobs: DownloadJob[], clients: Set<(jobs: DownloadJob[]) => void>) {
  const payload = jobs.slice().reverse();
  for (const client of clients) {
    try {
      client(payload);
    } catch {
      clients.delete(client);
    }
  }
}
