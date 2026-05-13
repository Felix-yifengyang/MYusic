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
  const config: ApiRuntimeConfig = {
    host: "0.0.0.0",
    port: 8787,
    musicDir: paths.libraryDir,
    ytdlpPath: fs.existsSync(paths.ytdlpExePath) ? paths.ytdlpExePath : "yt-dlp",
    audioFormat: "mp3",
    audioQuality: "0",
    maxJobs: 50,
    jobStorePath: path.join(paths.dataRootDir, "collector", "jobs.json"),
    ffmpegPath: fs.existsSync(paths.ffmpegExePath) ? paths.ffmpegExePath : "",
    webDir: paths.webDistDir,
    cookies: {
      bilibili: paths.bilibiliCookiesPath
    },
    navidrome: {
      baseUrl: "http://127.0.0.1:4533",
      username: "",
      password: ""
    }
  };

  fs.writeFileSync(paths.apiConfigPath, JSON.stringify(config, null, 2) + "\n", "utf8");
  return config;
}
