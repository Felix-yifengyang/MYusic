import fs from "node:fs";
import path from "node:path";

export interface ApiConfig {
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
  webDir: string;
}

export function loadApiConfig(configPath: string): ApiConfig {
  const raw = fs.readFileSync(configPath, "utf8").replace(/^\uFEFF/, "");
  const parsed = JSON.parse(raw) as Partial<ApiConfig>;
  const rootDir = path.resolve(__dirname, "..", "..", "..");

  return {
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
    webDir: parsed.webDir || path.join(rootDir, "apps", "web", "dist")
  };
}
