import fs from "node:fs";
import path from "node:path";
import type { AppSettings, SettingsSaveResult } from "@personal-music/shared";
import type { ApiConfig } from "./config";
import { saveApiConfig } from "./config";

export function getSettings(config: ApiConfig): AppSettings {
  return {
    musicDir: config.musicDir,
    ytdlpPath: config.ytdlpPath,
    ffmpegPath: config.ffmpegPath,
    audioFormat: config.audioFormat,
    audioQuality: config.audioQuality,
    bilibiliCookiesPath: config.cookies.bilibili || "",
    navidromeBaseUrl: config.navidrome.baseUrl || "http://127.0.0.1:4533",
    navidromeUsername: config.navidrome.username || "",
    navidromePassword: config.navidrome.password || "",
    maxJobs: config.maxJobs
  };
}

export function updateSettings(config: ApiConfig, input: Partial<AppSettings>): SettingsSaveResult {
  const before = getSettings(config);
  const restartReasons: string[] = [];

  if (typeof input.musicDir === "string") {
    const next = normalizePath(input.musicDir);
    if (next && next !== config.musicDir) {
      config.musicDir = next;
      fs.mkdirSync(config.musicDir, { recursive: true });
      restartReasons.push("Navidrome needs a restart to scan the new music directory.");
    }
  }

  if (typeof input.ytdlpPath === "string") {
    config.ytdlpPath = input.ytdlpPath.trim() || "yt-dlp";
  }

  if (typeof input.ffmpegPath === "string") {
    const next = input.ffmpegPath.trim();
    if (next !== config.ffmpegPath) {
      config.ffmpegPath = next;
      restartReasons.push("Navidrome needs a restart to use the new ffmpeg path.");
    }
  }

  if (typeof input.audioFormat === "string") {
    config.audioFormat = normalizeAudioFormat(input.audioFormat);
  }

  if (typeof input.audioQuality === "string") {
    config.audioQuality = input.audioQuality.trim() || "0";
  }

  if (typeof input.bilibiliCookiesPath === "string") {
    config.cookies = {
      ...config.cookies,
      bilibili: normalizePath(input.bilibiliCookiesPath)
    };
  }

  if (typeof input.navidromeBaseUrl === "string") {
    config.navidrome = {
      ...config.navidrome,
      baseUrl: input.navidromeBaseUrl.trim() || "http://127.0.0.1:4533"
    };
  }

  if (typeof input.navidromeUsername === "string") {
    config.navidrome = {
      ...config.navidrome,
      username: input.navidromeUsername.trim()
    };
  }

  if (typeof input.navidromePassword === "string") {
    config.navidrome = {
      ...config.navidrome,
      password: input.navidromePassword
    };
  }

  if (typeof input.maxJobs === "number" && Number.isFinite(input.maxJobs)) {
    config.maxJobs = Math.max(1, Math.min(500, Math.floor(input.maxJobs)));
  }

  saveApiConfig(config);

  return {
    settings: getSettings(config),
    restartRequired: restartReasons.length > 0,
    restartReasons: dedupeRestartReasons(before, getSettings(config), restartReasons)
  };
}

function normalizePath(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return "";
  return path.resolve(trimmed);
}

function normalizeAudioFormat(value: string) {
  const allowed = new Set(["mp3", "m4a", "opus", "flac", "wav"]);
  const normalized = value.trim().toLowerCase();
  return allowed.has(normalized) ? normalized : "mp3";
}

function dedupeRestartReasons(_before: AppSettings, _after: AppSettings, reasons: string[]) {
  return Array.from(new Set(reasons));
}
