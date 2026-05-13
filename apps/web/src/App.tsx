import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import type { AppSettings, DiagnosticCheck, DiagnosticsReport, DownloadJob, NavidromeSong, RuntimeStatus } from "@personal-music/shared";

type TabName = "download" | "library" | "settings";

type PlayerTrack = {
  key: string;
  source: "navidrome";
  title: string;
  artist: string;
  album?: string;
  streamUrl: string;
  coverUrl?: string;
};

export function App() {
  const [activeTab, setActiveTab] = useState<TabName>("download");
  const [status, setStatus] = useState<RuntimeStatus | null>(null);
  const [jobs, setJobs] = useState<DownloadJob[]>([]);
  const [navidromeSongs, setNavidromeSongs] = useState<NavidromeSong[]>([]);
  const [navidromeQuery, setNavidromeQuery] = useState("");
  const [navidromeError, setNavidromeError] = useState("");
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [diagnostics, setDiagnostics] = useState<DiagnosticsReport | null>(null);
  const [queue, setQueue] = useState<PlayerTrack[]>([]);
  const [queueIndex, setQueueIndex] = useState(-1);
  const [url, setUrl] = useState("");
  const [error, setError] = useState("");
  const [settingsMessage, setSettingsMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const activeTabRef = useRef<TabName>("download");
  const navidromeUrl = status?.navidromeUrl || "http://127.0.0.1:4533";
  const nowPlaying = queueIndex >= 0 ? queue[queueIndex] : null;

  useEffect(() => {
    activeTabRef.current = activeTab;
  }, [activeTab]);

  useEffect(() => {
    void loadStatus();
    void loadJobs();
    void loadDiagnostics();

    const onFocus = () => {
      if (activeTabRef.current === "settings" || activeTabRef.current === "download") void loadStatus();
      if (activeTabRef.current === "settings" || activeTabRef.current === "download") void loadDiagnostics();
      if (activeTabRef.current === "library") void loadNavidromeSongs();
    };

    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, []);

  useEffect(() => {
    if (activeTab === "library") void loadNavidromeSongs();
    if (activeTab === "settings") {
      void loadStatus();
      void loadSettings();
      void loadDiagnostics();
    }
    if (activeTab === "download") void loadJobs();
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

  async function loadSettings() {
    const response = await fetch("/api/settings");
    setSettings(await response.json());
  }

  async function loadDiagnostics() {
    const response = await fetch("/api/diagnostics");
    setDiagnostics(await response.json());
  }

  async function loadNavidromeSongs(query = navidromeQuery) {
    setNavidromeError("");
    try {
      const response = await fetch(`/api/navidrome/songs?q=${encodeURIComponent(query)}`);
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "Navidrome 音乐库读取失败");
      setNavidromeSongs(body.songs);
    } catch (caught) {
      setNavidromeSongs([]);
      setNavidromeError(caught instanceof Error ? caught.message : "Navidrome 音乐库读取失败");
    }
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
      if (!response.ok) {
        await loadDiagnostics();
        throw new Error(body.error || "下载失败");
      }
      setUrl("");
      await loadJobs();
      await loadNavidromeSongs();
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

  async function saveSettings(event: FormEvent) {
    event.preventDefault();
    if (!settings) return;

    setSettingsMessage("");
    const response = await fetch("/api/settings", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(settings)
    });
    const body = await response.json();
    setSettings(body.settings);
    await loadStatus();
    await loadDiagnostics();
    setSettingsMessage(body.restartRequired ? `已保存，需要重启：${body.restartReasons.join("；")}` : "已保存");
  }

  function updateSetting<K extends keyof AppSettings>(key: K, value: AppSettings[K]) {
    setSettings((current) => current ? { ...current, [key]: value } : current);
  }

  function searchNavidrome(event: FormEvent) {
    event.preventDefault();
    void loadNavidromeSongs(navidromeQuery);
  }

  function playSong(song: NavidromeSong) {
    const tracks = navidromeSongs.map(navidromePlayerTrack);
    const index = Math.max(0, navidromeSongs.findIndex((item) => item.id === song.id));
    setQueue(tracks);
    setQueueIndex(index);
  }

  function playPrevious() {
    setQueueIndex((current) => current > 0 ? current - 1 : current);
  }

  function playNext() {
    setQueueIndex((current) => current >= 0 && current < queue.length - 1 ? current + 1 : current);
  }

  function closePlayer() {
    setQueueIndex(-1);
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
            {diagnostics && <DiagnosticsList diagnostics={diagnostics} compact />}
          </aside>
        </section>
      )}

      {activeTab === "library" && (
        <section className="block">
          <NavidromeLibrary
            songs={navidromeSongs}
            query={navidromeQuery}
            error={navidromeError}
            navidromeUrl={navidromeUrl}
            currentTrackKey={nowPlaying?.key || ""}
            queue={queue}
            queueIndex={queueIndex}
            onQueryChange={setNavidromeQuery}
            onSearch={searchNavidrome}
            onRefresh={() => loadNavidromeSongs()}
            onPlay={playSong}
          />
        </section>
      )}

      {activeTab === "settings" && (
        <section className="grid">
          <section className="block">
            <h2>路径和工具</h2>
            {settings ? (
              <SettingsForm
                settings={settings}
                message={settingsMessage}
                onChange={updateSetting}
                onSubmit={saveSettings}
              />
            ) : (
              <Empty>正在读取设置</Empty>
            )}
          </section>
          <section className="block">
            <h2>手机连接</h2>
            {status ? <LanSettings status={status} /> : <Empty>正在读取局域网地址</Empty>}
            {diagnostics && <DiagnosticsList diagnostics={diagnostics} />}
          </section>
        </section>
      )}

      <PlayerBar
        track={nowPlaying}
        canPrevious={queueIndex > 0}
        canNext={queueIndex >= 0 && queueIndex < queue.length - 1}
        onPrevious={playPrevious}
        onNext={playNext}
        onEnded={playNext}
        onClose={closePlayer}
      />
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

function NavidromeLibrary({
  songs,
  query,
  error,
  navidromeUrl,
  currentTrackKey,
  queue,
  queueIndex,
  onQueryChange,
  onSearch,
  onRefresh,
  onPlay
}: {
  songs: NavidromeSong[];
  query: string;
  error: string;
  navidromeUrl: string;
  currentTrackKey: string;
  queue: PlayerTrack[];
  queueIndex: number;
  onQueryChange: (value: string) => void;
  onSearch: (event: FormEvent) => void;
  onRefresh: () => void;
  onPlay: (song: NavidromeSong) => void;
}) {
  const currentQueueTrack = queueIndex >= 0 ? queue[queueIndex] : null;
  const nextQueueTrack = queueIndex >= 0 && queueIndex < queue.length - 1 ? queue[queueIndex + 1] : null;

  return (
    <div className="navidrome-panel">
      <div className="section-heading">
        <h2>音乐库</h2>
        <div className="inline-actions">
          <button className="button secondary compact" type="button" onClick={onRefresh}>刷新</button>
          <a className="button secondary compact" href={navidromeUrl} target="_blank" rel="noreferrer">管理页</a>
        </div>
      </div>
      <form className="search-form" onSubmit={onSearch}>
        <input value={query} onChange={(event) => onQueryChange(event.target.value)} placeholder="搜索标题、歌手、专辑" />
        <button className="button secondary compact" type="submit">搜索</button>
      </form>
      {error && <div className="error">{error}</div>}
      {currentQueueTrack && (
        <div className="queue-summary">
          <div>
            <strong>当前播放</strong>
            <div className="meta">{currentQueueTrack.title} · {queueIndex + 1}/{queue.length}</div>
          </div>
          <div>
            <strong>下一首</strong>
            <div className="meta">{nextQueueTrack ? nextQueueTrack.title : "队列已到末尾"}</div>
          </div>
        </div>
      )}
      <div className="navidrome-songs">
        {!songs.length && !error ? <Empty>没有歌曲。确认 Navidrome 已扫描音乐库，并在设置中填写账号密码。</Empty> : songs.map((song) => (
          <article className={`navidrome-song ${currentTrackKey === `navidrome:${song.id}` ? "active" : ""}`} key={song.id}>
            {song.coverArt ? <img alt="" src={`/api/navidrome/cover/${encodeURIComponent(song.coverArt)}`} /> : <div className="cover-placeholder" />}
            <div>
              <div className="song-title">{song.title}</div>
              <div className="meta">{song.artist || "Unknown"} · {song.album || "Unknown"}</div>
            </div>
            <button className="button secondary compact" type="button" onClick={() => onPlay(song)}>
              {currentTrackKey === `navidrome:${song.id}` ? "播放中" : "播放"}
            </button>
          </article>
        ))}
      </div>
    </div>
  );
}

function PlayerBar({
  track,
  canPrevious,
  canNext,
  onPrevious,
  onNext,
  onEnded,
  onClose
}: {
  track: PlayerTrack | null;
  canPrevious: boolean;
  canNext: boolean;
  onPrevious: () => void;
  onNext: () => void;
  onEnded: () => void;
  onClose: () => void;
}) {
  if (!track) return null;

  return (
    <div className="player-bar">
      {track.coverUrl ? <img alt="" src={track.coverUrl} /> : <div className="cover-placeholder" />}
      <div className="player-info">
        <div className="song-title">{track.title}</div>
        <div className="meta">{track.artist}{track.album ? ` · ${track.album}` : ""}</div>
      </div>
      <div className="player-controls">
        <button className="button secondary compact" type="button" disabled={!canPrevious} onClick={onPrevious}>上一首</button>
        <audio controls autoPlay src={track.streamUrl} onEnded={onEnded} />
        <button className="button secondary compact" type="button" disabled={!canNext} onClick={onNext}>下一首</button>
      </div>
      <button className="button secondary compact" type="button" onClick={onClose}>关闭</button>
    </div>
  );
}

function navidromePlayerTrack(song: NavidromeSong): PlayerTrack {
  return {
    key: `navidrome:${song.id}`,
    source: "navidrome",
    title: song.title,
    artist: song.artist || "Unknown",
    album: song.album,
    streamUrl: `/api/navidrome/stream/${encodeURIComponent(song.id)}`,
    coverUrl: song.coverArt ? `/api/navidrome/cover/${encodeURIComponent(song.coverArt)}` : undefined
  };
}

function DiagnosticsList({ diagnostics, compact = false }: { diagnostics: DiagnosticsReport; compact?: boolean }) {
  const visibleChecks = compact ? diagnostics.checks.filter((check) => check.level !== "ok") : diagnostics.checks;

  if (compact && !visibleChecks.length) {
    return <div className="diagnostics-summary ok">环境检查正常</div>;
  }

  return (
    <div className="diagnostics">
      {!compact && <div className={`diagnostics-summary ${diagnostics.ok ? "ok" : "error"}`}>{diagnostics.ok ? "环境检查正常" : "环境存在问题"}</div>}
      {visibleChecks.map((check) => <DiagnosticItem check={check} key={check.id} />)}
    </div>
  );
}

function DiagnosticItem({ check }: { check: DiagnosticCheck }) {
  return (
    <article className={`diagnostic ${check.level}`}>
      <div className="row">
        <strong>{check.label}</strong>
        <span>{check.level}</span>
      </div>
      <div className="value">{check.message}</div>
      {check.suggestion && <div className="suggestion">{check.suggestion}</div>}
    </article>
  );
}

function SettingsForm({
  settings,
  message,
  onChange,
  onSubmit
}: {
  settings: AppSettings;
  message: string;
  onChange: <K extends keyof AppSettings>(key: K, value: AppSettings[K]) => void;
  onSubmit: (event: FormEvent) => void;
}) {
  return (
    <form className="settings-form" onSubmit={onSubmit}>
      <label>
        <span>音乐目录</span>
        <input value={settings.musicDir} onChange={(event) => onChange("musicDir", event.target.value)} />
      </label>
      <label>
        <span>Bilibili Cookie</span>
        <input value={settings.bilibiliCookiesPath} onChange={(event) => onChange("bilibiliCookiesPath", event.target.value)} />
      </label>
      <label>
        <span>yt-dlp</span>
        <input value={settings.ytdlpPath} onChange={(event) => onChange("ytdlpPath", event.target.value)} />
      </label>
      <label>
        <span>ffmpeg</span>
        <input value={settings.ffmpegPath} onChange={(event) => onChange("ffmpegPath", event.target.value)} />
      </label>
      <label>
        <span>音频格式</span>
        <select value={settings.audioFormat} onChange={(event) => onChange("audioFormat", event.target.value)}>
          <option value="mp3">mp3</option>
          <option value="m4a">m4a</option>
          <option value="opus">opus</option>
          <option value="flac">flac</option>
          <option value="wav">wav</option>
        </select>
      </label>
      <label>
        <span>音频质量</span>
        <input value={settings.audioQuality} onChange={(event) => onChange("audioQuality", event.target.value)} />
      </label>
      <label>
        <span>Navidrome 地址</span>
        <input value={settings.navidromeBaseUrl} onChange={(event) => onChange("navidromeBaseUrl", event.target.value)} />
      </label>
      <label>
        <span>Navidrome 用户名</span>
        <input value={settings.navidromeUsername} onChange={(event) => onChange("navidromeUsername", event.target.value)} />
      </label>
      <label>
        <span>Navidrome 密码</span>
        <input type="password" value={settings.navidromePassword} onChange={(event) => onChange("navidromePassword", event.target.value)} />
      </label>
      <label>
        <span>最多保留任务</span>
        <input type="number" min="1" max="500" value={settings.maxJobs} onChange={(event) => onChange("maxJobs", Number(event.target.value))} />
      </label>
      <button className="button" type="submit">保存设置</button>
      {message && <div className="settings-message">{message}</div>}
    </form>
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
          <SyncStatus job={job} />
          <IngestionDetails job={job} />
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

function IngestionDetails({ job }: { job: DownloadJob }) {
  if (job.status === "running") return null;

  const ingestion = job.ingestion;
  if (job.status === "done" && !ingestion) {
    return (
      <div className="ingestion-details muted">
        <strong>入库记录</strong>
        <span>旧任务没有入库文件记录。新下载任务会记录最终文件和源站信息。</span>
      </div>
    );
  }

  if (!ingestion) return null;

  return (
    <div className="ingestion-details">
      <strong>入库记录</strong>
      <div className="ingestion-grid">
        <IngestionField label="标题" value={ingestion.title || "未识别"} />
        <IngestionField label="来源" value={formatSource(ingestion)} />
        <IngestionField label="文件" value={ingestion.relativeOutputPath || ingestion.outputPath || "未识别"} />
        <IngestionField label="元数据" value={ingestion.infoJsonPath || "未生成"} />
      </div>
    </div>
  );
}

function IngestionField({ label, value }: { label: string; value: string }) {
  return (
    <div className="ingestion-field">
      <span>{label}</span>
      <div>{value}</div>
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

function formatSource(ingestion: NonNullable<DownloadJob["ingestion"]>) {
  const site = ingestion.sourceSite || "Unknown";
  const uploader = ingestion.uploader ? ` · ${ingestion.uploader}` : "";
  return `${site}${uploader}`;
}
