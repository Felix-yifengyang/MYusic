import fs from "node:fs";
import path from "node:path";
import type { RuntimePaths } from "../paths";

export function writeNavidromeConfig(paths: RuntimePaths, ffmpegPath: string) {
  const dataDir = path.join(paths.dataRootDir, "navidrome", "data");
  const lines = [
    `MusicFolder = "${tomlString(paths.libraryDir)}"`,
    `DataFolder = "${tomlString(dataDir)}"`,
    ffmpegPath ? `FFmpegPath = "${tomlString(ffmpegPath)}"` : "",
    'Address = "0.0.0.0"',
    'Port = "4533"',
    ""
  ].filter(Boolean);

  fs.writeFileSync(paths.navidromeConfigPath, lines.join("\n"), "utf8");
}

function tomlString(value: string) {
  return String(value).replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}
