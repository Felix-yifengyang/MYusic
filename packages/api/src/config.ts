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
  webDir: string;
}

export function loadApiConfig(configPath: string): ApiConfig {
  const raw = fs.readFileSync(configPath, "utf8").replace(/^\uFEFF/, "");
  const parsed = JSON.parse(raw) as Partial<ApiConfig>;
  const rootDir = path.resolve(__dirname, "..", "..", "..");

  const databaseUrl = process.env.DATABASE_URL || parsed.database?.url || "";

  return {
    configPath,
    host: parsed.host || "0.0.0.0",
    port: Number(parsed.port || 8787),
    musicDir: parsed.musicDir || path.join(rootDir, "music"),
    ytdlpPath: parsed.ytdlpPath || "yt-dlp",
    audioFormat: parsed.audioFormat || "mp3",
    audioQuality: String(parsed.audioQuality ?? "0"),
    ffmpegPath: parsed.ffmpegPath || "",
    cookies: parsed.cookies || {},
    navidrome: parsed.navidrome || {},
    maxJobs: Number(parsed.maxJobs || 50),
    jobStorePath: parsed.jobStorePath || path.join(rootDir, "data", "jobs.json"),
    ingestionStorePath: parsed.ingestionStorePath || path.join(rootDir, "data", "ingestions.json"),
    database: {
      driver: normalizeStorageDriver(process.env.PERSONAL_MUSIC_STORAGE || parsed.database?.driver || (databaseUrl ? "postgres" : "json")),
      url: databaseUrl || undefined
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
    webDir: config.webDir
  };

  fs.writeFileSync(config.configPath, JSON.stringify(value, null, 2) + "\n", "utf8");
}

function normalizeStorageDriver(value: string): StorageDriver {
  return value === "postgres" ? "postgres" : "json";
}
