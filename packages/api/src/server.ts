import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";
import type { ChildProcessWithoutNullStreams } from "node:child_process";
import Fastify from "fastify";
import type { AppSettings, DownloadJob, IngestionRecord, RuntimeStatus } from "@personal-music/shared";
import { createAudioDownloadArgs, decodeProcessOutput } from "@personal-music/downloader";
import type { ApiConfig } from "./config";
import { getBlockingDownloadChecks, getDiagnostics } from "./diagnostics";
import { loadJobs, saveJobs, trimJobs } from "./job-store";
import { getLanAddresses } from "./network";
import {
  getNavidromeScanStatus,
  getNavidromeSongs,
  pingNavidrome,
  proxyNavidromeCover,
  proxyNavidromeStream,
  startNavidromeScan
} from "./navidrome";
import { getSettings, updateSettings } from "./settings";
import { registerStaticRoutes } from "./static";

export interface CreateApiServerOptions {
  config: ApiConfig;
}

export function createApiServer(options: CreateApiServerOptions) {
  const { config } = options;
  const jobs: DownloadJob[] = loadJobs(config.jobStorePath, config.maxJobs);
  const runningProcesses = new Map<string, ChildProcessWithoutNullStreams>();
  const jobClients = new Set<(jobs: DownloadJob[]) => void>();
  const app = Fastify({ logger: false });
  persistAndBroadcastJobs(config, jobs, jobClients);

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

  app.get("/api/settings", async () => getSettings(config));

  app.patch<{ Body: Partial<AppSettings> }>("/api/settings", async (request) => updateSettings(config, request.body || {}));

  app.get("/api/diagnostics", async () => getDiagnostics(config));

  app.get("/api/navidrome/ping", async () => pingNavidrome(config));

  app.get<{ Querystring: { q?: string } }>("/api/navidrome/songs", async (request) => {
    return getNavidromeSongs(config, request.query.q || "");
  });

  app.get<{ Params: { id: string } }>("/api/navidrome/stream/:id", async (request, reply) => {
    await proxyNavidromeStream(config, request, reply);
  });

  app.get<{ Params: { id: string } }>("/api/navidrome/cover/:id", async (request, reply) => {
    await proxyNavidromeCover(config, request, reply);
  });

  app.get("/api/jobs", async () => jobs.slice().reverse());

  app.get("/api/jobs/events", async (_request, reply) => {
    reply.hijack();
    reply.raw.writeHead(200, {
      "content-type": "text/event-stream; charset=utf-8",
      "cache-control": "no-cache, no-transform",
      connection: "keep-alive",
      "x-accel-buffering": "no"
    });
    reply.raw.write(`event: jobs\ndata: ${JSON.stringify(jobs.slice().reverse())}\n\n`);

    const send = (nextJobs: DownloadJob[]) => {
      reply.raw.write(`event: jobs\ndata: ${JSON.stringify(nextJobs)}\n\n`);
    };
    jobClients.add(send);

    const heartbeat = setInterval(() => {
      reply.raw.write(": ping\n\n");
    }, 30000);

    _request.raw.on("close", () => {
      clearInterval(heartbeat);
      jobClients.delete(send);
    });
  });

  app.post<{ Body: { url?: string } }>("/api/download", async (request, reply) => {
    const mediaUrl = String(request.body?.url || "").trim();

    if (!/^https?:\/\//i.test(mediaUrl)) {
      reply.code(400);
      return { error: "Please provide a valid http(s) URL." };
    }

    const blockingChecks = getBlockingDownloadChecks(config);
    if (blockingChecks.length) {
      reply.code(409);
      return {
        error: blockingChecks.map((check) => `${check.label}: ${check.message}`).join("; "),
        checks: blockingChecks
      };
    }

    const job = startDownload(mediaUrl, config, jobs, runningProcesses, () => persistAndBroadcastJobs(config, jobs, jobClients));
    reply.code(202);
    persistAndBroadcastJobs(config, jobs, jobClients);
    return job;
  });

  app.post<{ Params: { id: string } }>("/api/jobs/:id/cancel", async (request, reply) => {
    const job = jobs.find((item) => item.id === request.params.id);
    if (!job) {
      reply.code(404);
      return { error: "Job not found." };
    }

    if (job.status !== "running") {
      reply.code(409);
      return { error: "Only running jobs can be canceled." };
    }

    const child = runningProcesses.get(job.id);
    job.status = "canceled";
    job.error = "Canceled by user.";
    job.finishedAt = new Date().toISOString();
    job.updatedAt = new Date().toISOString();
    child?.kill();
    persistAndBroadcastJobs(config, jobs, jobClients);
    return job;
  });

  app.post<{ Params: { id: string } }>("/api/jobs/:id/retry", async (request, reply) => {
    const job = jobs.find((item) => item.id === request.params.id);
    if (!job) {
      reply.code(404);
      return { error: "Job not found." };
    }

    const nextJob = startDownload(
      job.url,
      config,
      jobs,
      runningProcesses,
      () => persistAndBroadcastJobs(config, jobs, jobClients),
      job.id
    );
    reply.code(202);
    persistAndBroadcastJobs(config, jobs, jobClients);
    return nextJob;
  });

  app.delete("/api/jobs", async () => {
    for (let index = jobs.length - 1; index >= 0; index -= 1) {
      if (jobs[index].status !== "running") {
        jobs.splice(index, 1);
      }
    }
    persistAndBroadcastJobs(config, jobs, jobClients);
    return jobs.slice().reverse();
  });

  registerStaticRoutes(app, config.webDir);

  return app;
}

