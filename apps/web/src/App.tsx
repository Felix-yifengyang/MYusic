import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import type { DownloadJob, RuntimeStatus, Track } from "@personal-music/shared";

type TabName = "download" | "library" | "settings";

export function App() {
  const [activeTab, setActiveTab] = useState<TabName>("download");
  const [status, setStatus] = useState<RuntimeStatus | null>(null);
  const [jobs, setJobs] = useState<DownloadJob[]>([]);
  const [tracks, setTracks] = useState<Track[]>([]);
  const [url, setUrl] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const activeTabRef = useRef<TabName>("download");
  const navidromeUrl = status?.navidromeUrl || "http://127.0.0.1:4533";

  useEffect(() => {
    activeTabRef.current = activeTab;
  }, [activeTab]);

  useEffect(() => {
    void loadStatus();
    void loadJobs();
    void loadLibrary();

    const onFocus = () => {
      if (activeTabRef.current === "settings" || activeTabRef.current === "download") void loadStatus();
      if (activeTabRef.current === "library") void loadLibrary();
    };

    window.addEventListener("focus", onFocus);
    return () => {
      window.removeEventListener("focus", onFocus);
    };
  }, []);

  useEffect(() => {
    if (activeTab === "library") {
      void loadLibrary();
    }
    if (activeTab === "settings") {
      void loadStatus();
    }
    if (activeTab === "download") {
      void loadJobs();
    }
  }, [activeTab]);

  useEffect(() => {
    if (activeTab !== "download") return;

    const events = new EventSource("/api/jobs/events");
    events.addEventListener("jobs", (event) => {
      setJobs(JSON.parse(event.data));
    });
    events.onerror = () => {
      void loadJobs();
    };

    return () => events.close();
  }, [activeTab]);

  async function loadStatus() {
    const response = await fetch("/api/health");
    setStatus(await response.json());
  }

  async function loadJobs() {
    const response = await fetch("/api/jobs");
    setJobs(await response.json());
  }

  async function loadLibrary() {
    const response = await fetch("/api/library");
    setTracks(await response.json());
  }

  async function submitDownload(event: FormEvent) {
    event.preventDefault();
    const mediaUrl = url.trim();
    if (!mediaUrl) return;

    setSubmitting(true);
    setError("");

    try {
      const response = await fetch("/api/download", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ url: mediaUrl })
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "下载失败");
      setUrl("");
      await loadJobs();
      await loadLibrary();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "下载失败");
    } finally {
      setSubmitting(false);
    }
  }

  async function cancelJob(id: string) {
    await fetch(`/api/jobs/${id}/cancel`, { method: "POST" });
    await loadJobs();
  }

  async function retryJob(id: string) {
    await fetch(`/api/jobs/${id}/retry`, { method: "POST" });
    await loadJobs();
  }

  async function clearFinishedJobs() {
    const response = await fetch("/api/jobs", { method: "DELETE" });
    setJobs(await response.json());
  }

  const serviceLabel = useMemo(() => {
    if (!status) return "启动中";
    return "服务正常";
  }, [status]);

  return (
    <main className="layout">
      <header className="header">
        <div>
          <h1>Personal Music</h1>
          <div className="subtle">{status?.musicDir || "正在读取音乐库..."}</div>
        </div>
        <div className={`status-dot ${status ? "ready" : ""}`}>{serviceLabel}</div>
      </header>

      <nav className="tabs" aria-label="功能">
        <TabButton active={activeTab === "download"} onClick={() => setActiveTab("download")}>下载</TabButton>
        <TabButton active={activeTab === "library"} onClick={() => setActiveTab("library")}>音乐列表</TabButton>
        <TabButton active={activeTab === "settings"} onClick={() => setActiveTab("settings")}>设置</TabButton>
      </nav>

      {activeTab === "download" && (
        <section className="grid">
          <section className="block">
            <div className="section-heading">
              <h2>下载音频</h2>
              <button className="button secondary compact" type="button" onClick={clearFinishedJobs}>清空已结束</button>
            </div>
            <form className="download-form" onSubmit={submitDownload}>
              <input
                id="download-url"
                name="url"
                type="url"
                placeholder="粘贴 Bilibili / YouTube / 网页链接"
                value={url}
                onChange={(event) => setUrl(event.target.value)}
                required
              />
              <button className="button" type="submit" disabled={submitting}>下载</button>
            </form>
            {error && <p className="error">{error}</p>}
            <JobList jobs={jobs} onCancel={cancelJob} onRetry={retryJob} />
          </section>

          <aside className="block">
            <h2>当前状态</h2>
            {status ? <QuickStatus status={status} /> : <Empty>正在读取状态</Empty>}
          </aside>
        </section>
      )}

      {activeTab === "library" && (
        <section>
          <div className="toolbar">
            <button className="button secondary" type="button" onClick={loadLibrary}>刷新列表</button>
            <a className="button secondary" href={navidromeUrl} target="_blank" rel="noreferrer">打开完整音乐库</a>
          </div>
          <div className="grid">
            <section className="block">
              <h2>本地音乐列表</h2>
              <TrackList tracks={tracks} />
            </section>
            <section className="block">
              <h2>Navidrome</h2>
              <div className="navidrome-panel">
                <div className="value">Navidrome 不允许被嵌入页面，完整播放和账号管理需要在独立页面打开。</div>
                <a className="button secondary" href={navidromeUrl} target="_blank" rel="noreferrer">打开 Navidrome</a>
              </div>
            </section>
          </div>
        </section>
      )}

      {activeTab === "settings" && (
        <section className="grid">
          <section className="block">
            <h2>路径和工具</h2>
            {status ? <SettingsMain status={status} /> : <Empty>正在读取设置</Empty>}
          </section>
          <section className="block">
            <h2>手机连接</h2>
            {status ? <LanSettings status={status} /> : <Empty>正在读取局域网地址</Empty>}
          </section>
        </section>
      )}
    </main>
  );
}

