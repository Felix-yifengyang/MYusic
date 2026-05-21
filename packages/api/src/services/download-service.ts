import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";
import type { ChildProcessWithoutNullStreams } from "node:child_process";
import type { DownloadJob, IngestionRecord } from "@myusic/shared";
import { createAudioDownloadArgs, createMetadataArgs, decodeProcessOutput } from "@myusic/downloader";
import type { ApiConfig } from "../config";
import { upsertIngestion } from "../ingestion-store";
import { trimJobs } from "../job-store";

export interface StartDownloadOptions {
  onChange: () => void;
  onDone: (job: DownloadJob) => void;
  retryOf?: string;
}

export function startDownload(
  url: string,
  config: ApiConfig,
  jobs: DownloadJob[],
  ingestions: IngestionRecord[],
  runningProcesses: Map<string, ChildProcessWithoutNullStreams>,
  options: StartDownloadOptions
): DownloadJob {
  fs.mkdirSync(config.musicDir, { recursive: true });

  const job: DownloadJob = {
    id: crypto.randomUUID(),
    url,
    status: "running",
    output: "",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    retryOf: options.retryOf
  };

  jobs.push(job);
  jobs.splice(0, jobs.length, ...trimJobs(jobs, config.maxJobs));

  const { args, notes } = createAudioDownloadArgs(url, {
    musicDir: config.musicDir,
    audioFormat: config.audioFormat,
    audioQuality: config.audioQuality,
    ffmpegPath: config.ffmpegPath,
    cookies: config.cookies
  });

  if (notes.length) {
    job.output += `${notes.join("\n")}\n`;
  }

  const child = spawn(config.ytdlpPath, args, {
    windowsHide: true,
    shell: false
  });
  runningProcesses.set(job.id, child);

  child.stdout.on("data", (data: Buffer) => {
    appendOutput(job, data);
    job.updatedAt = new Date().toISOString();
    options.onChange();
  });
  child.stderr.on("data", (data: Buffer) => {
    appendOutput(job, data);
    job.updatedAt = new Date().toISOString();
    options.onChange();
  });
  child.on("error", (error) => {
    job.status = "failed";
    job.error = error.message;
    job.finishedAt = new Date().toISOString();
    job.updatedAt = new Date().toISOString();
    runningProcesses.delete(job.id);
    options.onChange();
  });
  child.on("close", (code) => {
    runningProcesses.delete(job.id);
    if (job.status === "running") {
      job.status = code === 0 ? "done" : "failed";
      if (job.status === "failed" && !job.error) {
        job.error = `yt-dlp exited with code ${code}`;
      }
    }
    job.exitCode = code;
    job.finishedAt = new Date().toISOString();
    if (job.status === "done") {
      const ingestion = upsertIngestion(ingestions, buildIngestionRecord(job, config));
      job.ingestionId = ingestion.id;
      job.ingestion = ingestion;
    }
    job.updatedAt = new Date().toISOString();
    options.onChange();

    if (job.status === "done") {
      options.onDone(job);
    }
  });

  return job;
}

export async function findDuplicateIngestion(config: ApiConfig, ingestions: IngestionRecord[], url: string) {
  const metadata = await fetchSourceMetadata(config, url);
  const sourceSite = stringField(metadata.extractor_key) || stringField(metadata.extractor);
  const sourceId = stringField(metadata.id);

  if (sourceId) {
    const sourceMatch = ingestions.find((ingestion) => (
      ingestion.sourceId === sourceId &&
      (!sourceSite || !ingestion.sourceSite || ingestion.sourceSite === sourceSite)
    ));
    if (sourceMatch) return sourceMatch;
  }

  const webpageUrl = stringField(metadata.webpage_url) || stringField(metadata.original_url);
  return ingestions.find((ingestion) => (
    ingestion.sourceUrl === url ||
    (Boolean(webpageUrl) && (ingestion.webpageUrl === webpageUrl || ingestion.sourceUrl === webpageUrl))
  ));
}

export function stopRunningJob(job: DownloadJob, runningProcesses: Map<string, ChildProcessWithoutNullStreams>) {
  if (job.status !== "running") return;

  job.status = "canceled";
  job.error = "Stopped before deleting the task.";
  job.finishedAt = new Date().toISOString();
  job.updatedAt = new Date().toISOString();
  const child = runningProcesses.get(job.id);
  runningProcesses.delete(job.id);
  child?.kill();
}

