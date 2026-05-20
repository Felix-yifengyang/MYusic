import fs from "node:fs";
import path from "node:path";
import { Pool, type PoolClient } from "pg";
import type { DownloadJob, IngestionRecord } from "@myusic/shared";

interface MigrationResult {
  jobsRead: number;
  jobsWritten: number;
  ingestionsRead: number;
  ingestionsWritten: number;
  jobsPath: string;
  ingestionsPath: string;
}

async function main() {
  loadDotEnv(resolveRootDir());

  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error("DATABASE_URL is required. Put it in .env or set it before running the migration.");
  }

  const dataRoot = process.env.MYUSIC_DATA_DIR || path.resolve(resolveRootDir(), "..", "MYusic-data");
  const jobsPath = process.env.MYUSIC_JOBS_JSON || path.join(dataRoot, "collector", "jobs.json");
  const ingestionsPath = process.env.MYUSIC_INGESTIONS_JSON || path.join(dataRoot, "collector", "ingestions.json");

  const jobs = readJsonArray<DownloadJob>(jobsPath);
  const ingestions = readJsonArray<IngestionRecord>(ingestionsPath);
  const pool = new Pool({ connectionString: databaseUrl });

  try {
    await ensureSchema(pool);
    const result = await migrateState(pool, jobs, ingestions, jobsPath, ingestionsPath);
    console.log(JSON.stringify(result, null, 2));
  } finally {
    await pool.end();
  }
}

async function migrateState(
  pool: Pool,
  jobs: DownloadJob[],
  ingestions: IngestionRecord[],
  jobsPath: string,
  ingestionsPath: string
): Promise<MigrationResult> {
  const client = await pool.connect();
  let jobsWritten = 0;
  let ingestionsWritten = 0;

  try {
    await client.query("begin");

    for (const job of jobs) {
      if (!isValidJob(job)) continue;
      await upsertJob(client, job);
      jobsWritten += 1;
    }

    for (const ingestion of ingestions) {
      if (!isValidIngestion(ingestion)) continue;
      await upsertIngestion(client, ingestion);
      ingestionsWritten += 1;
    }

    await client.query("commit");
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }

  return {
    jobsRead: jobs.length,
    jobsWritten,
    ingestionsRead: ingestions.length,
    ingestionsWritten,
    jobsPath,
    ingestionsPath
  };
}

async function ensureSchema(pool: Pool) {
  await pool.query(`
    create table if not exists download_jobs (
      id text primary key,
      url text not null,
      status text not null,
      output text not null default '',
      error text,
      exit_code integer,
      retry_of text,
      ingestion_id text,
      ingestion jsonb,
      library_sync jsonb,
      created_at timestamptz not null,
      updated_at timestamptz,
      finished_at timestamptz
    );

    create table if not exists ingestions (
      id text primary key,
      job_id text,
      source_url text not null,
      source_site text,
      source_id text,
      title text,
      uploader text,
      duration numeric,
      webpage_url text,
      output_path text,
      relative_output_path text,
      info_json_path text,
      navidrome_song_id text,
      navidrome_match_method text,
      navidrome_matched_at timestamptz,
      navidrome_last_match_attempt_at timestamptz,
      navidrome_match_error text,
      captured_at timestamptz,
      created_at timestamptz,
      updated_at timestamptz
    );

    create index if not exists download_jobs_created_at_idx on download_jobs (created_at);
    create index if not exists ingestions_source_identity_idx on ingestions (source_site, source_id);
    create index if not exists ingestions_webpage_url_idx on ingestions (webpage_url);
    create index if not exists ingestions_navidrome_song_id_idx on ingestions (navidrome_song_id);
  `);
}