function startDownload(
  url: string,
  config: ApiConfig,
  jobs: DownloadJob[],
  runningProcesses: Map<string, ChildProcessWithoutNullStreams>,
  onChange: () => void,
  retryOf?: string
): DownloadJob {
  fs.mkdirSync(config.musicDir, { recursive: true });

  const job: DownloadJob = {
    id: crypto.randomUUID(),
    url,
    status: "running",
    output: "",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    retryOf
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
    onChange();
  });
  child.stderr.on("data", (data: Buffer) => {
    appendOutput(job, data);
    job.updatedAt = new Date().toISOString();
    onChange();
  });
  child.on("error", (error) => {
    job.status = "failed";
    job.error = error.message;
    job.finishedAt = new Date().toISOString();
    job.updatedAt = new Date().toISOString();
    runningProcesses.delete(job.id);
    onChange();
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
      job.ingestion = buildIngestionRecord(job, config);
    }
    job.updatedAt = new Date().toISOString();
    onChange();

    if (job.status === "done") {
      void syncDownloadedJobToNavidrome(job, config, onChange);
    }
  });

  return job;
}

function buildIngestionRecord(job: DownloadJob, config: ApiConfig): IngestionRecord {
  const outputPath = normalizeMarkerPath(readMarker(job.output, "__PERSONAL_MUSIC_FILE__"));
  const infoJsonPath = normalizeMarkerPath(readMarker(job.output, "__PERSONAL_MUSIC_INFO__"));
  const metadata = readInfoJson(infoJsonPath);
  const resolvedOutputPath = outputPath ? path.resolve(outputPath) : undefined;
  const resolvedInfoJsonPath = infoJsonPath ? path.resolve(infoJsonPath) : undefined;

  return {
    sourceUrl: job.url,
    sourceSite: stringField(metadata.extractor_key) || stringField(metadata.extractor),
    sourceId: stringField(metadata.id),
    title: stringField(metadata.title),
    uploader: stringField(metadata.uploader) || stringField(metadata.creator) || stringField(metadata.artist),
    duration: numberField(metadata.duration),
    webpageUrl: stringField(metadata.webpage_url) || stringField(metadata.original_url),
    outputPath: resolvedOutputPath,
    relativeOutputPath: resolvedOutputPath ? relativeToMusicDir(config.musicDir, resolvedOutputPath) : undefined,
    infoJsonPath: resolvedInfoJsonPath,
    capturedAt: new Date().toISOString()
  };
}

function readMarker(output: string, marker: string) {
  const pattern = new RegExp(`^${escapeRegExp(marker)}:(.+)$`, "m");
  const match = pattern.exec(output);
  if (!match) return "";

  const raw = match[1].trim();
  try {
    const parsed = JSON.parse(raw) as unknown;
    return typeof parsed === "string" ? parsed : "";
  } catch {
    return raw;
  }
}

function normalizeMarkerPath(value: string) {
  const normalized = value.trim();
  if (!normalized || normalized === "NA" || normalized === "null") return "";
  return normalized;
}

function readInfoJson(infoJsonPath: string): Record<string, unknown> {
  if (!infoJsonPath || !fs.existsSync(infoJsonPath)) return {};

  try {
    return JSON.parse(fs.readFileSync(infoJsonPath, "utf8")) as Record<string, unknown>;
  } catch {
    return {};
  }
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

async function syncDownloadedJobToNavidrome(job: DownloadJob, config: ApiConfig, onChange: () => void) {
  const requestedAt = new Date().toISOString();
  job.librarySync = {
    status: "pending",
    message: "等待 Navidrome 扫描音乐库。",
    requestedAt
  };
  job.updatedAt = requestedAt;
  onChange();

  try {
    const startStatus = await startNavidromeScan(config);
    job.librarySync = {
      status: startStatus.scanning ? "scanning" : "synced",
      message: startStatus.scanning ? "Navidrome 正在扫描音乐库。" : "Navidrome 已接收音乐库扫描。",
      requestedAt,
      finishedAt: startStatus.scanning ? undefined : new Date().toISOString()
    };
    job.updatedAt = new Date().toISOString();
    onChange();

    if (!startStatus.scanning) return;

    const finalStatus = await waitForNavidromeScan(config);
    job.librarySync = {
      status: finalStatus.scanning ? "scanning" : "synced",
      message: finalStatus.scanning ? "Navidrome 仍在扫描，稍后刷新音乐列表。" : "已同步到 Navidrome 音乐库。",
      requestedAt,
      finishedAt: finalStatus.scanning ? undefined : new Date().toISOString()
    };
    job.updatedAt = new Date().toISOString();
    onChange();
  } catch (error) {
    job.librarySync = {
      status: "failed",
      message: error instanceof Error ? error.message : "Navidrome 扫描触发失败。",
      requestedAt,
      finishedAt: new Date().toISOString()
    };
    job.updatedAt = new Date().toISOString();
    onChange();
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

function persistAndBroadcastJobs(config: ApiConfig, jobs: DownloadJob[], clients: Set<(jobs: DownloadJob[]) => void>) {
  saveJobs(config.jobStorePath, jobs, config.maxJobs);
  broadcastJobs(jobs, clients);
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

function appendOutput(job: DownloadJob, value: Buffer) {
  job.output += decodeProcessOutput(value);
  if (job.output.length > 30000) {
    job.output = job.output.slice(-30000);
  }
}
