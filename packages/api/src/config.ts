import fs from "node:fs";
import path from "node:path";

export type StorageDriver = "json" | "postgres";

export interface ApiConfig {
  configPath: string;
  host: string;
  port: number;
  musicDir: string;
  ytdlpPath: string;
  audioFormat: string;
  audioQuality: string;
  ffmpegPath: string;
  cookies: {
    bilibili?: string;
  };
  navidrome: {
    baseUrl?: string;
    username?: string;
    password?: string;
  };
  maxJobs: number;
  jobStorePath: string;
  ingestionStorePath: string;
  database: {
    driver: StorageDriver;
    url?: string;
  };
  auth: {
    enabled: boolean;
    cookieName: string;
    sessionDays: number;
    secureCookie: boolean;
  };
  webDir: string;
}

export function loadApiConfig(configPath: string): ApiConfig {
  const raw = fs.readFileSync(configPath, "utf8").replace(/^\uFEFF/, "");
  const parsed = JSON.parse(raw) as Partial<ApiConfig>;
  const rootDir = path.resolve(__dirname, "..", "..", "..");

  const databaseUrl = process.env.DATABASE_URL || parsed.database?.url || "";
  const storageDriver = normalizeStorageDriver(process.env.PERSONAL_MUSIC_STORAGE || parsed.database?.driver || (databaseUrl ? "postgres" : "json"));

  return {
    configPath,
    host: process.env.PERSONAL_MUSIC_API_HOST || parsed.host || "0.0.0.0",
    port: readNumberEnv("PERSONAL_MUSIC_API_PORT", Number(parsed.port || 8787)),
    musicDir: process.env.PERSONAL_MUSIC_LIBRARY_DIR || parsed.musicDir || path.join(rootDir, "music"),
    ytdlpPath: process.env.PERSONAL_MUSIC_YTDLP_PATH || parsed.ytdlpPath || "yt-dlp",
    audioFormat: process.env.PERSONAL_MUSIC_AUDIO_FORMAT || parsed.audioFormat || "mp3",
    audioQuality: String(process.env.PERSONAL_MUSIC_AUDIO_QUALITY ?? parsed.audioQuality ?? "0"),
    ffmpegPath: process.env.PERSONAL_MUSIC_FFMPEG_PATH || parsed.ffmpegPath || "",
    cookies: {
      ...parsed.cookies,
      bilibili: process.env.PERSONAL_MUSIC_BILIBILI_COOKIES || parsed.cookies?.bilibili
    },
    navidrome: {
      ...parsed.navidrome,
      baseUrl: process.env.PERSONAL_MUSIC_NAVIDROME_URL || parsed.navidrome?.baseUrl,
      username: process.env.PERSONAL_MUSIC_NAVIDROME_USER || parsed.navidrome?.username,
      password: process.env.PERSONAL_MUSIC_NAVIDROME_PASSWORD || parsed.navidrome?.password
    },
    maxJobs: readNumberEnv("PERSONAL_MUSIC_MAX_JOBS", Number(parsed.maxJobs || 50)),
    jobStorePath: parsed.jobStorePath || path.join(rootDir, "data", "jobs.json"),
    ingestionStorePath: parsed.ingestionStorePath || path.join(rootDir, "data", "ingestions.json"),
    database: {
      driver: storageDriver,
      url: databaseUrl || undefined
    },
    auth: {
      enabled: readBooleanEnv("PERSONAL_MUSIC_AUTH_ENABLED", storageDriver === "postgres"),
      cookieName: process.env.PERSONAL_MUSIC_AUTH_COOKIE || parsed.auth?.cookieName || "personal_music_session",
      sessionDays: readNumberEnv("PERSONAL_MUSIC_AUTH_SESSION_DAYS", Number(parsed.auth?.sessionDays || 30)),
      secureCookie: readBooleanEnv("PERSONAL_MUSIC_AUTH_SECURE_COOKIE", Boolean(parsed.auth?.secureCookie))
    },
    webDir: parsed.webDir || path.join(rootDir, "apps", "web", "dist")
  };
}

export function saveApiConfig(config: ApiConfig) {
  const value = {
    host: config.host,
    port: config.port,
    musicDir: config.musicDir,
    ytdlpPath: config.ytdlpPath,
    audioFormat: config.audioFormat,
    audioQuality: config.audioQuality,
    ffmpegPath: config.ffmpegPath,
    cookies: config.cookies,
    navidrome: config.navidrome,
    maxJobs: config.maxJobs,
    jobStorePath: config.jobStorePath,
    ingestionStorePath: config.ingestionStorePath,
    database: config.database,
    auth: config.auth,
    webDir: config.webDir
  };

  fs.writeFileSync(config.configPath, JSON.stringify(value, null, 2) + "\n", "utf8");
}

function normalizeStorageDriver(value: string): StorageDriver {
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
