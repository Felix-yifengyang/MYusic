import type {
  AppSettings,
  AuthLoginResult,
  AuthStatus,
  BilibiliCookieSaveResult,
  CookieFileStatus,
  DiagnosticsReport,
  DownloadJob,
  IngestionRecord,
  NavidromeSongsResult,
  Playlist,
  RuntimeStatus,
  UserAccount
} from "@myusic/shared";

export type AgentChatRole = "system" | "user" | "assistant";

export interface AgentChatMessage {
  role: AgentChatRole;
  content: string;
}

export interface AgentChatResponse {
  reply: string;
}

export interface DownloadErrorBody {
  error?: string;
  code?: string;
  ingestion?: IngestionRecord;
}

export interface SaveSettingsResult {
  settings: AppSettings;
  restartRequired: boolean;
  restartReasons: string[];
}

export interface RematchIngestionResult {
  matched: boolean;
  ingestion: IngestionRecord;
}

export class ApiError extends Error {
  constructor(message: string, public readonly status: number) {
    super(message);
  }
}

export class ApiConnectionError extends Error {
  constructor(message: string) {
    super(message);
  }
}

export async function getAuthStatus() {
  return getJson<AuthStatus>("/api/auth/status");
}

export async function initializeAdmin(username: string, password: string) {
  return postJson<AuthLoginResult>("/api/auth/setup", { username, password });
}

export async function login(username: string, password: string) {
  return postJson<AuthLoginResult>("/api/auth/login", { username, password });
}

export async function logout() {
  return postJson<{ ok: boolean }>("/api/auth/logout");
}

export async function changePassword(currentPassword: string, newPassword: string) {
  return requestJson<{ ok: boolean }>("/api/auth/password", {
    method: "PATCH",
    body: { currentPassword, newPassword }
  });
}

export async function logoutAllDevices() {
  return requestJson<{ ok: boolean }>("/api/auth/sessions", { method: "DELETE" });
}

export async function getUsers() {
  return getJson<UserAccount[]>("/api/users");
}

export async function createUser(username: string, password: string, role: UserAccount["role"] = "member") {
  return postJson<UserAccount>("/api/users", { username, password, role });
}

export async function syncUserNavidrome(id: string, navidromeUsername: string, password: string) {
  return postJson<UserAccount>(`/api/users/${encodeURIComponent(id)}/navidrome`, { navidromeUsername, password });
}

export async function getHealth() {
  return getJson<RuntimeStatus>("/api/health");
}

export async function getJobs() {
  return getJson<DownloadJob[]>("/api/jobs");
}

export async function getIngestions() {
  return getJson<IngestionRecord[]>("/api/ingestions");
}

export async function getSettings() {
  return getJson<AppSettings>("/api/settings");
}

export async function getDiagnostics() {
  return getJson<DiagnosticsReport>("/api/diagnostics");
}

export async function getNavidromeSongs(query: string) {
  return getJson<NavidromeSongsResult>(`/api/navidrome/songs?q=${encodeURIComponent(query)}`);
}

export async function deleteNavidromeSong(id: string) {
  return requestJson<{ ok: boolean }>(`/api/navidrome/songs/${encodeURIComponent(id)}`, { method: "DELETE" });
}

export async function getPlaylists() {
  return getJson<Playlist[]>("/api/playlists");
}

export async function createPlaylist(name?: string, songId?: string) {
  return postJson<Playlist>("/api/playlists", { name, songId });
}

export async function updatePlaylist(id: string, body: { name?: string; color?: string }) {
  return requestJson<Playlist>(`/api/playlists/${encodeURIComponent(id)}`, {
    method: "PATCH",
    body
  });
}

export async function deletePlaylist(id: string) {
  return requestJson<Playlist[]>(`/api/playlists/${encodeURIComponent(id)}`, { method: "DELETE" });
}

export async function addPlaylistItem(id: string, songId: string) {
  return postJson<Playlist>(`/api/playlists/${encodeURIComponent(id)}/items`, { songId });
}

export async function removePlaylistItem(id: string, itemId: string) {
  return requestJson<Playlist>(`/api/playlists/${encodeURIComponent(id)}/items/${encodeURIComponent(itemId)}`, { method: "DELETE" });
}

export async function markPlaylistPlayed(id: string) {
  return postJson<Playlist>(`/api/playlists/${encodeURIComponent(id)}/play`);
}

export async function chatWithAgent(messages: AgentChatMessage[]) {
  return postJson<AgentChatResponse>("/api/agent/chat", { messages });
}

export async function createDownload(url: string) {
  const response = await fetch("/api/download", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ url })
  });
  const body = await response.json() as DownloadJob & DownloadErrorBody;
  return { ok: response.ok, body };
}

export async function cancelDownloadJob(id: string) {
  return postJson<DownloadJob>(`/api/jobs/${encodeURIComponent(id)}/cancel`);
}

export async function retryDownloadJob(id: string) {
  return postJson<DownloadJob>(`/api/jobs/${encodeURIComponent(id)}/retry`);
}

export async function clearDownloadJobs() {
  return requestJson<DownloadJob[]>("/api/jobs", { method: "DELETE" });
}

export async function deleteDownloadJob(id: string) {
  return requestJson<DownloadJob[]>(`/api/jobs/${encodeURIComponent(id)}`, { method: "DELETE" });
}

export async function rematchIngestion(id: string) {
  return postJson<RematchIngestionResult>("/api/ingestions/rematch", { id });
}

export async function saveSettings(settings: AppSettings) {
  return requestJson<SaveSettingsResult>("/api/settings", {
    method: "PATCH",
    body: settings
  });
}

export async function saveBilibiliCookie(content: string) {
  return postJson<BilibiliCookieSaveResult>("/api/cookies/bilibili", { content });
}

export async function getBilibiliCookieStatus() {
  return getJson<CookieFileStatus>("/api/cookies/bilibili");
}

export async function clearBilibiliCookie() {
  return requestJson<CookieFileStatus>("/api/cookies/bilibili", { method: "DELETE" });
}

async function getJson<T>(url: string) {
  return requestJson<T>(url);
}

async function postJson<T>(url: string, body?: unknown) {
  return requestJson<T>(url, { method: "POST", body });
}

async function requestJson<T>(url: string, options: { method?: string; body?: unknown } = {}) {
  let response: Response;
  try {
    response = await fetch(url, {
      method: options.method || "GET",
      headers: options.body === undefined ? undefined : { "content-type": "application/json" },
      body: options.body === undefined ? undefined : JSON.stringify(options.body)
    });
  } catch {
    throw new ApiConnectionError("无法连接 MYusic API。请先启动完整服务，或确认 dev:web 已代理到 http://127.0.0.1:8787。");
  }

  const contentType = response.headers.get("content-type") || "";
  if (!contentType.includes("application/json")) {
    const text = await response.text();
    const isFrontendFallback = text.trimStart().startsWith("<!doctype html") || text.trimStart().startsWith("<html");
    throw new ApiError(
      isFrontendFallback
        ? "当前页面没有连到 MYusic API。开发模式请同时启动后端，正式使用请打开 http://127.0.0.1:8787。"
        : `MYusic API 返回了非 JSON 响应：${response.status}`,
      response.status
    );
  }

  const body = await response.json() as T & { error?: string };
  if (!response.ok) throw new ApiError(body.error || `Request failed: ${response.status}`, response.status);
  return body;
}
