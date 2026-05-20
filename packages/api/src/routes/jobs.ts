import type { ChildProcessWithoutNullStreams } from "node:child_process";
import type { FastifyInstance } from "fastify";
import type { DownloadJob, IngestionRecord } from "@myusic/shared";
import type { ApiConfig } from "../config";
import { getBlockingDownloadChecks } from "../diagnostics";

export interface RegisterJobRoutesOptions {
  config: ApiConfig;
  jobs: DownloadJob[];
  ingestions: IngestionRecord[];
  runningProcesses: Map<string, ChildProcessWithoutNullStreams>;
  jobClients: Set<(jobs: DownloadJob[]) => void>;
  persist: () => Promise<void>;
  onDownloadDone: (job: DownloadJob) => void;
  startDownload: (
    url: string,
    config: ApiConfig,
    jobs: DownloadJob[],
    ingestions: IngestionRecord[],
    runningProcesses: Map<string, ChildProcessWithoutNullStreams>,
    options: { onChange: () => void; onDone: (job: DownloadJob) => void; retryOf?: string }
  ) => DownloadJob;
  findDuplicateIngestion: (config: ApiConfig, ingestions: IngestionRecord[], url: string) => Promise<IngestionRecord | undefined>;
  stopRunningJob: (job: DownloadJob, runningProcesses: Map<string, ChildProcessWithoutNullStreams>) => void;
}

export function registerJobRoutes(app: FastifyInstance, options: RegisterJobRoutesOptions) {
  const { config, jobs, ingestions, runningProcesses, jobClients } = options;

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

  app.post<{ Body: { url?: string; force?: boolean } }>("/api/download", async (request, reply) => {
    const mediaUrl = String(request.body?.url || "").trim();
    const force = Boolean(request.body?.force);

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

    if (!force) {
      let duplicate: IngestionRecord | undefined;
      try {
        duplicate = await options.findDuplicateIngestion(config, ingestions, mediaUrl);
      } catch (error) {
        reply.code(409);
        return {
          error: error instanceof Error ? `下载预检查失败：${error.message}` : "下载预检查失败。"
        };
      }

      if (duplicate) {
        reply.code(409);
        return {
          error: "已存在入库记录，未重复下载。",
          code: "DUPLICATE_INGESTION",
          ingestion: duplicate
        };
      }
    }

    const job = options.startDownload(mediaUrl, config, jobs, ingestions, runningProcesses, {
      onChange: () => { void options.persist(); },
      onDone: options.onDownloadDone
    });
    reply.code(202);
    await options.persist();
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
    await options.persist();
    return job;
  });

  app.post<{ Params: { id: string } }>("/api/jobs/:id/retry", async (request, reply) => {
    const job = jobs.find((item) => item.id === request.params.id);
    if (!job) {
      reply.code(404);
      return { error: "Job not found." };
    }

    const nextJob = options.startDownload(
      job.url,
      config,
      jobs,
      ingestions,
      runningProcesses,
      {
        onChange: () => { void options.persist(); },
        onDone: options.onDownloadDone,
        retryOf: job.id
      }
    );
    reply.code(202);
    await options.persist();
    return nextJob;
  });

  app.delete<{ Params: { id: string } }>("/api/jobs/:id", async (request, reply) => {
    const index = jobs.findIndex((item) => item.id === request.params.id);
    if (index === -1) {
      reply.code(404);
      return { error: "Job not found." };
    }

    options.stopRunningJob(jobs[index], runningProcesses);
    jobs.splice(index, 1);
    await options.persist();
    return jobs.slice().reverse();
  });

  app.delete("/api/jobs", async () => {
    for (const job of jobs) {
      options.stopRunningJob(job, runningProcesses);
    }
    jobs.splice(0, jobs.length);
    await options.persist();
    return jobs.slice().reverse();
  });
}
