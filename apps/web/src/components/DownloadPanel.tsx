import type { FormEvent } from "react";
import type { DownloadJob, IngestionRecord } from "@myusic/shared";
import { Button, EmptyState, StatPill } from "./ui";

const SYNC_STATUS_LABELS = {
  pending: "等待扫描",
  scanning: "同步中",
  synced: "已同步",
  failed: "同步失败"
};

export interface DownloadPanelProps {
  jobs: DownloadJob[];
  url: string;
  error: string;
  submitting: boolean;
  duplicateIngestion: IngestionRecord | null;
  onUrlChange: (value: string) => void;
  onSubmit: (event: FormEvent) => void;
  onClearJobs: () => void;
  onCancelJob: (id: string) => void;
  onDeleteJob: (id: string) => void;
  onRetryJob: (id: string) => void;
  onOpenIngestions: () => void;
  onDismissDuplicate: () => void;
}

export function DownloadPanel({
  jobs,
  url,
  error,
  submitting,
  duplicateIngestion,
  onUrlChange,
  onSubmit,
  onClearJobs,
  onCancelJob,
  onDeleteJob,
  onRetryJob,
  onOpenIngestions,
  onDismissDuplicate
}: DownloadPanelProps) {
  const counts = summarizeJobs(jobs);

  return (
    <section className="collect-panel">
      <div className="collect-command">
        <div className="collect-stats">
          <StatPill label="进行中" value={counts.running} tone={counts.running ? "warn" : "neutral"} />
          <StatPill label="已完成" value={counts.done} tone="ok" />
          <StatPill label="失败" value={counts.failed} tone={counts.failed ? "danger" : "neutral"} />
        </div>
      </div>

      <form className="collect-form" onSubmit={onSubmit}>
        <input
          aria-label="下载链接"
          id="download-url"
          name="url"
          type="url"
          placeholder="粘贴链接"
          value={url}
          onChange={(event) => onUrlChange(event.target.value)}
          required
        />
        <Button className="collect-submit" type="submit" disabled={submitting} aria-label={submitting ? "提交中" : "开始收集"}>
          <svg aria-hidden="true" viewBox="0 0 24 24">
            <path d="M5 12h13" />
            <path d="m13 6 6 6-6 6" />
          </svg>
        </Button>
      </form>

      {error && <p className="error">{error}</p>}
      {duplicateIngestion && (
        <div className="duplicate-notice">
          <span>已存在入库记录，未创建下载任务：{duplicateIngestion.id}</span>
          <Button variant="secondary" size="compact" type="button" onClick={onOpenIngestions}>查看</Button>
          <Button variant="secondary" size="compact" type="button" onClick={onDismissDuplicate}>关闭</Button>
        </div>
      )}

      <div className="section-heading">
        <div>
          <h3>任务列表</h3>
        </div>
        <Button variant="secondary" type="button" onClick={onClearJobs} disabled={!jobs.length}>清空任务</Button>
      </div>

      <JobList
        jobs={jobs}
        onCancel={onCancelJob}
        onDelete={onDeleteJob}
        onRetry={onRetryJob}
        onOpenIngestions={onOpenIngestions}
      />
    </section>
  );
}

function JobList({
  jobs,
  onCancel,
  onDelete,
  onRetry,
  onOpenIngestions
}: {
  jobs: DownloadJob[];
  onCancel: (id: string) => void;
  onDelete: (id: string) => void;
  onRetry: (id: string) => void;
  onOpenIngestions: () => void;
}) {
  if (!jobs.length) return <EmptyState>暂无下载任务</EmptyState>;

  return (
    <div className="jobs">
      {jobs.map((job) => (
        <article className={`job collect-job ${job.status}`} key={job.id}>
          <div className="collect-job-row">
            <div className="collect-job-main">
              <span className={`status ${job.status}`}>{statusLabel(job.status)}</span>
              <div className="url">{job.url}</div>
              <span className="meta">{formatDate(job.createdAt)}</span>
            </div>
            <div className="job-actions">
              {job.status === "running" && (
                <Button variant="secondary" size="compact" type="button" onClick={() => onCancel(job.id)}>取消</Button>
              )}
              {(job.status === "failed" || job.status === "canceled") && (
                <Button variant="secondary" size="compact" type="button" onClick={() => onRetry(job.id)}>重试</Button>
              )}
              <Button variant="secondary" size="compact" type="button" onClick={() => onDelete(job.id)}>删除</Button>
            </div>
          </div>
          <details className="job-details">
            <summary>任务详情</summary>
            <SyncStatus job={job} />
            <JobIngestionSummary job={job} onOpenIngestions={onOpenIngestions} />
            {job.error && <pre>{job.error}</pre>}
            {job.output && <pre>{job.output}</pre>}
          </details>
        </article>
      ))}
    </div>
  );
}

function summarizeJobs(jobs: DownloadJob[]) {
  return jobs.reduce(
    (summary, job) => {
      summary[job.status] += 1;
      return summary;
    },
    { running: 0, done: 0, failed: 0, canceled: 0 }
  );
}

function JobIngestionSummary({ job, onOpenIngestions }: { job: DownloadJob; onOpenIngestions: () => void }) {
  if (job.status === "running") return null;

  if (job.status === "done" && !job.ingestionId && !job.ingestion?.id) {
    return <div className="job-ingestion-summary muted">入库记录：旧任务未记录</div>;
  }

  const ingestionId = job.ingestionId || job.ingestion?.id;
  if (!ingestionId) return null;

  return (
    <div className="job-ingestion-summary">
      <span>入库记录：{ingestionId}</span>
      <Button variant="secondary" size="compact" type="button" onClick={onOpenIngestions}>查看</Button>
    </div>
  );
}

function SyncStatus({ job }: { job: DownloadJob }) {
  if (job.status === "running") {
    return (
      <div className="sync-status muted">
        <strong>音乐库同步</strong>
        <span>下载中，完成后会自动触发 Navidrome 扫描。</span>
      </div>
    );
  }

  if (job.status === "failed" || job.status === "canceled") {
    return (
      <div className="sync-status muted">
        <strong>音乐库同步</strong>
        <span>下载未完成，不会同步到音乐库。</span>
      </div>
    );
  }

  const sync = job.librarySync;
  if (!sync) {
    return (
      <div className="sync-status muted">
        <strong>音乐库同步</strong>
        <span>旧任务没有同步记录。新下载任务会显示扫描状态。</span>
      </div>
    );
  }

  return (
    <div className={`sync-status ${sync.status}`}>
      <strong>音乐库同步：{SYNC_STATUS_LABELS[sync.status]}</strong>
      {sync.message ? <span>{sync.message}</span> : null}
    </div>
  );
}

function formatDate(value?: string) {
  if (!value) return "";
  return new Date(value).toLocaleString();
}

function statusLabel(status: DownloadJob["status"]) {
  const labels = {
    running: "下载中",
    done: "已完成",
    failed: "失败",
    canceled: "已取消"
  };
  return labels[status];
}
