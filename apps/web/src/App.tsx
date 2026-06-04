import { useEffect, useRef, useState } from "react";
import type { FormEvent } from "react";
import type {
  AppSettings,
  AuthStatus,
  CookieFileStatus,
  DiagnosticsReport,
  DownloadJob,
  IngestionRecord,
  NavidromeSong,
  RuntimeStatus
} from "@myusic/shared";
import {
  ApiConnectionError,
  cancelDownloadJob,
  changePassword as changePasswordApi,
  clearBilibiliCookie as clearBilibiliCookieApi,
  clearDownloadJobs,
  createDownload,
  deleteDownloadJob,
  getAuthStatus,
  getBilibiliCookieStatus,
  getDiagnostics,
  getHealth,
  getIngestions,
  getJobs,
  getNavidromeSongs,
  getSettings,
  login as loginApi,
  logout as logoutApi,
  logoutAllDevices as logoutAllDevicesApi,
  rematchIngestion as rematchIngestionApi,
  retryDownloadJob,
  saveBilibiliCookie as saveBilibiliCookieApi,
  saveSettings as saveSettingsApi,
  initializeAdmin as initializeAdminApi
} from "./api/client";
import { AuthPanel } from "./components/AuthPanel";
import { DownloadPanel } from "./components/DownloadPanel";
import { IngestionPanel } from "./components/IngestionPanel";
import { ManagedPage } from "./components/ManagedPage";
import type { PlayerTrack } from "./components/playerTypes";
import { SettingsPanel } from "./components/SettingsPanel";
import { StatusPanel } from "./components/StatusPanel";
import { TurntablePage } from "./components/TurntablePage";
import type { AppView } from "./components/TurntablePage";

type ManagedView = Exclude<AppView, "player">;

