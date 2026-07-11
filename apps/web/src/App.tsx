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
  Playlist,
  RuntimeStatus,
  UserAccount
} from "@myusic/shared";
import {
  ApiError,
  ApiConnectionError,
  cancelDownloadJob,
  changePassword as changePasswordApi,
  clearBilibiliCookie as clearBilibiliCookieApi,
  clearDownloadJobs,
  createPlaylist as createPlaylistApi,
  createDownload,
  createUser as createUserApi,
  addPlaylistItem as addPlaylistItemApi,
  deleteDownloadJob,
  deleteNavidromeSong as deleteNavidromeSongApi,
  deletePlaylist as deletePlaylistApi,
  getAuthStatus,
  getBilibiliCookieStatus,
  getDiagnostics,
  getHealth,
  getIngestions,
  getJobs,
  getNavidromeSongs,
  getPlaylists,
  getSettings,
  getUsers,
  login as loginApi,
  logout as logoutApi,
  logoutAllDevices as logoutAllDevicesApi,
  rematchIngestion as rematchIngestionApi,
  removePlaylistItem as removePlaylistItemApi,
  retryDownloadJob,
  saveBilibiliCookie as saveBilibiliCookieApi,
  saveSettings as saveSettingsApi,
  updatePlaylist as updatePlaylistApi,
  initializeAdmin as initializeAdminApi,
  syncUserNavidrome as syncUserNavidromeApi
} from "./api/client";
import { AgentPanel } from "./components/AgentPanel";
import { AuthPanel } from "./components/AuthPanel";
import { CabinetPage } from "./components/CabinetPage";
import { ComputerPage } from "./components/ComputerPage";
import type { ComputerView } from "./components/ComputerPage";
import { DownloadPanel } from "./components/DownloadPanel";
import { IngestionPanel } from "./components/IngestionPanel";
import { ManagedPage } from "./components/ManagedPage";
import { coverUrl, type PlayerTrack } from "./components/playerTypes";
import { PlaylistPage } from "./components/PlaylistPage";
import { RoomPage } from "./components/RoomPage";
import { SettingsPanel } from "./components/SettingsPanel";
import { StatusPanel } from "./components/StatusPanel";
import { TurntablePage } from "./components/TurntablePage";
import type { AppView } from "./components/TurntablePage";

type ManagedView = Exclude<AppView, "player">;
type RoomView = "room" | "table" | "cabinet" | "computer" | "playlists";

async function verifySession() {
  const auth = await getAuthStatus();
  if (!auth.authenticated) {
    throw new ApiConnectionError("登录请求已返回，但浏览器没有保存会话 Cookie。请确认当前页面和 API 同源，并检查 MYUSIC_AUTH_SECURE_COOKIE。");
  }
}

