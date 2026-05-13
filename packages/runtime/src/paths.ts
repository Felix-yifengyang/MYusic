import fs from "node:fs";
import path from "node:path";

export interface RuntimePaths {
  rootDir: string;
  dataRootDir: string;
  configDir: string;
  apiConfigPath: string;
  apiCliPath: string;
  webDistDir: string;
  navidromeDir: string;
  navidromeExePath: string;
  navidromeConfigPath: string;
  libraryDir: string;
  cookiesDir: string;
  bilibiliCookiesPath: string;
  binDir: string;
  ytdlpExePath: string;
  ffmpegExePath: string;
}

export function resolveRuntimePaths(rootDir = resolveRootDir(), dataRootDir = resolveDataRootDir(rootDir)): RuntimePaths {
  const configDir = path.join(dataRootDir, "config");
  const navidromeDir = path.join(rootDir, "services", "navidrome");
  const libraryDir = path.join(dataRootDir, "library");
  const cookiesDir = path.join(dataRootDir, "cookies");
  const binDir = path.join(rootDir, "bin");

  return {
    rootDir,
    dataRootDir,
    configDir,
    apiConfigPath: path.join(configDir, "api.json"),
    apiCliPath: path.join(rootDir, "packages", "api", "dist", "cli.js"),
    webDistDir: path.join(rootDir, "apps", "web", "dist"),
    navidromeDir,
    navidromeExePath: path.join(navidromeDir, process.platform === "win32" ? "navidrome.exe" : "navidrome"),
    navidromeConfigPath: path.join(dataRootDir, "navidrome", "navidrome.toml"),
    libraryDir,
    cookiesDir,
    bilibiliCookiesPath: path.join(cookiesDir, "bilibili.txt"),
    binDir,
    ytdlpExePath: path.join(binDir, process.platform === "win32" ? "yt-dlp.exe" : "yt-dlp"),
    ffmpegExePath: path.join(binDir, process.platform === "win32" ? "ffmpeg.exe" : "ffmpeg")
  };
}

export function ensureRuntimeFolders(paths: RuntimePaths) {
  fs.mkdirSync(paths.configDir, { recursive: true });
  fs.mkdirSync(path.dirname(paths.navidromeConfigPath), { recursive: true });
  fs.mkdirSync(path.join(paths.dataRootDir, "navidrome", "data"), { recursive: true });
  fs.mkdirSync(paths.libraryDir, { recursive: true });
  fs.mkdirSync(paths.cookiesDir, { recursive: true });
}

function resolveRootDir() {
  const candidate = path.resolve(__dirname, "..", "..", "..");
  if (fs.existsSync(path.join(candidate, "packages", "runtime"))) {
    return candidate;
  }

  return path.resolve(process.cwd());
}

function resolveDataRootDir(rootDir: string) {
  if (process.env.PERSONAL_MUSIC_DATA_DIR) {
    return process.env.PERSONAL_MUSIC_DATA_DIR;
  }

  return path.resolve(rootDir, "..", "personal-music-stack-data");
}
