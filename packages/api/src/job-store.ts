import fs from "node:fs";
import path from "node:path";
import type { DownloadJob } from "@myusic/shared";

export function loadJobs(jobStorePath: string, maxJobs: number): DownloadJob[] {
  if (!fs.existsSync(jobStorePath)) {
    return [];
  }

  const raw = fs.readFileSync(jobStorePath, "utf8").replace(/^\uFEFF/, "");
  const parsed = JSON.parse(raw) as DownloadJob[];
  const restored = Array.isArray(parsed) ? parsed : [];

  return restored.slice(-maxJobs).map((job) => {
    if (job.status !== "running") return job;

    return {
      ...job,
      status: "failed",
      error: job.error || "Task was interrupted because the server stopped.",
      finishedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
  });
}

export function saveJobs(jobStorePath: string, jobs: DownloadJob[], maxJobs: number) {
  fs.mkdirSync(path.dirname(jobStorePath), { recursive: true });
  const trimmed = trimJobs(jobs, maxJobs);
  const tempPath = `${jobStorePath}.tmp`;
  fs.writeFileSync(tempPath, JSON.stringify(trimmed, null, 2) + "\n", "utf8");
  fs.renameSync(tempPath, jobStorePath);
}

export function trimJobs(jobs: DownloadJob[], maxJobs: number) {
  if (jobs.length <= maxJobs) return jobs;

  const running = jobs.filter((job) => job.status === "running");
  const finished = jobs.filter((job) => job.status !== "running");
  return [...finished.slice(Math.max(0, finished.length - Math.max(0, maxJobs - running.length))), ...running];
}