export function App() {
  const [roomView, setRoomView] = useState<RoomView>("room");
  const [activeView, setActiveView] = useState<AppView>("player");
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [authStatus, setAuthStatus] = useState<AuthStatus | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [frontendPreview, setFrontendPreview] = useState(false);
  const [status, setStatus] = useState<RuntimeStatus | null>(null);
  const [jobs, setJobs] = useState<DownloadJob[]>([]);
  const [ingestions, setIngestions] = useState<IngestionRecord[]>([]);
  const [navidromeSongs, setNavidromeSongs] = useState<NavidromeSong[]>([]);
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [selectedPlaylistId, setSelectedPlaylistId] = useState("");
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [users, setUsers] = useState<UserAccount[]>([]);
  const [diagnostics, setDiagnostics] = useState<DiagnosticsReport | null>(null);
  const [cookieStatus, setCookieStatus] = useState<CookieFileStatus | null>(null);
  const [turntableSongs, setTurntableSongs] = useState<NavidromeSong[]>([]);
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
  const [newUserUsername, setNewUserUsername] = useState("");
  const [newUserPassword, setNewUserPassword] = useState("");
  const [newUserRole, setNewUserRole] = useState<UserAccount["role"]>("member");
  const [userMessage, setUserMessage] = useState("");
  const [userSaving, setUserSaving] = useState(false);
  const [navidromeUsernames, setNavidromeUsernames] = useState<Record<string, string>>({});
  const [navidromePasswords, setNavidromePasswords] = useState<Record<string, string>>({});
  const [syncingNavidromeUserId, setSyncingNavidromeUserId] = useState("");
  const [ingestionMessage, setIngestionMessage] = useState("");
  const [rematchingIngestionId, setRematchingIngestionId] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const activeViewRef = useRef<AppView>("player");
  const roomViewRef = useRef<RoomView>("room");
  const authStatusRef = useRef<AuthStatus | null>(null);
  const frontendPreviewRef = useRef(false);
  const nowPlaying = queueIndex >= 0 ? queue[queueIndex] : null;
  const previousTrack = queueIndex > 0 ? queue[queueIndex - 1] : null;
  const nextTrack = queueIndex >= 0 && queueIndex < queue.length - 1 ? queue[queueIndex + 1] : null;

  useEffect(() => {
    activeViewRef.current = activeView;
  }, [activeView]);

  useEffect(() => {
    roomViewRef.current = roomView;
  }, [roomView]);

  useEffect(() => {
    authStatusRef.current = authStatus;
  }, [authStatus]);

  useEffect(() => {
    frontendPreviewRef.current = frontendPreview;
  }, [frontendPreview]);

  useEffect(() => {
    void boot();

    const onFocus = () => {
      const auth = authStatusRef.current;
      if (auth?.enabled && !auth.authenticated) return;
      const admin = isAdmin(auth);
      if (admin && (activeViewRef.current === "settings" || activeViewRef.current === "collect")) void loadStatus();
      if (admin && (activeViewRef.current === "settings" || activeViewRef.current === "collect")) void loadDiagnostics();
      if (admin && activeViewRef.current === "settings") void loadBilibiliCookieStatus();
      if (activeViewRef.current === "player") void loadNavidromeSongs();
      if (activeViewRef.current === "ingestions") void loadIngestions();
      if (roomViewRef.current === "playlists") void loadPlaylists();
    };

    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, []);

  useEffect(() => {
    if (!authStatus || (authStatus.enabled && !authStatus.authenticated)) return;
    if (activeView === "player") void loadNavidromeSongs();
    if (activeView === "settings") {
      if (isAdmin(authStatus)) {
        void loadStatus();
        void loadSettings();
        void loadUsers();
        void loadDiagnostics();
        void loadBilibiliCookieStatus();
      }
    }
    if (activeView === "collect") {
      void loadJobs();
      if (isAdmin(authStatus)) {
        void loadStatus();
        void loadDiagnostics();
      }
    }
    if (activeView === "ingestions") void loadIngestions();
  }, [activeView, authStatus]);

  useEffect(() => {
    if (!authStatus || (authStatus.enabled && !authStatus.authenticated)) return;
    if (roomView === "cabinet" || roomView === "playlists" || roomView === "table") void loadNavidromeSongs();
    if (roomView === "playlists") void loadPlaylists();
  }, [roomView, authStatus]);

  useEffect(() => {
    if (activeView !== "collect") return;
    if (!authStatus || (authStatus.enabled && !authStatus.authenticated)) return;
    if (frontendPreview) return;

    const events = new EventSource("/api/jobs/events");
    events.addEventListener("jobs", (event) => {
      setJobs(JSON.parse(event.data));
    });
    events.onerror = () => {
      void loadJobs();
    };

    return () => events.close();
  }, [activeView, authStatus, frontendPreview]);

  async function boot() {
    setAuthLoading(true);
    setError("");
    await getAuthStatus()
      .then(async (auth) => {
        setAuthStatus(auth);
        if (!auth.enabled || auth.authenticated) {
          await loadInitialData(auth);
        }
      })
      .catch((caught) => {
        if (canUseFrontendPreview(caught)) {
          enterFrontendPreview();
          return;
        }
        setError(errorMessage(caught));
      })
      .finally(() => setAuthLoading(false));
  }

  async function loadInitialData(auth: AuthStatus) {
    if (frontendPreviewRef.current) {
      hydrateFrontendPreviewData();
      return;
    }

    const tasks: Array<Promise<void>> = [
      loadStatus(),
      loadJobs(),
      loadIngestions(),
      loadPlaylists()
    ];
    if (isAdmin(auth)) {
      tasks.push(loadDiagnostics(), loadBilibiliCookieStatus());
    }
    await Promise.all(tasks);
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
    if (frontendPreviewRef.current) {
      enterFrontendPreview();
      return;
    }

    setStatus(null);
    setJobs([]);
    setIngestions([]);
    setNavidromeSongs([]);
    setPlaylists([]);
    setSelectedPlaylistId("");
    setSettings(null);
    setUsers([]);
    setDiagnostics(null);
    setCookieStatus(null);
    setTurntableSongs([]);
    setQueue([]);
    setQueueIndex(-1);
    setCurrentPassword("");
    setNewPassword("");
    setPasswordMessage("");
    setNewUserUsername("");
    setNewUserPassword("");
    setNewUserRole("member");
    setUserMessage("");
    setNavidromePasswords({});
    setSyncingNavidromeUserId("");
    setAuthStatus(await getAuthStatus());
  }

  async function handleAuthApiError(caught: unknown, setMessage?: (message: string) => void) {
    if (!(caught instanceof ApiError)) return false;

    if (caught.status === 401) {
      await resetAfterLogout();
      setMessage?.("登录已失效，请重新登录。");
      return true;
    }

    if (caught.status === 403) {
      setMessage?.("当前账号没有管理员权限。");
      return true;
    }

    return false;
  }

  async function loadStatus() {
    if (frontendPreviewRef.current) {
      setStatus(createPreviewStatus());
      return;
    }

    await getHealth()
      .then(setStatus)
      .catch(async (caught) => {
        if (await handleAuthApiError(caught, setError)) return;
        setError(errorMessage(caught));
      });
  }

  async function loadJobs() {
    if (frontendPreviewRef.current) {
      setJobs([]);
      return;
    }

    await getJobs()
      .then(setJobs)
      .catch(async (caught) => {
        if (await handleAuthApiError(caught, setError)) return;
        setError(errorMessage(caught));
      });
  }

  async function loadIngestions() {
    if (frontendPreviewRef.current) {
      setIngestions([]);
      return;
    }

    await getIngestions()
      .then(setIngestions)
      .catch(async (caught) => {
        if (await handleAuthApiError(caught, setIngestionMessage)) return;
        setIngestionMessage(errorMessage(caught));
      });
  }

  async function loadSettings() {
    if (frontendPreviewRef.current) {
      setSettings(createPreviewSettings());
      return;
    }

    await getSettings()
      .then(setSettings)
      .catch(async (caught) => {
        if (await handleAuthApiError(caught, setSettingsMessage)) return;
        setSettingsMessage(errorMessage(caught));
      });
  }

  async function loadUsers() {
    if (frontendPreviewRef.current) {
      setUsers([]);
      return;
    }

    const auth = authStatusRef.current;
    if (auth?.enabled && auth.user?.role !== "admin") {
      setUsers([]);
      return;
    }

    await getUsers()
      .then(setUsers)
      .catch(async (caught) => {
        if (await handleAuthApiError(caught, setUserMessage)) return;
        setUserMessage(errorMessage(caught));
      });
  }

  async function loadDiagnostics() {
    if (frontendPreviewRef.current) {
      setDiagnostics(createPreviewDiagnostics());
      return;
    }

    await getDiagnostics()
      .then(setDiagnostics)
      .catch(async (caught) => {
        if (await handleAuthApiError(caught, setSettingsMessage)) return;
        setSettingsMessage(errorMessage(caught));
      });
  }

  async function loadBilibiliCookieStatus() {
    if (frontendPreviewRef.current) {
      setCookieStatus(createPreviewCookieStatus());
      return;
    }

    await getBilibiliCookieStatus()
      .then(setCookieStatus)
      .catch(async (caught) => {
        if (await handleAuthApiError(caught, setBilibiliCookieMessage)) return;
        setBilibiliCookieMessage(errorMessage(caught));
      });
  }

  async function loadNavidromeSongs() {
    if (frontendPreviewRef.current) {
      setNavidromeSongs([]);
      return;
    }

    await getNavidromeSongs("")
      .then((body) => setNavidromeSongs(body.songs))
      .catch((caught) => {
        setNavidromeSongs([]);
      });
  }

  async function loadPlaylists() {
    if (frontendPreviewRef.current) {
      setPlaylists([]);
      return;
    }

    await getPlaylists()
      .then((nextPlaylists) => {
        setPlaylists(nextPlaylists);
        setSelectedPlaylistId((current) => {
          if (current && nextPlaylists.some((playlist) => playlist.id === current)) return current;
          return nextPlaylists[0]?.id || "";
        });
      })
      .catch(async (caught) => {
        await handleAuthApiError(caught);
      });
  }

  async function submitDownload(event: FormEvent) {
    event.preventDefault();
    const mediaUrl = url.trim();
    if (!mediaUrl) return;

    if (frontendPreviewRef.current) {
      setError("前端预览模式不会创建真实下载任务。启动完整服务后可测试下载链路。");
      return;
    }

    setSubmitting(true);
    setError("");
    setDuplicateIngestion(null);

    await createDownload(mediaUrl)
      .then(async (result) => {
        if (!result.ok) {
          if (isAdmin(authStatusRef.current)) await loadDiagnostics().catch(() => undefined);
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
    if (frontendPreviewRef.current) return;

    await cancelDownloadJob(id);
    await loadJobs();
  }

  async function retryJob(id: string) {
    if (frontendPreviewRef.current) return;

    await retryDownloadJob(id);
    await loadJobs();
  }

  async function clearJobs() {
    if (frontendPreviewRef.current) {
      setJobs([]);
      return;
    }

    setJobs(await clearDownloadJobs());
  }

  async function deleteJob(id: string) {
    if (frontendPreviewRef.current) return;

    setJobs(await deleteDownloadJob(id));
  }

  async function rematchIngestion(id: string) {
    if (frontendPreviewRef.current) {
      setIngestionMessage("前端预览模式不会重新匹配音乐库。");
      return;
    }

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
    if (frontendPreviewRef.current) {
      setSettingsMessage("前端预览模式不会保存设置。");
      return;
    }

    const body = await saveSettingsApi(settings);
    setSettings(body.settings);
    await Promise.all([
      loadStatus(),
      loadDiagnostics(),
      loadBilibiliCookieStatus()
    ]);
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
    if (frontendPreviewRef.current) {
      setBilibiliCookieMessage("前端预览模式不会保存 Cookie。");
      setBilibiliCookieSaving(false);
      return;
    }

    await saveBilibiliCookieApi(content)
      .then(async (body) => {
        setSettings(body.settings);
        setBilibiliCookieText("");
        setBilibiliCookieMessage(`\u5df2\u4fdd\u5b58\u5230\uff1a${body.path}`);
        await Promise.all([
          loadStatus(),
          loadDiagnostics(),
          loadBilibiliCookieStatus()
        ]);
      })
      .catch((caught) => setBilibiliCookieMessage(errorMessage(caught)))
      .finally(() => setBilibiliCookieSaving(false));
  }

  async function clearBilibiliCookie() {
    setBilibiliCookieSaving(true);
    setBilibiliCookieMessage("");
    if (frontendPreviewRef.current) {
      setBilibiliCookieMessage("前端预览模式不会清空 Cookie。");
      setBilibiliCookieSaving(false);
      return;
    }

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
    if (frontendPreviewRef.current) {
      setPasswordMessage("前端预览模式未连接账号服务。");
      return;
    }

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

  async function createUser(event: FormEvent) {
    event.preventDefault();
    setUserMessage("");
    const username = newUserUsername.trim();
    if (!username || !newUserPassword) {
      setUserMessage("请填写用户名和初始密码。");
      return;
    }

    if (frontendPreviewRef.current) {
      setUserMessage("前端预览模式未连接账号服务。");
      return;
    }

    setUserSaving(true);
    await createUserApi(username, newUserPassword, newUserRole)
      .then(async (user) => {
        setNewUserUsername("");
        setNewUserPassword("");
        setNewUserRole("member");
        setUserMessage(`已创建账号：${user.username}`);
        await loadUsers();
      })
      .catch(async (caught) => {
        if (await handleAuthApiError(caught, setUserMessage)) return;
        setUserMessage(errorMessage(caught));
      })
      .finally(() => setUserSaving(false));
  }

  async function syncUserNavidrome(userId: string) {
    setUserMessage("");
    const targetUser = users.find((user) => user.id === userId);
    const navidromeUsername = (navidromeUsernames[userId] ?? targetUser?.navidromeUsername ?? targetUser?.username ?? "").trim();
    const password = navidromePasswords[userId] || "";
    if (!navidromeUsername) {
      setUserMessage("请填写 Navidrome 用户名。");
      return;
    }

    if (frontendPreviewRef.current) {
      setUserMessage("前端预览模式未连接账号服务。");
      return;
    }

    setSyncingNavidromeUserId(userId);
    await syncUserNavidromeApi(userId, navidromeUsername, password)
      .then(async (user) => {
        setNavidromePasswords((current) => ({ ...current, [userId]: "" }));
        setNavidromeUsernames((current) => ({ ...current, [userId]: user.navidromeUsername || navidromeUsername }));
        setUserMessage(user.navidromeSyncError ? `移动端配置失败：${user.navidromeSyncError}` : `已绑定 Navidrome 账号：${user.navidromeUsername || navidromeUsername}`);
        await loadUsers();
      })
      .catch(async (caught) => {
        if (await handleAuthApiError(caught, setUserMessage)) return;
        setUserMessage(errorMessage(caught));
      })
      .finally(() => setSyncingNavidromeUserId(""));
  }

  function updateSetting<K extends keyof AppSettings>(key: K, value: AppSettings[K]) {
    setSettings((current) => current ? { ...current, [key]: value } : current);
  }

  function playFromCabinet(song: NavidromeSong) {
    const index = navidromeSongs.findIndex((item) => item.id === song.id);
    const nextTurntableSongs = index >= 0
      ? navidromeSongs.slice(index).concat(navidromeSongs.slice(0, index))
      : [song];
    setTurntableSongs(nextTurntableSongs);
    setQueue(nextTurntableSongs.map(navidromePlayerTrack));
    setQueueIndex(0);
  }

  function playFromPlaylist(song: NavidromeSong) {
    const index = turntableSongs.findIndex((item) => item.id === song.id);
    if (index >= 0) setQueueIndex(index);
  }

  function playPlaylist(playlist: Playlist, songId: string) {
    const songById = new Map(navidromeSongs.map((song) => [song.id, song]));
    const nextTurntableSongs = playlist.items.map((item) => songById.get(item.songId)).filter(Boolean) as NavidromeSong[];
    const index = nextTurntableSongs.findIndex((song) => song.id === songId);
    if (index < 0) return;
    setTurntableSongs(nextTurntableSongs);
    setQueue(nextTurntableSongs.map(navidromePlayerTrack));
    setQueueIndex(index);
    setActiveView("player");
    setRoomView("table");
  }

  function playPrevious() {
    setQueueIndex((current) => current > 0 ? current - 1 : current);
  }

  function playNext() {
    setQueueIndex((current) => current >= 0 && current < queue.length - 1 ? current + 1 : current);
  }

  async function createPlaylist(name: string) {
    if (frontendPreviewRef.current) return;

    await createPlaylistApi(name || undefined)
      .then((playlist) => {
        setPlaylists((current) => [...current, playlist]);
        setSelectedPlaylistId(playlist.id);
      })
      .catch(async (caught) => {
        await handleAuthApiError(caught);
      });
  }

  async function renamePlaylist(playlistId: string, name: string) {
    if (frontendPreviewRef.current) return;

    await updatePlaylistApi(playlistId, { name })
      .then(updatePlaylistInState)
      .catch(async (caught) => {
        await handleAuthApiError(caught);
      });
  }

  async function deletePlaylist(playlistId: string) {
    if (frontendPreviewRef.current) return;

    await deletePlaylistApi(playlistId)
      .then((nextPlaylists) => {
        setPlaylists(nextPlaylists);
        setSelectedPlaylistId((current) => current === playlistId ? nextPlaylists[0]?.id || "" : current);
      })
      .catch(async (caught) => {
        await handleAuthApiError(caught);
      });
  }

  async function addSongToPlaylist(song: NavidromeSong, playlistId: string) {
    if (frontendPreviewRef.current) return;

    await addPlaylistItemApi(playlistId, song.id)
      .then((playlist) => {
        updatePlaylistInState(playlist);
        setSelectedPlaylistId(playlist.id);
      })
      .catch(async (caught) => {
        await handleAuthApiError(caught);
      });
  }

  async function removePlaylistItem(playlistId: string, itemId: string) {
    if (frontendPreviewRef.current) return;

    await removePlaylistItemApi(playlistId, itemId)
      .then(updatePlaylistInState)
      .catch(async (caught) => {
        await handleAuthApiError(caught);
      });
  }

  async function deleteNavidromeSong(song: NavidromeSong) {
    if (frontendPreviewRef.current) return;

    await deleteNavidromeSongApi(song.id)
      .then(async () => {
        removeSongFromPlayback(song.id);
        setNavidromeSongs((current) => current.filter((item) => item.id !== song.id));
        await loadPlaylists();
      })
      .catch(async (caught) => {
        await handleAuthApiError(caught);
      });
  }

  function updatePlaylistInState(playlist: Playlist) {
    setPlaylists((current) => current.map((item) => item.id === playlist.id ? playlist : item));
  }

  function removeSongFromPlayback(songId: string) {
    const trackKey = `navidrome:${songId}`;
    const removedIndex = queue.findIndex((track) => track.key === trackKey);
    const nextQueue = queue.filter((track) => track.key !== trackKey);
    setTurntableSongs((current) => current.filter((song) => song.id !== songId));
    if (removedIndex === -1) return;

    setQueue(nextQueue);
    setQueueIndex((index) => {
      if (!nextQueue.length) return -1;
      if (index === removedIndex) return Math.min(index, nextQueue.length - 1);
      if (removedIndex < index) return Math.max(0, index - 1);
      return Math.min(index, nextQueue.length - 1);
    });
  }

  function enterFrontendPreview() {
    setFrontendPreview(true);
    setAuthStatus({
      enabled: false,
      setupRequired: false,
      authenticated: true
    });
    hydrateFrontendPreviewData();
  }

  function hydrateFrontendPreviewData() {
    setStatus(createPreviewStatus());
    setJobs([]);
    setIngestions([]);
    setSettings(createPreviewSettings());
    setDiagnostics(createPreviewDiagnostics());
    setCookieStatus(createPreviewCookieStatus());
    setNavidromeSongs([]);
    setPlaylists([]);
    setSelectedPlaylistId("");
    setTurntableSongs([]);
    setQueue([]);
    setQueueIndex(-1);
    setError("");
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

  function openComputerView(view: ComputerView) {
    setRoomView("computer");
    openManagedView(view);
  }

  function closeManagedView() {
    setActiveView("player");
    if (roomView === "computer") setRoomView("room");
  }

  function enterComputer() {
    setRoomView("computer");
    openManagedView("agent");
  }

  function enterPlaylist() {
    setDrawerOpen(false);
    setRoomView("playlists");
  }

  function exitToRoom() {
    setDrawerOpen(false);
    setRoomView("room");
  }

  return (
    <>
      <RoomPage
        active={roomView === "room"}
        onEnterTable={() => setRoomView("table")}
        onEnterCabinet={() => setRoomView("cabinet")}
        onEnterComputer={enterComputer}
        onEnterPlaylist={enterPlaylist}
      />

      <CabinetPage
        active={roomView === "cabinet"}
        songs={navidromeSongs}
        playlists={playlists}
        currentTrackKey={nowPlaying?.key || ""}
        onPlay={playFromCabinet}
        onAddToPlaylist={(song, playlistId) => void addSongToPlaylist(song, playlistId)}
        onCreatePlaylist={(name) => void createPlaylist(name)}
        onRemoveItem={(playlistId, itemId) => void removePlaylistItem(playlistId, itemId)}
        onDeleteSong={(song) => void deleteNavidromeSong(song)}
        onExitToRoom={exitToRoom}
      />

      <PlaylistPage
        active={roomView === "playlists"}
        playlists={playlists}
        songs={navidromeSongs}
        selectedPlaylistId={selectedPlaylistId}
        onSelectPlaylist={setSelectedPlaylistId}
        onCreatePlaylist={(name) => void createPlaylist(name)}
        onRenamePlaylist={(playlistId, name) => void renamePlaylist(playlistId, name)}
        onDeletePlaylist={(playlistId) => void deletePlaylist(playlistId)}
        onPlaySong={playPlaylist}
        onRemoveItem={(playlistId, itemId) => void removePlaylistItem(playlistId, itemId)}
        onExitToRoom={exitToRoom}
      />

      <ComputerPage
        active={roomView === "computer" && activeView !== "player"}
        activeView={activeView === "player" ? "agent" : activeView}
        onNavigate={openComputerView}
        onExitToRoom={closeManagedView}
      >
        {activeView === "collect" && (
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
        )}

        {activeView === "agent" && <AgentPanel preview={frontendPreview} />}

        {activeView === "ingestions" && (
          <IngestionPanel
            ingestions={ingestions}
            message={ingestionMessage}
            rematchingId={rematchingIngestionId}
            onRefresh={loadIngestions}
            onRematch={rematchIngestion}
          />
        )}

        {activeView === "settings" && (
          <SettingsPanel
            settings={settings}
            status={status}
            authStatus={authStatus}
            isAdmin={isAdmin(authStatus)}
            users={users}
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
            newUserUsername={newUserUsername}
            newUserPassword={newUserPassword}
            newUserRole={newUserRole}
            userMessage={userMessage}
            userSaving={userSaving}
            navidromeUsernames={navidromeUsernames}
            navidromePasswords={navidromePasswords}
            syncingNavidromeUserId={syncingNavidromeUserId}
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
            onNewUserUsernameChange={setNewUserUsername}
            onNewUserPasswordChange={setNewUserPassword}
            onNewUserRoleChange={setNewUserRole}
            onCreateUser={createUser}
            onNavidromeUsernameChange={(userId, username) => setNavidromeUsernames((current) => ({ ...current, [userId]: username }))}
            onNavidromePasswordChange={(userId, password) => setNavidromePasswords((current) => ({ ...current, [userId]: password }))}
            onSyncUserNavidrome={(userId) => void syncUserNavidrome(userId)}
          />
        )}
      </ComputerPage>

      <TurntablePage
        active={roomView === "table" && activeView === "player"}
        songs={turntableSongs}
        currentTrack={nowPlaying}
        currentTrackKey={nowPlaying?.key || ""}
        previousTrack={previousTrack}
        nextTrack={nextTrack}
        drawerOpen={drawerOpen}
        onDrawerOpenChange={setDrawerOpen}
        onPlay={playFromPlaylist}
        onExitToRoom={exitToRoom}
        canPrevious={queueIndex > 0}
        canNext={queueIndex >= 0 && queueIndex < queue.length - 1}
        onPrevious={playPrevious}
        onNext={playNext}
        onEnded={playNext}
      />

      {activeView === "collect" && roomView !== "computer" && (
        <ManagedPage title="收集" onBack={closeManagedView}>
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

      {activeView === "agent" && roomView !== "computer" && (
        <ManagedPage title="音乐问答" onBack={closeManagedView}>
          <AgentPanel preview={frontendPreview} />
        </ManagedPage>
      )}

      {activeView === "ingestions" && roomView !== "computer" && (
        <ManagedPage title="入库" onBack={closeManagedView}>
          <IngestionPanel
            ingestions={ingestions}
            message={ingestionMessage}
            rematchingId={rematchingIngestionId}
            onRefresh={loadIngestions}
            onRematch={rematchIngestion}
          />
        </ManagedPage>
      )}

      {activeView === "settings" && roomView !== "computer" && (
        <ManagedPage title="设置" onBack={closeManagedView}>
        <SettingsPanel
          settings={settings}
          status={status}
          authStatus={authStatus}
          isAdmin={isAdmin(authStatus)}
          users={users}
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
          newUserUsername={newUserUsername}
          newUserPassword={newUserPassword}
          newUserRole={newUserRole}
          userMessage={userMessage}
          userSaving={userSaving}
          navidromeUsernames={navidromeUsernames}
          navidromePasswords={navidromePasswords}
          syncingNavidromeUserId={syncingNavidromeUserId}
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
          onNewUserUsernameChange={setNewUserUsername}
          onNewUserPasswordChange={setNewUserPassword}
          onNewUserRoleChange={setNewUserRole}
          onCreateUser={createUser}
          onNavidromeUsernameChange={(userId, username) => setNavidromeUsernames((current) => ({ ...current, [userId]: username }))}
          onNavidromePasswordChange={(userId, password) => setNavidromePasswords((current) => ({ ...current, [userId]: password }))}
          onSyncUserNavidrome={(userId) => void syncUserNavidrome(userId)}
        />
        </ManagedPage>
      )}
    </>
  );
}

function errorMessage(caught: unknown) {
  return caught instanceof Error ? caught.message : "\u64cd\u4f5c\u5931\u8d25";
}

function canUseFrontendPreview(caught: unknown) {
  return isFrontendDevServer() && (
    caught instanceof ApiConnectionError ||
    (caught instanceof ApiError && caught.status === 504)
  );
}

function isFrontendDevServer() {
  const host = window.location.hostname;
  return window.location.port === "3000" && (host === "127.0.0.1" || host === "localhost");
}

function createPreviewStatus(): RuntimeStatus {
  return {
    ok: true,
    collectorUrl: "",
    navidromeUrl: "",
    musicDir: "前端预览模式",
    audioFormat: "mp3",
    cookies: {
      bilibili: {
        path: "",
        exists: false
      }
    },
    tools: {
      ytdlpPath: "",
      ffmpegPath: "",
      ytdlpExists: false,
      ffmpegExists: false
    },
    lan: [],
    requestHost: window.location.host
  };
}

function createPreviewSettings(): AppSettings {
  return {
    musicDir: "",
    ytdlpPath: "",
    ffmpegPath: "",
    audioFormat: "mp3",
    audioQuality: "0",
    bilibiliCookiesPath: "",
    navidromeBaseUrl: "",
    navidromeUsername: "",
    navidromePassword: "",
    maxJobs: 50
  };
}

function isAdmin(auth: AuthStatus | null | undefined) {
  if (!auth?.enabled) return true;
  return auth.authenticated && auth.user?.role === "admin";
}

function createPreviewDiagnostics(): DiagnosticsReport {
  return {
    ok: true,
    checks: [
      {
        id: "frontend-preview",
        label: "前端预览",
        level: "warning",
        message: "当前只运行了 web 开发服务器，后端接口已跳过。"
      }
    ]
  };
}

function createPreviewCookieStatus(): CookieFileStatus {
  return {
    path: "",
    exists: false,
    size: 0
  };
}

function navidromePlayerTrack(song: NavidromeSong): PlayerTrack {
  return {
    key: `navidrome:${song.id}`,
    source: "navidrome",
    title: song.title,
    artist: song.artist || "Unknown",
    album: song.album,
    streamUrl: `/api/navidrome/stream/${encodeURIComponent(song.id)}`,
    coverUrl: coverUrl(song)
  };
}