function buildIngestionRecord(job: DownloadJob, config: ApiConfig): IngestionRecord {
  const outputPath = normalizeMarkerPath(readMarker(job.output, "__MYUSIC_FILE__"));
  const infoJsonPath = normalizeMarkerPath(readMarker(job.output, "__MYUSIC_INFO__"));
  const metadata = readInfoJson(infoJsonPath);
  const resolvedOutputPath = outputPath ? path.resolve(outputPath) : undefined;
  const resolvedInfoJsonPath = infoJsonPath ? path.resolve(infoJsonPath) : undefined;

  const sourceSite = stringField(metadata.extractor_key) || stringField(metadata.extractor);
  const sourceId = stringField(metadata.id);
  const title = stringField(metadata.title);
  const capturedAt = new Date().toISOString();

  return {
    id: buildIngestionId(job, {
      sourceSite,
      sourceId,
      relativeOutputPath: resolvedOutputPath ? relativeToMusicDir(config.musicDir, resolvedOutputPath) : undefined,
      outputPath: resolvedOutputPath
    }),
    jobId: job.id,
    sourceUrl: job.url,
    sourceSite,
    sourceId,
    title,
    uploader: stringField(metadata.uploader) || stringField(metadata.creator) || stringField(metadata.artist),
    duration: numberField(metadata.duration),
    webpageUrl: stringField(metadata.webpage_url) || stringField(metadata.original_url),
    outputPath: resolvedOutputPath,
    relativeOutputPath: resolvedOutputPath ? relativeToMusicDir(config.musicDir, resolvedOutputPath) : undefined,
    infoJsonPath: resolvedInfoJsonPath,
    capturedAt,
    createdAt: capturedAt,
    updatedAt: capturedAt
  };
}

async function fetchSourceMetadata(config: ApiConfig, url: string): Promise<Record<string, unknown>> {
  const { args } = createMetadataArgs(url, { cookies: config.cookies });
  const child = spawn(config.ytdlpPath, args, {
    windowsHide: true,
    shell: false
  });

  const stdout: Buffer[] = [];
  const stderr: Buffer[] = [];

  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      child.kill();
      reject(new Error("yt-dlp metadata check timed out."));
    }, 30000);

    child.stdout.on("data", (data: Buffer) => stdout.push(data));
    child.stderr.on("data", (data: Buffer) => stderr.push(data));
    child.on("error", (error) => {
      clearTimeout(timeout);
      reject(error);
    });
    child.on("close", (code) => {
      clearTimeout(timeout);
      const output = decodeProcessOutput(Buffer.concat(stdout)).trim();
      if (code !== 0) {
        const errorOutput = decodeProcessOutput(Buffer.concat(stderr)).trim();
        reject(new Error(errorOutput || `yt-dlp metadata exited with code ${code}`));
        return;
      }

      resolve(Promise.resolve().then(() => JSON.parse(output) as Record<string, unknown>));
    });
  });
}

function buildIngestionId(
  job: DownloadJob,
  input: { sourceSite?: string; sourceId?: string; relativeOutputPath?: string; outputPath?: string }
) {
  if (input.sourceId) {
    return `${input.sourceSite || "source"}:${input.sourceId}`;
  }

  if (input.relativeOutputPath || input.outputPath) {
    return `file:${input.relativeOutputPath || input.outputPath}`;
  }

  return `job:${job.id}`;
}

function readMarker(output: string, marker: string) {
  const match = new RegExp(`^${escapeRegExp(marker)}:(.+)$`, "m").exec(output);
  if (!match) return "";

  const raw = match[1].trim();
  const parsed = JSON.parse(raw) as unknown;
  return typeof parsed === "string" ? parsed : "";
}

function normalizeMarkerPath(value: string) {
  const normalized = value.trim();
  if (!normalized || normalized === "NA" || normalized === "null") return "";
  return normalized;
}

function readInfoJson(infoJsonPath: string): Record<string, unknown> {
  if (!infoJsonPath || !fs.existsSync(infoJsonPath)) return {};
  return JSON.parse(fs.readFileSync(infoJsonPath, "utf8")) as Record<string, unknown>;
}

function stringField(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function numberField(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function relativeToMusicDir(musicDir: string, filePath: string) {
  const root = path.resolve(musicDir);
  const candidate = path.resolve(filePath);
  const relative = path.relative(root, candidate);
  if (relative.startsWith("..") || path.isAbsolute(relative)) return undefined;
  return relative;
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function appendOutput(job: DownloadJob, value: Buffer) {
  job.output += decodeProcessOutput(value);
  if (job.output.length > 30000) {
    job.output = job.output.slice(-30000);
  }
}
