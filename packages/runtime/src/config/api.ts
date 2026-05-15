import fs from "node:fs";
import path from "node:path";
import type { RuntimePaths } from "../paths";

export interface ApiRuntimeConfig {
  host: string;
  port: number;
  musicDir: string;
  ytdlpPath: string;
  audioFormat: string;
  audioQuality: string;
  maxJobs: number;
  jobStorePath: string;
  ingestionStorePath: string;
  database: {
    driver: "json" | "postgres";
    url?: string;
  };
  auth: {
    enabled: boolean;
    cookieName: string;
    sessionDays: number;
    secureCookie: boolean;
  };
  ffmpegPath: string;
  webDir: string;
  cookies: {
    bilibili: string;
  };
  navidrome: {
    baseUrl: string;
    username: string;
    password: string;
  };
}

export function writeApiConfig(paths: RuntimePaths): ApiRuntimeConfig {
  const existing = readExistingConfig(paths.apiConfigPath);
  const databaseUrl = process.env.DATABASE_URL || existing.database?.url || "";
  const apiPort = readNumberEnv("PERSONAL_MUSIC_API_PORT", existing.port || 8787);
  const navidromePort = readNumberEnv("PERSONAL_MUSIC_NAVIDROME_PORT", 4533);
  const storageDriver = normalizeStorageDriver(process.env.PERSONAL_MUSIC_STORAGE || existing.database?.driver || (databaseUrl ? "postgres" : "json"));
  const navidromeUrl =
    process.env.PERSONAL_MUSIC_NAVIDROME_URL ||
    existing.navidrome?.baseUrl ||
    `http://127.0.0.1:${navidromePort}`;
  const config: ApiRuntimeConfig = {
    host: process.env.PERSONAL_MUSIC_API_HOST || existing.host || "0.0.0.0",
    port: apiPort,
    musicDir: process.env.PERSONAL_MUSIC_LIBRARY_DIR || existing.musicDir || paths.libraryDir,
    ytdlpPath: process.env.PERSONAL_MUSIC_YTDLP_PATH || existing.ytdlpPath || (fs.existsSync(paths.ytdlpExePath) ? paths.ytdlpExePath : "yt-dlp"),
    audioFormat: process.env.PERSONAL_MUSIC_AUDIO_FORMAT || existing.audioFormat || "mp3",
    audioQuality: String(process.env.PERSONAL_MUSIC_AUDIO_QUALITY ?? existing.audioQuality ?? "0"),
    maxJobs: readNumberEnv("PERSONAL_MUSIC_MAX_JOBS", Number(existing.maxJobs || 50)),
    jobStorePath: path.join(paths.dataRootDir, "collector", "jobs.json"),
    ingestionStorePath: path.join(paths.dataRootDir, "collector", "ingestions.json"),
    database: {
      driver: storageDriver,
      url: databaseUrl || undefined
    },
    auth: {
      enabled: readBooleanEnv("PERSONAL_MUSIC_AUTH_ENABLED", storageDriver === "postgres"),
      cookieName: process.env.PERSONAL_MUSIC_AUTH_COOKIE || existing.auth?.cookieName || "personal_music_session",
      sessionDays: readNumberEnv("PERSONAL_MUSIC_AUTH_SESSION_DAYS", Number(existing.auth?.sessionDays || 30)),
      secureCookie: readBooleanEnv("PERSONAL_MUSIC_AUTH_SECURE_COOKIE", Boolean(existing.auth?.secureCookie))
    },
    ffmpegPath: process.env.PERSONAL_MUSIC_FFMPEG_PATH || existing.ffmpegPath || (fs.existsSync(paths.ffmpegExePath) ? paths.ffmpegExePath : ""),
    webDir: paths.webDistDir,
    cookies: {
      bilibili: process.env.PERSONAL_MUSIC_BILIBILI_COOKIES || existing.cookies?.bilibili || paths.bilibiliCookiesPath
    },
    navidrome: {
      baseUrl: navidromeUrl,
      username: process.env.PERSONAL_MUSIC_NAVIDROME_USER || existing.navidrome?.username || "",
      password: process.env.PERSONAL_MUSIC_NAVIDROME_PASSWORD || existing.navidrome?.password || ""
    }
  };

  fs.mkdirSync(config.musicDir, { recursive: true });
  fs.writeFileSync(paths.apiConfigPath, JSON.stringify(config, null, 2) + "\n", "utf8");
  return config;
}

function normalizeStorageDriver(value: string | undefined) {
  return value === "postgres" ? "postgres" : "json";
}

function readNumberEnv(name: string, fallback: number) {
  const value = process.env[name];
  if (!value) return fallback;

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function readBooleanEnv(name: string, fallback: boolean) {
  const value = process.env[name];
  if (value === undefined) return fallback;
  return ["1", "true", "yes", "on"].includes(value.trim().toLowerCase());
}

function readExistingConfig(configPath: string): Partial<ApiRuntimeConfig> {
  if (!fs.existsSync(configPath)) {
    return {};
  }

  try {
    return JSON.parse(fs.readFileSync(configPath, "utf8").replace(/^\uFEFF/, "")) as Partial<ApiRuntimeConfig>;
  } catch {
    return {};
  }
}