async function upsertJob(client: PoolClient, job: DownloadJob) {
  await client.query(
    `insert into download_jobs (
      id, url, status, output, error, exit_code, retry_of, ingestion_id, ingestion,
      library_sync, created_at, updated_at, finished_at
    ) values (
      $1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb, $10::jsonb, $11, $12, $13
    )
    on conflict (id) do update set
      url = excluded.url,
      status = excluded.status,
      output = excluded.output,
      error = excluded.error,
      exit_code = excluded.exit_code,
      retry_of = excluded.retry_of,
      ingestion_id = excluded.ingestion_id,
      ingestion = excluded.ingestion,
      library_sync = excluded.library_sync,
      created_at = excluded.created_at,
      updated_at = excluded.updated_at,
      finished_at = excluded.finished_at`,
    [
      job.id,
      job.url,
      job.status,
      job.output || "",
      job.error || null,
      job.exitCode ?? null,
      job.retryOf || null,
      job.ingestionId || job.ingestion?.id || null,
      job.ingestion ? JSON.stringify(job.ingestion) : null,
      job.librarySync ? JSON.stringify(job.librarySync) : null,
      job.createdAt,
      job.updatedAt || null,
      job.finishedAt || null
    ]
  );
}

async function upsertIngestion(client: PoolClient, ingestion: IngestionRecord) {
  await client.query(
    `insert into ingestions (
      id, job_id, source_url, source_site, source_id, title, uploader, duration,
      webpage_url, output_path, relative_output_path, info_json_path,
      navidrome_song_id, navidrome_match_method, navidrome_matched_at,
      navidrome_last_match_attempt_at, navidrome_match_error,
      captured_at, created_at, updated_at
    ) values (
      $1, $2, $3, $4, $5, $6, $7, $8,
      $9, $10, $11, $12,
      $13, $14, $15,
      $16, $17,
      $18, $19, $20
    )
    on conflict (id) do update set
      job_id = excluded.job_id,
      source_url = excluded.source_url,
      source_site = excluded.source_site,
      source_id = excluded.source_id,
      title = excluded.title,
      uploader = excluded.uploader,
      duration = excluded.duration,
      webpage_url = excluded.webpage_url,
      output_path = excluded.output_path,
      relative_output_path = excluded.relative_output_path,
      info_json_path = excluded.info_json_path,
      navidrome_song_id = excluded.navidrome_song_id,
      navidrome_match_method = excluded.navidrome_match_method,
      navidrome_matched_at = excluded.navidrome_matched_at,
      navidrome_last_match_attempt_at = excluded.navidrome_last_match_attempt_at,
      navidrome_match_error = excluded.navidrome_match_error,
      captured_at = excluded.captured_at,
      created_at = excluded.created_at,
      updated_at = excluded.updated_at`,
    [
      ingestion.id,
      ingestion.jobId || null,
      ingestion.sourceUrl,
      ingestion.sourceSite || null,
      ingestion.sourceId || null,
      ingestion.title || null,
      ingestion.uploader || null,
      ingestion.duration ?? null,
      ingestion.webpageUrl || null,
      ingestion.outputPath || null,
      ingestion.relativeOutputPath || null,
      ingestion.infoJsonPath || null,
      ingestion.navidromeSongId || null,
      ingestion.navidromeMatchMethod || null,
      ingestion.navidromeMatchedAt || null,
      ingestion.navidromeLastMatchAttemptAt || null,
      ingestion.navidromeMatchError || null,
      ingestion.capturedAt || null,
      ingestion.createdAt || null,
      ingestion.updatedAt || null
    ]
  );
}

function readJsonArray<T>(filePath: string): T[] {
  if (!fs.existsSync(filePath)) return [];
  const raw = fs.readFileSync(filePath, "utf8").replace(/^\uFEFF/, "");
  const parsed = JSON.parse(raw || "[]") as unknown;
  return Array.isArray(parsed) ? parsed as T[] : [];
}

function isValidJob(job: DownloadJob) {
  return Boolean(job.id && job.url && job.status && job.createdAt);
}

function isValidIngestion(ingestion: IngestionRecord) {
  return Boolean(ingestion.id && ingestion.sourceUrl);
}

function resolveRootDir() {
  return path.resolve(__dirname, "..", "..", "..", "..");
}

function loadDotEnv(rootDir: string) {
  const envPath = path.join(rootDir, ".env");
  if (!fs.existsSync(envPath)) return;

  const content = fs.readFileSync(envPath, "utf8").replace(/^\uFEFF/, "");
  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;

    const separator = trimmed.indexOf("=");
    if (separator === -1) continue;

    const key = trimmed.slice(0, separator).trim();
    const value = trimmed.slice(separator + 1).trim();
    if (key && process.env[key] === undefined) {
      process.env[key] = value;
    }
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
