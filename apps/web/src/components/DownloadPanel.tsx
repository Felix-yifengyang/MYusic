import type { FormEvent } from "react";
import type { DownloadJob, IngestionRecord } from "@myusic/shared";
import { Empty } from "./common";

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
      <div className="collect-hero">
        <div>
          <span>Collect</span>
          <h2>把网页音频收进 MYusic</h2>
          <p>{counts.running ? `${counts.running} 个任务正在处理，完成后会进入音乐库。` : "粘贴一个链接，MYusic 会下载、转码并同步到音乐库。"}</p>
        </div>
      </div>

      <form className="collect-form" onSubmit={onSubmit}>
        <input
          id="download-url"
          name="url"
          type="url"
          placeholder="粘贴 Bilibili / YouTube / 网页链接"
          value={url}
          onChange={(event) => onUrlChange(event.target.value)}
          required
        />
        <button type="submit" disabled={submitting}>{submitting ? "提交中..." : "开始收集"}</button>
      </form>

      <div className="collect-stats">
        <SummaryPill label="进行中" value={counts.running} tone={counts.running ? "warn" : "neutral"} />
        <SummaryPill label="已完成" value={counts.done} tone="ok" />
        <SummaryPill label="失败" value={counts.failed} tone={counts.failed ? "danger" : "neutral"} />
        <SummaryPill label="已取消" value={counts.canceled} tone="neutral" />
      </div>

      {error && <p className="error">{error}</p>}
      {duplicateIngestion && (
        <div className="duplicate-notice">
          <span>已存在入库记录，未创建下载任务：{duplicateIngestion.id}</span>
          <button className="button secondary compact" type="button" onClick={onOpenIngestions}>查看</button>
          <button className="button secondary compact" type="button" onClick={onDismissDuplicate}>关闭</button>
        </div>
      )}

      <div className="collect-section-heading">
        <div>
          <h3>收集任务</h3>
          <p>{jobs.length ? `${jobs.length} 条任务记录` : "暂无任务记录"}</p>
        </div>
        <button type="button" onClick={onClearJobs} disabled={!jobs.length}>清空任务</button>
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

function SummaryPill({
  label,
  value,
  tone
}: {
  label: string;
  value: number;
  tone: "ok" | "warn" | "danger" | "neutral";
}) {
  return (
    <div className={`summary-pill ${tone}`}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
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
  if (!jobs.length) return <Empty>暂无下载任务</Empty>;

  return (
    <div className="jobs">
      {jobs.map((job) => (
        <article className={`job collect-job ${job.status}`} key={job.id}>
          <div className="collect-job-main">
            <div className="collect-job-status">
              <span className={`status ${job.status}`}>{statusLabel(job.status)}</span>
              <span className="meta">{formatDate(job.createdAt)}</span>
            </div>
            <div className="url">{job.url}</div>
          </div>
          <SyncStatus job={job} />
          <JobIngestionSummary job={job} onOpenIngestions={onOpenIngestions} />
          <div className="job-actions">
            {job.status === "running" && (
              <button className="button secondary compact" type="button" onClick={() => onCancel(job.id)}>取消</button>
            )}
            {(job.status === "failed" || job.status === "canceled") && (
              <button className="button secondary compact" type="button" onClick={() => onRetry(job.id)}>重试</button>
            )}
            <button className="button secondary compact" type="button" onClick={() => onDelete(job.id)}>删除</button>
          </div>
          {job.error && <pre>{job.error}</pre>}
          {job.output && <pre>{job.output}</pre>}
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
      <button className="button secondary compact" type="button" onClick={onOpenIngestions}>查看</button>
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

  const labels = {
    pending: "等待扫描",
    scanning: "同步中",
    synced: "已同步",
    failed: "同步失败"
  };

  return (
    <div className={`sync-status ${sync.status}`}>
      <strong>音乐库同步：{labels[sync.status]}</strong>
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
