import type {
  AppSettings,
  BilibiliCookieSaveResult,
  DiagnosticsReport,
  DownloadJob,
  IngestionRecord,
  NavidromeSongsResult,
  RuntimeStatus
} from "@personal-music/shared";

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

async function getJson<T>(url: string) {
  return requestJson<T>(url);
}

async function postJson<T>(url: string, body?: unknown) {
  return requestJson<T>(url, { method: "POST", body });
}

async function requestJson<T>(url: string, options: { method?: string; body?: unknown } = {}) {
  const response = await fetch(url, {
    method: options.method || "GET",
    headers: options.body === undefined ? undefined : { "content-type": "application/json" },
    body: options.body === undefined ? undefined : JSON.stringify(options.body)
  });
  const body = await response.json() as T & { error?: string };
  if (!response.ok) throw new Error(body.error || `Request failed: ${response.status}`);
  return body;
}
