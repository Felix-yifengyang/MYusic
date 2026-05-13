import crypto from "node:crypto";
import fs from "node:fs";
import { spawn } from "node:child_process";
import type { ChildProcessWithoutNullStreams } from "node:child_process";
import Fastify from "fastify";
import type { AppSettings, DownloadJob, RuntimeStatus } from "@personal-music/shared";
import { createAudioDownloadArgs, decodeProcessOutput } from "@personal-music/downloader";
import type { ApiConfig } from "./config";
import { getBlockingDownloadChecks, getDiagnostics } from "./diagnostics";
import { loadJobs, saveJobs, trimJobs } from "./job-store";
import { scanLibrary } from "./library";
import { getLanAddresses } from "./network";
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

  app.get("/api/library", async () => scanLibrary(config.musicDir));

  app.get("/api/settings", async () => getSettings(config));

  app.patch<{ Body: Partial<AppSettings> }>("/api/settings", async (request) => updateSettings(config, request.body || {}));

  app.get("/api/diagnostics", async () => getDiagnostics(config));

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
    job.updatedAt = new Date().toISOString();
    onChange();
  });

  return job;
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
