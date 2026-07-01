import type { DownloadJob, IngestionRecord } from "@myusic/shared";
import type { ApiConfig } from "../config";
import { upsertIngestion } from "../ingestion-store";
import {
  type NavidromeContext,
  findNavidromeSongForIngestion,
  getNavidromeScanStatus,
  startNavidromeScan
} from "../navidrome";

export async function syncDownloadedJobToNavidrome(
  job: DownloadJob,
  config: ApiConfig,
  ingestions: IngestionRecord[],
  onChange: () => void,
  context?: NavidromeContext
) {
  const requestedAt = new Date().toISOString();
  job.librarySync = {
    status: "pending",
    message: "Waiting for Navidrome to scan this user's library.",
    requestedAt
  };
  job.updatedAt = requestedAt;
  onChange();

  const startStatus = await startNavidromeScan(config, context);
  job.librarySync = {
    status: startStatus.scanning ? "scanning" : "synced",
    message: startStatus.scanning ? "Navidrome is scanning this user's library." : "Navidrome accepted the library scan.",
    requestedAt,
    finishedAt: startStatus.scanning ? undefined : new Date().toISOString()
  };
  job.updatedAt = new Date().toISOString();
  onChange();

  if (!startStatus.scanning) {
    await linkIngestionToNavidrome(job, config, ingestions, requestedAt, "Navidrome scan completed.", context);
    job.updatedAt = new Date().toISOString();
    onChange();
    return;
  }

  const finalStatus = await waitForNavidromeScan(config, context);
  if (finalStatus.scanning) {
    job.librarySync = {
      status: "scanning",
      message: "Navidrome is still scanning; refresh this user's song list later.",
      requestedAt
    };
  } else {
    await linkIngestionToNavidrome(job, config, ingestions, requestedAt, "Synced to Navidrome.", context);
  }
  job.updatedAt = new Date().toISOString();
  onChange();
}

export async function rematchIngestion(
  config: ApiConfig,
  jobs: DownloadJob[],
  ingestions: IngestionRecord[],
  ingestion: IngestionRecord,
  context?: NavidromeContext
) {
  const match = await findNavidromeSongForIngestion(config, ingestion, context);
  const now = new Date().toISOString();
  const updated = upsertIngestion(ingestions, match ? {
    ...ingestion,
    navidromeSongId: match.song.id,
    navidromeMatchMethod: match.method,
    navidromeMatchedAt: now,
    navidromeLastMatchAttemptAt: now,
    navidromeMatchError: undefined,
    updatedAt: now
  } : {
    ...ingestion,
    navidromeLastMatchAttemptAt: now,
    navidromeMatchError: "No matching Navidrome song was found.",
    updatedAt: now
  });

  updateJobIngestionSnapshots(jobs, updated);
  return {
    matched: Boolean(match),
    ingestion: updated
  };
}

async function linkIngestionToNavidrome(
  job: DownloadJob,
  config: ApiConfig,
  ingestions: IngestionRecord[],
  requestedAt: string,
  baseMessage: string,
  context?: NavidromeContext
) {
  if (!job.ingestion) {
    job.librarySync = {
      status: "synced",
      message: `${baseMessage} No ingestion record is attached to this job.`,
      requestedAt,
      finishedAt: new Date().toISOString()
    };
    return;
  }

  const match = await findNavidromeSongForIngestion(config, job.ingestion, context);
  if (!match) {
    job.librarySync = {
      status: "synced",
      message: `${baseMessage} No Navidrome song id was matched automatically.`,
      requestedAt,
      finishedAt: new Date().toISOString()
    };
    return;
  }

  const updatedIngestion = upsertIngestion(ingestions, {
    ...job.ingestion,
    navidromeSongId: match.song.id,
    navidromeMatchMethod: match.method,
    navidromeMatchedAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  });
  job.ingestionId = updatedIngestion.id;
  job.ingestion = updatedIngestion;
  job.librarySync = {
    status: "synced",
    message: `${baseMessage} Linked Navidrome song id: ${match.song.id}`,
    requestedAt,
    finishedAt: new Date().toISOString()
  };
}

function updateJobIngestionSnapshots(jobs: DownloadJob[], ingestion: IngestionRecord) {
  for (const job of jobs) {
    if (job.ingestionId === ingestion.id || job.ingestion?.id === ingestion.id) {
      job.ingestionId = ingestion.id;
      job.ingestion = ingestion;
      job.updatedAt = new Date().toISOString();
    }
  }
}

async function waitForNavidromeScan(config: ApiConfig, context?: NavidromeContext) {
  for (let attempt = 0; attempt < 12; attempt += 1) {
    await delay(1500);
    const status = await getNavidromeScanStatus(config, context);
    if (!status.scanning) return status;
  }

  return getNavidromeScanStatus(config, context);
}

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
