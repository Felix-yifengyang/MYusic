import type { DownloadJob, IngestionRecord } from "@myusic/shared";
import type { ApiConfig } from "../config";
import { upsertIngestion } from "../ingestion-store";
import {
  findNavidromeSongForIngestion,
  getNavidromeScanStatus,
  startNavidromeScan
} from "../navidrome";

export async function syncDownloadedJobToNavidrome(
  job: DownloadJob,
  config: ApiConfig,
  ingestions: IngestionRecord[],
  onChange: () => void
) {
  const requestedAt = new Date().toISOString();
  job.librarySync = {
    status: "pending",
    message: "等待 Navidrome 扫描音乐库。",
    requestedAt
  };
  job.updatedAt = requestedAt;
  onChange();

  const startStatus = await startNavidromeScan(config);
  job.librarySync = {
    status: startStatus.scanning ? "scanning" : "synced",
    message: startStatus.scanning ? "Navidrome 正在扫描音乐库。" : "Navidrome 已接收音乐库扫描。",
    requestedAt,
    finishedAt: startStatus.scanning ? undefined : new Date().toISOString()
  };
  job.updatedAt = new Date().toISOString();
  onChange();

  if (!startStatus.scanning) {
    await linkIngestionToNavidrome(job, config, ingestions, requestedAt, "Navidrome 已完成扫描");
    job.updatedAt = new Date().toISOString();
    onChange();
    return;
  }

  const finalStatus = await waitForNavidromeScan(config);
  if (finalStatus.scanning) {
    job.librarySync = {
      status: "scanning",
      message: "Navidrome 仍在扫描，稍后刷新音乐列表。",
      requestedAt
    };
  } else {
    await linkIngestionToNavidrome(job, config, ingestions, requestedAt, "已同步到 Navidrome 音乐库");
  }
  job.updatedAt = new Date().toISOString();
  onChange();

}

export async function rematchIngestion(
  config: ApiConfig,
  jobs: DownloadJob[],
  ingestions: IngestionRecord[],
  ingestion: IngestionRecord
) {
  const match = await findNavidromeSongForIngestion(config, ingestion);
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
    navidromeMatchError: "未找到匹配的 Navidrome 歌曲。",
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
  baseMessage: string
) {
  if (!job.ingestion) {
    job.librarySync = {
      status: "synced",
      message: `${baseMessage}，但当前任务没有入库记录。`,
      requestedAt,
      finishedAt: new Date().toISOString()
    };
    return;
  }

  const match = await findNavidromeSongForIngestion(config, job.ingestion);
  if (!match) {
    job.librarySync = {
      status: "synced",
      message: `${baseMessage}，但未自动匹配 Navidrome song id。`,
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
    message: `${baseMessage}，已关联 Navidrome song id：${match.song.id}`,
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

async function waitForNavidromeScan(config: ApiConfig) {
  for (let attempt = 0; attempt < 12; attempt += 1) {
    await delay(1500);
    const status = await getNavidromeScanStatus(config);
    if (!status.scanning) return status;
  }

  return getNavidromeScanStatus(config);
}

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
