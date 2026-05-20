import { Pool, type PoolClient, type QueryResultRow } from "pg";
import type { DownloadJob, DownloadStatus, IngestionMatchMethod, IngestionRecord, LibrarySyncState } from "@myusic/shared";
import type { ApiConfig } from "../config";
import { trimJobs } from "../job-store";
import type { AppStateRepository } from "./repository";

export function createPostgresRepository(config: ApiConfig): AppStateRepository {
  if (!config.database.url) {
    throw new Error("DATABASE_URL is required when MYUSIC_STORAGE=postgres.");
  }

  return new PostgresRepository(config.database.url);
}

class PostgresRepository implements AppStateRepository {
  private readonly pool: Pool;
  private migration?: Promise<void>;

  constructor(databaseUrl: string) {
    this.pool = new Pool({ connectionString: databaseUrl });
  }

  async loadJobs(maxJobs: number): Promise<DownloadJob[]> {
    await this.ensureMigrated();
    const result = await this.pool.query(
      `select * from download_jobs order by created_at desc limit $1`,
      [maxJobs]
    );
    const now = new Date().toISOString();
    return result.rows.reverse().map((row) => {
      const job = rowToJob(row);
      if (job.status !== "running") return job;
      return {
        ...job,
        status: "failed",
        error: job.error || "Task was interrupted because the server stopped.",
        finishedAt: now,
        updatedAt: now
      };
    });
  }

  async saveJobs(jobs: DownloadJob[], maxJobs: number): Promise<void> {
    await this.ensureMigrated();
    const trimmed = trimJobs(jobs, maxJobs);
    await this.withTransaction(async (client) => {
      for (const job of trimmed) {
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
            job.output,
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

      await deleteRowsMissingFromState(client, "download_jobs", trimmed.map((job) => job.id));
    });
  }

  async loadIngestions(): Promise<IngestionRecord[]> {
    await this.ensureMigrated();
    const result = await this.pool.query(`select * from ingestions order by coalesce(updated_at, captured_at, created_at) asc`);
    return result.rows.map(rowToIngestion);
  }

  async saveIngestions(ingestions: IngestionRecord[]): Promise<void> {
    await this.ensureMigrated();
    await this.withTransaction(async (client) => {
      for (const ingestion of ingestions) {
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

      await deleteRowsMissingFromState(client, "ingestions", ingestions.map((ingestion) => ingestion.id));
    });
  }

  private ensureMigrated() {
    this.migration ||= this.migrate();
    return this.migration;
  }

  private async migrate() {
    await this.pool.query(`
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

  private async withTransaction(callback: (client: PoolClient) => Promise<void>) {
    const client = await this.pool.connect();
    try {
      await client.query("begin");
      await callback(client);
      await client.query("commit");
    } catch (error) {
      await client.query("rollback");
      throw error;
    } finally {
      client.release();
    }
  }
}

async function deleteRowsMissingFromState(client: PoolClient, tableName: "download_jobs" | "ingestions", ids: string[]) {
  if (!ids.length) {
    await client.query(`delete from ${tableName}`);
    return;
  }

  await client.query(`delete from ${tableName} where not (id = any($1::text[]))`, [ids]);
}

function rowToJob(row: QueryResultRow): DownloadJob {
  return {
    id: stringValue(row.id),
    url: stringValue(row.url),
    status: stringValue(row.status) as DownloadStatus,
    output: stringValue(row.output),
    createdAt: isoValue(row.created_at) || new Date().toISOString(),
    updatedAt: isoValue(row.updated_at),
    finishedAt: isoValue(row.finished_at),
    exitCode: numberValue(row.exit_code),
    error: optionalString(row.error),
    retryOf: optionalString(row.retry_of),
    ingestionId: optionalString(row.ingestion_id),
    ingestion: objectValue<IngestionRecord>(row.ingestion),
    librarySync: objectValue<LibrarySyncState>(row.library_sync)
  };
}

function rowToIngestion(row: QueryResultRow): IngestionRecord {
  return {
    id: stringValue(row.id),
    jobId: optionalString(row.job_id),
    sourceUrl: stringValue(row.source_url),
    sourceSite: optionalString(row.source_site),
    sourceId: optionalString(row.source_id),
    title: optionalString(row.title),
    uploader: optionalString(row.uploader),
    duration: numberValue(row.duration),
    webpageUrl: optionalString(row.webpage_url),
    outputPath: optionalString(row.output_path),
    relativeOutputPath: optionalString(row.relative_output_path),
    infoJsonPath: optionalString(row.info_json_path),
    navidromeSongId: optionalString(row.navidrome_song_id),
    navidromeMatchMethod: optionalString(row.navidrome_match_method) as IngestionMatchMethod | undefined,
    navidromeMatchedAt: isoValue(row.navidrome_matched_at),
    navidromeLastMatchAttemptAt: isoValue(row.navidrome_last_match_attempt_at),
    navidromeMatchError: optionalString(row.navidrome_match_error),
    capturedAt: isoValue(row.captured_at),
    createdAt: isoValue(row.created_at),
    updatedAt: isoValue(row.updated_at)
  };
}

function objectValue<T>(value: unknown): T | undefined {
  if (!value) return undefined;
  if (typeof value === "string") {
    try {
      return JSON.parse(value) as T;
    } catch {
      return undefined;
    }
  }
  return value as T;
}

function stringValue(value: unknown) {
  return typeof value === "string" ? value : String(value || "");
}

function optionalString(value: unknown) {
  return typeof value === "string" && value ? value : undefined;
}

function numberValue(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : undefined;
  }
  return undefined;
}

function isoValue(value: unknown) {
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "string" && value) return new Date(value).toISOString();
  return undefined;
}