function TabButton(props: { active: boolean; onClick: () => void; children: string }) {
  return (
    <button className={`tab ${props.active ? "active" : ""}`} type="button" onClick={props.onClick}>
      {props.children}
    </button>
  );
}

function QuickStatus({ status }: { status: RuntimeStatus }) {
  return (
    <div className="facts">
      <Fact label="下载服务" value={status.collectorUrl} />
      <Fact label="音乐库服务" value={status.navidromeUrl} />
      <Fact label="Bilibili Cookie" value={status.cookies.bilibili.exists ? "已配置" : "未配置"} />
      <Fact label="yt-dlp" value={status.tools.ytdlpExists ? "可用" : "未找到"} />
      <Fact label="ffmpeg" value={status.tools.ffmpegExists ? "可用" : "未找到"} />
    </div>
  );
}

function SettingsMain({ status }: { status: RuntimeStatus }) {
  return (
    <div className="facts">
      <Fact label="音乐目录" value={status.musicDir} />
      <Fact label="音频格式" value={status.audioFormat} />
      <Fact label="Cookie 文件" value={status.cookies.bilibili.path || "未设置"} />
      <Fact label="yt-dlp" value={status.tools.ytdlpPath} />
      <Fact label="ffmpeg" value={status.tools.ffmpegPath || "未设置"} />
    </div>
  );
}

function LanSettings({ status }: { status: RuntimeStatus }) {
  if (!status.lan.length) return <Empty>没有检测到局域网 IP</Empty>;

  return (
    <div className="facts">
      {status.lan.map((item) => (
        <article className="fact" key={item.address}>
          <div className="row"><strong>{item.address}</strong></div>
          <div className="value">控制台：{item.collectorUrl}</div>
          <div className="value">Amperfy：{item.navidromeUrl}</div>
        </article>
      ))}
    </div>
  );
}

function JobList({
  jobs,
  onCancel,
  onRetry
}: {
  jobs: DownloadJob[];
  onCancel: (id: string) => void;
  onRetry: (id: string) => void;
}) {
  if (!jobs.length) return <Empty>暂无下载任务</Empty>;

  return (
    <div className="jobs">
      {jobs.map((job) => (
        <article className="job" key={job.id}>
          <div className="row">
            <span className={`status ${job.status}`}>{job.status}</span>
            <span className="meta">{formatDate(job.createdAt)}</span>
          </div>
          <div className="url">{job.url}</div>
          <div className="job-actions">
            {job.status === "running" && (
              <button className="button secondary compact" type="button" onClick={() => onCancel(job.id)}>取消</button>
            )}
            {(job.status === "failed" || job.status === "canceled") && (
              <button className="button secondary compact" type="button" onClick={() => onRetry(job.id)}>重试</button>
            )}
          </div>
          {job.error && <pre>{job.error}</pre>}
          {job.output && <pre>{job.output}</pre>}
        </article>
      ))}
    </div>
  );
}

function TrackList({ tracks }: { tracks: Track[] }) {
  if (!tracks.length) return <Empty>音乐库里还没有音频文件</Empty>;

  return (
    <div className="songs">
      {tracks.map((track) => (
        <article className="song" key={track.relativePath}>
          <div className="song-title">{track.title}</div>
          <div className="meta">{track.artist} · {formatBytes(track.size)} · {formatDate(track.modifiedAt)}</div>
          <div className="value">{track.relativePath}</div>
        </article>
      ))}
    </div>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <article className="fact">
      <div className="row"><strong>{label}</strong></div>
      <div className="value">{value}</div>
    </article>
  );
}

function Empty({ children }: { children: string }) {
  return <div className="empty">{children}</div>;
}

function formatDate(value?: string) {
  if (!value) return "";
  return new Date(value).toLocaleString();
}

function formatBytes(value: number) {
  const units = ["B", "KB", "MB", "GB"];
  let size = Number(value || 0);
  let unit = 0;
  while (size >= 1024 && unit < units.length - 1) {
    size /= 1024;
    unit += 1;
  }
  return `${size.toFixed(unit === 0 ? 0 : 1)} ${units[unit]}`;
}