export function App() {
  const [activeView, setActiveView] = useState<AppView>("player");
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [authStatus, setAuthStatus] = useState<AuthStatus | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [status, setStatus] = useState<RuntimeStatus | null>(null);
  const [jobs, setJobs] = useState<DownloadJob[]>([]);
  const [ingestions, setIngestions] = useState<IngestionRecord[]>([]);
  const [navidromeSongs, setNavidromeSongs] = useState<NavidromeSong[]>([]);
  const [navidromeError, setNavidromeError] = useState("");
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [diagnostics, setDiagnostics] = useState<DiagnosticsReport | null>(null);
  const [cookieStatus, setCookieStatus] = useState<CookieFileStatus | null>(null);
  const [queue, setQueue] = useState<PlayerTrack[]>([]);
  const [queueIndex, setQueueIndex] = useState(-1);
  const [url, setUrl] = useState("");
  const [error, setError] = useState("");
  const [duplicateIngestion, setDuplicateIngestion] = useState<IngestionRecord | null>(null);
  const [settingsMessage, setSettingsMessage] = useState("");
  const [bilibiliCookieText, setBilibiliCookieText] = useState("");
  const [bilibiliCookieMessage, setBilibiliCookieMessage] = useState("");
  const [bilibiliCookieSaving, setBilibiliCookieSaving] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [passwordMessage, setPasswordMessage] = useState("");
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [ingestionMessage, setIngestionMessage] = useState("");
  const [rematchingIngestionId, setRematchingIngestionId] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const activeViewRef = useRef<AppView>("player");
  const authStatusRef = useRef<AuthStatus | null>(null);
  const nowPlaying = queueIndex >= 0 ? queue[queueIndex] : null;
  const previousTrack = queueIndex > 0 ? queue[queueIndex - 1] : null;
  const nextTrack = queueIndex >= 0 && queueIndex < queue.length - 1 ? queue[queueIndex + 1] : null;

  useEffect(() => {
    activeViewRef.current = activeView;
  }, [activeView]);

  useEffect(() => {
    authStatusRef.current = authStatus;
  }, [authStatus]);

  useEffect(() => {
    void boot();

    const onFocus = () => {
      const auth = authStatusRef.current;
      if (auth?.enabled && !auth.authenticated) return;
      if (activeViewRef.current === "settings" || activeViewRef.current === "collect") void loadStatus();
      if (activeViewRef.current === "settings" || activeViewRef.current === "collect") void loadDiagnostics();
      if (activeViewRef.current === "settings") void loadBilibiliCookieStatus();
      if (activeViewRef.current === "player") void loadNavidromeSongs();
      if (activeViewRef.current === "ingestions") void loadIngestions();
    };

    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, []);

  useEffect(() => {
    if (!authStatus || (authStatus.enabled && !authStatus.authenticated)) return;
    if (activeView === "player") void loadNavidromeSongs();
    if (activeView === "settings") {
      void loadStatus();
      void loadSettings();
      void loadDiagnostics();
      void loadBilibiliCookieStatus();
    }
    if (activeView === "collect") {
      void loadStatus();
      void loadJobs();
      void loadDiagnostics();
    }
    if (activeView === "ingestions") void loadIngestions();
  }, [activeView, authStatus]);

  useEffect(() => {
    if (activeView !== "collect") return;
    if (!authStatus || (authStatus.enabled && !authStatus.authenticated)) return;

    const events = new EventSource("/api/jobs/events");
    events.addEventListener("jobs", (event) => {
      setJobs(JSON.parse(event.data));
    });
    events.onerror = () => {
      void loadJobs();
    };

    return () => events.close();
  }, [activeView, authStatus]);

  async function boot() {
    setAuthLoading(true);
    setError("");
    await getAuthStatus()
      .then(async (auth) => {
        setAuthStatus(auth);
        if (!auth.enabled || auth.authenticated) {
          await loadInitialData();
        }
      })
      .catch((caught) => {
        setError(errorMessage(caught));
      })
      .finally(() => setAuthLoading(false));
  }

  async function loadInitialData() {
    await Promise.all([
      loadStatus(),
      loadJobs(),
      loadIngestions(),
      loadDiagnostics(),
      loadBilibiliCookieStatus()
    ]);
  }

  async function initializeAdmin(username: string, password: string) {
    await initializeAdminApi(username, password);
    await verifySession();
    await boot();
  }

  async function login(username: string, password: string) {
    await loginApi(username, password);
    await verifySession();
    await boot();
  }

  async function logout() {
    await logoutApi();
    await resetAfterLogout();
  }

  async function logoutAllDevices() {
    await logoutAllDevicesApi();
    await resetAfterLogout();
  }

  async function resetAfterLogout() {
    setStatus(null);
    setJobs([]);
    setIngestions([]);
    setNavidromeSongs([]);
    setSettings(null);
    setDiagnostics(null);
    setCookieStatus(null);
    setQueue([]);
    setQueueIndex(-1);
    setCurrentPassword("");
    setNewPassword("");
    setPasswordMessage("");
    setAuthStatus(await getAuthStatus());
  }

  async function verifySession() {
    const auth = await getAuthStatus();
    if (!auth.authenticated) {
      throw new ApiConnectionError("登录请求已返回，但浏览器没有保存会话 Cookie。请确认当前页面和 API 同源，并检查 MYUSIC_AUTH_SECURE_COOKIE。");
    }
  }

  async function loadStatus() {
    setStatus(await getHealth());
  }

  async function loadJobs() {
    setJobs(await getJobs());
  }

  async function loadIngestions() {
    setIngestions(await getIngestions());
  }

  async function loadSettings() {
    setSettings(await getSettings());
  }

  async function loadDiagnostics() {
    setDiagnostics(await getDiagnostics());
  }

  async function loadBilibiliCookieStatus() {
    setCookieStatus(await getBilibiliCookieStatus());
  }

  async function loadNavidromeSongs() {
    setNavidromeError("");
    await getNavidromeSongs("")
      .then((body) => setNavidromeSongs(body.songs))
      .catch((caught) => {
        setNavidromeSongs([]);
        setNavidromeError(errorMessage(caught));
      });
  }

  async function submitDownload(event: FormEvent) {
    event.preventDefault();
    const mediaUrl = url.trim();
    if (!mediaUrl) return;

    setSubmitting(true);
    setError("");
    setDuplicateIngestion(null);

    await createDownload(mediaUrl)
      .then(async (result) => {
        if (!result.ok) {
          await loadDiagnostics();
          if (result.body.code === "DUPLICATE_INGESTION" && result.body.ingestion) {
            setDuplicateIngestion(result.body.ingestion);
          }
          throw new Error(result.body.error || "Download failed.");
        }
        setUrl("");
        await loadJobs();
        await loadNavidromeSongs();
      })
      .catch((caught) => setError(errorMessage(caught)))
      .finally(() => setSubmitting(false));
  }

  async function cancelJob(id: string) {
    await cancelDownloadJob(id);
    await loadJobs();
  }

  async function retryJob(id: string) {
    await retryDownloadJob(id);
    await loadJobs();
  }

  async function clearJobs() {
    setJobs(await clearDownloadJobs());
  }

  async function deleteJob(id: string) {
    setJobs(await deleteDownloadJob(id));
  }

  async function rematchIngestion(id: string) {
    setIngestionMessage("");
    setRematchingIngestionId(id);
    await rematchIngestionApi(id)
      .then(async (body) => {
        await loadIngestions();
        await loadJobs();
        setIngestionMessage(body.matched ? "\u5df2\u91cd\u65b0\u5339\u914d Navidrome ID\u3002" : "\u672a\u627e\u5230\u5339\u914d\u7684 Navidrome \u6b4c\u66f2\u3002");
      })
      .catch((caught) => setIngestionMessage(errorMessage(caught)))
      .finally(() => setRematchingIngestionId(""));
  }

  async function saveSettings(event: FormEvent) {
    event.preventDefault();
    if (!settings) return;

    setSettingsMessage("");
    const body = await saveSettingsApi(settings);
    setSettings(body.settings);
    await loadStatus();
    await loadDiagnostics();
    await loadBilibiliCookieStatus();
    setSettingsMessage(body.restartRequired ? `已保存，需要重启：${body.restartReasons.join("；")}` : "已保存");
  }

  async function loadBilibiliCookieFile(file: File | undefined) {
    if (!file) return;
    setBilibiliCookieText(await file.text());
    setBilibiliCookieMessage(`已读取：${file.name}`);
  }

  async function saveBilibiliCookie(event: FormEvent) {
    event.preventDefault();
    const content = bilibiliCookieText.trim();
    if (!content) {
      setBilibiliCookieMessage("\u8bf7\u5148\u4e0a\u4f20\u6216\u7c98\u8d34 cookies.txt \u5185\u5bb9\u3002");
      return;
    }

    setBilibiliCookieSaving(true);
    setBilibiliCookieMessage("");
    await saveBilibiliCookieApi(content)
      .then(async (body) => {
        setSettings(body.settings);
        setBilibiliCookieText("");
        setBilibiliCookieMessage(`\u5df2\u4fdd\u5b58\u5230\uff1a${body.path}`);
        await loadStatus();
        await loadDiagnostics();
        await loadBilibiliCookieStatus();
      })
      .catch((caught) => setBilibiliCookieMessage(errorMessage(caught)))
      .finally(() => setBilibiliCookieSaving(false));
  }

  async function clearBilibiliCookie() {
    setBilibiliCookieSaving(true);
    setBilibiliCookieMessage("");
    await clearBilibiliCookieApi()
      .then(async (nextStatus) => {
        setCookieStatus(nextStatus);
        setBilibiliCookieText("");
        setBilibiliCookieMessage("Cookie \u5df2\u6e05\u7a7a\u3002");
        await loadStatus();
        await loadDiagnostics();
      })
      .catch((caught) => setBilibiliCookieMessage(errorMessage(caught)))
      .finally(() => setBilibiliCookieSaving(false));
  }

  async function changePassword(event: FormEvent) {
    event.preventDefault();
    setPasswordMessage("");
    setPasswordSaving(true);
    await changePasswordApi(currentPassword, newPassword)
      .then(() => {
        setCurrentPassword("");
        setNewPassword("");
        setPasswordMessage("\u5bc6\u7801\u5df2\u66f4\u65b0\u3002");
      })
      .catch((caught) => setPasswordMessage(errorMessage(caught)))
      .finally(() => setPasswordSaving(false));
  }

  function updateSetting<K extends keyof AppSettings>(key: K, value: AppSettings[K]) {
    setSettings((current) => current ? { ...current, [key]: value } : current);
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

  if (authLoading || !authStatus) {
    return (
      <main className="auth-page">
        <div className="auth-card">
          <h1>MYusic</h1>
          {error && <div className="error">{error}</div>}
          <p>{error ? "无法连接登录服务" : "正在检查登录状态..."}</p>
        </div>
      </main>
    );
  }

  if (authStatus.enabled && !authStatus.authenticated) {
    return <AuthPanel status={authStatus} onInitializeAdmin={initializeAdmin} onLogin={login} />;
  }

  function openManagedView(view: ManagedView) {
    setDrawerOpen(false);
    setActiveView(view);
  }

  return (
    <>
      <TurntablePage
        active={activeView === "player"}
        songs={navidromeSongs}
        error={navidromeError}
        currentTrack={nowPlaying}
        currentTrackKey={nowPlaying?.key || ""}
        previousTrack={previousTrack}
        nextTrack={nextTrack}
        drawerOpen={drawerOpen}
        onDrawerOpenChange={setDrawerOpen}
        onRefresh={() => loadNavidromeSongs()}
        onPlay={playSong}
        onNavigate={openManagedView}
        canPrevious={queueIndex > 0}
        canNext={queueIndex >= 0 && queueIndex < queue.length - 1}
        onPrevious={playPrevious}
        onNext={playNext}
        onEnded={playNext}
      />

      {activeView === "collect" && (
        <ManagedPage title="收集" onBack={() => setActiveView("player")}>
          <DownloadPanel
            jobs={jobs}
            url={url}
            error={error}
            submitting={submitting}
            duplicateIngestion={duplicateIngestion}
            onUrlChange={setUrl}
            onSubmit={submitDownload}
            onClearJobs={clearJobs}
            onCancelJob={cancelJob}
            onDeleteJob={deleteJob}
            onRetryJob={retryJob}
            onOpenIngestions={() => {
              setDuplicateIngestion(null);
              setError("");
              setActiveView("ingestions");
            }}
            onDismissDuplicate={() => {
              setDuplicateIngestion(null);
              setError("");
            }}
          />
        </ManagedPage>
      )}

      {activeView === "ingestions" && (
        <ManagedPage title="入库" onBack={() => setActiveView("player")}>
          <IngestionPanel
            ingestions={ingestions}
            message={ingestionMessage}
            rematchingId={rematchingIngestionId}
            onRefresh={loadIngestions}
            onRematch={rematchIngestion}
          />
        </ManagedPage>
      )}

      {activeView === "settings" && (
        <ManagedPage title="设置" onBack={() => setActiveView("player")}>
        <SettingsPanel
          settings={settings}
          status={status}
          authStatus={authStatus}
          cookieStatus={cookieStatus}
          diagnostics={diagnostics}
          settingsMessage={settingsMessage}
          bilibiliCookieText={bilibiliCookieText}
          bilibiliCookieMessage={bilibiliCookieMessage}
          bilibiliCookieSaving={bilibiliCookieSaving}
          currentPassword={currentPassword}
          newPassword={newPassword}
          passwordMessage={passwordMessage}
          passwordSaving={passwordSaving}
          onSettingsChange={updateSetting}
          onSettingsSubmit={saveSettings}
          onCookieContentChange={setBilibiliCookieText}
          onCookieFileLoad={loadBilibiliCookieFile}
          onCookieSubmit={saveBilibiliCookie}
          onCookieClear={() => void clearBilibiliCookie()}
          onCurrentPasswordChange={setCurrentPassword}
          onNewPasswordChange={setNewPassword}
          onPasswordSubmit={changePassword}
          onLogoutAllDevices={() => void logoutAllDevices()}
        />
        </ManagedPage>
      )}
    </>
  );
}

function errorMessage(caught: unknown) {
  return caught instanceof Error ? caught.message : "\u64cd\u4f5c\u5931\u8d25";
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
