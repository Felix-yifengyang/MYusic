import fs from "node:fs";
import path from "node:path";
import type { IngestionRecord } from "@myusic/shared";

export function loadIngestions(ingestionStorePath: string): IngestionRecord[] {
  if (!fs.existsSync(ingestionStorePath)) {
    return [];
  }

  const raw = fs.readFileSync(ingestionStorePath, "utf8").replace(/^\uFEFF/, "");
  const parsed = JSON.parse(raw) as IngestionRecord[];
  return Array.isArray(parsed) ? parsed : [];
}

export function saveIngestions(ingestionStorePath: string, ingestions: IngestionRecord[]) {
  fs.mkdirSync(path.dirname(ingestionStorePath), { recursive: true });
  const tempPath = `${ingestionStorePath}.tmp`;
  fs.writeFileSync(tempPath, JSON.stringify(ingestions, null, 2) + "\n", "utf8");
  fs.renameSync(tempPath, ingestionStorePath);
}

export function upsertIngestion(ingestions: IngestionRecord[], record: IngestionRecord) {
  const index = ingestions.findIndex((item) => item.id === record.id);
  if (index === -1) {
    ingestions.push(record);
    return record;
  }

  ingestions[index] = {
    ...ingestions[index],
    ...record,
    updatedAt: record.updatedAt || new Date().toISOString()
  };
  return ingestions[index];
}

export function seedIngestionsFromJobs(ingestions: IngestionRecord[], jobs: Array<{ id: string; userId?: string; ingestion?: IngestionRecord }>) {
  for (const job of jobs) {
    if (!job.ingestion) continue;
    upsertIngestion(ingestions, {
      ...job.ingestion,
      userId: job.ingestion.userId || job.userId,
      id: job.ingestion.id || buildLegacyIngestionId(job.ingestion),
      jobId: job.ingestion.jobId || job.id,
      createdAt: job.ingestion.createdAt || job.ingestion.capturedAt || job.ingestion.navidromeMatchedAt,
      updatedAt: job.ingestion.updatedAt || job.ingestion.navidromeMatchedAt || job.ingestion.capturedAt
    });
  }
}

function buildLegacyIngestionId(record: IngestionRecord) {
  return record.sourceId
    ? `${record.sourceSite || "source"}:${record.sourceId}`
    : `file:${record.relativeOutputPath || record.outputPath || record.sourceUrl}`;
}
