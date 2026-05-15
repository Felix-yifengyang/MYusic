import fs from "node:fs";
import path from "node:path";
import type { RuntimePaths } from "../paths";

export interface NavidromeRuntimeConfig {
  host: string;
  port: number;
}

export function writeNavidromeConfig(paths: RuntimePaths, ffmpegPath: string, musicDir = paths.libraryDir): NavidromeRuntimeConfig {
  const dataDir = path.join(paths.dataRootDir, "navidrome", "data");
  const host = process.env.PERSONAL_MUSIC_NAVIDROME_HOST || "0.0.0.0";
  const port = readNumberEnv("PERSONAL_MUSIC_NAVIDROME_PORT", 4533);
  const lines = [
    `MusicFolder = "${tomlString(musicDir)}"`,
    `DataFolder = "${tomlString(dataDir)}"`,
    ffmpegPath ? `FFmpegPath = "${tomlString(ffmpegPath)}"` : "",
    `Address = "${tomlString(host)}"`,
    `Port = "${port}"`,
    ""
  ].filter(Boolean);

  fs.writeFileSync(paths.navidromeConfigPath, lines.join("\n"), "utf8");
  return { host, port };
}

function tomlString(value: string) {
  return String(value).replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

function readNumberEnv(name: string, fallback: number) {
  const value = process.env[name];
  if (!value) return fallback;

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}
