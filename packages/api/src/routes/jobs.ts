import type { ChildProcessWithoutNullStreams } from "node:child_process";
import type { FastifyInstance } from "fastify";
import type { DownloadJob, IngestionRecord } from "@myusic/shared";
import type { ApiConfig } from "../config";
import type { NavidromeContext } from "../navidrome";
import { getBlockingDownloadChecks } from "../diagnostics";
import { requireUserNavidromeContext } from "../services/user-library-service";

export interface RegisterJobRoutesOptions {
  config: ApiConfig;
  jobs: DownloadJob[];
  ingestions: IngestionRecord[];
  runningProcesses: Map<string, ChildProcessWithoutNullStreams>;
  jobClients: Set<(jobs: DownloadJob[]) => void>;
  persist: () => Promise<void>;
  onDownloadDone: (job: DownloadJob, context?: NavidromeContext) => void;
  startDownload: (
    url: string,
    config: ApiConfig,
    jobs: DownloadJob[],
    ingestions: IngestionRecord[],
    runningProcesses: Map<string, ChildProcessWithoutNullStreams>,
    options: { userId?: string; onChange: () => void; onDone: (job: DownloadJob) => void; retryOf?: string }
  ) => DownloadJob;
  findDuplicateIngestion: (config: ApiConfig, ingestions: IngestionRecord[], url: string, userId?: string) => Promise<IngestionRecord | undefined>;
  stopRunningJob: (job: DownloadJob, runningProcesses: Map<string, ChildProcessWithoutNullStreams>) => void;
}

export function registerJobRoutes(app: FastifyInstance, options: RegisterJobRoutesOptions) {
  const { config, jobs, ingestions, runningProcesses, jobClients } = options;

  app.get("/api/jobs", async (request) => userJobs(jobs, request.auth?.user.id).slice().reverse());

  app.get("/api/jobs/events", async (_request, reply) => {
    reply.hijack();
    reply.raw.writeHead(200, {
      "content-type": "text/event-stream; charset=utf-8",
      "cache-control": "no-cache, no-transform",
      connection: "keep-alive",
      "x-accel-buffering": "no"
    });
    const userId = _request.auth?.user.id;
    reply.raw.write(`event: jobs\ndata: ${JSON.stringify(userJobs(jobs, userId).slice().reverse())}\n\n`);

    const send = (nextJobs: DownloadJob[]) => {
      reply.raw.write(`event: jobs\ndata: ${JSON.stringify(userJobs(nextJobs, userId))}\n\n`);
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

    const user = request.auth?.user;
    const navidrome = requireUserNavidromeContext(config, user, "请先绑定移动端音乐库，再下载歌曲。");

    const blockingChecks = getBlockingDownloadChecks(config);
    if (blockingChecks.length) {
      reply.code(409);
      return {
        error: blockingChecks.map((check) => `${check.label}: ${check.message}`).join("; "),
        checks: blockingChecks
      };
    }

    if (!force) {
      const duplicate = await options.findDuplicateIngestion(config, ingestions, mediaUrl, user?.id);
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
      userId: user?.id,
      onChange: () => { void options.persist(); },
      onDone: (doneJob) => options.onDownloadDone(doneJob, navidrome)
    });
    reply.code(202);
    await options.persist();
    return job;
  });

  app.post<{ Params: { id: string } }>("/api/jobs/:id/cancel", async (request, reply) => {
    const job = jobs.find((item) => item.id === request.params.id && belongsToUser(item, request.auth?.user.id));
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
    const job = jobs.find((item) => item.id === request.params.id && belongsToUser(item, request.auth?.user.id));
    if (!job) {
      reply.code(404);
      return { error: "Job not found." };
    }

    const navidrome = requireUserNavidromeContext(config, request.auth?.user, "请先绑定移动端音乐库，再重试下载。");

    const nextJob = options.startDownload(
      job.url,
      config,
      jobs,
      ingestions,
      runningProcesses,
      {
        userId: job.userId || request.auth?.user.id,
        onChange: () => { void options.persist(); },
        onDone: (doneJob) => options.onDownloadDone(doneJob, navidrome),
        retryOf: job.id
      }
    );
    reply.code(202);
    await options.persist();
    return nextJob;
  });

  app.delete<{ Params: { id: string } }>("/api/jobs/:id", async (request, reply) => {
    const index = jobs.findIndex((item) => item.id === request.params.id && belongsToUser(item, request.auth?.user.id));
    if (index === -1) {
      reply.code(404);
      return { error: "Job not found." };
    }

    options.stopRunningJob(jobs[index], runningProcesses);
    jobs.splice(index, 1);
    await options.persist();
    return userJobs(jobs, request.auth?.user.id).slice().reverse();
  });

  app.delete("/api/jobs", async (request) => {
    for (const job of userJobs(jobs, request.auth?.user.id)) {
      options.stopRunningJob(job, runningProcesses);
    }
    removeUserJobs(jobs, request.auth?.user.id);
    await options.persist();
    return userJobs(jobs, request.auth?.user.id).slice().reverse();
  });
}

function userJobs(jobs: DownloadJob[], userId?: string) {
  return jobs.filter((job) => belongsToUser(job, userId));
}

function belongsToUser(record: { userId?: string }, userId?: string) {
  return userId ? record.userId === userId : true;
}

function removeUserJobs(jobs: DownloadJob[], userId?: string) {
  for (let index = jobs.length - 1; index >= 0; index -= 1) {
    if (belongsToUser(jobs[index], userId)) jobs.splice(index, 1);
  }
}
