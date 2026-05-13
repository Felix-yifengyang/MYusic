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
  const config: ApiRuntimeConfig = {
    host: "0.0.0.0",
    port: 8787,
    musicDir: existing.musicDir || paths.libraryDir,
    ytdlpPath: existing.ytdlpPath || (fs.existsSync(paths.ytdlpExePath) ? paths.ytdlpExePath : "yt-dlp"),
    audioFormat: existing.audioFormat || "mp3",
    audioQuality: String(existing.audioQuality ?? "0"),
    maxJobs: Number(existing.maxJobs || 50),
    jobStorePath: path.join(paths.dataRootDir, "collector", "jobs.json"),
    ffmpegPath: existing.ffmpegPath || (fs.existsSync(paths.ffmpegExePath) ? paths.ffmpegExePath : ""),
    webDir: paths.webDistDir,
    cookies: {
      bilibili: existing.cookies?.bilibili || paths.bilibiliCookiesPath
    },
    navidrome: {
      baseUrl: existing.navidrome?.baseUrl || "http://127.0.0.1:4533",
      username: existing.navidrome?.username || "",
      password: existing.navidrome?.password || ""
    }
  };

  fs.mkdirSync(config.musicDir, { recursive: true });
  fs.writeFileSync(paths.apiConfigPath, JSON.stringify(config, null, 2) + "\n", "utf8");
  return config;
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
